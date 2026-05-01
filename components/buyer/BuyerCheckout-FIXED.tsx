import { useState } from 'react';
import { PaymentMethodSelector } from '../payment/PaymentMethodSelector';
import { ArrowLeft, CreditCard, Lock, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { User } from '../../App';
import { useLanguage } from '../../utils/i18n/LanguageContext';

const VITE_PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

interface BuyerCheckoutProps {
  cart: any[];
  user: User;
  accessToken: string;
  onBack: () => void;
  onOrderComplete: () => void;
}

function CheckoutForm({ cart, user, accessToken, onBack, onOrderComplete }: BuyerCheckoutProps) {
  const { t } = useLanguage();
  
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    address: '',
    city: '',
    zipCode: '',
    country: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shipping = subtotal > 50 ? 0 : 9.99;
  const tax = Math.round(subtotal * 0.08);
  const total = subtotal + shipping + tax;

  const handlePaymentSuccess = async (reference: string, method: 'paystack' | 'stripe') => {
    console.log('Payment successful:', { reference, method });
    
    try {
      const response = await fetch(`https://azelpjscwzkwioxoquft.supabase.co/functions/v1/server/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          items: cart.map(item => ({
            productId: item.product.id,
            productName: item.product.name,
            productImage: item.product.image,
            quantity: item.quantity,
            price: item.product.price,
            sellerId: item.product.sellerId,
            sellerName: item.product.sellerName,
          })),
          shippingInfo: formData,
          total,
          paymentReference: reference,
          paymentMethod: method,
        }),
      });

      const result = await response.json();
      if (result.success) {
        onOrderComplete();
      } else {
        throw new Error(result.error || 'Order creation failed');
      }
    } catch (error) {
      console.error('Order creation error:', error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center mb-6">
            <Button
              variant="ghost"
              onClick={onBack}
              className="mr-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Cart
            </Button>
            <h1 className="text-2xl font-bold">Checkout</h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="size-5 text-blue-600" />
                  <h2 className="text-gray-900">Shipping Information</h2>
                  <Lock className="size-4 text-gray-400 ml-auto" />
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Street Address</Label>
                    <Input
                      id="address"
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zipCode">ZIP Code</Label>
                      <Input
                        id="zipCode"
                        type="text"
                        value={formData.zipCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, zipCode: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        type="text"
                        value={formData.country}
                        onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card className="p-6 sticky top-20">
                <h2 className="text-gray-900 mb-4">Order Summary</h2>

                <div className="space-y-3 mb-4">
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex justify-between text-sm">
                      <span className="text-gray-900">{item.product.name}</span>
                      <span className="text-gray-500">x{item.quantity}</span>
                      <span className="text-gray-900">₦{item.product.price.toLocaleString()}</span>
                    </div>
                  ))}

                  <div className="border-t pt-3">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Subtotal</span>
                      <span>₦{subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Shipping</span>
                      <span>₦{shipping.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Tax (8%)</span>
                      <span>₦{tax.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between mb-6">
                      <span className="text-gray-900">Total</span>
                      <span className="text-gray-900">₦{total.toLocaleString()}</span>
                    </div>

                    <div className="text-center text-sm text-gray-500">
                      Complete payment above to place your order
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="size-5 text-blue-600" />
                  <h2 className="text-gray-900">Payment Method</h2>
                </div>

                <PaymentMethodSelector
                  amount={total}
                  email={formData.email}
                  onPaymentSuccess={handlePaymentSuccess}
                  onPaymentCancel={() => {}}
                  onError={(error) => console.error('Payment error:', error)}
                />
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BuyerCheckout(props: BuyerCheckoutProps) {
  return (
    <CheckoutForm {...props} />
  );
}
