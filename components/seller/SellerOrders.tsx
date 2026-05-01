import { useState, useEffect } from 'react';
import { Package, Loader2, TrendingUp, DollarSign, ShoppingBag, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { supabase } from '../../utils/supabase/client';
import { useLanguage } from '../../utils/i18n/LanguageContext';

interface SellerOrdersProps {
  accessToken: string;
  sellerId?: string;
  onBack?: () => void;
}

interface StatusHistoryEntry {
  status: string;
  timestamp: string;
  note?: string;
}

function sellerItemsAndEarnings(order: any, userId: string | null) {
  if (!userId) return { items: order.items || [], earnings: 0 };
  const items = (order.items || []).filter((i: any) => i.sellerId === userId);
  const raw = order.sellerEarnings;
  const earnings = raw && typeof raw === 'object' ? (raw[userId] || 0) : 0;
  return { items, earnings };
}

const STATUS_STEPS = ['pending', 'processing', 'shipped', 'delivered'] as const;
type OrderStatus = typeof STATUS_STEPS[number];

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending:    'bg-yellow-100 text-yellow-800 border-yellow-200',
  processing: 'bg-blue-100 text-blue-800 border-blue-200',
  shipped:    'bg-purple-100 text-purple-800 border-purple-200',
  delivered:  'bg-green-100 text-green-800 border-green-200',
};

const STATUS_BUTTON: Record<OrderStatus, string> = {
  pending:    'bg-yellow-500 hover:bg-yellow-600 text-white',
  processing: 'bg-blue-500 hover:bg-blue-600 text-white',
  shipped:    'bg-purple-500 hover:bg-purple-600 text-white',
  delivered:  'bg-green-500 hover:bg-green-600 text-white',
};

const STATUS_NOTE_KEYS: Record<OrderStatus, string> = {
  pending:    'statusNotePending',
  processing: 'statusNoteProcessing',
  shipped:    'statusNoteShipped',
  delivered:  'statusNoteDelivered',
};

export function SellerOrders({ accessToken, sellerId: sellerIdProp }: SellerOrdersProps) {
  const [orders,          setOrders]          = useState<any[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [sellerId,        setSellerId]        = useState<string | null>(sellerIdProp || null);
  const { formatCurrency, t } = useLanguage();

  useEffect(() => {
    if (!sellerIdProp) {
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        setSellerId(payload.sub || null);
      } catch { /* ignore */ }
    }
    fetchOrders();

    const ch = supabase
      .channel('seller-orders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchOrders = async () => {
    try {
      let uid: string | null = sellerIdProp || null;
      if (!uid) {
        try {
          const payload = JSON.parse(atob(accessToken.split('.')[1]));
          uid = payload.sub || null;
        } catch { /* ignore */ }
      }
      if (!uid) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .not('seller_earnings', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mine = (data || []).filter((o: any) => {
        const se = o.seller_earnings;
        return se && typeof se === 'object' && uid! in se;
      });

      const normalised = mine.map((o: any) => ({
        id:             o.id,
        status:         o.status,
        paymentStatus:  o.payment_status,
        buyerEmail:     o.buyer_email,
        createdAt:      o.created_at,
        total:          o.total,
        trackingNumber: o.tracking_number || null,
        statusHistory:  (o.status_history || []) as StatusHistoryEntry[],
        items:          (o.items || []).map((i: any) => ({
          productId:   i.productId   || i.product_id,
          productName: i.productName || i.product_name,
          quantity:    i.quantity,
          price:       i.price,
          sellerId:    i.sellerId    || i.seller_id,
        })),
        shippingInfo:   o.shipping_info || {},
        sellerEarnings: o.seller_earnings || {},
      }));

      setOrders(normalised);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingOrderId(orderId);
    try {
      // Fetch current status_history first
      const { data: current } = await supabase
        .from('orders')
        .select('status_history')
        .eq('id', orderId)
        .maybeSingle();

      const history: StatusHistoryEntry[] = current?.status_history || [];
      history.push({
        status:    newStatus,
        timestamp: new Date().toISOString(),
        note:      t(STATUS_NOTE_KEYS[newStatus]),
      });

      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, status_history: history })
        .eq('id', orderId);

      if (!error) {
        setOrders(prev => prev.map(o =>
          o.id === orderId ? { ...o, status: newStatus, statusHistory: history } : o
        ));
      }
    } catch (error) {
      console.error('Failed to update order status:', error);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const toggleHistory = (orderId: string) => {
    setExpandedHistory(prev => {
      const next = new Set(prev);
      next.has(orderId) ? next.delete(orderId) : next.add(orderId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="loading"><span /><span /><span /><span /><span /></div>
      </div>
    );
  }

  const totalEarnings    = orders.reduce((sum, o) => sum + sellerItemsAndEarnings(o, sellerId).earnings, 0);
  const totalItemsSold   = orders.reduce((sum, o) => {
    const { items } = sellerItemsAndEarnings(o, sellerId);
    return sum + items.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
  }, 0);

  if (orders.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="p-12 text-center">
          <Package className="size-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-gray-900 mb-2">No orders yet</h2>
          <p className="text-gray-600">{t('ordersWillAppearText')}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in-up">
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1">Customer Orders</h1>
        <p className="text-gray-600 text-sm">Manage and fulfill customer orders</p>
      </div>

      {/* Earnings summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: t('totalEarningsLabel'), value: formatCurrency(totalEarnings), icon: DollarSign, color: 'from-green-50 to-green-100', ring: 'bg-green-500' },
          { label: t('totalOrdersLabel'),  value: orders.length,                 icon: ShoppingBag, color: 'from-blue-50 to-blue-100',   ring: 'bg-blue-500' },
          { label: t('itemsSoldLabel'),    value: totalItemsSold,                icon: TrendingUp,  color: 'from-purple-50 to-purple-100', ring: 'bg-purple-500' },
        ].map(({ label, value, icon: Icon, color, ring }, i) => (
          <Card key={i} className={`p-4 bg-gradient-to-br ${color}`} style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="flex items-center gap-3">
              <div className={`size-9 rounded-full ${ring} flex items-center justify-center shrink-0`}>
                <Icon className="size-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-600 truncate">{label}</p>
                <p className="text-lg font-bold text-gray-900">{value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        {orders.map((order, index) => {
          const { items: myItems, earnings: myEarnings } = sellerItemsAndEarnings(order, sellerId);
          const currentStepIndex = STATUS_STEPS.indexOf(order.status as OrderStatus);
          const historyOpen = expandedHistory.has(order.id);

          return (
            <Card
              key={order.id}
              className="p-6 animate-fade-in-up transition-shadow duration-200 hover:shadow-md"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {/* Order header */}
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-gray-900 text-sm font-semibold">Order #{order.id?.slice(-10)}</h3>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[order.status as OrderStatus] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                      {order.status}
                    </span>
                    {order.paymentStatus === 'completed' && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Paid</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">Customer: {order.buyerEmail}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(order.createdAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {order.trackingNumber && (
                    <p className="text-xs text-blue-600 font-mono mt-1">
                      Tracking: <span className="font-semibold">{order.trackingNumber}</span>
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-0.5">Your Earnings (80%)</p>
                  <p className="text-lg font-bold text-green-700">{formatCurrency(myEarnings)}</p>
                  <p className="text-xs text-gray-400">Order total: {formatCurrency(order.total || 0)}</p>
                </div>
              </div>

              {/* ── Status step tracker ── */}
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-xs font-medium text-gray-600 mb-3">{t('updateOrderStatusLabel')}</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {STATUS_STEPS.map((step, i) => {
                    const reached  = i <= currentStepIndex;
                    const isCurrent = i === currentStepIndex;
                    const isUpdating = updatingOrderId === order.id;
                    return (
                      <div key={step} className="flex items-center gap-1">
                        <button
                          onClick={() => !isCurrent && !isUpdating && handleUpdateStatus(order.id, step)}
                          disabled={isCurrent || isUpdating}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                            isCurrent
                              ? `${STATUS_BUTTON[step]} opacity-100 scale-105 shadow-sm cursor-default`
                              : reached
                                ? 'bg-gray-200 text-gray-500 border-gray-200 cursor-pointer hover:bg-gray-300'
                                : 'bg-white text-gray-400 border-gray-200 cursor-pointer hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {isUpdating && isCurrent ? <Loader2 className="size-3 animate-spin inline mr-1" /> : null}
                          {step.charAt(0).toUpperCase() + step.slice(1)}
                        </button>
                        {i < STATUS_STEPS.length - 1 && (
                          <div className={`w-4 h-px ${reached && i < currentStepIndex ? 'bg-gray-400' : 'bg-gray-200'}`} />
                        )}
                      </div>
                    );
                  })}
                  {updatingOrderId === order.id && (
                    <Loader2 className="size-3.5 animate-spin text-blue-500 ml-2" />
                  )}
                </div>
              </div>

              {/* Items */}
              <div className="border-t border-gray-100 pt-4 mb-4">
                <p className="text-sm text-gray-600 mb-2">Items:</p>
                <div className="space-y-1">
                  {myItems.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-900">{item.productName} × {item.quantity}</span>
                      <span className="text-gray-600">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shipping address */}
              <div className="border-t border-gray-100 pt-4 mb-4">
                <p className="text-sm text-gray-600 mb-1">Shipping Address:</p>
                <p className="text-sm text-gray-900">{order.shippingInfo?.name}</p>
                <p className="text-sm text-gray-500">{order.shippingInfo?.address}</p>
                <p className="text-sm text-gray-500">
                  {order.shippingInfo?.city}{order.shippingInfo?.zipCode ? `, ${order.shippingInfo.zipCode}` : ''}
                </p>
                <p className="text-sm text-gray-500">{order.shippingInfo?.country}</p>
              </div>

              {/* ── Status history (collapsible) ── */}
              {order.statusHistory?.length > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <button
                    onClick={() => toggleHistory(order.id)}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <Clock className="size-3.5" />
                    {t('trackingHistoryBtn')} ({order.statusHistory.length} event{order.statusHistory.length !== 1 ? 's' : ''})
                    {historyOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                  </button>

                  {historyOpen && (
                    <div className="mt-3 space-y-2">
                      {[...order.statusHistory].reverse().map((entry: StatusHistoryEntry, i: number) => (
                        <div key={i} className="flex items-start gap-3 text-xs">
                          <div className={`mt-0.5 size-2 rounded-full shrink-0 ${
                            entry.status === 'delivered' ? 'bg-green-500' :
                            entry.status === 'shipped'   ? 'bg-purple-500' :
                            entry.status === 'processing'? 'bg-blue-500' : 'bg-yellow-500'
                          }`} />
                          <div>
                            <span className="font-medium text-gray-800 capitalize">{entry.status}</span>
                            {entry.note && <span className="text-gray-500 ml-1">— {entry.note}</span>}
                            <p className="text-gray-400 mt-0.5">
                              {new Date(entry.timestamp).toLocaleString('en-NG', {
                                day: '2-digit', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
