import { useState, useEffect } from 'react';
import {
  DollarSign, TrendingUp, ShoppingBag, ArrowLeft,
  Download, RefreshCw, CheckCircle2, Clock, Truck, Package,
  ExternalLink, AlertCircle,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { projectId } from '../../utils/supabase/info';

interface AdminRevenueProps {
  accessToken: string;
  onBack: () => void;
}

interface Order {
  id: string;
  total: number;
  platformFeeTotal: number;
  sellerEarnings: Record<string, number>;
  status: string;
  paymentStatus?: string;
  paymentReference?: string;
  paymentMethod?: string;
  buyerEmail?: string;
  buyerId?: string;
  createdAt: string;
  items: Array<{ productName: string; quantity: number; price: number; sellerId?: string }>;
  shippingInfo?: { name: string; email?: string; country?: string; city?: string };
}

interface RevenueSummary {
  total: number;
  updatedAt: string | null;
}

const BASE = `https://${projectId}.supabase.co/functions/v1/server`;

const fmt = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;

const statusIcon = (s: string) => {
  switch (s) {
    case 'paid':
    case 'delivered': return <CheckCircle2 className="size-3.5 text-green-600" />;
    case 'shipped':   return <Truck className="size-3.5 text-blue-600" />;
    case 'processing': return <Clock className="size-3.5 text-amber-600" />;
    default:           return <Package className="size-3.5 text-gray-400" />;
  }
};

const statusColor = (s: string) => {
  switch (s) {
    case 'paid':
    case 'delivered': return 'bg-green-50 text-green-700 border-green-200';
    case 'shipped':   return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'processing': return 'bg-amber-50 text-amber-700 border-amber-200';
    default:           return 'bg-gray-50 text-gray-600 border-gray-200';
  }
};

export function AdminRevenue({ accessToken, onBack }: AdminRevenueProps) {
  const [orders, setOrders]         = useState<Order[]>([]);
  const [summary, setSummary]       = useState<RevenueSummary>({ total: 0, updatedAt: null });
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };

      const [ordersRes, revenueRes] = await Promise.all([
        fetch(`${BASE}/admin/orders`,  { headers }),
        fetch(`${BASE}/admin/revenue`, { headers }),
      ]);

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data.orders || []);
      } else {
        const t = await ordersRes.text();
        setError(`Failed to load orders: ${t}`);
      }

      if (revenueRes.ok) {
        const data = await revenueRes.json();
        setSummary({ total: data.admin?.total || 0, updatedAt: data.admin?.updatedAt || null });
      }
    } catch (e) {
      setError('Network error — check your connection.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Derived stats
  const totalRevenue    = orders.reduce((s, o) => s + (o.total || 0), 0);
  const totalCommission = orders.reduce((s, o) => s + (o.platformFeeTotal || 0), 0);

  const now = new Date();
  const todayStr   = now.toISOString().split('T')[0];
  const weekAgo    = new Date(now.getTime() - 7  * 86400_000);
  const monthAgo   = new Date(now.getTime() - 30 * 86400_000);

  const todayRev = orders
    .filter(o => o.createdAt?.startsWith(todayStr))
    .reduce((s, o) => s + (o.platformFeeTotal || 0), 0);
  const weekRev  = orders
    .filter(o => new Date(o.createdAt) >= weekAgo)
    .reduce((s, o) => s + (o.platformFeeTotal || 0), 0);
  const monthRev = orders
    .filter(o => new Date(o.createdAt) >= monthAgo)
    .reduce((s, o) => s + (o.platformFeeTotal || 0), 0);

  const fmtDate = (d: string) => {
    try {
      return new Date(d).toLocaleString('en-NG', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return d; }
  };

  const downloadCsv = () => {
    const rows = [
      ['Order ID', 'Date', 'Buyer', 'Items', 'Order Total', 'Commission (20%)', 'Status', 'Payment Ref'],
      ...orders.map(o => [
        o.id.slice(-12),
        fmtDate(o.createdAt),
        o.buyerEmail || '',
        (o.items?.length || 0).toString(),
        (o.total || 0).toFixed(2),
        (o.platformFeeTotal || 0).toFixed(2),
        o.status,
        o.paymentReference || '',
      ]),
    ].map(r => r.map(v => `"${v}"`).join(',')).join('\n');

    const blob = new Blob([rows], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `shophub-revenue-${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="loading"><span/><span/><span/><span/><span/></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 animate-fade-in">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onBack} size="sm" className="gap-1">
              <ArrowLeft className="size-4" /> Back
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Revenue & Transactions</h1>
              <p className="text-xs text-gray-500">{orders.length} total order{orders.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchAll} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className="size-3.5 mr-1" /> Refresh
            </Button>
            <Button onClick={downloadCsv} variant="outline" size="sm">
              <Download className="size-3.5 mr-1" /> Export CSV
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Commission (20%)', value: fmt(totalCommission), icon: DollarSign, color: 'from-green-50 to-green-100', ring: 'bg-green-500' },
            { label: 'Gross Revenue (GMV)',    value: fmt(totalRevenue),    icon: TrendingUp,  color: 'from-blue-50 to-blue-100',  ring: 'bg-blue-500' },
            { label: 'Total Orders',           value: orders.length,        icon: ShoppingBag, color: 'from-purple-50 to-purple-100', ring: 'bg-purple-500' },
            { label: 'Month Commission',       value: fmt(monthRev),        icon: TrendingUp,  color: 'from-orange-50 to-orange-100', ring: 'bg-orange-500' },
          ].map(({ label, value, icon: Icon, color, ring }, i) => (
            <Card key={i} className={`p-4 bg-gradient-to-br ${color} animate-fade-in-up`} style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="flex items-center gap-3">
                <div className={`size-10 rounded-full ${ring} flex items-center justify-center shrink-0`}>
                  <Icon className="size-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-600 truncate">{label}</p>
                  <p className="text-lg font-bold text-gray-900">{value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Time buckets */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Today',      value: todayRev },
            { label: 'This Week',  value: weekRev  },
            { label: 'This Month', value: monthRev },
          ].map(({ label, value }, i) => (
            <Card key={i} className="p-4 animate-fade-in-up" style={{ animationDelay: `${0.25 + i * 0.06}s` }}>
              <p className="text-xs text-gray-500 mb-1">{label} Commission</p>
              <p className="text-xl font-bold text-gray-900">{fmt(value)}</p>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="transactions">
          <TabsList className="mb-4">
            <TabsTrigger value="transactions">Transaction History</TabsTrigger>
            <TabsTrigger value="breakdown">Revenue Split</TabsTrigger>
          </TabsList>

          {/* Transaction history */}
          <TabsContent value="transactions">
            <Card className="p-0 overflow-hidden">
              {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <ShoppingBag className="size-12 text-gray-300 mb-3" />
                  <p className="font-medium">No orders yet</p>
                  <p className="text-sm">Completed orders will appear here with Paystack references.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {/* Table header */}
                  <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-5 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <span>Order / Date</span>
                    <span>Buyer</span>
                    <span>Items</span>
                    <span className="text-right">Order Total</span>
                    <span className="text-right">Commission</span>
                    <span>Status / Ref</span>
                  </div>

                  {orders.map((order, idx) => (
                    <div
                      key={order.id}
                      className="px-5 py-4 hover:bg-gray-50 transition-colors animate-fade-in-up"
                      style={{ animationDelay: `${idx * 0.03}s` }}
                    >
                      {/* Mobile layout */}
                      <div className="md:hidden space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-mono text-gray-500">#{order.id.slice(-10)}</p>
                            <p className="text-xs text-gray-400">{fmtDate(order.createdAt)}</p>
                          </div>
                          <Badge className={`text-xs border ${statusColor(order.status)}`}>
                            {order.status}
                          </Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{order.buyerEmail}</span>
                          <span className="font-semibold">{fmt(order.total || 0)}</span>
                        </div>
                        {order.paymentReference && (
                          <p className="text-xs text-gray-400 font-mono truncate">{order.paymentReference}</p>
                        )}
                      </div>

                      {/* Desktop layout */}
                      <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center text-sm">
                        <div>
                          <p className="font-mono text-xs text-gray-500">#{order.id.slice(-10)}</p>
                          <p className="text-xs text-gray-400">{fmtDate(order.createdAt)}</p>
                        </div>
                        <p className="text-gray-700 truncate">{order.buyerEmail || '—'}</p>
                        <p className="text-gray-600">{order.items?.length || 0} item{order.items?.length !== 1 ? 's' : ''}</p>
                        <p className="text-right font-semibold text-gray-900">{fmt(order.total || 0)}</p>
                        <p className="text-right font-semibold text-green-700">{fmt(order.platformFeeTotal || 0)}</p>
                        <div className="space-y-1">
                          <div className={`inline-flex items-center gap-1 text-xs border px-2 py-0.5 rounded-full ${statusColor(order.status)}`}>
                            {statusIcon(order.status)}
                            {order.status}
                          </div>
                          {order.paymentReference && (
                            <p className="text-[10px] text-gray-400 font-mono truncate" title={order.paymentReference}>
                              {order.paymentReference.slice(0, 28)}…
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Revenue split */}
          <TabsContent value="breakdown">
            <Card className="p-6 space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Revenue Distribution</h2>
              {[
                { label: 'Platform Commission (20%)', sub: 'Your earnings from all orders', value: totalCommission, color: 'text-green-700', bg: 'bg-green-100', icon: DollarSign },
                { label: 'Seller Earnings (80%)',     sub: 'Paid out to sellers after commission', value: totalRevenue * 0.8, color: 'text-blue-700', bg: 'bg-blue-100', icon: TrendingUp },
                { label: 'Gross Merchandise Value',  sub: 'Total value of all transactions',  value: totalRevenue, color: 'text-purple-700', bg: 'bg-purple-100', icon: ShoppingBag },
              ].map(({ label, sub, value, color, bg, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`size-10 rounded-full ${bg} flex items-center justify-center`}>
                      <Icon className={`size-5 ${color}`} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{label}</p>
                      <p className="text-xs text-gray-500">{sub}</p>
                    </div>
                  </div>
                  <p className={`text-xl font-bold ${color}`}>{fmt(value)}</p>
                </div>
              ))}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
