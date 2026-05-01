import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ShoppingBag, Settings, Truck, MapPin, Home,
  Package, ChevronDown, ChevronUp, RefreshCw, Search,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { supabase } from '../../utils/supabase/client';

/* ─── Visual step definitions ──────────────────────────────────────── */
const TRACK_STEPS = [
  { key: 'placed',      label: 'Order\nPlaced',   icon: ShoppingBag },
  { key: 'processing',  label: 'Processing',       icon: Settings    },
  { key: 'shipped',     label: 'Order\nShipped',  icon: Truck       },
  { key: 'en_route',    label: 'En Route',         icon: MapPin      },
  { key: 'delivered',   label: 'Delivered',        icon: Home        },
];

function statusToStep(status: string): number {
  switch (status) {
    case 'pending':    return 0;
    case 'processing': return 1;
    case 'shipped':    return 2;
    case 'delivered':  return 4;
    default:           return 0;
  }
}

/* ─── Gradient status tracker card ─────────────────────────────────── */
function StatusTracker({ order }: { order: any }) {
  const currentStep = statusToStep(order.status);
  const pct = (currentStep / (TRACK_STEPS.length - 1)) * 100;

  const estimatedDelivery = (() => {
    const d = new Date(order.createdAt || order.created_at);
    d.setDate(d.getDate() + 5);
    return d.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
  })();

  const trackingNum = order.trackingNumber || order.tracking_number;

  return (
    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-5 mt-3">
      {/* Top row */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-indigo-200 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Order</p>
          <p className="text-white font-bold text-lg">#{(order.id || '').slice(-8).toUpperCase()}</p>
        </div>
        <div className="text-right">
          <p className="text-indigo-200 text-[10px]">Expected Arrival</p>
          <p className="text-white text-xs font-semibold">{estimatedDelivery}</p>
          {trackingNum && (
            <>
              <p className="text-indigo-200 text-[10px] mt-1">Tracking #</p>
              <p className="text-white text-xs font-mono font-bold tracking-wider">{trackingNum}</p>
            </>
          )}
        </div>
      </div>

      {/* Progress bar + dots */}
      <div className="relative mb-2 px-4">
        <div className="absolute top-4 left-4 right-4 h-1.5 bg-white/20 rounded-full" />
        <div
          className="absolute top-4 left-4 h-1.5 bg-white rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
        <div className="relative flex justify-between">
          {TRACK_STEPS.map((step, i) => {
            const done    = i <= currentStep;
            const current = i === currentStep;
            return (
              <div key={step.key} className="flex flex-col items-center">
                <div className={`
                  size-8 rounded-full border-2 flex items-center justify-center z-10
                  transition-all duration-500
                  ${done ? 'bg-white border-white shadow-lg shadow-white/25' : 'bg-transparent border-white/30'}
                  ${current ? 'scale-110 ring-4 ring-white/20' : ''}
                `}>
                  <step.icon className={`size-3.5 ${done ? 'text-indigo-700' : 'text-white/30'}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between px-0 mt-1">
        {TRACK_STEPS.map((step, i) => {
          const done    = i <= currentStep;
          const current = i === currentStep;
          return (
            <div key={step.key} className="flex flex-col items-center text-center" style={{ width: '20%' }}>
              {step.label.split('\n').map((line, li) => (
                <p key={li} className={`text-[9px] leading-tight font-medium ${
                  current ? 'text-white' : done ? 'text-white/75' : 'text-white/30'
                }`}>
                  {line}
                </p>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────────── */
export function TrackOrder() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const passed    = location.state;   // from BuyerOrders "Full Tracking" button

  const [orders,     setOrders]     = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(passed?.orderId || null);
  const [search,     setSearch]     = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('orders')
      .select('id, status, created_at, items, total, shipping_info, tracking_number')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false });

    setOrders((data || []).map((o: any) => ({
      id:             o.id,
      status:         o.status,
      createdAt:      o.created_at,
      items:          o.items || [],
      total:          o.total,
      shippingInfo:   o.shipping_info || {},
      trackingNumber: o.tracking_number || null,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  /* if arriving via state, auto-expand and inject if not in list yet */
  useEffect(() => {
    if (!passed?.orderId) return;
    setExpandedId(passed.orderId);
    setOrders(prev => {
      if (prev.find(o => o.id === passed.orderId)) return prev;
      return [{
        id:             passed.orderId,
        status:         passed.status,
        createdAt:      new Date().toISOString(),
        items:          passed.items || [],
        total:          passed.total || 0,
        shippingInfo:   {},
        trackingNumber: passed.trackingNumber || null,
      }, ...prev];
    });
  }, [passed?.orderId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const fmt = (n: number) => `₦${Math.round(n || 0).toLocaleString('en-NG')}`;

  const statusColor: Record<string, string> = {
    pending:    'bg-yellow-100 text-yellow-800 border-yellow-200',
    processing: 'bg-blue-100 text-blue-800 border-blue-200',
    shipped:    'bg-purple-100 text-purple-800 border-purple-200',
    delivered:  'bg-green-100 text-green-800 border-green-200',
  };

  const filtered = orders.filter(o => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      o.id.toLowerCase().includes(q) ||
      (o.trackingNumber || '').toLowerCase().includes(q) ||
      (o.items || []).some((i: any) =>
        (i.productName || i.product_name || '').toLowerCase().includes(q)
      )
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 pl-2">
              <ArrowLeft className="size-4" /> Back
            </Button>
            <h1 className="text-xl font-bold text-gray-900">Track Orders</h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-1.5">
            <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Search bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by order ID, tracking # or product name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 shadow-sm"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="loading"><span /><span /><span /><span /><span /></div>
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Package className="size-12 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-500">No orders found</p>
            <p className="text-sm text-gray-400 mt-1">Place an order to start tracking here.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((order, idx) => {
              const isOpen    = expandedId === order.id;
              const firstItem = order.items?.[0];
              const itemName  = firstItem?.productName || firstItem?.product_name || 'Order';
              const itemImg   = firstItem?.productImage || firstItem?.product_image || '';
              const extra     = order.items?.length > 1 ? ` +${order.items.length - 1} more` : '';

              return (
                <Card
                  key={order.id}
                  className="overflow-hidden transition-shadow hover:shadow-md animate-fade-in-up"
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  {/* ── Summary row ── */}
                  <button
                    className="w-full text-left px-4 py-4 flex items-center gap-3 hover:bg-gray-50/60 transition-colors"
                    onClick={() => setExpandedId(isOpen ? null : order.id)}
                  >
                    {/* Thumbnail */}
                    <div className="size-12 rounded-xl overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                      {itemImg
                        ? <img src={itemImg} alt={itemName} className="w-full h-full object-cover"
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        : <Package className="size-5 text-gray-400" />
                      }
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{itemName}{extra}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-gray-400 font-mono">#{order.id.slice(-8).toUpperCase()}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium capitalize ${statusColor[order.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {order.status}
                        </span>
                      </div>
                      {order.trackingNumber && (
                        <p className="text-[10px] font-mono text-indigo-600 mt-0.5">{order.trackingNumber}</p>
                      )}
                    </div>

                    {/* Amount + chevron */}
                    <div className="text-right shrink-0 mr-1">
                      <p className="text-sm font-bold text-gray-900">{fmt(order.total)}</p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(order.createdAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                    {isOpen
                      ? <ChevronUp className="size-4 text-gray-400 shrink-0" />
                      : <ChevronDown className="size-4 text-gray-400 shrink-0" />
                    }
                  </button>

                  {/* ── Expanded panel ── */}
                  {isOpen && (
                    <div className="border-t border-gray-100 px-4 pb-5">
                      <StatusTracker order={order} />

                      {/* Items */}
                      {order.items?.length > 0 && (
                        <div className="mt-5 space-y-2">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Items</p>
                          {order.items.map((item: any, i: number) => {
                            const name  = item.productName || item.product_name || 'Product';
                            const img   = item.productImage || item.product_image || '';
                            const price = (item.price || 0) * (item.quantity || 1);
                            return (
                              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                {img && (
                                  <img src={img} alt={name}
                                    className="w-11 h-11 object-cover rounded-lg shrink-0"
                                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                                  <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                                </div>
                                <p className="text-sm font-semibold text-gray-900 shrink-0">{fmt(price)}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Shipping */}
                      {order.shippingInfo?.name && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-xl">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Shipping to</p>
                          <p className="text-sm font-medium text-gray-800">{order.shippingInfo.name}</p>
                          <p className="text-xs text-gray-500">{order.shippingInfo.address}</p>
                          <p className="text-xs text-gray-500">
                            {order.shippingInfo.city}{order.shippingInfo.zipCode ? `, ${order.shippingInfo.zipCode}` : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
