import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { User, Product } from '../../App';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { saveCartToSupabase, loadCartFromSupabase, applyDiscountSession, ProductDiscount, getProductDiscount } from '../../utils/supabase/cartService';
import { ExitIntentPopup } from '../ExitIntentPopup';
import { BuyerHeader } from './BuyerHeader';
import { ProductsView } from './ProductsView';
import { BuyerCart } from './BuyerCart';
import { BuyerCheckout } from './BuyerCheckout';
import { BuyerOrders } from './BuyerOrders';
import { BuyerProfile } from './BuyerProfile';
import { BuyerWishlist } from './BuyerWishlist';
import { BuyerInbox } from './BuyerInbox';
import { BuyerHelpCenter } from './BuyerHelpCenter';
import { BuyerTrackOrder } from './BuyerTrackOrder';
import { BuyerReturns } from './BuyerReturns';
import { ProductDetail } from '../../components/ProductDetail';
import { SellerProfile } from './SellerProfile';
import { Footer } from '../Footer';
import { Star, X, Bell, Mail, Megaphone } from 'lucide-react';
import { Button } from '../ui/button';
import { useLanguage } from '../../utils/i18n/LanguageContext';

/* ─── Inbox toast notification ──────────────────────────────────── */
interface ToastMsg { id: string; subject: string; body: string; sender_role: string; is_broadcast: boolean; }

function InboxToast({ msg, onDismiss, onOpen, t }: { msg: ToastMsg; onDismiss: () => void; onOpen: () => void; t: (key: string) => string }) {
  const [pct, setPct] = useState(100);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const start = performance.now();
    const DURATION = 5000;
    let raf: number;
    const tick = (now: number) => {
      const remaining = Math.max(0, 1 - (now - start) / DURATION);
      setPct(remaining * 100);
      if (remaining > 0) { raf = requestAnimationFrame(tick); }
      else { onDismiss(); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const icon = msg.is_broadcast
    ? <Megaphone className="size-4 text-orange-600" />
    : msg.sender_role === 'admin'
      ? <Bell className="size-4 text-purple-600" />
      : <Mail className="size-4 text-blue-600" />;

  const iconBg = msg.is_broadcast ? 'bg-orange-100' : msg.sender_role === 'admin' ? 'bg-purple-100' : 'bg-blue-100';

  return (
    <div className={`fixed top-4 right-4 z-[200] w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-[110%]'}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`size-9 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{msg.subject}</p>
            <p className="text-xs text-gray-500 capitalize">{msg.is_broadcast ? t('shopHubAnnouncement') : `From: ${msg.sender_role}`}</p>
            <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">{msg.body}</p>
          </div>
          <button onClick={onDismiss} className="shrink-0 text-gray-400 hover:text-gray-600"><X className="size-4" /></button>
        </div>
        <button onClick={onOpen} className="mt-2 text-xs font-semibold text-blue-600 hover:underline">{t('openInboxBtn')}</button>
      </div>
      <div className="h-1 bg-gray-100">
        <div className="h-full bg-blue-500" style={{ width: `${pct}%`, transition: 'none' }} />
      </div>
    </div>
  );
}

interface RatingOrder {
  orderId: string;
  items: Array<{ productId: string; productName: string; sellerId: string }>;
}

function RatingModal({ ratingOrder, onClose }: { ratingOrder: RatingOrder; onClose: () => void }) {
  const { t } = useLanguage();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }

    const inserts = ratingOrder.items.map(item => ({
      order_id: ratingOrder.orderId,
      product_id: item.productId,
      seller_id: item.sellerId,
      buyer_id: user.id,
      rating: ratings[item.productId] || 5,
      comment: comments[item.productId] || '',
    }));

    await supabase.from('product_reviews').upsert(inserts, { onConflict: 'order_id,product_id' });
    setDone(true);
    setSubmitting(false);
    setTimeout(onClose, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{t('rateYourOrder')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="size-5" /></button>
        </div>

        {done ? (
          <div className="text-center py-6">
            <div className="size-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Star className="size-6 text-green-600 fill-green-600" />
            </div>
            <p className="font-medium text-gray-900">{t('thankYouRating')}</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-5">{t('orderDeliveredQuestion')}</p>
            <div className="space-y-5">
              {ratingOrder.items.map(item => (
                <div key={item.productId}>
                  <p className="text-sm font-medium text-gray-900 mb-2">{item.productName}</p>
                  <div className="flex gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatings(r => ({ ...r, [item.productId]: star }))}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={`size-7 ${(ratings[item.productId] || 0) >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={2}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    placeholder={t('optionalComment')}
                    value={comments[item.productId] || ''}
                    onChange={e => setComments(c => ({ ...c, [item.productId]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" onClick={onClose} className="flex-1">{t('skipBtn')}</Button>
              <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
                {submitting ? t('submittingLabel') : t('submitRatingBtn')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}



interface BuyerDashboardProps {
  user: User;
  accessToken: string;
  onLogout: () => void;
  showExitPopup: boolean;
  setShowExitPopup: (show: boolean) => void;
}

export function BuyerDashboard({ user, accessToken, onLogout, showExitPopup, setShowExitPopup }: BuyerDashboardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [cart, setCart] = useState<any[]>([]);
  const [refreshOrders, setRefreshOrders] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [pendingRating, setPendingRating] = useState<RatingOrder | null>(null);
  const [inboxToast, setInboxToast] = useState<ToastMsg | null>(null);
  const [activeDiscounts, setActiveDiscounts] = useState<Map<string, ProductDiscount>>(new Map());

  // Load cart from Supabase on component mount
  useEffect(() => {
    const loadCart = async () => {
      try {
        const savedCart = await loadCartFromSupabase();
        if (savedCart && savedCart.length > 0) {
          setCart(savedCart);
        }
      } catch (error) {
        console.error('Error loading cart:', error);
      }
    };
    loadCart();
  }, []);

  // Save cart to Supabase whenever it changes
  useEffect(() => {
    if (cart.length > 0 || (cart.length === 0 && localStorage.getItem('cart_saved'))) {
      saveCartToSupabase(cart, user.id);
      localStorage.setItem('cart_saved', 'true');
    }
  }, [cart, user.id]);

  // Handle exit popup - apply discount when user goes to cart
  const handleExitPopupGoToCart = async (discounts: Map<string, ProductDiscount>) => {
    try {
      // Apply discount sessions for each discounted product in cart
      for (const [productId, discount] of discounts.entries()) {
        const timeRemaining = Math.ceil(
          (new Date(discount.active_end_time).getTime() - Date.now()) / (1000 * 60)
        );
        await applyDiscountSession(
          discount.id,
          productId,
          user.id,
          false,
          Math.max(1, timeRemaining)
        );
      }
      setActiveDiscounts(discounts);
      // Navigate to cart page
      navigate('/buyer/cart');
    } catch (error) {
      console.error('Error applying discounts:', error);
      // Still navigate to cart even if discount application fails
      navigate('/buyer/cart');
    }
  };

  // Realtime: watch for orders becoming 'delivered' and prompt rating
  useEffect(() => {
    const channel = supabase
      .channel('buyer-order-delivery')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `buyer_id=eq.${user.id}` },
        async (payload) => {
          const updated = payload.new as any;
          if (updated.status !== 'delivered') return;
          // Check if already rated this order
          const { data: existing } = await supabase
            .from('product_reviews')
            .select('id')
            .eq('order_id', updated.id)
            .limit(1);
          if (existing && existing.length > 0) return;
          const items = (updated.items || []).map((i: any) => ({
            productId: i.productId || i.product_id,
            productName: i.productName || i.product_name || 'Product',
            sellerId: i.sellerId || i.seller_id || '',
          }));
          setPendingRating({ orderId: updated.id, items });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user.id]);

  // Inbox toast: show on load if unread, and on new message
  useEffect(() => {
    const checkUnread = async () => {
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, subject, body, sender_role, is_broadcast')
        .or(`recipient_id.eq.${user.id},is_broadcast.eq.true`)
        .order('created_at', { ascending: false })
        .limit(10);
      if (!msgs?.length) return;
      const { data: reads } = await supabase
        .from('message_reads')
        .select('message_id')
        .eq('user_id', user.id);
      const readIds = new Set((reads || []).map((r: any) => r.message_id));
      const first = msgs.find(m => !readIds.has(m.id));
      if (first) setInboxToast(first as ToastMsg);
    };
    checkUnread();

    const ch = supabase
      .channel('inbox-toast')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new as any;
        if (m.is_broadcast || m.recipient_id === user.id) {
          setInboxToast({ id: m.id, subject: m.subject, body: m.body, sender_role: m.sender_role, is_broadcast: m.is_broadcast });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user.id]);

  // Load persisted cart for this user from Supabase on mount
  useEffect(() => {
    const loadCart = async () => {
      try {
        const { data, error } = await supabase
          .from('cart_items')
          .select('quantity, products:product_id (*)')
          .eq('user_id', user.id);

        if (error) {
          console.error('Failed to load cart from Supabase', error);
          return;
        }

        const items = (data as any[]).map(row => ({
          product: row.products as Product,
          quantity: row.quantity as number,
        }));

        setCart(items);
      } catch (e) {
        console.error('Unexpected error loading cart', e);
      }
    };

    loadCart();
  }, [user.id]);

  const addToCart = (product: any, quantity: number = 1) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product.id === product.id);
      if (existingItem) {
        toast.success(`Updated: ${product.name}`, {
          description: `Quantity increased to ${existingItem.quantity + quantity}`,
          duration: 3000,
        });
        return prevCart.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      toast.success(`Added to cart!`, {
        description: product.name,
        duration: 3000,
      });
      return [...prevCart, { product, quantity }];
    });

    // Persist in Supabase (upsert by user_id + product_id)
    const persist = async () => {
      try {
        const existing = cart.find((item) => item.product.id === product.id);
        const newQuantity = (existing?.quantity || 0) + quantity;
        const { error } = await supabase.from('cart_items').upsert({
          user_id: user.id,
          product_id: product.id,
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,product_id' });
        if (error) console.error('Failed to persist cart add', error);
      } catch (e) {
        console.error('Unexpected error persisting cart add', e);
      }
    };

    void persist();
  };

  const updateCartItemQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prevCart =>
      prevCart.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );

    const persist = async () => {
      try {
        const { error } = await supabase
          .from('cart_items')
          .upsert({
            user_id: user.id,
            product_id: productId,
            quantity,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,product_id' });
        if (error) console.error('Failed to persist cart quantity', error);
      } catch (e) {
        console.error('Unexpected error updating cart quantity', e);
      }
    };

    void persist();
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId));

    const persist = async () => {
      try {
        const { error } = await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', productId);
        if (error) console.error('Failed to remove cart item in Supabase', error);
      } catch (e) {
        console.error('Unexpected error removing cart item', e);
      }
    };

    void persist();
  };

  const clearCart = () => {
    setCart([]);

    const persist = async () => {
      try {
        const { error } = await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', user.id);
        if (error) console.error('Failed to clear cart in Supabase', error);
      } catch (e) {
        console.error('Unexpected error clearing cart', e);
      }
    };

    void persist();
  };

  const handleOrderComplete = () => {
    clearCart();
    setRefreshOrders(prev => prev + 1);
    navigate('/buyer/orders');
  };

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {pendingRating && (
        <RatingModal ratingOrder={pendingRating} onClose={() => setPendingRating(null)} />
      )}
      {inboxToast && (
        <InboxToast
          msg={inboxToast}
          onDismiss={() => setInboxToast(null)}
          onOpen={() => { setInboxToast(null); navigate('/buyer/inbox'); }}
          t={t}
        />
      )}
      <ExitIntentPopup
        isOpen={showExitPopup}
        cart={cart}
        onClose={() => setShowExitPopup(false)}
        onGoToCart={handleExitPopupGoToCart}
      />
      <BuyerHeader
        user={user}
        cartItemCount={cartItemCount}
        onNavigatePath={navigate}
        currentPath={location.pathname}
        onLogout={onLogout}
      />

      <main className="flex-1">
        <Routes>
          <Route
            path="/buyer"
            element={
              selectedProduct ? (
                <ProductDetail
                  product={selectedProduct}
                  onAddToCart={addToCart}
                  onBack={() => setSelectedProduct(null)}
                  onOpenSellerPage={(sellerId) => {
                    setSelectedSellerId(sellerId);
                    navigate('/buyer/seller');
                  }}
                />
              ) : (
                <ProductsView
                  accessToken={accessToken}
                  onAddToCart={addToCart}
                  onOpenProduct={(p) => setSelectedProduct(p)}
                />
              )
            }
          />

          <Route
            path="/buyer/cart"
            element={
              <BuyerCart
                cart={cart}
                onUpdateQuantity={updateCartItemQuantity}
                onRemove={removeFromCart}
                onContinueShopping={() => navigate('/buyer')}
                onCheckout={() => navigate('/buyer/checkout')}
                activeDiscounts={activeDiscounts}
              />
            }
          />

          <Route
            path="/buyer/checkout"
            element={
              <BuyerCheckout
                cart={cart}
                user={user}
                accessToken={accessToken}
                onBack={() => navigate('/buyer/cart')}
                onOrderComplete={handleOrderComplete}
              />
            }
          />

          <Route
            path="/buyer/orders"
            element={
              <BuyerOrders
                accessToken={accessToken}
                refreshTrigger={refreshOrders}
                onBack={() => navigate('/buyer')}
              />
            }
          />

          <Route
            path="/buyer/help-center"
            element={<BuyerHelpCenter onBackToProducts={() => navigate('/buyer')} />}
          />

          <Route
            path="/buyer/track-order"
            element={
              <BuyerTrackOrder
                accessToken={accessToken}
                onBackToProducts={() => navigate('/buyer')}
              />
            }
          />

          <Route
            path="/buyer/returns"
            element={<BuyerReturns onBackToProducts={() => navigate('/buyer')} />}
          />

          <Route
            path="/buyer/wishlist"
            element={<BuyerWishlist onBackToProducts={() => navigate('/buyer')} />}
          />

          <Route
            path="/buyer/inbox"
            element={<BuyerInbox onBackToProducts={() => navigate('/buyer')} />}
          />

          <Route
            path="/buyer/account"
            element={<BuyerProfile onBackToProducts={() => navigate('/buyer')} />}
          />

          <Route
            path="/buyer/seller"
            element={
              selectedSellerId ? (
                <SellerProfile
                  sellerId={selectedSellerId}
                  onBack={() => navigate('/buyer')}
                />
              ) : (
                <Navigate to="/buyer" replace />
              )
            }
          />

          <Route path="*" element={<Navigate to="/buyer" replace />} />
        </Routes>
      </main>
      <Footer isLoggedIn={true} showAdminLink={false} onOpenAdmin={() => {}} />
    </div>
  );
}
