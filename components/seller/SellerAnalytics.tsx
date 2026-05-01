import { useState, useEffect } from 'react';
import { DollarSign, Package, ShoppingCart, TrendingUp, Loader2, Star, CreditCard } from 'lucide-react';
import { Card } from '../ui/card';
import { supabase } from '../../utils/supabase/client';
import { useLanguage } from '../../utils/i18n/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';

interface SellerAnalyticsProps {
  accessToken: string;
}

const NIGERIAN_BANKS = [
  { name: 'Access Bank',       code: '044' },
  { name: 'Citibank',          code: '023' },
  { name: 'Ecobank',           code: '050' },
  { name: 'Fidelity Bank',     code: '070' },
  { name: 'First Bank',        code: '011' },
  { name: 'FCMB',              code: '214' },
  { name: 'GTBank',            code: '058' },
  { name: 'Heritage Bank',     code: '030' },
  { name: 'Keystone Bank',     code: '082' },
  { name: 'Opay',              code: '999992' },
  { name: 'Palmpay',           code: '999991' },
  { name: 'Polaris Bank',      code: '076' },
  { name: 'Providus Bank',     code: '101' },
  { name: 'Stanbic IBTC',      code: '221' },
  { name: 'Sterling Bank',     code: '232' },
  { name: 'UBA',               code: '033' },
  { name: 'Union Bank',        code: '032' },
  { name: 'Unity Bank',        code: '215' },
  { name: 'Wema Bank',         code: '035' },
  { name: 'Zenith Bank',       code: '057' },
];

export function SellerAnalytics({ accessToken }: SellerAnalyticsProps) {
  const { t, formatCurrency } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0, totalOrders: 0, totalProducts: 0, averageOrderValue: 0,
  });
  const [followersCount, setFollowersCount] = useState(0);
  const [sellerScorePct, setSellerScorePct] = useState(0);
  const [reviewsStats, setReviewsStats] = useState({
    totalReviews: 0, uniqueReviewers: 0, averageRating: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1|2|3|4|5, number>,
    topProducts: [] as Array<{ productId: string; name: string; count: number; avg: number }>,
  });

  /* ── withdrawal state ── */
  const [balance, setBalance] = useState(0);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({
    amount: '', bankCode: '', accountNumber: '', accountName: '',
  });
  const [withdrawError, setWithdrawError]   = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setSellerId(user.id);

      // Seller-specific orders (where seller_earnings has this seller's key)
      const { data: allOrders } = await supabase
        .from('orders')
        .select('id, total, seller_earnings, created_at')
        .not('seller_earnings', 'is', null);

      const myOrders = (allOrders || []).filter((o: any) =>
        o.seller_earnings && typeof o.seller_earnings === 'object' && user.id in o.seller_earnings
      );

      const totalRevenue = myOrders.reduce((s: number, o: any) =>
        s + (o.seller_earnings[user.id] || 0), 0);
      const totalOrders = myOrders.length;

      // Products
      const { data: productsRes } = await supabase
        .from('products')
        .select('id, name')
        .eq('seller_id', user.id);
      const products = (productsRes || []) as Array<{ id: string; name: string }>;

      setAnalytics({
        totalRevenue,
        totalOrders,
        totalProducts: products.length,
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      });

      // Compute balance = total earnings - total withdrawn
      const { data: withdrawalRows } = await supabase
        .from('seller_withdrawals')
        .select('amount, status')
        .eq('seller_id', user.id)
        .in('status', ['pending', 'completed']);
      const withdrawn = (withdrawalRows || []).reduce((s: number, w: any) => s + (w.amount || 0), 0);
      setBalance(Math.max(0, totalRevenue - withdrawn));
      setWithdrawals(withdrawalRows || []);

      // Followers
      const { count: fCount } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', user.id);
      setFollowersCount(fCount || 0);

      // Reviews
      const productIds = products.map(p => p.id);
      if (productIds.length) {
        const { data: reviews } = await supabase
          .from('reviews')
          .select('product_id, user_email, rating')
          .in('product_id', productIds);
        const revList = (reviews || []) as Array<{ product_id: string; user_email: string | null; rating: number }>;

        const dist: Record<1|2|3|4|5, number> = { 1:0, 2:0, 3:0, 4:0, 5:0 };
        revList.forEach(r => { const k = Math.min(5, Math.max(1, Math.round(r.rating))) as 1|2|3|4|5; dist[k]++; });
        const totalRev     = revList.length;
        const uniqueRev    = new Set(revList.map(r => r.user_email || '')).size;
        const avgRating    = totalRev ? revList.reduce((s, r) => s + (r.rating || 0), 0) / totalRev : 0;

        const byProduct: Record<string, { count: number; sum: number }> = {};
        revList.forEach(r => {
          if (!byProduct[r.product_id]) byProduct[r.product_id] = { count: 0, sum: 0 };
          byProduct[r.product_id].count++;
          byProduct[r.product_id].sum += r.rating || 0;
        });
        const nameById = Object.fromEntries(products.map(p => [p.id, p.name]));
        const topProducts = Object.entries(byProduct)
          .map(([pid, v]) => ({ productId: pid, name: nameById[pid] || 'Product', count: v.count, avg: v.sum / v.count }))
          .sort((a, b) => b.count - a.count).slice(0, 5);

        setReviewsStats({ totalReviews: totalRev, uniqueReviewers: uniqueRev, averageRating: avgRating, distribution: dist, topProducts });
        setSellerScorePct(Math.round((avgRating / 5) * 100));
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    setWithdrawError('');
    setWithdrawSuccess('');
    const amount = parseFloat(withdrawForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setWithdrawError('Enter a valid amount.'); return; }
    if (amount > balance) { setWithdrawError('Amount exceeds available balance.'); return; }
    if (!withdrawForm.bankCode) { setWithdrawError('Select your bank.'); return; }
    if (!withdrawForm.accountNumber.trim()) { setWithdrawError('Enter your account number.'); return; }
    if (!withdrawForm.accountName.trim()) { setWithdrawError('Enter your account name.'); return; }

    setWithdrawing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const bankName = NIGERIAN_BANKS.find(b => b.code === withdrawForm.bankCode)?.name || '';
      const { error } = await supabase.from('seller_withdrawals').insert({
        seller_id:      user?.id,
        amount,
        bank_name:      bankName,
        bank_code:      withdrawForm.bankCode,
        account_number: withdrawForm.accountNumber,
        account_name:   withdrawForm.accountName,
        status:         'pending',
      });
      if (error) throw error;
      setBalance(prev => Math.max(0, prev - amount));
      setWithdrawSuccess(`Withdrawal of ${formatCurrency(amount)} submitted. Processing within 1-2 business days.`);
      setWithdrawForm({ amount: '', bankCode: '', accountNumber: '', accountName: '' });
      setTimeout(() => { setShowWithdraw(false); setWithdrawSuccess(''); }, 3000);
    } catch (err: any) {
      setWithdrawError(err.message || 'Failed to submit withdrawal.');
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="loading"><span /><span /><span /><span /><span /></div>
      </div>
    );
  }

  const stats = [
    { title: 'My Earnings (80%)',   value: formatCurrency(analytics.totalRevenue), icon: DollarSign,  color: 'text-green-600',  bgColor: 'bg-green-50' },
    { title: 'Total Orders',        value: analytics.totalOrders.toString(),        icon: ShoppingCart, color: 'text-blue-600',   bgColor: 'bg-blue-50' },
    { title: 'Total Products',      value: analytics.totalProducts.toString(),      icon: Package,      color: 'text-purple-600', bgColor: 'bg-purple-50' },
    { title: 'Avg Order Value',     value: formatCurrency(analytics.averageOrderValue), icon: TrendingUp,   color: 'text-orange-600', bgColor: 'bg-orange-50' },
    { title: t('followersLabel'),   value: followersCount.toString(),               icon: ShoppingCart, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
    { title: 'Seller Score',        value: `${sellerScorePct}%`,                    icon: TrendingUp,   color: 'text-emerald-600',bgColor: 'bg-emerald-50' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-gray-900 mb-2">{t('sellerAnalyticsTitle')}</h1>
        <p className="text-gray-600">{t('sellerAnalyticsSubtitle')}</p>
      </div>

      {/* Balance + withdraw card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="p-6 col-span-1">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="size-4 text-green-600" />
            <p className="text-sm text-gray-600">Available Balance</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">{formatCurrency(balance)}</p>
          <p className="text-xs text-gray-400 mb-3">Earned: {formatCurrency(analytics.totalRevenue)}</p>
          <button
            onClick={() => { setWithdrawError(''); setWithdrawSuccess(''); setShowWithdraw(true); }}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
          >
            Withdraw to bank
          </button>
          {withdrawals.length > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              {withdrawals.length} withdrawal request{withdrawals.length !== 1 ? 's' : ''} recorded
            </p>
          )}
        </Card>
      </div>

      {/* Withdrawal dialog */}
      <Dialog open={showWithdraw} onOpenChange={open => { if (!open) setShowWithdraw(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw Earnings</DialogTitle>
            <DialogDescription>
              Enter your bank details. Your withdrawal will be processed within 1-2 business days.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div className="text-sm bg-green-50 border border-green-200 rounded-md px-3 py-2">
              Available: <strong>{formatCurrency(balance)}</strong>
            </div>
            {withdrawSuccess && (
              <div className="text-sm bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-blue-700">{withdrawSuccess}</div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Amount (NGN) *</label>
              <input
                type="number" min={0} step="0.01"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                placeholder={`Max: ${Math.round(balance).toLocaleString('en-NG')}`}
                value={withdrawForm.amount}
                onChange={e => setWithdrawForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Bank *</label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                value={withdrawForm.bankCode}
                onChange={e => setWithdrawForm(f => ({ ...f, bankCode: e.target.value }))}
              >
                <option value="">Select bank…</option>
                {NIGERIAN_BANKS.map(b => (
                  <option key={b.code} value={b.code}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Account Number *</label>
              <input
                type="text" maxLength={10}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                placeholder="10-digit NUBAN"
                value={withdrawForm.accountNumber}
                onChange={e => setWithdrawForm(f => ({ ...f, accountNumber: e.target.value.replace(/\D/g, '') }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Account Name *</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                placeholder="As registered with your bank"
                value={withdrawForm.accountName}
                onChange={e => setWithdrawForm(f => ({ ...f, accountName: e.target.value }))}
              />
            </div>
            {withdrawError && <p className="text-xs text-red-600">{withdrawError}</p>}
          </div>

          <DialogFooter className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              onClick={() => setShowWithdraw(false)}
            >Cancel</button>
            <button
              type="button"
              disabled={withdrawing}
              className="inline-flex items-center rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-gray-800 disabled:opacity-60"
              onClick={handleWithdraw}
            >
              {withdrawing ? <><Loader2 className="size-3 animate-spin mr-1.5" />Processing…</> : 'Confirm Withdrawal'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KPI grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="p-6 animate-fade-in-up transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
              style={{ animationDelay: `${index * 0.08}s` }}>
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`size-6 ${stat.color}`} />
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
              <p className="text-xl font-bold text-gray-900">{stat.value}</p>
            </Card>
          );
        })}
      </div>

      {/* Business insights */}
      <div className="mt-2 mb-8">
        <Card className="p-6">
          <h2 className="text-gray-900 mb-4">{t('businessInsightsTitle')}</h2>
          <div className="space-y-4">
            {[
              { dot: 'bg-blue-600',   title: t('orderManagementTitle'),  body: t('orderManagementText').replace('{count}', String(analytics.totalOrders)) },
              { dot: 'bg-green-600',  title: t('productCatalogTitle'),   body: t('productCatalogText').replace('{count}', String(analytics.totalProducts)) },
              { dot: 'bg-purple-600', title: t('revenueGrowthTitle'),    body: t('revenueGrowthText').replace('{value}', formatCurrency(analytics.averageOrderValue)) },
            ].map(({ dot, title, body }) => (
              <div key={title} className="flex items-start gap-3">
                <div className={`w-2 h-2 ${dot} rounded-full mt-2 shrink-0`} />
                <div>
                  <p className="text-gray-900">{title}</p>
                  <p className="text-sm text-gray-600">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Reviews analytics */}
      <Card className="p-6">
        <h2 className="text-gray-900 mb-4">{t('reviewsAnalyticsTitle')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div>
            <p className="text-sm text-gray-600 mb-1">{t('totalReviewsLabel')}</p>
            <p className="text-xl font-bold text-gray-900">{reviewsStats.totalReviews}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">{t('averageRatingLabel')}</p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`size-4 ${i < Math.round(reviewsStats.averageRating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                ))}
              </div>
              <span className="text-gray-900">{reviewsStats.averageRating.toFixed(2)}</span>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">{t('uniqueReviewersLabel')}</p>
            <p className="text-xl font-bold text-gray-900">{reviewsStats.uniqueReviewers}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">{t('ratingDistributionLabel')}</p>
            <div className="space-y-1">
              {[5,4,3,2,1].map(r => (
                <div key={r} className="flex items-center gap-2 text-sm">
                  <span className="w-6 text-gray-700">{r}★</span>
                  <div className="flex-1 bg-gray-100 h-2 rounded">
                    <div className="bg-yellow-400 h-2 rounded" style={{
                      width: `${reviewsStats.totalReviews ? (reviewsStats.distribution[r as 1|2|3|4|5] / reviewsStats.totalReviews) * 100 : 0}%`
                    }} />
                  </div>
                  <span className="w-8 text-right text-gray-700">{reviewsStats.distribution[r as 1|2|3|4|5]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="text-gray-900 mb-3">{t('topProductsByReviews')}</p>
          {reviewsStats.topProducts.length === 0 ? (
            <p className="text-sm text-gray-500">{t('noReviewsProducts')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reviewsStats.topProducts.map(p => (
                <Card key={p.productId} className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-gray-900 text-sm">{p.name}</p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`size-3 ${i < Math.round(p.avg) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                        ))}
                      </div>
                      <span>{p.avg.toFixed(1)} · {p.count} reviews</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
