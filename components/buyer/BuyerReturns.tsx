import { FC, useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { supabase } from '../../utils/supabase/client';
import { useLanguage } from '../../utils/i18n/LanguageContext';
import { Package, RotateCcw, ChevronDown, ChevronUp, Check, AlertCircle } from 'lucide-react';

interface BuyerReturnsProps {
  onBackToProducts: () => void;
}

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  sellerId: string;
}

interface DeliveredOrder {
  id: string;
  buyerEmail: string;
  items: OrderItem[];
  total: number;
  createdAt: string;
  sellerEarnings: Record<string, number>;
}

interface ReturnFormState {
  returnType: 'return' | 'refund';
  reason: string;
  submitting: boolean;
  submitted: boolean;
  error: string;
}

export const BuyerReturns: FC<BuyerReturnsProps> = ({ onBackToProducts }) => {
  const [orders, setOrders] = useState<DeliveredOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, ReturnFormState>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const { formatCurrency, t } = useLanguage();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      setUserEmail(user.email || '');

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('buyer_id', user.id)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false });

      if (error || !data) { setLoading(false); return; }

      const mapped: DeliveredOrder[] = (data as any[]).map(o => ({
        id: o.id,
        buyerEmail: o.buyer_email || user.email || '',
        items: (o.items || []).map((i: any) => ({
          productId:   i.productId   || i.product_id   || '',
          productName: i.productName || i.product_name || 'Product',
          quantity:    i.quantity    || 1,
          price:       i.price       || 0,
          sellerId:    i.sellerId    || i.seller_id    || '',
        })),
        total:          o.total          || 0,
        createdAt:      o.created_at,
        sellerEarnings: o.seller_earnings || {},
      }));
      setOrders(mapped);
      setLoading(false);
    };
    load();
  }, []);

  const initForm = (orderId: string) => {
    if (forms[orderId]) return;
    setForms(prev => ({
      ...prev,
      [orderId]: { returnType: 'return', reason: '', submitting: false, submitted: false, error: '' },
    }));
  };

  const setField = (orderId: string, field: keyof ReturnFormState, value: any) => {
    setForms(prev => ({ ...prev, [orderId]: { ...prev[orderId], [field]: value } }));
  };

  const handleSubmit = async (order: DeliveredOrder) => {
    const form = forms[order.id];
    if (!form || !form.reason.trim() || !userId) return;
    setField(order.id, 'error', '');
    setField(order.id, 'submitting', true);

    // Get primary seller: first item's sellerId, or first key in seller_earnings
    const primarySellerId =
      order.items.find(i => i.sellerId)?.sellerId ||
      Object.keys(order.sellerEarnings)[0] ||
      '';

    const subject = `${form.returnType === 'refund' ? 'Refund' : 'Return'} Request — Order #${order.id.slice(-8).toUpperCase()}`;

    const { error } = await supabase.from('complaints').insert({
      order_id:    order.id,
      buyer_id:    userId,
      buyer_email: userEmail,
      seller_id:   primarySellerId,
      subject,
      message:     form.reason.trim(),
      status:      'open',
    });

    if (error) {
      setField(order.id, 'error', error.message || 'Failed to submit. Please try again.');
      setField(order.id, 'submitting', false);
      return;
    }

    // Also notify seller via messages
    if (primarySellerId) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('messages').insert({
        sender_id:    userId,
        sender_role:  'buyer',
        recipient_id: primarySellerId,
        subject,
        body:         form.reason.trim(),
        is_broadcast: false,
      });
    }

    setField(order.id, 'submitting', false);
    setField(order.id, 'submitted', true);
  };

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in-up">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('returnsRefundsTitle')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('returnsSubtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onBackToProducts}>{t('backToProducts')}</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="loading"><span /><span /><span /><span /><span /></div>
        </div>
      ) : orders.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="size-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">{t('noDeliveredOrdersTitle')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('noDeliveredOrdersText')}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const form = forms[order.id];
            const isExpanded = expandedId === order.id;

            return (
              <Card key={order.id} className="overflow-hidden">
                {/* Order header */}
                <button
                  className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    setExpandedId(isExpanded ? null : order.id);
                    initForm(order.id);
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">
                          Order #{order.id.slice(-8).toUpperCase()}
                        </span>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                          {t('deliveredBadge')}
                        </Badge>
                        {form?.submitted && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                            <Check className="size-2.5 mr-1" /> {t('requestSubmittedBadge')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        {new Date(order.createdAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {' · '}{order.items.length} item{order.items.length !== 1 ? 's' : ''}
                        {' · '}<span className="font-medium text-gray-600">{formatCurrency(order.total)}</span>
                      </p>
                    </div>
                    {isExpanded
                      ? <ChevronUp className="size-4 text-gray-400 shrink-0 mt-1" />
                      : <ChevronDown className="size-4 text-gray-400 shrink-0 mt-1" />}
                  </div>
                </button>

                {isExpanded && form && (
                  <div className="border-t px-5 py-4 space-y-4">
                    {/* Items list */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{t('orderItemsLabel')}</p>
                      {order.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-900 truncate">{item.productName}</p>
                            <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                          </div>
                          <p className="text-gray-600 font-medium ml-4 shrink-0">{formatCurrency(item.price * item.quantity)}</p>
                        </div>
                      ))}
                    </div>

                    {form.submitted ? (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                        <Check className="size-5 text-green-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-green-800">{t('requestSubmittedTitle')}</p>
                          <p className="text-xs text-green-600 mt-0.5">
                            Your {form.returnType} request has been sent to the seller. You'll receive a response in your inbox.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Return type selector */}
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">{t('requestTypeLabel')}</p>
                          <div className="flex gap-2">
                            {(['return', 'refund'] as const).map(type => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => setField(order.id, 'returnType', type)}
                                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                                  form.returnType === type
                                    ? 'bg-gray-900 text-white border-gray-900'
                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                }`}
                              >
                                <RotateCcw className={`size-3.5 inline mr-1.5 ${form.returnType === type ? 'text-white' : 'text-gray-400'}`} />
                                {type === 'return' ? t('returnItemsBtn') : t('requestRefundBtn')}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Reason */}
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest block mb-2">
                            {t('reasonLabel')} <span className="text-red-400 font-normal normal-case tracking-normal">{t('requiredFieldIndicator')}</span>
                          </label>
                          <textarea
                            rows={3}
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-400/30"
                            placeholder={`Describe why you want to ${form.returnType} this order…`}
                            value={form.reason}
                            onChange={e => setField(order.id, 'reason', e.target.value)}
                          />
                        </div>

                        {form.error && (
                          <p className="text-xs text-red-600 flex items-center gap-1.5">
                            <AlertCircle className="size-3.5 shrink-0" /> {form.error}
                          </p>
                        )}

                        <Button
                          className="w-full"
                          disabled={!form.reason.trim() || form.submitting}
                          onClick={() => handleSubmit(order)}
                        >
                          {form.submitting ? t('submittingLabel') : `Submit ${form.returnType === 'refund' ? t('requestRefundBtn') : t('returnItemsBtn')} Request`}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
};
