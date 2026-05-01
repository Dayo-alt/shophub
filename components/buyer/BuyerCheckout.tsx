import { useState } from 'react';
import { PaymentMethodSelector } from '../payment/PaymentMethodSelector';
import { ArrowLeft, Lock, ShieldCheck, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { User } from '../../App';
import { supabase } from '../../utils/supabase/client';
import { projectId } from '../../utils/supabase/info';

interface BuyerCheckoutProps {
  cart: any[];
  user: User;
  accessToken: string;
  onBack: () => void;
  onOrderComplete: () => void;
}

interface ShippingForm {
  name: string;
  email: string;
  address: string;
  city: string;
  zipCode: string;
  country: string;
}

function validateShipping(f: ShippingForm): string | null {
  if (!f.name.trim())    return 'Full name is required.';
  if (!f.email.trim() || !/\S+@\S+\.\S+/.test(f.email)) return 'A valid email is required.';
  if (!f.address.trim()) return 'Street address is required.';
  if (!f.city.trim())    return 'City is required.';
  if (!f.country.trim()) return 'Country is required.';
  return null;
}

export function BuyerCheckout({ cart, user, accessToken, onBack, onOrderComplete }: BuyerCheckoutProps) {
  const [form, setForm] = useState<ShippingForm>({
    name:    user.name,
    email:   user.email,
    address: '',
    city:    '',
    zipCode: '',
    country: '',
  });

  const [formError,  setFormError]  = useState('');
  const [orderError, setOrderError] = useState('');
  const [placing,    setPlacing]    = useState(false);
  const [shippingDone, setShippingDone] = useState(false);

  const subtotal = cart.reduce((sum: number, item: any) => sum + item.product.price * item.quantity, 0);
  // Shipping in NGN: free over ₦5000 otherwise ₦1500
  const shipping  = subtotal >= 5000 ? 0 : 1500;
  const tax       = Math.round(subtotal * 0.075);      // 7.5% VAT (Nigerian standard)
  const total     = subtotal + shipping + tax;

  const set = (field: keyof ShippingForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    setFormError('');
  };

  const handleConfirmShipping = () => {
    const err = validateShipping(form);
    if (err) { setFormError(err); return; }
    setShippingDone(true);
  };

  const createOrder = async (paymentReference: string) => {
    setOrderError('');
    setPlacing(true);

    try {
      const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const trackingNumber = `TRK${Date.now().toString(36).slice(-5).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
      const items = cart.map((item: any) => ({
        productId:    item.product.id,
        productName:  item.product.name,
        productImage: item.product.image,
        quantity:     item.quantity,
        price:        item.product.price,
        sellerId:     item.product.sellerId,
      }));

      // Compute per-seller earnings (80%) and platform fee (20%)
      const platformFee = parseFloat((total * 0.20).toFixed(2));
      const sellerEarnings: Record<string, number> = {};
      for (const item of items) {
        if (!item.sellerId) continue;
        const itemTotal = item.price * item.quantity;
        sellerEarnings[item.sellerId] = parseFloat(
          ((sellerEarnings[item.sellerId] || 0) + itemTotal * 0.80).toFixed(2)
        );
      }

      const { error } = await supabase.from('orders').insert({
        id:                orderId,
        buyer_id:          user.id,
        buyer_email:       form.email,
        items,
        total:             parseFloat(total.toFixed(2)),
        status:            'processing',
        payment_status:    'completed',
        payment_reference: paymentReference,
        payment_method:    'paystack',
        shipping_info:     form,
        platform_fee:      platformFee,
        seller_earnings:   sellerEarnings,
        tracking_number:   trackingNumber,
        status_history:    [{ status: 'processing', timestamp: new Date().toISOString(), note: 'Order placed and payment confirmed.' }],
      });

      if (error) throw new Error(error.message);

      // Fire-and-forget: send buyer confirmation + seller notification emails
      fetch(`https://${projectId}.supabase.co/functions/v1/server/notify-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ orderId }),
      }).catch(() => { /* non-fatal */ });

      localStorage.removeItem('cart');
      onOrderComplete();
    } catch (err) {
      console.error('Order creation failed:', err);
      setOrderError(err instanceof Error ? err.message : 'Failed to place order. Please contact support.');
      setPlacing(false);
    }
  };

  const fmt = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;

  return (
    <div className="min-h-screen bg-gray-50 p-4 animate-fade-in">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6">

          {/* ── Header ── */}
          <div className="flex items-center mb-6 gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
              <ArrowLeft className="size-4" /> Back to Cart
            </Button>
            <h1 className="text-xl font-bold text-gray-900 flex-1">Checkout</h1>
            <div className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-100 rounded-full px-3 py-1">
              <ShieldCheck className="size-3.5" />
              Secure checkout
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* ── Left: shipping → payment ── */}
            <div className="space-y-6 animate-slide-left">

              {/* Shipping form */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Lock className="size-4 text-blue-600" />
                  <h2 className="text-gray-900 text-base font-semibold">
                    1. Shipping Information
                  </h2>
                  {shippingDone && (
                    <span className="ml-auto text-xs text-green-700 bg-green-50 border border-green-100 rounded-full px-2 py-0.5">
                      ✓ Confirmed
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input id="name" value={form.name} onChange={set('name')} placeholder="John Doe" disabled={shippingDone} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email *</Label>
                      <Input id="email" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" disabled={shippingDone} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="address">Street Address *</Label>
                    <Input id="address" value={form.address} onChange={set('address')} placeholder="123 Main Street" disabled={shippingDone} />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="city">City *</Label>
                      <Input id="city" value={form.city} onChange={set('city')} placeholder="Lagos" disabled={shippingDone} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="zipCode">ZIP / Postal</Label>
                      <Input id="zipCode" value={form.zipCode} onChange={set('zipCode')} placeholder="100001" disabled={shippingDone} />
                    </div>
                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <Label htmlFor="country">Country *</Label>
                      <Input id="country" value={form.country} onChange={set('country')} placeholder="Nigeria" disabled={shippingDone} />
                    </div>
                  </div>
                </div>

                {/* Inline form error */}
                {formError && (
                  <div className="mt-3 flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    {formError}
                  </div>
                )}

                {!shippingDone && (
                  <Button onClick={handleConfirmShipping} className="mt-4 w-full sm:w-auto">
                    Confirm shipping details →
                  </Button>
                )}
                {shippingDone && (
                  <button
                    type="button"
                    onClick={() => setShippingDone(false)}
                    className="mt-3 text-xs text-blue-600 hover:underline"
                  >
                    Edit shipping
                  </button>
                )}
              </Card>

              {/* Payment — only shown after shipping is confirmed */}
              {shippingDone && (
                <Card className="p-6 animate-fade-in-up">
                  <div className="flex items-center gap-2 mb-5">
                    <Lock className="size-4 text-blue-600" />
                    <h2 className="text-gray-900 text-base font-semibold">2. Payment</h2>
                  </div>

                  {orderError && (
                    <div className="mb-4 flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                      <AlertCircle className="size-4 shrink-0 mt-0.5" />
                      {orderError}
                    </div>
                  )}

                  {placing ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-600">
                      <div className="loading scale-50 -my-4">
                        <span /><span /><span /><span /><span />
                      </div>
                      Confirming your order…
                    </div>
                  ) : (
                    <PaymentMethodSelector
                      amount={total}
                      email={form.email}
                      onPaymentSuccess={(reference) => {
                        createOrder(reference);
                      }}
                      onPaymentCancel={() => {
                        setOrderError('Payment cancelled. You can try again when ready.');
                      }}
                      onError={(err) => {
                        setOrderError(err);
                      }}
                    />
                  )}
                </Card>
              )}
            </div>

            {/* ── Right: order summary ── */}
            <div className="animate-slide-right" style={{ animationDelay: '0.1s' }}>
              <Card className="p-6 sticky top-20">
                <h2 className="text-gray-900 text-base font-semibold mb-4">Order Summary</h2>

                {/* Items */}
                <div className="space-y-3 mb-4 max-h-56 overflow-y-auto pr-1">
                  {cart.map((item: any) => (
                    <div key={item.product.id} className="flex items-center gap-3 text-sm">
                      {item.product.image && (
                        <img
                          src={(item.product.image || '').split(',')[0]?.trim()}
                          alt={item.product.name}
                          className="w-12 h-12 rounded-md object-cover bg-gray-100 shrink-0"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 font-medium truncate">{item.product.name}</p>
                        <p className="text-gray-500 text-xs">Qty: {item.quantity}</p>
                      </div>
                      <span className="text-gray-900 shrink-0">{fmt(item.product.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="border-t pt-3 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span><span>{fmt(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span>{shipping === 0 ? <span className="text-green-600 font-medium">FREE</span> : fmt(shipping)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>VAT (7.5%)</span><span>{fmt(tax)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold text-base">
                    <span className="text-gray-900">Total</span>
                    <span className="text-gray-900">{fmt(total)}</span>
                  </div>
                </div>

                {shipping > 0 && (
                  <p className="mt-3 text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                    Add {fmt(5000 - subtotal)} more to get free shipping!
                  </p>
                )}

                <p className="mt-4 text-center text-[11px] text-gray-400">
                  {shippingDone
                    ? 'Click "Pay with Paystack" to complete your order.'
                    : 'Confirm your shipping details first, then pay.'}
                </p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
