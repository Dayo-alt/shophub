import { useState, useEffect } from 'react';
import {
  ArrowLeft, Package, Truck, AlertCircle, X, Send,
  ShoppingBag, Settings, MapPin, Home, ChevronDown, ChevronUp, Calendar,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { supabase } from '../../utils/supabase/client';
import { Order } from '../../App';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../utils/i18n/LanguageContext';

interface BuyerOrdersProps {
  accessToken: string;
  refreshTrigger: number;
  onBack: () => void;
}

interface ComplaintState {
  orderId: string;
  orderShort: string;
  sellerId: string;
  subject: string;
  message: string;
  submitting: boolean;
  submitted: boolean;
  error: string;
}

/* ── Visual tracking steps ── */
const TRACK_STEPS = [
  { key: 'placed',      labelKey: 'trackStepPlaced',      icon: ShoppingBag },
  { key: 'processing',  labelKey: 'trackStepProcessing',  icon: Settings    },
  { key: 'shipped',     labelKey: 'trackStepShipped',     icon: Truck       },
  { key: 'en_route',    labelKey: 'trackStepEnRoute',     icon: MapPin      },
  { key: 'delivered',   labelKey: 'trackStepDelivered',   icon: Home        },
];

function getStepIndex(status: string): number {
  switch (status) {
    case 'pending':    return 0;
    case 'processing': return 1;
    case 'shipped':    return 2;
    case 'delivered':  return 4;
    default:           return 0;
  }
}

function StatusTracker({ order, t }: { order: Order; t: (key: string) => string }) {
  const currentStep = getStepIndex(order.status);
  const estimatedDelivery = (() => {
    if (order.estimatedDelivery) {
      return new Date(order.estimatedDelivery).toLocaleDateString('en-NG', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    }
    const d = new Date(order.createdAt);
    d.setDate(d.getDate() + 5);
    return d.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
  })();

  return (
    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-5 mt-4">
      {/* Header row */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-indigo-200 text-xs font-medium uppercase tracking-wide mb-0.5">Order</p>
          <p className="text-white font-bold text-base">#{order.id.slice(-8).toUpperCase()}</p>
        </div>
        <div className="text-right">
          <p className="text-indigo-200 text-xs">Expected Arrival</p>
          <p className="text-white text-xs font-semibold">{estimatedDelivery}</p>
          {order.trackingNumber && (
            <>
              <p className="text-indigo-200 text-[10px] mt-0.5">Tracking #</p>
              <p className="text-white text-xs font-mono font-bold">{order.trackingNumber}</p>
            </>
          )}
        </div>
      </div>

      {/* Progress line + dots */}
      <div className="relative mb-3">
        {/* Background line */}
        <div className="absolute top-4 left-4 right-4 h-1 bg-white/20 rounded-full" />
        {/* Filled line */}
        <div
          className="absolute top-4 left-4 h-1 bg-white rounded-full transition-all duration-700"
          style={{ width: `calc(${(currentStep / (TRACK_STEPS.length - 1)) * 100}% - 2rem + 1rem)` }}
        />
        {/* Step dots */}
        <div className="relative flex justify-between">
          {TRACK_STEPS.map((step, i) => {
            const done    = i <= currentStep;
            const current = i === currentStep;
            return (
              <div key={step.key} className="flex flex-col items-center" style={{ width: '20%' }}>
                {/* Dot */}
                <div className={`
                  size-8 rounded-full border-2 flex items-center justify-center z-10 transition-all duration-500
                  ${done
                    ? 'bg-white border-white shadow-lg shadow-white/30'
                    : 'bg-transparent border-white/40'
                  }
                  ${current ? 'scale-110' : ''}
                `}>
                  <step.icon className={`size-3.5 ${done ? 'text-indigo-600' : 'text-white/40'}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between">
        {TRACK_STEPS.map((step, i) => {
          const done    = i <= currentStep;
          const current = i === currentStep;
          return (
            <div key={step.key} className="flex flex-col items-center text-center" style={{ width: '20%' }}>
              <p className={`text-[10px] leading-tight font-medium ${
                current ? 'text-white' : done ? 'text-white/80' : 'text-white/35'
              }`}>
                {t(step.labelKey)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BuyerOrders({ accessToken, refreshTrigger, onBack }: BuyerOrdersProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [orders,        setOrders]        = useState<Order[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [statusFilter,  setStatusFilter]  = useState<'all' | 'pending' | 'processing' | 'shipped' | 'delivered'>('all');
  const [query,         setQuery]         = useState('');
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [complaint,     setComplaint]     = useState<ComplaintState | null>(null);

  useEffect(() => {
    fetchOrders();
    const ch = supabase
      .channel('buyer-orders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refreshTrigger]);

  const fetchOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: Order[] = (data || []).map((o: any) => ({
        id:               o.id,
        buyerId:          o.buyer_id,
        buyerEmail:       o.buyer_email,
        items:            (o.items || []).map((i: any) => ({
          productId:    i.productId   || i.product_id,
          productName:  i.productName || i.product_name,
          productImage: i.productImage || i.product_image || '',
          quantity:     i.quantity,
          price:        i.price,
          sellerId:     i.sellerId    || i.seller_id,
        })),
        total:            o.total,
        status:           o.status,
        paymentStatus:    o.payment_status,
        paymentReference: o.payment_reference,
        paymentMethod:    o.payment_method,
        shippingInfo:     o.shipping_info || {},
        sellerEarnings:   o.seller_earnings || {},
        createdAt:          o.created_at,
        trackingNumber:     o.tracking_number || null,
        estimatedDelivery:  o.estimated_delivery || null,
      }));

      setOrders(mapped);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const q = query.trim().toLowerCase();
    if (!q) return matchesStatus;
    return matchesStatus && (
      order.id.toLowerCase().includes(q) ||
      order.items.some(i => i.productName.toLowerCase().includes(q)) ||
      (order.trackingNumber || '').toLowerCase().includes(q)
    );
  });

  const handleTrackOrder = (order: Order) => {
    navigate('/buyer/track-order', {
      state: {
        orderId:        order.id,
        trackingNumber: order.trackingNumber || `TRK${order.id.slice(-8).toUpperCase()}`,
        status:         order.status,
        items:          order.items,
        total:          order.total,
      },
    });
  };

  const openComplaint = (order: Order) => {
    setComplaint({
      orderId:    order.id,
      orderShort: order.id.slice(-8).toUpperCase(),
      sellerId:   order.items[0]?.sellerId || '',
      subject:    `Issue with order #${order.id.slice(-8).toUpperCase()}`,
      message:    '',
      submitting: false,
      submitted:  false,
      error:      '',
    });
  };

  const submitComplaint = async () => {
    if (!complaint) return;
    if (!complaint.message.trim()) {
      setComplaint(c => c ? { ...c, error: 'Please describe your issue.' } : null);
      return;
    }
    setComplaint(c => c ? { ...c, submitting: true, error: '' } : null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('complaints').insert({
        order_id:    complaint.orderId,
        buyer_id:    user?.id,
        buyer_email: user?.email,
        seller_id:   complaint.sellerId,
        subject:     complaint.subject,
        message:     complaint.message,
        status:      'open',
      });
      if (error) throw error;
      setComplaint(c => c ? { ...c, submitting: false, submitted: true } : null);
    } catch (err: any) {
      setComplaint(c => c ? { ...c, submitting: false, error: err.message || 'Failed to submit. Try again.' } : null);
    }
  };

  const fmt = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;

  const statusColor: Record<string, string> = {
    pending:    'bg-yellow-100 text-yellow-800 border-yellow-200',
    processing: 'bg-blue-100 text-blue-800 border-blue-200',
    shipped:    'bg-purple-100 text-purple-800 border-purple-200',
    delivered:  'bg-green-100 text-green-800 border-green-200',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="loading"><span /><span /><span /><span /><span /></div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-scale-in">
        <Button variant="ghost" onClick={onBack} className="mb-6 gap-2">
          <ArrowLeft className="size-4" /> Back to Products
        </Button>
        <Card className="p-12 text-center">
          <Package className="size-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-gray-900 mb-2">No orders yet</h2>
          <p className="text-gray-600 mb-6">Start shopping to see your orders here!</p>
          <Button onClick={onBack}>Start Shopping</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in-up">

      {/* Complaint modal */}
      {complaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                {complaint.submitted ? t('complaintSubmittedMsg') : `${t('reportIssueTitlePrefix')}${complaint.orderShort}`}
              </h3>
              <button onClick={() => setComplaint(null)} className="text-gray-400 hover:text-gray-600">
                <X className="size-5" />
              </button>
            </div>
            {complaint.submitted ? (
              <div className="text-center py-4">
                <div className="size-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Send className="size-5 text-green-600" />
                </div>
                <p className="font-medium text-gray-900 mb-1">{t('complaintSubmittedMsg')}</p>
                <p className="text-sm text-gray-500">{t('sellerAdminNotifiedMsg')}</p>
                <Button onClick={() => setComplaint(null)} className="mt-4 w-full">{t('closeBtn')}</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">{t('subjectLabel')}</label>
                  <input className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    value={complaint.subject}
                    onChange={e => setComplaint(c => c ? { ...c, subject: e.target.value } : null)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">{t('describeIssueLabel')}</label>
                  <textarea rows={4}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
                    placeholder={t('issueExamplePlaceholder')}
                    value={complaint.message}
                    onChange={e => setComplaint(c => c ? { ...c, message: e.target.value } : null)}
                  />
                </div>
                {complaint.error && (
                  <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    <AlertCircle className="size-3.5 shrink-0 mt-0.5" /> {complaint.error}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={() => setComplaint(null)} className="flex-1">{t('cancelBtn')}</Button>
                  <Button onClick={submitComplaint} disabled={complaint.submitting} className="flex-1">
                    {complaint.submitting ? t('submittingLabel') : t('submitComplaintBtn')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <Button variant="ghost" onClick={onBack} className="mb-6 gap-2">
        <ArrowLeft className="size-4" /> Back to Products
      </Button>

      <h1 className="text-gray-900 mb-4">My Orders</h1>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {(['all', 'pending', 'processing', 'shipped', 'delivered'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize ${
                statusFilter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {s === 'all' ? t('allOrdersFilter') : s}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('searchOrdersPlaceholder')}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
      </div>

      {/* Order list */}
      <div className="space-y-3">
        {filteredOrders.map((order, index) => {
          const isExpanded = expandedId === order.id;
          return (
            <Card
              key={order.id}
              className="overflow-hidden animate-fade-in-up transition-shadow hover:shadow-md"
              style={{ animationDelay: `${index * 0.06}s` }}
            >
              {/* ── Compact summary row (always visible) ── */}
              <button
                className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50/70 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : order.id)}
              >
                {/* Product thumbnail */}
                <div className="size-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                  <img
                    src={order.items[0]?.productImage || '/placeholder-product.png'}
                    alt={order.items[0]?.productName}
                    className="w-full h-full object-cover"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>

                {/* Order info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">Order #{order.id.slice(-8).toUpperCase()}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize ${statusColor[order.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {order.status}
                    </span>
                    {order.paymentStatus === 'completed' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-green-50 text-green-700 border-green-200">Paid</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {order.items.length} item{order.items.length !== 1 ? 's' : ''} ·{' '}
                    {new Date(order.createdAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                  {order.trackingNumber && (
                    <p className="text-[10px] font-mono text-indigo-600 mt-0.5">{order.trackingNumber}</p>
                  )}
                </div>

                {/* Total + chevron */}
                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-900 text-sm">{fmt(order.total)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Total</p>
                </div>
                <div className="shrink-0 text-gray-400">
                  {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </div>
              </button>

              {/* ── Expanded detail ── */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-5 pb-5">
                  {/* Shipped delivery date banner */}
                  {order.estimatedDelivery && order.status === 'shipped' && (
                    <div className="mt-4 flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
                      <Truck className="size-4 text-purple-600 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-purple-800">Your order is on its way!</p>
                        <p className="text-xs text-purple-600">
                          Expected delivery: <span className="font-bold">{new Date(order.estimatedDelivery).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Visual status tracker */}
                  <StatusTracker order={order} t={t} />

                  {/* Items */}
                  <div className="mt-5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('orderItemsLabel')}</p>
                    <div className="space-y-2">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <img
                            src={item.productImage || '/placeholder-product.png'}
                            alt={item.productName}
                            className="w-12 h-12 object-cover rounded-lg shrink-0"
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{item.productName}</p>
                            <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 shrink-0">{fmt(item.price * item.quantity)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Shipping address */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Shipping Address</p>
                    <p className="text-sm text-gray-800">{order.shippingInfo.name}</p>
                    <p className="text-xs text-gray-500">{order.shippingInfo.address}</p>
                    <p className="text-xs text-gray-500">{order.shippingInfo.city}{order.shippingInfo.zipCode ? `, ${order.shippingInfo.zipCode}` : ''}</p>
                    <p className="text-xs text-gray-500">{order.shippingInfo.country}</p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTrackOrder(order)}
                      className="flex-1 gap-1.5"
                    >
                      <Truck className="size-3.5" /> {t('fullTrackingBtn')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openComplaint(order)}
                      className="flex-1 gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <AlertCircle className="size-3.5" /> {t('reportIssueBtn')}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
