import { ShoppingCart, Package, Store } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface HeaderProps {
  cartItemCount: number;
  onCartClick: () => void;
  onLogoClick: () => void;
  onOrdersClick: () => void;
  currentView: string;
}

export function Header({ cartItemCount, onCartClick, onLogoClick, onOrdersClick, currentView }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button
            onClick={onLogoClick}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Store className="size-8 text-blue-600" />
            <span className="text-xl text-gray-900">ShopHub</span>
          </button>

          <nav className="flex items-center gap-4">
            <Button
              variant={currentView === 'orders' ? 'default' : 'ghost'}
              size="sm"
              onClick={onOrdersClick}
              className="gap-2"
            >
              <Package className="size-4" />
              <span className="hidden sm:inline">Orders</span>
            </Button>

            <Button
              variant={currentView === 'cart' ? 'default' : 'outline'}
              size="sm"
              onClick={onCartClick}
              className="relative gap-2"
            >
              <ShoppingCart className="size-4" />
              <span className="hidden sm:inline">Cart</span>
              {cartItemCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 size-5 flex items-center justify-center p-0 text-xs"
                >
                  {cartItemCount}
                </Badge>
              )}
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
}
