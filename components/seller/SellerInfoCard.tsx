import { useEffect, useMemo, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { ArrowRight } from 'lucide-react';
import { supabase } from '../../utils/supabase/client';

interface SellerInfoCardProps {
  sellerId: string | null;
  sellerName: string;
  onOpenSellerPage?: (sellerId: string) => void;
}

// Helper to map metric text to a numeric score for analytics display
const metricScore = (val: string | null | undefined) => {
  switch ((val || '').toLowerCase()) {
    case 'excellent': return 1.0;
    case 'good':
    case 'normal': return 0.7;
    case 'bad': return 0.3;
    default: return 0.0;
  }
};

export function SellerInfoCard({ sellerId, sellerName, onOpenSellerPage }: SellerInfoCardProps) {
  const [followers, setFollowers] = useState<number>(0);
  const [following, setFollowing] = useState<boolean>(false);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [metrics, setMetrics] = useState<{ shipping_speed: string | null; quality_score: string | null; customer_rating: string | null } | null>(null);
  const [avgRating, setAvgRating] = useState<number>(0);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    if (!sellerId) return;
    const load = async () => {
      // Followers count and whether current user follows
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      const { count } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', sellerId);
      setFollowers(count || 0);
      if (uid) {
        const { data: f } = await supabase
          .from('followers')
          .select('id')
          .eq('seller_id', sellerId)
          .eq('follower_id', uid)
          .maybeSingle();
        setFollowing(!!f);
      } else {
        setFollowing(false);
      }

      // Metrics (single row per seller)
      const { data: m } = await supabase
        .from('seller_metrics')
        .select('shipping_speed, quality_score, customer_rating')
        .eq('seller_id', sellerId)
        .maybeSingle();
      setMetrics((m as any) || null);

      // Seller score: average rating across all seller's products
      const { data: prods } = await supabase
        .from('products')
        .select('id')
        .eq('seller_id', sellerId);
      const ids = ((prods as any[]) || []).map(p => p.id);
      if (ids.length) {
        const { data: revs } = await supabase
          .from('reviews')
          .select('product_id, rating')
          .in('product_id', ids);
        const list = (revs as any[]) || [];
        const avg = list.length ? list.reduce((s, r) => s + (Number(r.rating) || 0), 0) / list.length : 0;
        setAvgRating(avg);
      } else {
        setAvgRating(0);
      }

      // Basic seller profile info (name, avatar, address)
      const { data: prof } = await supabase
        .from('profiles')
        .select('name, email, avatar_url, address')
        .eq('id', sellerId)
        .maybeSingle();
      if (prof) {
        const p: any = prof;
        setProfileName(p.name || p.email || null);
        setAvatarUrl(p.avatar_url || null);
        setAddress(p.address || null);
      } else {
        setProfileName(null);
        setAvatarUrl(null);
        setAddress(null);
      }
    };
    load();

    // Realtime followers count
    const ch = supabase
      .channel('followers-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'followers', filter: `seller_id=eq.${sellerId}` }, () => {
        // Refresh followers quickly
        supabase
          .from('followers')
          .select('*', { count: 'exact', head: true })
          .eq('seller_id', sellerId)
          .then(({ count }) => setFollowers(count || 0));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sellerId]);

  const sellerScorePct = useMemo(() => Math.round((avgRating / 5) * 100), [avgRating]);

  const handleFollowToggle = async () => {
    if (!sellerId) return;
    setLoadingFollow(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        alert('Please log in to follow sellers.');
        return;
      }
      if (following) {
        await supabase
          .from('followers')
          .delete()
          .eq('seller_id', sellerId)
          .eq('follower_id', uid);
        setFollowing(false);
      } else {
        await supabase
          .from('followers')
          .insert({ seller_id: sellerId, follower_id: uid });
        setFollowing(true);
      }
    } catch (e) {
      console.error('Follow error', e);
    } finally {
      setLoadingFollow(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-gray-900">Seller Information</div>
        <div className="flex items-center gap-2">
          {sellerId && onOpenSellerPage && (
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full h-7 w-7"
              onClick={() => onOpenSellerPage(sellerId)}
            >
              <ArrowRight className="size-4" />
            </Button>
          )}
          {sellerId && (
            <Button
              size="sm"
              variant={following ? 'outline' : 'default'}
              onClick={handleFollowToggle}
              disabled={loadingFollow}
            >
              {following ? 'Following' : 'Follow'}
            </Button>
          )}
        </div>
      </div>
      <div className="text-sm text-gray-900 mb-1">{profileName ?? sellerName}</div>
      {address && (
        <div className="text-sm text-gray-700 mb-1">{address}</div>
      )}
      <div className="text-sm text-gray-700 mb-1">{sellerScorePct}% Seller Score</div>
      <div className="text-sm text-gray-700 mb-4">{followers} Followers</div>

      <div className="text-sm text-gray-900 mb-2">Seller Performance</div>
      <div className="space-y-1 text-sm text-gray-700">
        <div>Shipping speed: {metrics?.shipping_speed ?? '—'}</div>
        <div>Quality Score: {metrics?.quality_score ?? '—'}</div>
        <div>Customer Rating: {metrics?.customer_rating ?? '—'}</div>
      </div>
    </Card>
  );
}
