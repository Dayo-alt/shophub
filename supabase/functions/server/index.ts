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

// ── Shared email sender: Brevo first, Resend fallback ────────────────────────
async function sendEmailShopHub(to: string, subject: string, html: string, fromName = 'ShopHub'): Promise<void> {
  const BREVO_KEY  = Deno.env.get('BREVO_API_KEY');
  const BREVO_FROM = Deno.env.get('BREVO_FROM_EMAIL');
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');

  if (BREVO_KEY && BREVO_FROM) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { name: fromName, email: BREVO_FROM },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
      });
      if (res.ok) { console.log(`Email sent via Brevo to ${to}`); return; }
      const err = await res.text().catch(() => '');
      console.log(`Brevo failed (${res.status}): ${err.slice(0, 200)}`);
    } catch (e) { console.log('Brevo error:', e); }
  }

  if (RESEND_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `${fromName} <onboarding@resend.dev>`, to: [to], subject, html }),
      });
      if (res.ok) { console.log(`Email sent via Resend to ${to}`); return; }
      const err = await res.text().catch(() => '');
      console.log(`Resend failed (${res.status}): ${err.slice(0, 200)}`);
    } catch (e) { console.log('Resend error:', e); }
  }

  console.log(`No email provider available — could not send to ${to}`);
}

// ── Email helper ─────────────────────────────────────────────────────────────
async function sendSellerOrderEmail(
  sellerEmail: string,
  sellerName: string,
  order: any,
  sellerItems: any[],
  sellerEarnings: number,
) {

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

  await sendEmailShopHub(
    sellerEmail,
    `New order #${order.id.slice(-8)} — You earned ₦${sellerEarnings.toLocaleString('en-NG')}`,
    html,
    'ShopHub Orders',
  );
}

// ── Buyer confirmation email ──────────────────────────────────────────────────
async function sendBuyerConfirmationEmail(buyerEmail: string, order: any) {

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

  await sendEmailShopHub(buyerEmail, `✅ Order Confirmed — #${orderId}`, html, 'ShopHub');
}

// ── Notify order (buyer confirmation + seller notifications) ──────────────────
async function runNotifyOrder(c: any, body?: any): Promise<Response> {
  try {
    const parsed = body ?? await c.req.json().catch(() => ({})) as any;
    const { orderId } = parsed;
    if (!orderId) return c.json({ error: 'orderId required' }, 400);

    const { data: order, error: oErr } = await supabase
      .from('orders').select('*').eq('id', orderId).maybeSingle();
    if (oErr || !order) return c.json({ error: 'Order not found' }, 404);

    // Always use the buyer's registered email from profiles (not checkout form email)
    let buyerEmail = order.buyer_email;
    if (order.buyer_id) {
      const { data: buyerProfile } = await supabase
        .from('profiles').select('email, name').eq('id', order.buyer_id).maybeSingle();
      if (buyerProfile?.email) buyerEmail = buyerProfile.email;
    }

    // Send buyer confirmation
    if (buyerEmail) {
      await sendBuyerConfirmationEmail(buyerEmail, {
        ...order,
        shippingInfo: order.shipping_info,
      });
    }

    // Send seller notifications
    const sellerEarnings: Record<string, number> = order.seller_earnings || {};
    for (const sellerId of Object.keys(sellerEarnings)) {
      try {
        const { data: profile } = await supabase
          .from('profiles').select('email, name').eq('id', sellerId).maybeSingle();
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
      } catch (e) { console.log('Seller notify error:', e); }
    }

    return c.json({ ok: true });
  } catch (e) {
    console.log('notify-order error:', e);
    return c.json({ error: 'Failed to send notifications' }, 500);
  }
}

app.post('/notify-order', async (c) => runNotifyOrder(c));

// ── Complaint notification (buyer → seller + admin) ───────────────────────────
app.post('/complaint-notify', async (c) => {
  try {
    const { complaintId } = await c.req.json();
    if (!complaintId) return c.json({ error: 'complaintId required' }, 400);

    const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'admin@shophub.com';

    const { data: complaint } = await supabase
      .from('complaints')
      .select('*')
      .eq('id', complaintId)
      .maybeSingle();

    if (!complaint) return c.json({ error: 'Complaint not found' }, 404);

    const sendEmail = async (to: string, subject: string, bodyHtml: string) => {
      await sendEmailShopHub(to, subject, bodyHtml, 'ShopHub Support').catch(() => {});
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

// ── Order shipped email ───────────────────────────────────────────────────────
async function sendOrderShippedEmail(buyerEmail: string, order: any, estimatedDelivery: string) {
  const deliveryLabel = estimatedDelivery
    ? new Date(estimatedDelivery).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Soon';
  const orderId = (order.id || '').slice(-10).toUpperCase();
  const shipping = order.shipping_info || {};

  const itemsHtml = (order.items || []).map((item: any) =>
    `<tr>
      <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${item.productName || item.product_name}</td>
      <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:center;">${item.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;">₦${((item.price || 0) * item.quantity).toLocaleString('en-NG')}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:sans-serif;">
<div style="max-width:600px;margin:32px auto;padding:0 16px;">
  <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:28px 32px;">
      <h1 style="margin:0;color:white;font-size:22px;font-weight:700;">🚚 Your Order is On Its Way!</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Great news — your ShopHub order has been shipped.</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#374151;font-size:15px;">Hi ${shipping.name || 'there'},</p>
      <p style="color:#6b7280;font-size:14px;">Your order <strong>#${orderId}</strong> is packed and on its way to you!</p>

      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
        <p style="margin:0;font-size:12px;color:#7c3aed;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Estimated Delivery</p>
        <p style="margin:8px 0 0;font-size:24px;font-weight:700;color:#5b21b6;">${deliveryLabel}</p>
      </div>

      ${order.tracking_number ? `<div style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:#64748b;">Tracking Number: <strong style="color:#1e293b;font-family:monospace;">${order.tracking_number}</strong></p>
      </div>` : ''}

      <h3 style="font-size:15px;color:#111827;margin:20px 0 10px;">Items Shipped</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead><tr style="background:#f9fafb;">
          <th style="padding:8px;text-align:left;color:#6b7280;font-weight:600;">Item</th>
          <th style="padding:8px;text-align:center;color:#6b7280;font-weight:600;">Qty</th>
          <th style="padding:8px;text-align:right;color:#6b7280;font-weight:600;">Price</th>
        </tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <div style="margin-top:20px;padding:16px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">
        <p style="margin:0;font-size:13px;color:#166534;">Shipping to: <strong>${shipping.name}</strong><br/>
        ${shipping.address}, ${shipping.city}${shipping.zipCode ? ', ' + shipping.zipCode : ''}, ${shipping.country}</p>
      </div>

      <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;text-align:center;">
        Questions? Reply to this email or visit your ShopHub orders page. — ShopHub Team
      </p>
    </div>
  </div>
</div></body></html>`;

  const subject = `🚚 Your order #${orderId} has been shipped — arriving ${deliveryLabel}`;
  await sendEmailShopHub(buyerEmail, subject, html, 'ShopHub');
}

app.post('/notify-shipped', async (c) => {
  const body = await c.req.json().catch(() => ({})) as any;
  return runNotifyShipped(c, body);
});

async function runNotifyShipped(c: any, body?: any): Promise<Response> {
  try {
    const parsed = body ?? await c.req.json().catch(() => ({})) as any;
    const { orderId, estimatedDelivery } = parsed;
    if (!orderId) return c.json({ error: 'orderId required' }, 400);

    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (!order) return c.json({ error: 'Order not found' }, 404);

    // Use registered email from profiles, not checkout form email
    let buyerEmail = order.buyer_email;
    if (order.buyer_id) {
      const { data: buyerProfile } = await supabase
        .from('profiles').select('email').eq('id', order.buyer_id).maybeSingle();
      if (buyerProfile?.email) buyerEmail = buyerProfile.email;
    }
    if (!buyerEmail) return c.json({ error: 'No buyer email on order' }, 400);

    await sendOrderShippedEmail(buyerEmail, order, estimatedDelivery || order.estimated_delivery || '');
    return c.json({ ok: true });
  } catch (e) {
    console.log('notify-shipped error:', e);
    return c.json({ error: 'Internal server error', detail: String(e) }, 500);
  }
}

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
      body: JSON.stringify({ from: `${fromName} <${Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev'}>`, to: [to], subject, html }),
    });
    if (res.ok) return { ok: true };
    const errBody = await res.text().catch(() => '');
    return { ok: false, error: `Resend HTTP ${res.status}: ${errBody.slice(0, 200)}` };
  } catch (e) { return { ok: false, error: String(e) }; }
}

async function sendCartReminderSms(phone: string, message: string, cfg: any): Promise<{ ok: boolean; error?: string }> {
  const accountSid = cfg.account_sid || Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken  = cfg.auth_token  || Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = cfg.from_number || Deno.env.get('TWILIO_FROM_NUMBER');
  if (!accountSid || !authToken || !fromNumber) {
    return { ok: false, error: 'SMS not configured — enter Twilio Account SID, Auth Token and From Number in Channels & Credentials' };
  }
  if (!phone) return { ok: false, error: 'User has no phone number in profile' };
  try {
    // Normalize: strip non-digits, prefix with +234 for Nigeria (replace leading 0)
    const digits = phone.replace(/[^0-9+]/g, '');
    const to = digits.startsWith('+') ? digits : '+' + digits.replace(/^0/, '234');
    // Twilio Messaging Service SID starts with MG — use MessagingServiceSid param; otherwise use From
    const senderParam = fromNumber.startsWith('MG')
      ? { MessagingServiceSid: fromNumber }
      : { From: fromNumber };
    const body = new URLSearchParams({ To: to, Body: message, ...senderParam });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        },
        body: body.toString(),
      }
    );
    const json = await res.json().catch(() => ({})) as any;
    if (!res.ok || json?.status === 'failed' || json?.error_code) {
      return { ok: false, error: `Twilio error ${json?.error_code || res.status}: ${json?.message || json?.error_message || 'Send failed'}` };
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
  const productRows = items.map((i: any) => {
    const p = i.products || {};
    const img = p.image_url
      ? `<img src="${p.image_url}" alt="${p.name || ''}" width="56" height="56" style="width:56px;height:56px;object-fit:cover;border-radius:8px;display:block;border:1px solid #e2e8f0;" />`
      : `<div style="width:56px;height:56px;border-radius:8px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:22px;text-align:center;line-height:56px;">🛍️</div>`;
    const price = p.price ? `₦${Number(p.price).toLocaleString('en-NG')}` : '';
    return `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #f1f5f9;vertical-align:middle;">
        <table cellpadding="0" cellspacing="0" style="width:100%;">
          <tr>
            <td style="width:72px;padding-right:14px;vertical-align:middle;">${img}</td>
            <td style="vertical-align:middle;">
              <p style="margin:0 0 3px;font-size:14px;font-weight:600;color:#1e293b;">${p.name || 'Product'}</p>
              <p style="margin:0;font-size:12px;color:#64748b;">Qty: ${i.quantity} &nbsp;·&nbsp; ${price}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Your cart is waiting — ${fromName}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- Header brand bar -->
      <tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:20px 32px;text-align:center;">
        <p style="margin:0;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">🛍️ ${fromName}</p>
      </td></tr>

      <!-- Hero -->
      <tr><td style="background:linear-gradient(135deg,#f97316 0%,#ea580c 50%,#dc2626 100%);padding:36px 32px 32px;text-align:center;">
        <p style="margin:0 0 8px;font-size:36px;">🛒</p>
        <h1 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#ffffff;line-height:1.2;">You left something behind!</h1>
        <p style="margin:0;font-size:15px;color:#fed7aa;">Hi <strong>${name}</strong>, your cart is patiently waiting for you.</p>
      </td></tr>

      <!-- Urgency strip -->
      <tr><td style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 32px;">
        <p style="margin:0;font-size:13px;color:#92400e;font-weight:600;">⚡ Items in your cart may sell out — complete your order before they're gone!</p>
      </td></tr>

      <!-- Body -->
      <tr><td style="background:#ffffff;padding:28px 32px;">

        <!-- Total pill -->
        <div style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td><p style="margin:0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Cart Total</p></td>
            <td align="right"><p style="margin:0;font-size:22px;font-weight:800;color:#0f172a;">${total}</p></td>
          </tr></table>
        </div>

        <!-- Product list -->
        <p style="margin:0 0 12px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Your Items</p>
        <table width="100%" cellpadding="0" cellspacing="0">${productRows}</table>

        <!-- CTA -->
        <div style="text-align:center;margin-top:28px;">
          <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#f97316,#ea580c);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:50px;font-weight:700;font-size:16px;letter-spacing:0.01em;box-shadow:0 4px 14px rgba(249,115,22,0.4);">
            Complete My Purchase →
          </a>
          <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">Tap the button to go straight to your cart</p>
        </div>
      </td></tr>

      <!-- Trust bar -->
      <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding:0 8px;">
              <p style="margin:0;font-size:18px;">🔒</p>
              <p style="margin:4px 0 0;font-size:11px;color:#64748b;font-weight:600;">Secure Payment</p>
            </td>
            <td align="center" style="padding:0 8px;">
              <p style="margin:0;font-size:18px;">🚚</p>
              <p style="margin:4px 0 0;font-size:11px;color:#64748b;font-weight:600;">Fast Delivery</p>
            </td>
            <td align="center" style="padding:0 8px;">
              <p style="margin:0;font-size:18px;">↩️</p>
              <p style="margin:4px 0 0;font-size:11px;color:#64748b;font-weight:600;">Easy Returns</p>
            </td>
            <td align="center" style="padding:0 8px;">
              <p style="margin:0;font-size:18px;">💬</p>
              <p style="margin:4px 0 0;font-size:11px;color:#64748b;font-weight:600;">24/7 Support</p>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#0f172a;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
        <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;">© ${fromName} — Your favourite online marketplace</p>
        <p style="margin:0;font-size:11px;color:#475569;">You received this because you left items in your cart. <a href="${link}" style="color:#94a3b8;">View cart</a></p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

async function runCartCheck(c: any, parsedBody?: any): Promise<Response> {
  try {
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedSecret = c.req.header('x-cron-secret') || '';
    if (cronSecret && providedSecret && providedSecret !== 'manual-test' && providedSecret !== cronSecret) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: cfg, error: cfgErr } = await supabase.from('cart_retention_config').select('*').eq('id', 1).maybeSingle();
    if (cfgErr) return c.json({ error: 'Config read error', detail: cfgErr.message });
    if (!cfg?.enabled) return c.json({ ok: true, message: 'Cart recovery is disabled — toggle it on in the Overview tab.' });

    const intervals: any[] = cfg.intervals || [];
    const channels: any = cfg.channels || {};
    const templates: any = cfg.templates || {};
    const appUrl = Deno.env.get('APP_URL') || 'https://shophub-alpha-three.vercel.app';
    const now = new Date();
    let totalSent = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    const debugLog: string[] = [];

    const body = parsedBody ?? {};
    const forceMode = body?.force === true;

    // Diagnostic: show raw cart_items data
    const { data: allCarts, error: allCartsErr } = await supabase.from('cart_items').select('user_id, updated_at');
    if (allCartsErr) {
      debugLog.push(`ERROR reading cart_items: ${allCartsErr.message}`);
      return c.json({ ok: false, sent: 0, debug: debugLog });
    }
    debugLog.push(`cart_items rows: ${allCarts?.length ?? 0}${forceMode ? ' (FORCE MODE — all carts will be targeted)' : ''}`);

    const enabledChannelNames = Object.entries(channels).filter(([, ch]: any) => ch.enabled).map(([k]) => k);
    debugLog.push(`Enabled channels: ${enabledChannelNames.join(', ') || 'NONE — enable email in Channels & Credentials tab'}`);
    if (!enabledChannelNames.length) {
      return c.json({ ok: true, sent: 0, message: 'No channels enabled', debug: debugLog });
    }

    // Process each interval
    for (const interval of intervals) {
      if (!interval.enabled) { continue; }
      const mins = interval.minutes as number;

      // Determine which users to target
      let targetUserIds: string[];
      if (forceMode) {
        targetUserIds = [...new Set((allCarts || []).map((r: any) => r.user_id).filter(Boolean))];
      } else {
        const windowEnd = new Date(now.getTime() - mins * 60_000);
        const windowStart = new Date(now.getTime() - (mins + 5) * 60_000);
        const { data: windowRows, error: windowErr } = await supabase
          .from('cart_items').select('user_id, updated_at')
          .gte('updated_at', windowStart.toISOString())
          .lte('updated_at', windowEnd.toISOString());
        if (windowErr) { debugLog.push(`[${interval.key}] window query error: ${windowErr.message}`); continue; }
        if (!windowRows?.length) continue;
        // One user can have multiple cart_items — dedupe
        targetUserIds = [...new Set(windowRows.map((r: any) => r.user_id).filter(Boolean))];
        debugLog.push(`[${interval.key}] ${targetUserIds.length} user(s) in ${windowStart.toISOString().slice(11,19)}–${windowEnd.toISOString().slice(11,19)} window`);
      }

      if (!targetUserIds.length) continue;

      for (const userId of targetUserIds) {
        // ── 1. Resolve user email ──────────────────────────────────────────────
        const { data: profile } = await supabase.from('profiles').select('name, email, phone').eq('id', userId).maybeSingle();
        let userEmail = profile?.email || '';
        if (!userEmail) {
          const { data: authData } = await supabase.auth.admin.getUserById(userId);
          userEmail = authData?.user?.email || '';
        }
        if (!userEmail) {
          debugLog.push(`[${interval.key}] SKIP user ${userId.slice(0,8)}… — no email in profiles or auth.users`);
          totalSkipped++;
          continue;
        }
        const userName = profile?.name || userEmail.split('@')[0] || 'Customer';
        const userPhone = profile?.phone || '';

        // ── 2. Fetch cart items (two-step: no join, avoids FK dependency) ──────
        const { data: rawCartItems, error: cartErr } = await supabase
          .from('cart_items').select('product_id, quantity').eq('user_id', userId);
        if (cartErr) {
          debugLog.push(`[${interval.key}] SKIP ${userEmail} — cart_items error: ${cartErr.message}`);
          totalSkipped++;
          continue;
        }
        if (!rawCartItems?.length) {
          debugLog.push(`[${interval.key}] SKIP ${userEmail} — no cart items found`);
          totalSkipped++;
          continue;
        }

        const productIds = rawCartItems.map((i: any) => i.product_id).filter(Boolean);
        const { data: products } = await supabase
          .from('products').select('id, name, price, image_url').in('id', productIds);
        const productMap = new Map((products || []).map((p: any) => [p.id, p]));

        const enrichedItems = rawCartItems.map((i: any) => ({
          quantity: i.quantity,
          products: productMap.get(i.product_id) || { id: i.product_id, name: 'Product', price: 0, image_url: null },
        }));
        const cartTotal = enrichedItems.reduce((s: number, i: any) => s + (i.products.price || 0) * i.quantity, 0);

        const vars: Record<string, string> = {
          name: userName,
          item_count: String(enrichedItems.length),
          total: `₦${cartTotal.toLocaleString('en-NG')}`,
          items_list: enrichedItems.map((i: any) => i.products.name).join(', '),
          link: `${appUrl}/buyer/cart`,
        };
        const tmpl = templates[interval.key] || {};

        // ── 3. Send per channel ────────────────────────────────────────────────
        for (const [ch, chCfg] of Object.entries(channels) as [string, any][]) {
          if (!chCfg.enabled) continue;

          // Deduplication — use a plain valid timestamp so DB insert works
          const dedupeTs = forceMode ? now.toISOString() : (allCarts?.find((r: any) => r.user_id === userId)?.updated_at || now.toISOString());
          const { data: already } = await supabase.from('cart_reminder_log')
            .select('id').eq('user_id', userId).eq('interval_key', interval.key)
            .eq('channel', ch).eq('cart_updated_at', dedupeTs).maybeSingle();
          if (already) {
            debugLog.push(`[${interval.key}] SKIP ${userEmail} (${ch}) — already sent for this cart snapshot`);
            totalSkipped++;
            continue;
          }

          let status = 'sent';
          let sendError: string | null = null;
          try {
            if (ch === 'email') {
              const html = cartEmailHtml(userName, enrichedItems, vars.total, vars.link, chCfg.from_name || 'ShopHub');
              const result = await sendCartReminderEmail(userEmail, fillTpl(tmpl.subject || 'Your cart is waiting!', vars), html, chCfg.from_name || 'ShopHub');
              if (!result.ok) { status = 'failed'; sendError = result.error || 'unknown email error'; }
              else debugLog.push(`[${interval.key}] ✅ EMAIL → ${userEmail}`);
            } else if (ch === 'sms') {
              const result = await sendCartReminderSms(userPhone, fillTpl(tmpl.sms || 'Your cart is waiting! {link}', vars), chCfg);
              if (!result.ok) { status = 'failed'; sendError = result.error || 'unknown SMS error'; }
              else debugLog.push(`[${interval.key}] ✅ SMS → ${userPhone || '(no phone)'}`);
            } else if (ch === 'whatsapp') {
              if (!userPhone) { continue; }
              const ok = await sendCartReminderWhatsapp(userPhone, fillTpl(tmpl.whatsapp || 'Your cart is waiting! {link}', vars), chCfg);
              if (!ok) { status = 'failed'; sendError = 'WhatsApp send failed'; }
            } else { continue; }
          } catch (e) { status = 'failed'; sendError = String(e); }

          if (sendError) {
            debugLog.push(`[${interval.key}] ❌ ${ch.toUpperCase()} FAILED → ${userEmail}: ${sendError}`);
            totalFailed++;
          }

          // Log send attempt (non-fatal if insert fails)
          try {
            await supabase.from('cart_reminder_log').insert({
              user_id: userId, interval_key: interval.key, channel: ch,
              cart_updated_at: dedupeTs, status, error: sendError,
            });
          } catch (_) { /* non-fatal */ }

          if (status === 'sent') totalSent++;
        }
      }
    }

    debugLog.push(`\nSUMMARY: ${totalSent} sent, ${totalFailed} failed, ${totalSkipped} skipped`);
    return c.json({ ok: true, sent: totalSent, failed: totalFailed, skipped: totalSkipped, debug: debugLog });
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
  if (body?.action === 'test-email') {
    const to = body.to || '';
    if (!to) return c.json({ error: 'to field required' }, 400);
    const result = await sendCartReminderEmail(to, '🧪 ShopHub Cart Recovery Test', `<div style="font-family:sans-serif;padding:32px;max-width:500px;margin:auto;background:#f8fafc;border-radius:12px;"><h2 style="color:#1e293b;">✅ Email Provider Working!</h2><p style="color:#475569;">This is a test email from ShopHub's cart recovery system.</p><p style="color:#475569;">If you received this, emails will be delivered to your customers.</p></div>`, 'ShopHub');
    return c.json({ ok: result.ok, error: result.error, to });
  }
  if (body?.action === 'cart-stats') {
    const { data } = await supabase.from('cart_items').select('user_id');
    const activeCarts = new Set((data || []).map((r: any) => r.user_id)).size;
    return c.json({ activeCarts });
  }
  if (body?.action === 'admin-transfer') return runAdminTransfer(c, body);
  if (body?.action === 'notify-shipped') return runNotifyShipped(c, body);
  if (body?.action === 'notify-order') return runNotifyOrder(c, body);
  return c.json({ ok: true, api: 'ShopHub server' });
});

// Catch-all for any unmatched sub-path
app.all('*', async (c) => {
  if (c.req.method === 'POST') {
    const body = await c.req.json().catch(() => ({})) as any;
    if (body?.action === 'cart-check') return runCartCheck(c, body);
    if (body?.action === 'cart-stats') {
      const { data } = await supabase.from('cart_items').select('user_id');
      const activeCarts = new Set((data || []).map((r: any) => r.user_id)).size;
      return c.json({ activeCarts });
    }
    if (body?.action === 'admin-transfer') return runAdminTransfer(c, body);
    if (body?.action === 'notify-shipped') return runNotifyShipped(c, body);
    if (body?.action === 'notify-order') return runNotifyOrder(c, body);
  }
  return c.json({ error: 'Not Found', path: c.req.path }, 404);
});

Deno.serve(app.fetch);
