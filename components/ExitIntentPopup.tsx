import { useEffect, useState } from 'react';
import { X, ShoppingBag, Clock, Zap, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { CartItem } from '../App';
import { ProductDiscount, getActiveDiscountsForCart, getRecentActiveDiscounts, formatTimeRemaining } from '../utils/supabase/cartService';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface ExitIntentPopupProps {
  isOpen: boolean;
  cart: CartItem[];
  onClose: () => void;
  onGoToCart: (discounts: Map<string, ProductDiscount>) => void;
}

export function ExitIntentPopup({ isOpen, cart, onClose, onGoToCart }: ExitIntentPopupProps) {
  const [discounts, setDiscounts] = useState<Map<string, ProductDiscount>>(new Map());
  const [recentDiscounts, setRecentDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dontShowEmpty, setDontShowEmpty] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Check if user previously clicked "don't show again" for empty cart
      const dontShowEmptyCart = sessionStorage.getItem('dontShowEmptyCartPopup') === 'true';
      setDontShowEmpty(dontShowEmptyCart);
      
      // If cart is empty and user clicked "don't show again", close popup immediately
      if (cart.length === 0 && dontShowEmptyCart) {
        onClose();
        return;
      }
      
      fetchDiscounts();
    }
  }, [isOpen, cart]);

  const handleDontShowAgain = () => {
    const newValue = !dontShowEmpty;
    setDontShowEmpty(newValue);
    if (newValue) {
      sessionStorage.setItem('dontShowEmptyCartPopup', 'true');
    } else {
      sessionStorage.removeItem('dontShowEmptyCartPopup');
    }
  };

  const fetchDiscounts = async () => {
    setLoading(true);
    try {
      // Fetch cart discounts if cart has items
      if (cart.length > 0) {
        const activeDiscounts = await getActiveDiscountsForCart(cart);
        setDiscounts(activeDiscounts);
      } else {
        setDiscounts(new Map());
      }

      // Always fetch recent discounts to show even when cart is empty
      const recent = await getRecentActiveDiscounts(2);
      setRecentDiscounts(recent);
    } catch (error) {
      console.error('Error fetching discounts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleGoToCart = () => {
    // Only call onGoToCart if cart has items
    if (cart.length > 0) {
      onGoToCart(discounts);
    }
    onClose();
  };

  // Get unique products in cart (some might have quantity > 1)
  const uniqueProducts = Array.from(
    cart.reduce((map, item) => {
      if (!map.has(item.product.id)) {
        map.set(item.product.id, item);
      }
      return map;
    }, new Map<string, CartItem>()).values()
  );

  // Filter products that have active discounts
  const productsWithDiscounts = uniqueProducts.filter(item => 
    discounts.has(item.product.id)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4 p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">👀 Wait!</h2>
            <p className="text-sm text-gray-600">
              {cart.length > 0 ? 'Your cart is still saved.' : 'Don\'t miss out!'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600"></div>
          </div>
        ) : cart.length > 0 ? (
          // CASE: Cart has items
          productsWithDiscounts.length > 0 ? (
            <>
              {/* Products with Discounts */}
              <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
                {productsWithDiscounts.map((item) => {
                  const discount = discounts.get(item.product.id);
                  if (!discount) return null;

                  const timeRemaining = Math.ceil(
                    (new Date(discount.active_end_time).getTime() - Date.now()) / 60000
                  );

                  return (
                    <div key={item.product.id} className="border border-orange-200 rounded-lg p-3 bg-orange-50">
                      <div className="flex gap-3">
                        <div className="w-16 h-16 flex-shrink-0 rounded bg-gray-100 overflow-hidden">
                          <ImageWithFallback
                            src={item.product.image}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                            {item.product.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs line-through text-gray-500">
                              ₦{discount.original_price.toLocaleString()}
                            </span>
                            <span className="text-sm font-bold text-orange-600">
                              ₦{discount.discount_price.toLocaleString()}
                            </span>
                            <span className="text-xs bg-orange-600 text-white px-2 py-0.5 rounded-full">
                              Save {discount.discount_percent?.toFixed(0)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-600">
                            <Clock className="size-3" />
                            <span>Expires in {formatTimeRemaining(Math.max(0, timeRemaining))}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Discount Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-900">
                  <strong>🎉 Special Offer:</strong> Complete your purchase in the next {formatTimeRemaining(
                    Math.ceil(
                      Math.min(
                        ...productsWithDiscounts.map(item => {
                          const discount = discounts.get(item.product.id);
                          return discount ? Math.ceil(
                            (new Date(discount.active_end_time).getTime() - Date.now()) / 60000
                          ) : 0;
                        })
                      )
                    )
                  )} to get these prices!
                </p>
              </div>
            </>
          ) : (
            /* No Discounts, Just Cart Reminder */
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingBag className="size-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">You have {cart.length} item{cart.length !== 1 ? 's' : ''} in your cart</h3>
              </div>
              <p className="text-sm text-gray-600">
                Your items are waiting. Complete your purchase now!
              </p>
            </div>
          )
        ) : (
          // CASE: Empty Cart - Show Recent Discounts
          <div>
            <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="size-5 text-green-600" />
                <h3 className="font-semibold text-gray-900">Amazing Deals Waiting!</h3>
              </div>
              <p className="text-sm text-gray-600">
                Check out these exclusive offers before they expire. Limited time only!
              </p>
            </div>

            {recentDiscounts.length > 0 ? (
              <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
                {recentDiscounts.map((item) => {
                  const timeRemaining = Math.ceil(
                    (new Date(item.active_end_time).getTime() - Date.now()) / 60000
                  );

                  return (
                    <div key={item.id} className="border border-orange-200 rounded-lg p-3 bg-orange-50">
                      <div className="flex gap-3">
                        <div className="w-16 h-16 flex-shrink-0 rounded bg-gray-100 overflow-hidden">
                          <ImageWithFallback
                            src={item.product?.image}
                            alt={item.product?.name || 'Product'}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                            {item.product?.name || 'Exclusive Item'}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs line-through text-gray-500">
                              ₦{item.original_price.toLocaleString()}
                            </span>
                            <span className="text-sm font-bold text-orange-600">
                              ₦{item.discount_price.toLocaleString()}
                            </span>
                            <span className="text-xs bg-orange-600 text-white px-2 py-0.5 rounded-full">
                              Save {item.discount_percent?.toFixed(0)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-600">
                            <Clock className="size-3" />
                            <span>Expires in {formatTimeRemaining(Math.max(0, timeRemaining))}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 text-center">
                  Check back soon for exclusive deals and offers!
                </p>
              </div>
            )}

            {/* Don't show again checkbox - only for empty cart */}
            <div className="mb-4 flex items-center gap-2 px-2">
              <button
                onClick={handleDontShowAgain}
                className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-colors ${
                  dontShowEmpty
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-gray-300 hover:border-blue-600'
                }`}
              >
                {dontShowEmpty && <Check className="size-3 text-white" />}
              </button>
              <label
                onClick={handleDontShowAgain}
                className="text-sm text-gray-600 cursor-pointer hover:text-gray-900"
              >
                Don't show this again
              </label>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="space-y-2">
          <Button
            onClick={handleGoToCart}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            {cart.length > 0 ? 'Go to Cart' : 'Start Shopping'}
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full"
          >
            No thanks
          </Button>
        </div>

        {/* Subtext */}
        <p className="text-xs text-gray-500 text-center mt-3">
          Your cart data is saved and secure
        </p>
      </Card>
    </div>
  );
}
