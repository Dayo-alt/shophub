import { CheckCircle, Package } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface OrderConfirmationProps {
  orderId: string;
  onContinueShopping: () => void;
  onViewOrders: () => void;
}

export function OrderConfirmation({ orderId, onContinueShopping, onViewOrders }: OrderConfirmationProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <Card className="p-8 text-center">
        <CheckCircle className="size-16 text-green-600 mx-auto mb-4" />
        <h1 className="text-gray-900 mb-2">Order Confirmed!</h1>
        <p className="text-gray-600 mb-6">
          Thank you for your purchase. Your order has been successfully placed.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600 mb-1">Order Number</p>
          <p className="text-gray-900">{orderId}</p>
        </div>

        <div className="flex items-start gap-3 mb-8 text-left bg-blue-50 p-4 rounded-lg">
          <Package className="size-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-gray-900 mb-1">What's next?</p>
            <p className="text-sm text-gray-600">
              We've sent a confirmation email with your order details. 
              You'll receive another email when your order ships.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={onViewOrders} variant="outline" className="flex-1">
            View Orders
          </Button>
          <Button onClick={onContinueShopping} className="flex-1">
            Continue Shopping
          </Button>
        </div>
      </Card>
    </div>
  );
}
