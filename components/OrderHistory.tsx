import { ArrowLeft, Package } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Order } from '../App';

interface OrderHistoryProps {
  orders: Order[];
  onBack: () => void;
}

export function OrderHistory({ orders, onBack }: OrderHistoryProps) {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Processing':
        return 'default';
      case 'Shipped':
        return 'secondary';
      case 'Delivered':
        return 'outline';
      default:
        return 'default';
    }
  };

  if (orders.length === 0) {
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

        <Card className="p-12 text-center">
          <Package className="size-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-gray-900 mb-2">No orders yet</h2>
          <p className="text-gray-600 mb-6">Start shopping to see your orders here!</p>
          <Button onClick={onBack}>
            Start Shopping
          </Button>
        </Card>
      </div>
    );
  }

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

      <h1 className="text-gray-900 mb-8">Order History</h1>

      <div className="space-y-4">
        {orders.map((order) => (
          <Card key={order.id} className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-gray-900">Order {order.id}</h3>
                  <Badge variant={getStatusVariant(order.status)}>
                    {order.status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">
                  {new Date(order.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 mb-1">Total</p>
                <p className="text-gray-900">${order.total.toFixed(2)}</p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <p className="text-sm text-gray-600 mb-2">Items:</p>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div
                    key={item.productId}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-gray-900">
                      {item.productName} × {item.quantity}
                    </span>
                    <span className="text-gray-600">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 mt-4 pt-4">
              <p className="text-sm text-gray-600 mb-1">Shipping Address:</p>
              <p className="text-sm text-gray-900">{order.shippingInfo.name}</p>
              <p className="text-sm text-gray-600">{order.shippingInfo.address}</p>
              <p className="text-sm text-gray-600">
                {order.shippingInfo.city}, {order.shippingInfo.zipCode}
              </p>
              <p className="text-sm text-gray-600">{order.shippingInfo.country}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
