import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.ts';

const app = new Hono();

app.use('*', cors({
  origin: (origin) => {
    // Allow all origins — API is protected by JWT auth
    return origin || '*';
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-cron-secret', 'x-client-info', 'apikey'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400,
}));

// Handle OPTIONS preflight requests
app.options('*', (c) => {
  return c.text('', 200);
});
app.use('*', logger(console.log));

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Sign up route
app.post('/signup', async (c) => {
  try {
    const { email, password, name, role } = await c.req.json();

    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role: role || 'buyer' },
      email_confirm: true, // Auto-confirm since email server is not configured
    });

    if (authError) {
      console.log(`Signup error: ${authError.message}`);
      return c.json({ error: authError.message }, 400);
    }

    // Store user profile in KV store
    await kv.set(`user:${authData.user.id}`, {
      id: authData.user.id,
      email,
      name,
      role: role || 'buyer',
      createdAt: new Date().toISOString(),
    });

    return c.json({ 
      message: 'User created successfully',
      user: {
        id: authData.user.id,
        email,
        name,
        role: role || 'buyer',
      }
    });
  } catch (error) {
    console.log(`Signup error: ${error}`);
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

// Get user profile
app.get('/profile', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const profile = await kv.get(`user:${user.id}`);
    if (!profile) {
      // Create profile from user metadata if not exists
      const userProfile = {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || '',
        role: user.user_metadata?.role || 'buyer',
        createdAt: user.created_at,
      };
      await kv.set(`user:${user.id}`, userProfile);
      return c.json({ user: userProfile });
    }

    return c.json({ user: profile });
  } catch (error) {
    console.log(`Profile fetch error: ${error}`);
    return c.json({ error: 'Failed to fetch profile' }, 500);
  }
});

// CORS preflight for seller balance
app.options('/seller/balance', (c) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  return c.body(null, 204);
});

// Get seller earnings balance (from commission splits)
app.get('/seller/balance', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const sellerKey = `seller:balance:${user.id}`;
    const balance = (await kv.get(sellerKey)) || { total: 0 };

    return c.json({ total: balance.total || 0 });
  } catch (error) {
    console.log(`Seller balance fetch error: ${error}`);
    return c.json({ error: 'Failed to fetch seller balance' }, 500);
  }
});

// CORS preflight for seller withdraw
app.options('/seller/withdraw', (c) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  return c.body(null, 204);
});

// Record a seller withdrawal (deduct from ledger balance)
app.post('/seller/withdraw', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const amount = Number(body.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return c.json({ error: 'Invalid amount' }, 400);
    }

    const sellerKey = `seller:balance:${user.id}`;
    const balance = (await kv.get(sellerKey)) || { total: 0 };
    const currentTotal = Number(balance.total || 0);

    if (amount > currentTotal) {
      return c.json({ error: 'Amount exceeds available balance' }, 400);
    }

    const nextTotal = currentTotal - amount;
    await kv.set(sellerKey, {
      total: nextTotal,
      updatedAt: new Date().toISOString(),
    });

    return c.json({ total: nextTotal });
  } catch (error) {
    console.log(`Seller withdraw error: ${error}`);
    return c.json({ error: 'Failed to record withdrawal' }, 500);
  }
});

// Get all products
app.get('/products', async (c) => {
  try {
    const products = await kv.getByPrefix('product:');
    return c.json({ products: products || [] });
  } catch (error) {
    console.log(`Products fetch error: ${error}`);
    return c.json({ error: 'Failed to fetch products' }, 500);
  }
});

// Create product (seller only)
app.post('/products', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const profile = await kv.get(`user:${user.id}`);
    if (profile.role !== 'seller') {
      return c.json({ error: 'Only sellers can create products' }, 403);
    }

    const productData = await c.req.json();
    const productId = `product:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const product = {
      ...productData,
      id: productId,
      sellerId: user.id,
      sellerName: profile.name,
      createdAt: new Date().toISOString(),
    };

    await kv.set(productId, product);

    return c.json({ product });
  } catch (error) {
    console.log(`Product creation error: ${error}`);
    return c.json({ error: 'Failed to create product' }, 500);
  }
});

// Update product (seller only)
app.put('/products/:id', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const profile = await kv.get(`user:${user.id}`);
    if (profile.role !== 'seller') {
      return c.json({ error: 'Only sellers can update products' }, 403);
    }

    const productId = c.req.param('id');
    const existingProduct = await kv.get(productId);
    
    if (!existingProduct) {
      return c.json({ error: 'Product not found' }, 404);
    }

    if (existingProduct.sellerId !== user.id) {
      return c.json({ error: 'You can only update your own products' }, 403);
    }

    const updates = await c.req.json();
    const updatedProduct = {
      ...existingProduct,
      ...updates,
      id: productId,
      sellerId: user.id,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(productId, updatedProduct);

    return c.json({ product: updatedProduct });
  } catch (error) {
    console.log(`Product update error: ${error}`);
    return c.json({ error: 'Failed to update product' }, 500);
  }
});

// Delete product (seller only)
app.delete('/products/:id', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const profile = await kv.get(`user:${user.id}`);
    if (profile.role !== 'seller') {
      return c.json({ error: 'Only sellers can delete products' }, 403);
    }

    const productId = c.req.param('id');
    const existingProduct = await kv.get(productId);
    
    if (!existingProduct) {
      return c.json({ error: 'Product not found' }, 404);
    }

    if (existingProduct.sellerId !== user.id) {
      return c.json({ error: 'You can only delete your own products' }, 403);
    }

    await kv.del(productId);

    return c.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.log(`Product deletion error: ${error}`);
    return c.json({ error: 'Failed to delete product' }, 500);
  }
});

// ── Email helper ─────────────────────────────────────────────────────────────
async function sendSellerOrderEmail(
  sellerEmail: string,
  sellerName: string,
  order: any,
  sellerItems: any[],
  sellerEarnings: number,
) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) return; // gracefully skip if not configured

  const itemsHtml = sellerItems
    .map(
      (item: any) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;">${item.productName}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;text-align:center;">${item.quantity}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">₦${(item.price * item.quantity).toLocaleString('en-NG')}</td>
      </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:sans-serif;">
<div style="max-width:600px;margin:32px auto;padding:0 16px;">
  <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:linear-gradient(135deg,#1d4ed8,#2563eb);padding:28px 32px;">
      <h1 style="margin:0;color:white;font-size:22px;font-weight:700;">🛍️ New Order Received!</h1>
      <p style="margin:6px 0 0;color:#bfdbfe;font-size:14px;">Hi ${sellerName}, someone just placed an order on ShopHub.</p>
    </div>

    <div style="padding:28px 32px;">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <p style="margin:0;font-size:12px;color:#15803d;text-transform:uppercase;letter-spacing:.05em;">Your Earnings (80%)</p>
          <p style="margin:4px 0 0;font-size:26px;font-weight:700;color:#166534;">₦${sellerEarnings.toLocaleString('en-NG')}</p>
        </div>
        <div style="text-align:right;">
          <p style="margin:0;font-size:12px;color:#15803d;">Order ID</p>
          <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#166534;">#${order.id.slice(-10)}</p>
        </div>
      </div>

      <h3 style="margin:0 0 12px;font-size:15px;color:#0f172a;">Customer Details</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr><td style="padding:4px 0;color:#64748b;font-size:13px;width:120px;">Name</td><td style="padding:4px 0;color:#1e293b;font-size:13px;font-weight:500;">${order.shippingInfo?.name || ''}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Email</td><td style="padding:4px 0;color:#1e293b;font-size:13px;">${order.shippingInfo?.email || order.buyerEmail}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Address</td><td style="padding:4px 0;color:#1e293b;font-size:13px;">${order.shippingInfo?.address || ''}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">City</td><td style="padding:4px 0;color:#1e293b;font-size:13px;">${order.shippingInfo?.city || ''}${order.shippingInfo?.zipCode ? ', ' + order.shippingInfo.zipCode : ''}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Country</td><td style="padding:4px 0;color:#1e293b;font-size:13px;">${order.shippingInfo?.country || ''}</td></tr>
      </table>

      <h3 style="margin:0 0 12px;font-size:15px;color:#0f172a;">Items You Need to Ship</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px 8px;text-align:left;color:#64748b;font-weight:600;text-transform:uppercase;font-size:11px;">Product</th>
            <th style="padding:10px 8px;text-align:center;color:#64748b;font-weight:600;text-transform:uppercase;font-size:11px;">Qty</th>
            <th style="padding:10px 8px;text-align:right;color:#64748b;font-weight:600;text-transform:uppercase;font-size:11px;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#64748b;"><strong style="color:#1e293b;">Payment:</strong> Paystack — ${order.paymentReference || 'N/A'}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#64748b;"><strong style="color:#1e293b;">Order Date:</strong> ${new Date(order.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</p>
      </div>

      <div style="background:#eff6ff;border-radius:8px;padding:16px;text-align:center;">
        <p style="margin:0;font-size:14px;color:#1d4ed8;font-weight:500;">Log in to your ShopHub seller dashboard to update the order status.</p>
      </div>
    </div>

    <div style="padding:16px 32px;border-top:1px solid #f1f5f9;text-align:center;">
      <p style="margin:0;font-size:11px;color:#94a3b8;">© ShopHub · This email was sent to ${sellerEmail}</p>
    </div>
  </div>
</div>
</body></html>`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ShopHub Orders <orders@resend.dev>',
        to: [sellerEmail],
        subject: `New order #${order.id.slice(-8)} — You earned ₦${sellerEarnings.toLocaleString('en-NG')}`,
        html,
      }),
    });
  } catch (e) {
    console.log('Seller email send error:', e);
  }
}

// ── Buyer confirmation email ──────────────────────────────────────────────────
async function sendBuyerConfirmationEmail(buyerEmail: string, order: any) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) return;

  const itemsHtml = (order.items || [])
    .map((item: any) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;">${item.productName}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;text-align:center;">${item.quantity}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">₦${(item.price * item.quantity).toLocaleString('en-NG')}</td>
      </tr>`)
    .join('');

  const shipping = order.shippingInfo || order.shipping_info || {};
  const total = (order.total || 0).toLocaleString('en-NG');
  const orderId = (order.id || '').slice(-10).toUpperCase();

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:sans-serif;">
<div style="max-width:600px;margin:32px auto;padding:0 16px;">
  <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:linear-gradient(135deg,#16a34a,#15803d);padding:28px 32px;">
      <h1 style="margin:0;color:white;font-size:22px;font-weight:700;">✅ Order Confirmed!</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Thank you for your purchase on ShopHub</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#374151;font-size:15px;">Hi ${shipping.name || 'there'},</p>
      <p style="color:#6b7280;font-size:14px;">Your order <strong>#${orderId}</strong> has been confirmed and the seller is preparing it for shipment.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0;font-size:13px;color:#166534;font-weight:600;">Order ID: #${orderId}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#166534;">Payment: ₦${total} — Confirmed</p>
      </div>
      <h3 style="font-size:15px;color:#111827;margin:20px 0 10px;">Items Ordered</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead><tr style="background:#f9fafb;">
          <th style="padding:8px;text-align:left;color:#6b7280;font-weight:600;">Item</th>
          <th style="padding:8px;text-align:center;color:#6b7280;font-weight:600;">Qty</th>
          <th style="padding:8px;text-align:right;color:#6b7280;font-weight:600;">Price</th>
        </tr></thead>
        <tbody>${itemsHtml}</tbody>
        <tfoot><tr>
          <td colspan="2" style="padding:12px 8px;font-weight:700;color:#111827;">Total</td>
          <td style="padding:12px 8px;text-align:right;font-weight:700;color:#16a34a;font-size:16px;">₦${total}</td>
        </tr></tfoot>
      </table>
      <h3 style="font-size:15px;color:#111827;margin:20px 0 8px;">Shipping To</h3>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0;">
        ${shipping.name || ''}<br/>
        ${shipping.address || ''}<br/>
        ${shipping.city || ''}${shipping.zipCode ? ', ' + shipping.zipCode : ''}<br/>
        ${shipping.country || ''}
      </p>
      <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;text-align:center;">
        You'll receive another email when your order is shipped. — ShopHub Team
      </p>
    </div>
  </div>
</div></body></html>`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'ShopHub <orders@resend.dev>',
        to: [buyerEmail],
        subject: `✅ Order Confirmed — #${orderId}`,
        html,
      }),
    });
  } catch (e) {
    console.log('Buyer email error:', e);
  }
}

// ── Notify order (buyer confirmation + seller notifications) ──────────────────
app.post('/notify-order', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { orderId } = await c.req.json();
    if (!orderId) return c.json({ error: 'orderId required' }, 400);

    // Fetch order from Supabase
    const { data: order, error: oErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (oErr || !order) return c.json({ error: 'Order not found' }, 404);

    // Send buyer confirmation
    if (order.buyer_email) {
      await sendBuyerConfirmationEmail(order.buyer_email, {
        ...order,
        shippingInfo: order.shipping_info,
      });
    }

    // Send seller notifications
    const sellerEarnings: Record<string, number> = order.seller_earnings || {};
    const sellerIds = Object.keys(sellerEarnings);

    for (const sellerId of sellerIds) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, name')
          .eq('id', sellerId)
          .maybeSingle();

        if (!profile?.email) continue;

        const sellerItems = (order.items || []).filter((i: any) =>
          (i.sellerId || i.seller_id) === sellerId
        );

        await sendSellerOrderEmail(
          profile.email,
          profile.name || 'Seller',
          { ...order, shippingInfo: order.shipping_info },
          sellerItems,
          sellerEarnings[sellerId] || 0,
        );
      } catch (e) {
        console.log('Seller notify error:', e);
      }
    }

    return c.json({ ok: true });
  } catch (e) {
    console.log('notify-order error:', e);
    return c.json({ error: 'Failed to send notifications' }, 500);
  }
});

// ── Complaint notification (buyer → seller + admin) ───────────────────────────
app.post('/complaint-notify', async (c) => {
  try {
    const { complaintId } = await c.req.json();
    if (!complaintId) return c.json({ error: 'complaintId required' }, 400);

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const ADMIN_EMAIL    = Deno.env.get('ADMIN_EMAIL') || 'admin@shophub.com';
    if (!RESEND_API_KEY) return c.json({ ok: true }); // non-fatal

    const { data: complaint } = await supabase
      .from('complaints')
      .select('*')
      .eq('id', complaintId)
      .maybeSingle();

    if (!complaint) return c.json({ error: 'Complaint not found' }, 404);

    const sendEmail = async (to: string, subject: string, bodyHtml: string) => {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'ShopHub <orders@resend.dev>', to: [to], subject, html: bodyHtml }),
      }).catch(() => {});
    };

    const htmlBody = (recipient: string) => `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#dc2626;">⚠️ Order Complaint Filed</h2>
        <p><strong>Recipient:</strong> ${recipient}</p>
        <p><strong>Order ID:</strong> ${complaint.order_id}</p>
        <p><strong>Buyer Email:</strong> ${complaint.buyer_email}</p>
        <p><strong>Subject:</strong> ${complaint.subject}</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0;color:#7f1d1d;white-space:pre-wrap;">${complaint.message}</p>
        </div>
        <p style="color:#6b7280;font-size:12px;">Filed on ${new Date(complaint.created_at).toLocaleString()}</p>
      </div>`;

    // Notify seller
    if (complaint.seller_id) {
      const { data: sellerProfile } = await supabase
        .from('profiles').select('email').eq('id', complaint.seller_id).maybeSingle();
      if (sellerProfile?.email) {
        await sendEmail(sellerProfile.email, `Complaint on Order #${complaint.order_id?.slice(-8)}`, htmlBody('Seller'));
      }
    }
    // Notify admin
    await sendEmail(ADMIN_EMAIL, `[Admin] Complaint on Order #${complaint.order_id?.slice(-8)} from ${complaint.buyer_email}`, htmlBody('Admin'));

    return c.json({ ok: true });
  } catch (e) {
    console.log('complaint-notify error:', e);
    return c.json({ error: 'Failed to send complaint notifications' }, 500);
  }
});

// Create order
app.post('/orders', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const orderData = await c.req.json();
    const orderId = `order:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const commissionRate = 0.2; // 20% platform commission
    const sellerEarnings: Record<string, number> = {};
    let platformFeeTotal = 0;

    for (const item of orderData.items) {
      const itemTotal = (item.price || 0) * (item.quantity || 0);
      const platformFee = Math.round(itemTotal * commissionRate);
      const sellerShare = itemTotal - platformFee;

      platformFeeTotal += platformFee;

      if (item.sellerId) {
        sellerEarnings[item.sellerId] =
          (sellerEarnings[item.sellerId] || 0) + sellerShare;
      }
    }

    const order = {
      ...orderData,
      id: orderId,
      buyerId: user.id,
      buyerEmail: user.email,
      status: 'paid',
      paymentStatus: 'completed',
      paymentReference: orderData.paymentReference || null,
      paymentMethod: orderData.paymentMethod || 'paystack',
      createdAt: new Date().toISOString(),
      commissionRate,
      platformFeeTotal,
      sellerEarnings,
      total: orderData.total || 0,
    };

    await kv.set(orderId, order);

    // Persist to Supabase orders table for admin dashboard visibility
    try {
      await supabase.from('orders').insert({
        id: orderId,
        buyer_id: user.id,
        buyer_email: user.email,
        items: orderData.items,
        total: order.total,
        status: order.status,
        payment_reference: order.paymentReference,
        payment_method: order.paymentMethod,
        shipping_info: order.shippingInfo,
        platform_fee: platformFeeTotal,
        seller_earnings: sellerEarnings,
        created_at: order.createdAt,
      });
    } catch (e) {
      // Table may not exist yet — non-fatal
      console.log('Supabase orders insert skipped:', e);
    }

    // Update product stock
    for (const item of orderData.items) {
      const product = await kv.get(item.productId);
      if (product) {
        await kv.set(item.productId, {
          ...product,
          stock: product.stock - item.quantity,
        });
      }
    }

    // Update admin revenue balance
    const adminKey = 'admin:revenue';
    const existingAdmin = (await kv.get(adminKey)) || { total: 0 };
    await kv.set(adminKey, {
      total: (existingAdmin.total || 0) + platformFeeTotal,
      updatedAt: new Date().toISOString(),
    });

    // Update each seller's balance
    for (const [sellerId, amount] of Object.entries(sellerEarnings)) {
      const sellerKey = `seller:balance:${sellerId}`;
      const existingSeller = (await kv.get(sellerKey)) || { total: 0 };
      await kv.set(sellerKey, {
        total: (existingSeller.total || 0) + amount,
        updatedAt: new Date().toISOString(),
      });
    }

    // Group items by seller and send email notifications
    const itemsBySeller: Record<string, any[]> = {};
    for (const item of orderData.items) {
      if (item.sellerId) {
        if (!itemsBySeller[item.sellerId]) itemsBySeller[item.sellerId] = [];
        itemsBySeller[item.sellerId].push(item);
      }
    }

    for (const [sellerId, sellerItems] of Object.entries(itemsBySeller)) {
      try {
        const sellerProfile = await kv.get(`user:${sellerId}`);
        if (sellerProfile?.email) {
          await sendSellerOrderEmail(
            sellerProfile.email,
            sellerProfile.name || 'Seller',
            order,
            sellerItems,
            sellerEarnings[sellerId] || 0,
          );
        }
      } catch (e) {
        console.log('Failed to send seller email for', sellerId, e);
      }
    }

    return c.json({ order });
  } catch (error) {
    console.log(`Order creation error: ${error}`);
    return c.json({ error: 'Failed to create order' }, 500);
  }
});

// Get buyer's orders
app.get('/orders/buyer', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const allOrders = await kv.getByPrefix('order:');
    const buyerOrders = allOrders.filter(order => order.buyerId === user.id);

    return c.json({ orders: buyerOrders });
  } catch (error) {
    console.log(`Orders fetch error: ${error}`);
    return c.json({ error: 'Failed to fetch orders' }, 500);
  }
});

// Get seller's orders
app.get('/orders/seller', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const profile = await kv.get(`user:${user.id}`);
    if (profile.role !== 'seller') {
      return c.json({ error: 'Only sellers can view this' }, 403);
    }

    const allOrders = await kv.getByPrefix('order:');
    const sellerOrders = allOrders.filter(order => 
      order.items.some(item => item.sellerId === user.id)
    );

    return c.json({ orders: sellerOrders });
  } catch (error) {
    console.log(`Seller orders fetch error: ${error}`);
    return c.json({ error: 'Failed to fetch orders' }, 500);
  }
});

// Update order status (seller only)
app.put('/orders/:id/status', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const profile = await kv.get(`user:${user.id}`);
    if (profile.role !== 'seller') {
      return c.json({ error: 'Only sellers can update order status' }, 403);
    }

    const orderId = c.req.param('id');
    const { status } = await c.req.json();

    const order = await kv.get(orderId);
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    const updatedOrder = {
      ...order,
      status,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(orderId, updatedOrder);

    return c.json({ order: updatedOrder });
  } catch (error) {
    console.log(`Order status update error: ${error}`);
    return c.json({ error: 'Failed to update order status' }, 500);
  }
});

// Process payment with Stripe
app.post('/create-payment-intent', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { amount, orderId } = await c.req.json();

    // Get Stripe secret key from environment
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return c.json({ error: 'Payment processing not configured' }, 500);
    }

    // Create Stripe payment intent
    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: Math.round(amount * 100).toString(), // Convert to cents
        currency: 'usd',
        'metadata[orderId]': orderId,
        'metadata[userId]': user.id,
      }),
    });

    const paymentIntent = await response.json();

    if (!response.ok) {
      console.log(`Stripe error: ${JSON.stringify(paymentIntent)}`);
      return c.json({ error: 'Failed to create payment intent' }, 500);
    }

    return c.json({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.log(`Payment intent creation error: ${error}`);
    return c.json({ error: 'Failed to create payment intent' }, 500);
  }
});

// Confirm payment
app.post('/confirm-payment', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { orderId, paymentIntentId } = await c.req.json();

    // Update order with payment info
    const order = await kv.get(orderId);
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    const updatedOrder = {
      ...order,
      paymentIntentId,
      paymentStatus: 'completed',
      status: 'processing',
      paidAt: new Date().toISOString(),
    };

    await kv.set(orderId, updatedOrder);

    return c.json({ order: updatedOrder });
  } catch (error) {
    console.log(`Payment confirmation error: ${error}`);
    return c.json({ error: 'Failed to confirm payment' }, 500);
  }
});

// Verify Paystack transaction
app.post('/paystack/verify', async (c) => {
  try {
    const { reference } = await c.req.json();

    if (!reference) {
      return c.json({ error: 'Missing transaction reference' }, 400);
    }

    const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!secret) {
      return c.json({ error: 'Paystack not configured' }, 500);
    }

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${secret}`,
          Accept: 'application/json',
        },
      },
    );

    const data = await response.json();

    if (!response.ok || !data.status || data.data?.status !== 'success') {
      console.log('Paystack verification failed:', JSON.stringify(data));
      return c.json({
        status: 'failed',
        error: 'Verification failed',
        raw: data,
      }, 400);
    }

    return c.json({
      status: 'success',
      reference,
      amount: data.data.amount,
      currency: data.data.currency,
      customer: data.data.customer,
    });
  } catch (error) {
    console.log(`Paystack verification error: ${error}`);
    return c.json({ error: 'Failed to verify Paystack transaction' }, 500);
  }
});

// Get platform revenue and seller balances (admin only)
app.get('/admin/revenue', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Basic admin check: profile role must be admin
    const profile = await kv.get(`user:${user.id}`);
    if (!profile || profile.role !== 'admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const adminKey = 'admin:revenue';
    const adminRevenue = (await kv.get(adminKey)) || { total: 0, updatedAt: null };

    // Aggregate seller balances
    const sellerBalancesRaw = await kv.getByPrefix('seller:balance:');
    const sellers = (sellerBalancesRaw || []).map((entry: any) => ({
      id: entry.id || entry.key || '',
      total: entry.total || 0,
      updatedAt: entry.updatedAt || null,
    }));

    return c.json({
      admin: {
        total: adminRevenue.total || 0,
        updatedAt: adminRevenue.updatedAt || null,
      },
      sellers,
    });
  } catch (error) {
    console.log(`Admin revenue fetch error: ${error}`);
    return c.json({ error: 'Failed to fetch admin revenue' }, 500);
  }
});

// PayStack webhook handler
app.post('/paystack/webhook', async (c) => {
  try {
    const signature = c.req.header('x-paystack-signature');
    if (!signature) {
      return c.json({ error: 'Missing signature' }, 401);
    }

    const body = await c.req.text();
    const hash = require('crypto')
      .createHmac('sha512', Deno.env.get('PAYSTACK_SECRET_KEY') || '')
      .update(body)
      .digest('hex');

    if (hash !== signature) {
      return c.json({ error: 'Invalid signature' }, 401);
    }

    const event = JSON.parse(body);
    console.log('PayStack webhook event:', event);

    if (event.event === 'charge.success') {
      const paymentData = event.data;
      
      // Update order with payment confirmation
      const orders = await kv.getByPrefix('order:');
      const order = orders.find(o => 
        o.paymentReference === paymentData.reference
      );

      if (order) {
        const updatedOrder = {
          ...order,
          paymentStatus: 'completed',
          paidAt: new Date().toISOString(),
          paystackReference: paymentData.reference,
          paystackTransactionId: paymentData.id,
        };
        
        await kv.set(order.id, updatedOrder);
        console.log('Payment confirmed for order:', order.id);
      }
    }

    return c.json({ received: true });
  } catch (error) {
    console.log('PayStack webhook error:', error);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

// Record an admin withdrawal from platform revenue
app.post('/admin/withdraw', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const profile = await kv.get(`user:${user.id}`);
    if (!profile || profile.role !== 'admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const amount = Number(body.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return c.json({ error: 'Invalid amount' }, 400);
    }

    const adminKey = 'admin:revenue';
    const revenue = (await kv.get(adminKey)) || { total: 0 };
    const currentTotal = Number(revenue.total || 0);

    if (amount > currentTotal) {
      return c.json({ error: 'Amount exceeds available balance' }, 400);
    }

    const nextTotal = currentTotal - amount;
    await kv.set(adminKey, {
      total: nextTotal,
      updatedAt: new Date().toISOString(),
    });

    return c.json({ total: nextTotal });
  } catch (error) {
    console.log(`Admin withdraw error: ${error}`);
    return c.json({ error: 'Failed to record admin withdrawal' }, 500);
  }
});

// Get all orders for admin (with full details including Paystack refs)
app.get('/admin/orders', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const profile = await kv.get(`user:${user.id}`);
    if (!profile || profile.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

    const allOrders = await kv.getByPrefix('order:');
    // Sort newest first
    allOrders.sort((a: any, b: any) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    return c.json({ orders: allOrders || [] });
  } catch (error) {
    console.log('Admin orders fetch error:', error);
    return c.json({ error: 'Failed to fetch admin orders' }, 500);
  }
});

// ── Admin Paystack Transfer ────────────────────────────────────────────────────
async function runAdminTransfer(c: any, body?: any): Promise<Response> {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error: authErr } = await supabase.auth.getUser(accessToken);
    if (authErr || !user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

    const parsed = body ?? await c.req.json().catch(() => ({}));
    const { amount, bank_code, account_number, account_name } = parsed;
    if (!amount || !bank_code || !account_number || !account_name) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!PAYSTACK_SECRET) return c.json({ error: 'Paystack secret key not configured on server' }, 500);

    const headers = {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json',
    };

    // Step 1: Create transfer recipient
    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'nuban',
        name: account_name,
        account_number,
        bank_code,
        currency: 'NGN',
      }),
    });
    const recipientData = await recipientRes.json();
    if (!recipientData.status) {
      return c.json({ error: recipientData.message || 'Failed to create transfer recipient' }, 400);
    }
    const recipientCode = recipientData.data.recipient_code;

    // Step 2: Initiate transfer
    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(amount * 100), // kobo
        recipient: recipientCode,
        reason: 'ShopHub platform revenue withdrawal',
      }),
    });
    const transferData = await transferRes.json();
    if (!transferData.status) {
      return c.json({ error: transferData.message || 'Transfer failed' }, 400);
    }

    // Step 3: Record in DB
    await supabase.from('admin_withdrawals').insert({
      amount,
      bank_code,
      account_number,
      account_name,
      paystack_transfer_code: transferData.data?.transfer_code || null,
      paystack_reference: transferData.data?.reference || null,
      status: transferData.data?.status || 'pending',
      recorded_at: new Date().toISOString(),
    });

    return c.json({ ok: true, reference: transferData.data?.reference, status: transferData.data?.status });
  } catch (e) {
    console.log('paystack-transfer error:', e);
    return c.json({ error: 'Internal server error' }, 500);
  }
}

app.post('/admin/paystack-transfer', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return runAdminTransfer(c, body);
});

// ── Cart retention helpers ────────────────────────────────────────────────────

async function sendCartReminderEmail(to: string, subject: string, html: string, fromName: string): Promise<{ ok: boolean; error?: string }> {
  const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
  const BREVO_FROM = Deno.env.get('BREVO_FROM_EMAIL');

  if (BREVO_API_KEY && BREVO_FROM) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { name: fromName, email: BREVO_FROM },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
      });
      if (res.ok) return { ok: true };
      const errBody = await res.text().catch(() => '');
      return { ok: false, error: `Brevo HTTP ${res.status}: ${errBody.slice(0, 200)}` };
    } catch (e) { return { ok: false, error: String(e) }; }
  }

  // Fallback: Resend (requires verified domain to send to others)
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) return { ok: false, error: 'No email provider configured. Add BREVO_API_KEY + BREVO_FROM_EMAIL secrets in Supabase.' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${fromName} <${Deno.env.get('RESEND_FROM_EMAIL') || 'orders@resend.dev'}>`, to: [to], subject, html }),
    });
    if (res.ok) return { ok: true };
    const errBody = await res.text().catch(() => '');
    return { ok: false, error: `Resend HTTP ${res.status}: ${errBody.slice(0, 200)}` };
  } catch (e) { return { ok: false, error: String(e) }; }
}

async function sendCartReminderSms(phone: string, message: string, cfg: any): Promise<{ ok: boolean; error?: string }> {
  const TERMII_KEY = Deno.env.get('TERMII_API_KEY') || cfg.api_key;
  if (!TERMII_KEY) return { ok: false, error: 'SMS not configured — add TERMII_API_KEY to Supabase secrets' };
  if (!phone) return { ok: false, error: 'User has no phone number in profile' };
  try {
    // Normalize phone: strip non-digits, ensure starts with country code
    const to = phone.replace(/[^0-9]/g, '').replace(/^0/, '234');
    const res = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TERMII_KEY,
        to,
        from: Deno.env.get('TERMII_SENDER_ID') || 'ShopHub',
        sms: message,
        type: 'plain',
        channel: 'generic',
      }),
    });
    const body = await res.json().catch(() => ({})) as any;
    if (!res.ok || body?.status === 'error' || body?.code >= 400) {
      return { ok: false, error: `Termii ${res.status}: ${JSON.stringify(body).slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

async function sendCartReminderWhatsapp(phone: string, message: string, cfg: any) {
  if (!cfg.token || !cfg.phone_number_id || !phone) return false;
  try {
    const to = phone.replace(/[^0-9]/g, '');
    const res = await fetch(`https://graph.facebook.com/v18.0/${cfg.phone_number_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: message } }),
    });
    return res.ok;
  } catch (e) { console.log('Cart WhatsApp error:', e); return false; }
}

function fillTpl(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

function cartEmailHtml(name: string, items: any[], total: string, link: string, fromName: string): string {
  const rows = items.map((i: any) =>
    `<tr><td style="padding:8px;border-bottom:1px solid #f1f5f9;">${i.products?.name || 'Product'}</td>
     <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:center;">x${i.quantity}</td></tr>`
  ).join('');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:sans-serif;">
<div style="max-width:600px;margin:32px auto;padding:0 16px;">
  <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:28px 32px;">
      <h1 style="margin:0;color:white;font-size:22px;font-weight:700;">🛒 You left something behind!</h1>
      <p style="margin:6px 0 0;color:#fef3c7;font-size:14px;">Hi ${name}, your cart is still waiting.</p>
    </div>
    <div style="padding:28px 32px;">
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0;font-size:15px;color:#92400e;font-weight:600;">Cart Total: ${total}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
        <thead><tr style="background:#f8fafc;">
          <th style="padding:8px;text-align:left;color:#64748b;font-size:11px;">PRODUCT</th>
          <th style="padding:8px;text-align:center;color:#64748b;font-size:11px;">QTY</th>
        </tr></thead><tbody>${rows}</tbody>
      </table>
      <div style="text-align:center;">
        <a href="${link}" style="display:inline-block;background:#1d4ed8;color:white;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:15px;">Complete Your Purchase</a>
      </div>
    </div>
    <div style="padding:14px 32px;border-top:1px solid #f1f5f9;text-align:center;">
      <p style="margin:0;font-size:11px;color:#94a3b8;">© ${fromName} · You have items saved in your cart.</p>
    </div>
  </div>
</div></body></html>`;
}

async function runCartCheck(c: any, parsedBody?: any): Promise<Response> {
  try {
    const token = (c.req.header('Authorization') || '').replace('Bearer ', '');
    let jwtRole = 'anon';
    try { jwtRole = JSON.parse(atob(token.split('.')[1])).role || 'anon'; } catch { /* ignore */ }
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (cronSecret && jwtRole === 'anon' && c.req.header('x-cron-secret') !== cronSecret) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: cfg, error: cfgErr } = await supabase.from('cart_retention_config').select('*').eq('id', 1).maybeSingle();
    if (cfgErr) return c.json({ error: 'Config read error', detail: cfgErr.message });
    if (!cfg?.enabled) return c.json({ ok: true, message: 'Cart recovery is disabled — toggle it on in the Overview tab.' });

    const intervals: any[] = cfg.intervals || [];
    const channels: any = cfg.channels || {};
    const templates: any = cfg.templates || {};
    const appUrl = Deno.env.get('APP_URL') || 'https://shophub.app';
    const now = new Date();
    let totalSent = 0;
    const debugLog: string[] = [];

    // Check if updated_at column exists
    const { error: colCheck } = await supabase.from('cart_items').select('updated_at').limit(1);
    if (colCheck) {
      return c.json({ error: 'cart_items.updated_at column missing. Run: ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();', detail: colCheck.message });
    }

    const body = parsedBody ?? await c.req.json().catch(() => ({})) as any;
    const forceMode = body?.force === true;

    // Count total carts and show their updated_at values
    const { data: allCarts } = await supabase.from('cart_items').select('user_id, updated_at');
    debugLog.push(`Total cart_items rows: ${allCarts?.length ?? 0}`);
    if (allCarts?.length) {
      const vals = allCarts.map((r: any) => r.updated_at ?? 'NULL').slice(0, 5);
      debugLog.push(`updated_at values (first 5): ${vals.join(' | ')}`);
    }

    const enabledChannels = Object.entries(channels).filter(([, ch]: any) => ch.enabled).map(([k]) => k);
    debugLog.push(`Enabled channels: ${enabledChannels.join(', ') || 'none'}`);
    if (forceMode) debugLog.push('FORCE MODE: ignoring time windows, sending to all carts');

    for (const interval of intervals) {
      if (!interval.enabled) continue;
      const mins = interval.minutes as number;
      const windowEnd = new Date(now.getTime() - mins * 60_000);
      const windowStart = new Date(now.getTime() - (mins + 5) * 60_000);

      let cartRows: any[] | null;
      let cartErr: any;
      if (forceMode) {
        // Force mode: grab all users with cart items, ignore time window
        const res = await supabase.from('cart_items').select('user_id, updated_at');
        cartRows = res.data; cartErr = res.error;
      } else {
        debugLog.push(`[${interval.key}] window: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`);
        const res = await supabase
          .from('cart_items')
          .select('user_id, updated_at')
          .gte('updated_at', windowStart.toISOString())
          .lte('updated_at', windowEnd.toISOString());
        cartRows = res.data; cartErr = res.error;
      }

      if (cartErr) { debugLog.push(`[${interval.key}] query error: ${cartErr.message}`); continue; }
      debugLog.push(`[${interval.key}] carts in window: ${cartRows?.length ?? 0}`);
      if (!cartRows?.length) continue;

      const userMap = new Map<string, string>();
      for (const row of cartRows) {
        const ex = userMap.get(row.user_id);
        if (!ex || row.updated_at > ex) userMap.set(row.user_id, row.updated_at);
      }

      for (const [userId, cartUpdatedAt] of userMap) {
        const { data: profile } = await supabase.from('profiles').select('name, email, phone').eq('id', userId).maybeSingle();
        if (!profile?.email) { debugLog.push(`[${interval.key}] user ${userId}: no email in profile`); continue; }

        const { data: cartItems } = await supabase.from('cart_items').select('quantity, products:product_id(id, name, price)').eq('user_id', userId);
        if (!cartItems?.length) continue;

        const cartTotal = (cartItems as any[]).reduce((s: number, i: any) => s + (i.products?.price || 0) * i.quantity, 0);
        const vars: Record<string, string> = {
          name: String(profile.name || profile.email.split('@')[0] || 'Customer'),
          item_count: String(cartItems.length),
          total: `₦${cartTotal.toLocaleString('en-NG')}`,
          items_list: (cartItems as any[]).map((i: any) => i.products?.name || 'item').join(', '),
          link: `${appUrl}/buyer/cart`,
        };
        const tmpl = templates[interval.key] || {};

        for (const [ch, chCfg] of Object.entries(channels) as [string, any][]) {
          if (!chCfg.enabled) continue;

          const dedupeKey = forceMode ? `force-${now.toISOString()}` : cartUpdatedAt;
          const { data: already } = await supabase.from('cart_reminder_log')
            .select('id').eq('user_id', userId).eq('interval_key', interval.key)
            .eq('channel', ch).eq('cart_updated_at', dedupeKey).maybeSingle();
          if (already) { debugLog.push(`[${interval.key}] already sent ${ch} to ${profile.email}`); continue; }

          let status = 'sent'; let sendError: string | null = null;
          try {
            if (ch === 'email') {
              const html = cartEmailHtml(vars.name, cartItems as any[], vars.total, vars.link, chCfg.from_name || 'ShopHub');
              const result = await sendCartReminderEmail(profile.email, fillTpl(tmpl.subject || 'Your cart is waiting!', vars), html, chCfg.from_name || 'ShopHub');
              if (!result.ok) { status = 'failed'; sendError = result.error || 'email send failed'; }
              else debugLog.push(`[${interval.key}] email sent to ${profile.email}`);
            } else if (ch === 'sms') {
              const result = await sendCartReminderSms(profile.phone || '', fillTpl(tmpl.sms || 'Your cart is waiting! {link}', vars), chCfg);
              if (!result.ok) { status = 'failed'; sendError = result.error || 'SMS send failed'; }
              else debugLog.push(`[${interval.key}] SMS sent to ${profile.phone} (${profile.email})`);
            } else if (ch === 'whatsapp' && profile.phone) {
              const ok = await sendCartReminderWhatsapp(profile.phone, fillTpl(tmpl.whatsapp || 'Your cart is waiting! {link}', vars), chCfg);
              if (!ok) { status = 'failed'; sendError = 'WhatsApp send failed'; }
            } else { continue; }
          } catch (e) { status = 'failed'; sendError = String(e); }

          if (sendError) debugLog.push(`[${interval.key}] ${ch} FAILED for ${profile.email}: ${sendError}`);
          await supabase.from('cart_reminder_log').insert({ user_id: userId, interval_key: interval.key, channel: ch, cart_updated_at: dedupeKey, status, error: sendError });
          if (status === 'sent') totalSent++;
        }
      }
    }
    return c.json({ ok: true, sent: totalSent, debug: debugLog });
  } catch (e) {
    console.log('cart-check error:', e);
    return c.json({ error: 'Internal server error', detail: String(e) }, 500);
  }
}

// Cart check: sub-path route
app.post('/cart-check', async (c) => {
  const body = await c.req.json().catch(() => ({})) as any;
  return runCartCheck(c, body);
});

// Root handler — dispatches by action body
app.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({})) as any;
  if (body?.action === 'cart-check') return runCartCheck(c, body);
  if (body?.action === 'admin-transfer') return runAdminTransfer(c, body);
  return c.json({ ok: true, api: 'ShopHub server' });
});

// Catch-all for any unmatched sub-path
app.all('*', async (c) => {
  if (c.req.method === 'POST') {
    const body = await c.req.json().catch(() => ({})) as any;
    if (body?.action === 'cart-check') return runCartCheck(c, body);
    if (body?.action === 'admin-transfer') return runAdminTransfer(c, body);
  }
  return c.json({ error: 'Not Found', path: c.req.path }, 404);
});

Deno.serve(app.fetch);
