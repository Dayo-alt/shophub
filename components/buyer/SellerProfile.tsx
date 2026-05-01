import { useEffect, useState } from 'react';
import { ArrowLeft, Star, Users, TrendingUp } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { supabase } from '../../utils/supabase/client';

interface SellerProfileProps {
  sellerId: string;
  onBack: () => void;
}

interface ReviewsStats {
  totalReviews: number;
  uniqueReviewers: number;
  averageRating: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export function SellerProfile({ sellerId, onBack }: SellerProfileProps) {
  const [loading, setLoading] = useState(true);
  const [sellerName, setSellerName] = useState<string>('Seller');
  const [sellerEmail, setSellerEmail] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [following, setFollowing] = useState<boolean>(false);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [sellerScorePct, setSellerScorePct] = useState<number>(0);
  const [reviewsStats, setReviewsStats] = useState<ReviewsStats>({
    totalReviews: 0,
    uniqueReviewers: 0,
    averageRating: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });

  useEffect(() => {
    const load = async () => {
      try {
        // Basic seller info from profiles (include optional avatar and address if present)
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, email, avatar_url, address')
          .eq('id', sellerId)
          .maybeSingle();
        if (profile) {
          const p: any = profile;
          setSellerName(p.name || p.email || 'Seller');
          setSellerEmail(p.email || '');
          setAvatarUrl(p.avatar_url || null);
          setAddress(p.address || null);
        }

        // Followers count and whether current user follows this seller
        const { count } = await supabase
          .from('followers')
          .select('*', { count: 'exact', head: true })
          .eq('seller_id', sellerId);
        setFollowersCount(count || 0);

        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id ?? null;
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

        // Reviews analytics similar to SellerAnalytics, but for this seller
        const { data: productsRes } = await supabase
          .from('products')
          .select('id')
          .eq('seller_id', sellerId);
        const products = (productsRes as Array<{ id: string }>) || [];
        const productIds = products.map((p) => p.id);

        if (productIds.length) {
          const { data: reviews } = await supabase
            .from('reviews')
            .select('product_id, user_email, rating')
            .in('product_id', productIds);
          const revList =
            (reviews as Array<{ product_id: string; user_email: string | null; rating: number }>) || [];

          const dist: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
          revList.forEach((r) => {
            const key = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
            dist[key] += 1;
          });
          const totalReviews = revList.length;
          const uniqueReviewers = new Set(revList.map((r) => r.user_email || '')).size;
          const averageRating = totalReviews
            ? revList.reduce((s, r) => s + (r.rating || 0), 0) / totalReviews
            : 0;

          setReviewsStats({ totalReviews, uniqueReviewers, averageRating, distribution: dist });
          setSellerScorePct(Math.round((averageRating / 5) * 100));
        } else {
          setReviewsStats({
            totalReviews: 0,
            uniqueReviewers: 0,
            averageRating: 0,
            distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          });
          setSellerScorePct(0);
        }
      } catch (error) {
        console.error('Failed to load seller profile', error);
      } finally {
        setLoading(false);
      }
    };

    if (sellerId) {
      load();
    }
  }, [sellerId]);

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
        setFollowersCount((c) => Math.max(0, c - 1));
      } else {
        await supabase
          .from('followers')
          .insert({ seller_id: sellerId, follower_id: uid });
        setFollowing(true);
        setFollowersCount((c) => c + 1);
      }
    } catch (e) {
      console.error('Follow error', e);
    } finally {
      setLoadingFollow(false);
    }
  };

  if (loading) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="loading">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
}
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in-up">
      <Button
        variant="ghost"
        onClick={onBack}
        className="mb-6 gap-2"
      >
        <ArrowLeft className="size-4" />
        Back to product
      </Button>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-gray-500 text-xl font-semibold">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={sellerName} className="w-full h-full object-cover" />
          ) : (
            <span>{sellerName.charAt(0).toUpperCase()}</span>
          )}
          </div>
          <div>
            <h1 className="text-gray-900 mb-1">{sellerName}</h1>
            {sellerEmail && <p className="text-gray-600 text-sm mb-1">{sellerEmail}</p>}
            {address && <p className="text-gray-600 text-sm">{address}</p>}
            <p className="text-gray-500 text-xs mt-1">Seller Profile</p>
          </div>
        </div>

        <Button
          size="sm"
          variant={following ? 'outline' : 'default'}
          onClick={handleFollowToggle}
          disabled={loadingFollow}
        >
          {following ? 'Following' : 'Follow'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="p-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Followers</p>
            <p className="text-gray-900 text-lg">{followersCount}</p>
          </div>
          <Users className="size-8 text-indigo-600" />
        </Card>

        <Card className="p-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Seller Score</p>
            <p className="text-gray-900 text-lg">{sellerScorePct}%</p>
          </div>
          <TrendingUp className="size-8 text-emerald-600" />
        </Card>

        <Card className="p-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Average Rating</p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`size-4 ${
                      i < Math.round(reviewsStats.averageRating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <span className="text-gray-900 text-sm">
                {reviewsStats.averageRating.toFixed(2)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-gray-900 mb-4">Reviews Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <p className="text-sm text-gray-600 mb-1">Total Reviews</p>
            <p className="text-gray-900">{reviewsStats.totalReviews}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Unique Reviewers</p>
            <p className="text-gray-900">{reviewsStats.uniqueReviewers}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Rating Distribution</p>
            <div className="space-y-1">
              {[5, 4, 3, 2, 1].map((r) => (
                <div key={r} className="flex items-center gap-2 text-sm">
                  <span className="w-6 text-gray-700">{r}★</span>
                  <div className="flex-1 bg-gray-100 h-2 rounded">
                    <div
                      className="bg-yellow-400 h-2 rounded"
                      style={{
                        width: `${
                          reviewsStats.totalReviews
                            ? (reviewsStats.distribution[r as 1 | 2 | 3 | 4 | 5] /
                                reviewsStats.totalReviews) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-gray-700">
                    {reviewsStats.distribution[r as 1 | 2 | 3 | 4 | 5]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
