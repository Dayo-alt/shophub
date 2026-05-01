import { FC, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { supabase } from '../../utils/supabase/client';
import { Order } from '../../App';

interface BuyerTrackOrderProps {
  accessToken: string;
  onBackToProducts: () => void;
}

export const BuyerTrackOrder: FC<BuyerTrackOrderProps> = ({ accessToken, onBackToProducts }) => {
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [foundOrder, setFoundOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');

  const statusSteps: Array<'pending' | 'processing' | 'shipped' | 'delivered'> = [
    'pending',
    'processing',
    'shipped',
    'delivered',
  ];

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reference.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');
    setFoundOrder(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in.');

      // Search by exact order ID or payment reference
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('buyer_id', user.id)
        .or(`id.eq.${trimmed},payment_reference.eq.${trimmed}`)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setError('No order found with this reference. Check your order ID or payment reference.');
      } else {
        const o = data as any;
        setFoundOrder({
          id: o.id,
          buyerId: o.buyer_id,
          buyerEmail: o.buyer_email,
          items: (o.items || []).map((i: any) => ({
            productId: i.productId || i.product_id,
            productName: i.productName || i.product_name,
            productImage: i.productImage || '',
            quantity: i.quantity,
            price: i.price,
            sellerId: i.sellerId || i.seller_id,
          })),
          total: o.total,
          status: o.status,
          paymentStatus: o.payment_status,
          paymentReference: o.payment_reference,
          paymentMethod: o.payment_method,
          shippingInfo: o.shipping_info || {},
          sellerEarnings: o.seller_earnings || {},
          createdAt: o.created_at,
        } as Order);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong while tracking your order.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'processing':
        return 'default';
      case 'shipped':
        return 'outline';
      case 'delivered':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in-up">
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl font-semibold">Track Order</h1>
        <Button variant="outline" size="sm" onClick={onBackToProducts}>
          Back to products
        </Button>
      </div>

      <form onSubmit={handleTrack} className="max-w-xl space-y-3 mb-6">
        <label className="block text-sm text-gray-700">
          Enter your order reference (you can paste the full ID or part of it):
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. 123e4567 or full order ID"
          />
          <Button type="submit" disabled={!reference.trim() || loading}>
            {loading ? 'Searching…' : 'Track order'}
          </Button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      {foundOrder && (
        <Card className="max-w-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-lg font-semibold text-gray-900">Order {foundOrder.id}</h2>
                <Badge variant={getStatusVariant(foundOrder.status)}>{foundOrder.status}</Badge>
                {foundOrder.paymentStatus === 'completed' && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Paid
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-600">
                Placed on{' '}
                {new Date(foundOrder.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">Total</p>
              <p className="text-gray-900">₦{Math.round(foundOrder.total).toLocaleString('en-NG')}</p>
            </div>
          </div>

          {/* Status timeline */}
          <div className="mb-4 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-gray-600 mb-1">
              <span>Order progress</span>
              <span className="capitalize">{foundOrder.status}</span>
            </div>
            <div className="flex items-center gap-2">
              {statusSteps.map((step, index) => {
                const currentIndex = statusSteps.indexOf(foundOrder.status as any);
                const reached = currentIndex >= index && currentIndex !== -1;
                const isCurrent = currentIndex === index;

                return (
                  <div key={step} className="flex items-center gap-2 flex-1">
                    <div
                      className={`h-2 w-2 rounded-full border ${
                        reached
                          ? 'bg-blue-600 border-blue-600'
                          : 'bg-gray-200 border-gray-300'
                      }`}
                    />
                    <span
                      className={`text-[11px] capitalize ${
                        isCurrent
                          ? 'text-blue-700 font-medium'
                          : reached
                            ? 'text-gray-800'
                            : 'text-gray-400'
                      }`}
                    >
                      {step}
                    </span>
                    {index < statusSteps.length - 1 && (
                      <div className="flex-1 h-px bg-gray-200" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4 mb-4">
            <p className="text-sm text-gray-600 mb-2">Items:</p>
            <div className="space-y-2">
              {foundOrder.items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-900">
                    {item.productName} × {item.quantity}
                  </span>
                  <span className="text-gray-600">
                    ₦{Math.round(item.price * item.quantity).toLocaleString('en-NG')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-600 mb-1">Shipping Address:</p>
            <p className="text-sm text-gray-900">{foundOrder.shippingInfo.name}</p>
            <p className="text-sm text-gray-600">{foundOrder.shippingInfo.address}</p>
            <p className="text-sm text-gray-600">
              {foundOrder.shippingInfo.city}, {foundOrder.shippingInfo.zipCode}
            </p>
            <p className="text-sm text-gray-600">{foundOrder.shippingInfo.country}</p>
          </div>
        </Card>
      )}
    </section>
  );
};
