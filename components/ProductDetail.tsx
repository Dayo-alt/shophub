import { useEffect, useState } from 'react';
import { useLanguage } from '../utils/i18n/LanguageContext';
import { ArrowLeft, ArrowLeftCircle, ArrowRightCircle, Star, ShoppingCart, Package, Shield, Truck, Heart, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Product } from '../App';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { supabase } from '../utils/supabase/client';
import { SellerInfoCard } from './seller/SellerInfoCard';
import { useParams, useNavigate } from 'react-router-dom';

interface ProductDetailProps {
  product: Product;
  onAddToCart: (product: Product, quantity: number) => void;
  onBack: () => void;
  onOpenSellerPage?: (sellerId: string) => void;
}

export function ProductDetail({ product, onAddToCart, onBack, onOpenSellerPage }: ProductDetailProps) {
  const { formatCurrency, t } = useLanguage();
  const [quantity, setQuantity] = useState(1);
  const [reviews, setReviews] = useState<Array<{
    id: string;
    product_id: string;
    user_id: string | null;
    user_email: string | null;
    rating: number;
    comment: string;
    created_at: string;
    user_name?: string | null;
    likes_count?: number;
    liked_by_me?: boolean;
  }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const images = (product.image || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const reviewCount = reviews.length;
  const averageRating = reviewCount
    ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewCount
    : 0;

  useEffect(() => {
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const currentUserId = auth.user?.id ?? null;
      setCurrentEmail(auth.user?.email ?? null);

      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false });

      if (!error) {
        const revs = (data as any[]) ?? [];

        const reviewIds = revs.map(r => r.id);
        let likesByReview: Record<string, { count: number; likedByMe: boolean }> = {};
        if (reviewIds.length) {
          const { data: likes } = await supabase
            .from('review_likes')
            .select('review_id, user_id')
            .in('review_id', reviewIds as string[]);

          likesByReview = {};
          (likes as any[] || []).forEach(l => {
            const rid = l.review_id as string;
            if (!likesByReview[rid]) {
              likesByReview[rid] = { count: 0, likedByMe: false };
            }
            likesByReview[rid].count += 1;
            if (currentUserId && l.user_id === currentUserId) {
              likesByReview[rid].likedByMe = true;
            }
          });
        }

        const ids = Array.from(new Set(revs.map(r => r.user_id).filter(Boolean)));
        if (ids.length) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', ids as string[]);
          const nameById = Object.fromEntries(((profs as any[]) || []).map(p => [p.id, p.name]));
          setReviews(
            revs.map(r => ({
              ...r,
              user_name: nameById[r.user_id as string] || null,
              likes_count: likesByReview[r.id]?.count ?? 0,
              liked_by_me: likesByReview[r.id]?.likedByMe ?? false,
            })) as any,
          );
        } else {
          setReviews(
            revs.map(r => ({
              ...r,
              likes_count: likesByReview[r.id]?.count ?? 0,
              liked_by_me: likesByReview[r.id]?.likedByMe ?? false,
            })) as any,
          );
        }
      }

      // After loading reviews, check if this product is already in the user's wishlist
      if (currentUserId) {
        const { data: wishlistRows, error: wishlistError } = await supabase
          .from('wishlist_items')
          .select('id')
          .eq('user_id', currentUserId)
          .eq('product_id', product.id)
          .maybeSingle();

        if (!wishlistError && wishlistRows) {
          setIsInWishlist(true);
        } else {
          setIsInWishlist(false);
        }
      } else {
        setIsInWishlist(false);
      }
    };
    load();

    const reviewsChannel = supabase
      .channel('reviews-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews', filter: `product_id=eq.${product.id}` }, () => {
        load();
      })
      .subscribe();

    const likesChannel = supabase
      .channel('review-likes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'review_likes' }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(reviewsChannel);
      supabase.removeChannel(likesChannel);
    };
  }, [product.id]);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 2000);
    return () => clearInterval(id);
  }, [images.length]);

  const handleSubmitReview = async () => {
    try {
      setSubmitting(true);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      const email = auth.user?.email ?? null;
      if (!uid) {
        alert('Please log in to submit a review.');
        return;
      }

      const { error } = await supabase.from('reviews').insert({
        product_id: product.id,
        user_id: uid,
        user_email: email,
        rating,
        comment,
      });
      if (error) throw error;
      setComment('');
      setRating(5);
    } catch (e) {
      console.error('Failed to submit review:', e);
      alert('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLike = async (reviewId: string, liked: boolean) => {
    console.log('Toggling like', { reviewId, liked });
    try {
      const { data: auth } = await supabase.auth.getUser();
      console.log('Auth user for like:', auth);
      const uid = auth.user?.id ?? null;
      if (!uid) {
        alert('Please log in to like reviews.');
        return;
      }

      if (liked) {
        const { error } = await supabase
          .from('review_likes')
          .delete()
          .eq('review_id', reviewId)
          .eq('user_id', uid);
        console.log('Unlike result error:', error);
      } else {
        const { error } = await supabase
          .from('review_likes')
          .insert({ review_id: reviewId, user_id: uid });
        console.log('Like result error:', error);
      }
    } catch (e) {
      console.error('Failed to toggle like:', e);
    }
  };

  const handleAddToCart = () => {
    onAddToCart(product, quantity);
  };

  const handleAddToWishlist = async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      if (!uid) {
        alert('Please log in to add items to your wishlist.');
        return;
      }
      let error;

      if (isInWishlist) {
        // Remove from wishlist
        ({ error } = await supabase
          .from('wishlist_items')
          .delete()
          .eq('user_id', uid)
          .eq('product_id', product.id));

        if (error) {
          console.error('Failed to remove from wishlist:', error);
          alert('Could not remove this item from your wishlist.');
        } else {
          setIsInWishlist(false);
        }
      } else {
        // Add to wishlist
        ({ error } = await supabase
          .from('wishlist_items')
          .upsert({
            user_id: uid,
            product_id: product.id,
          }));

        if (error) {
          console.error('Failed to add to wishlist:', error);
          alert('Could not add this item to your wishlist.');
        } else {
          setIsInWishlist(true);
        }
      }
    } catch (e) {
      console.error('Unexpected error adding to wishlist:', e);
      alert('Could not add this item to your wishlist.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Button
        variant="ghost"
        onClick={onBack}
        className="mb-6 gap-2"
      >
        <ArrowLeft className="size-4" />
        Back to Products
      </Button>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
          <ImageWithFallback
            src={images[ currentImageIndex ] || product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />

          {images.length > 1 && (
            <>
              <button
                type="button"
                className="absolute inset-y-0 left-0 flex items-center px-2 text-white/80 hover:text-white"
                onClick={() =>
                  setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
                }
              >
                <ArrowLeftCircle className="size-7 drop-shadow" />
              </button>
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center px-2 text-white/80 hover:text-white"
                onClick={() =>
                  setCurrentImageIndex((prev) => (prev + 1) % images.length)
                }
              >
                <ArrowRightCircle className="size-7 drop-shadow" />
              </button>

              <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrentImageIndex(i)}
                    className={`h-2 w-2 rounded-full ${
                      i === currentImageIndex ? 'bg-white' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-gray-900">{product.name}</h1>
            <Badge>{product.category}</Badge>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`size-5 ${
                    i < Math.round(averageRating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
            <span className="text-gray-600">
              {averageRating.toFixed(2)} ({reviewCount} reviews)
            </span>
          </div>

          <div className="mb-6">
            <span className="text-blue-600">{formatCurrency(product.price, product.currencyCode)}</span>
          </div>

          <p className="text-gray-600 mb-6">{product.description}</p>

          <div className="mb-6">
            <p className="text-gray-900 mb-2">
              {t('stockLabel')} <span className="text-green-600">{product.stock} {t('availableLabel')}</span>
            </p>

            <div className="flex flex-col items-start gap-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label htmlFor="quantity" className="text-gray-900">
                    Quantity:
                  </label>
                  <div className="flex items-center border border-gray-300 rounded-md">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3 py-1 hover:bg-gray-100"
                    >
                      −
                    </button>
                    <input
                      id="quantity"
                      type="number"
                      min="1"
                      max={product.stock}
                      value={quantity}
                      onChange={(e) =>
                        setQuantity(
                          Math.max(1, Math.min(product.stock, parseInt(e.target.value) || 1)),
                        )
                      }
                      className="w-16 text-center border-x border-gray-300 py-1"
                    />
                    <button
                      onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                      className="px-3 py-1 hover:bg-gray-100"
                    >
                      +
                    </button>
                  </div>
                </div>

                <Button onClick={handleAddToCart} className="gap-2">
                  <ShoppingCart className="size-4" />
                  Add to Cart
                </Button>
              </div>

              <Button
                variant={isInWishlist ? 'default' : 'outline'}
                className={`gap-2 ${isInWishlist ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}`}
                onClick={handleAddToWishlist}
              >
                <Heart className="size-4" />
                {isInWishlist ? t('addedToWishlist') : t('addToWishlist')}
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Truck className="size-5 text-blue-600" />
                <div>
                  <p className="text-gray-900">{t('freeShippingTitle')}</p>
                  <p className="text-sm text-gray-600">{t('freeShippingDesc')}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Shield className="size-5 text-blue-600" />
                <div>
                  <p className="text-gray-900">{t('securePaymentTitle')}</p>
                  <p className="text-sm text-gray-600">{t('securePaymentDesc')}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Package className="size-5 text-blue-600" />
                <div>
                  <p className="text-gray-900">{t('easyReturnsTitle')}</p>
                  <p className="text-sm text-gray-600">{t('easyReturnsDesc')}</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="mt-6">
            <SellerInfoCard
              sellerId={product.sellerId || null}
              sellerName={product.sellerName || 'Seller'}
              onOpenSellerPage={onOpenSellerPage}
            />
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-6">
        <h2 className="text-gray-900">Reviews</h2>

        <Card className="p-4">
          {reviews.length === 0 ? (
            <p className="text-gray-600">No reviews yet.</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => (
                <div key={r.id} className="border-b last:border-b-0 pb-3 last:pb-0">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-900">{r.user_name || r.user_email || 'Anonymous'}</div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`size-4 ${i < Math.floor(r.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{r.comment}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                    <span>{new Date(r.created_at).toLocaleString()}</span>
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 ${
                        r.liked_by_me ? 'text-blue-600' : 'text-gray-500 hover:text-blue-600'
                      }`}
                      onClick={() => handleToggleLike(r.id, !!r.liked_by_me)}
                    >
                      <span>👍</span>
                      <span>{r.likes_count ?? 0}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="text-gray-900 mb-3">{t('writeReviewTitle')}</h3>
          <div className="flex flex-col gap-3 max-w-xl">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-gray-700">{t('ratingLabel2')}</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => {
                  const value = i + 1;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      className="p-0.5"
                    >
                      <Star
                        className={
                          value <= rating
                            ? 'size-6 fill-yellow-400 text-yellow-400'
                            : 'size-6 text-gray-300'
                        }
                      />
                    </button>
                  );
                })}
                <span className="ml-2 text-xs text-gray-500">{rating} / 5</span>
              </div>
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder={currentEmail ? t('shareExperiencePlaceholder') : t('loginToReview')}
              className="w-full border rounded-md p-2"
            />
            <div>
              <Button onClick={handleSubmitReview} disabled={submitting} className="gap-2">
                {submitting ? t('submittingLabel') : t('submitReviewBtn')}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function ProductDetailPage({
  onAddToCart,
}: {
  onAddToCart: (product: Product, quantity: number) => void;
}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (error) {
          console.error('Failed to load product by id:', error);
          setProduct(null);
        } else if (data) {
          const p = data as any;
          const mapped: Product = {
            ...(p as any),
            sellerId: p.sellerId ?? p.seller_id ?? '',
            sellerName: p.sellerName ?? p.seller_name ?? 'Seller',
          };
          setProduct(mapped);
        } else {
          setProduct(null);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm text-blue-600 hover:underline mb-4"
        >
          1 Back
        </button>
        <p className="text-gray-700">{t('productNotFound')}</p>
      </div>
    );
  }

  return (
    <ProductDetail
      product={product}
      onAddToCart={onAddToCart}
      onBack={() => navigate(-1)}
    />
  );
}
