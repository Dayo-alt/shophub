import { Trash2, ShoppingBag } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { useLanguage } from '../../utils/i18n/LanguageContext';

interface BuyerCartProps {
  cart: any[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onContinueShopping: () => void;
  onCheckout: () => void;
}

export function BuyerCart({ cart, onUpdateQuantity, onRemove, onContinueShopping, onCheckout }: BuyerCartProps) {
  const { t } = useLanguage();
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shipping = subtotal > 50 ? 0 : 9.99;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

  if (cart.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 animate-scale-in">
        <Card className="p-12 text-center">
          <ShoppingBag className="size-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-gray-900 mb-2">{t('cartEmptyTitle') || 'Your cart is empty'}</h2>
          <p className="text-gray-600 mb-6">{t('cartEmptySubtitle') || 'Add some products to get started!'}</p>
          <Button onClick={onContinueShopping}>
            {t('continueShopping') || 'Continue Shopping'}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in-up">
      <h1 className="text-gray-900 mb-8">{t('shoppingCartTitle') || 'Shopping Cart'}</h1>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {cart.map((item, index) => (
            <Card
              key={item.product.id}
              className="p-4 animate-fade-in-up transition-shadow duration-200 hover:shadow-md"
              style={{ animationDelay: `${index * 0.06}s` }}
            >
              <div className="flex gap-4">
                <div className="w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-gray-100">
                  <ImageWithFallback
                    src={item.product.image}
                    alt={item.product.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <h3 className="text-gray-900">{item.product.name}</h3>
                      <p className="text-sm text-gray-600">{item.product.category}</p>
                      <p className="text-sm text-gray-500">{t('sellerLabel') || 'Seller:'} {item.product.sellerName}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(item.product.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">{t('quantityLabel') || 'Qty:'}</label>
                        <div className="flex items-center border border-gray-300 rounded-md">
                          <button
                            onClick={() =>
                              onUpdateQuantity(
                                item.product.id,
                                Math.max(1, item.quantity - 1),
                              )
                            }
                            className="px-2 py-1 hover:bg-gray-100 text-sm"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={item.product.stock}
                            value={item.quantity}
                            onChange={(e) => {
                              const raw = parseInt(e.target.value, 10);
                              const next = Number.isNaN(raw) ? 1 : raw;
                              const clamped = Math.min(
                                Math.max(1, next),
                                item.product.stock || next,
                              );
                              onUpdateQuantity(item.product.id, clamped);
                            }}
                            className="w-12 text-center border-x border-gray-300 py-1 text-sm"
                          />
                          <button
                            onClick={() =>
                              onUpdateQuantity(
                                item.product.id,
                                Math.min(
                                  (item.product.stock || item.quantity + 1),
                                  item.quantity + 1,
                                ),
                              )
                            }
                            className="px-2 py-1 hover:bg-gray-100 text-sm"
                            disabled={
                              typeof item.product.stock === 'number' &&
                              item.quantity >= item.product.stock
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {typeof item.product.stock === 'number' && item.product.stock <= 5 && (
                        <p className="text-[11px] text-amber-600">
                          {t('lowStockHint') || `Only ${item.product.stock} left in stock`}
                        </p>
                      )}
                    </div>

                    <span className="text-gray-900">
                      ${(item.product.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-1 animate-slide-right" style={{ animationDelay: '0.15s' }}>
          <Card className="p-6 sticky top-20">
            <h2 className="text-gray-900 mb-4">{t('orderSummaryTitle') || 'Order Summary'}</h2>

            <div className="space-y-3 mb-4 pb-4 border-b border-gray-200">
              <div className="flex justify-between text-gray-600">
                <span>{t('subtotal') || 'Subtotal'}</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>{t('shipping') || 'Shipping'}</span>
                <span>{shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>{t('taxWithRate') || 'Tax (8%)'}</span>
                <span>${tax.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-between mb-6">
              <span className="text-gray-900">{t('total') || 'Total'}</span>
              <span className="text-gray-900">${total.toFixed(2)}</span>
            </div>

            {shipping > 0 && (
              <p className="text-sm text-gray-600 mb-4">
                {t('freeShippingHint') || 'Add more for free shipping!'}
              </p>
            )}

            <Button onClick={onCheckout} className="w-full mb-3">
              {t('proceedToCheckout') || 'Proceed to Checkout'}
            </Button>
            <Button
              variant="outline"
              onClick={onContinueShopping}
              className="w-full"
            >
              {t('continueShopping') || 'Continue Shopping'}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
