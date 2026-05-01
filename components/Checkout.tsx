import { useEffect, useState } from 'react';
import { ArrowLeft, Lock } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { CartItem, Order } from '../App';
import { PaymentMethodSelector } from './payment/PaymentMethodSelector';

interface CheckoutProps {
  cart: CartItem[];
  onPlaceOrder: (shippingInfo: Order['shippingInfo']) => void;
  onBack: () => void;
}

export function Checkout({ cart, onPlaceOrder, onBack }: CheckoutProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    address: '',
    city: '',
    zipCode: '',
    country: '',
  });

  const [showPayment, setShowPayment] = useState(false);
  const [paying, setPaying] = useState(false);

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shipping = subtotal > 50000 ? 0 : 1999; // NGN example: free shipping over 50,000 NGN
  const tax = Math.round(subtotal * 0.08);
  const total = subtotal + shipping + tax;

  const handlePaymentSuccess = (reference: string, method: 'paystack' | 'stripe') => {
    // Validate shipping information before proceeding
    const { name, email, address, city, zipCode, country } = formData;
    if (!name || !email || !address || !city || !zipCode || !country) {
      alert('Please complete all shipping information before payment');
      return;
    }

    const shippingInfo = { 
      name: formData.name, 
      email: formData.email, 
      address: formData.address, 
      city: formData.city, 
      zipCode: formData.zipCode, 
      country: formData.country 
    } as Order['shippingInfo'];
    
    // Store payment reference in order metadata
    const orderWithPayment = {
      shippingInfo,
      paymentReference: reference,
      paymentMethod: method,
      items: cart.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        sellerId: item.product.sellerId,
        sellerName: item.product.sellerName,
      })),
      total,
    };
    
    onPlaceOrder(shippingInfo);
  };

  const handlePaymentCancel = () => {
    setPaying(false);
  };

  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error);
    setPaying(false);
    alert(`Payment failed: ${error}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Payment is handled by PaymentMethodSelector component
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Button
        variant="ghost"
        onClick={onBack}
        className="mb-6 gap-2"
      >
        <ArrowLeft className="size-4" />
        Back to Cart
      </Button>

      <h1 className="text-gray-900 mb-8">Checkout</h1>

      <form onSubmit={handleSubmit}>
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <h2 className="text-gray-900 mb-4">Shipping Information</h2>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="zipCode">ZIP Code</Label>
                    <Input
                      id="zipCode"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Lock className="size-5 text-blue-600" />
                <h2 className="text-gray-900">Payment Method</h2>
                <Lock className="size-4 text-gray-400 ml-auto" />
              </div>
              
              <PaymentMethodSelector
                amount={total}
                email={formData.email || 'customer@example.com'}
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentCancel={handlePaymentCancel}
                onError={handlePaymentError}
              />
              
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Fill in shipping information above before completing payment
                </p>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-20">
              <h2 className="text-gray-900 mb-4">Order Summary</h2>

              <div className="space-y-3 mb-4">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {item.product.name} × {item.quantity}
                    </span>
                    <span className="text-gray-900">
                      ₦{(item.product.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-3 mb-4 pb-4 border-t border-b border-gray-200 pt-4">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>₦{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span>{shipping === 0 ? 'FREE' : `₦${shipping.toLocaleString()}`}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tax (8%)</span>
                  <span>₦{tax.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-between mb-6">
                <span className="text-gray-900">Total</span>
                <span className="text-gray-900">₦{total.toLocaleString()}</span>
              </div>

              <div className="text-center text-sm text-gray-500">
                Complete payment above to place your order
              </div>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
