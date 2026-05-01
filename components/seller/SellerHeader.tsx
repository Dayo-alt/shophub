import { Store, Package, BarChart3, LogOut, User, Mail, Key } from 'lucide-react';
import { Button } from '../ui/button';
import { useLanguage } from '../../utils/i18n/LanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface SellerHeaderProps {
  user: { name: string; email: string };
  onNavigate: (view: 'products' | 'orders' | 'analytics' | 'profile' | 'inbox' | 'reset-password') => void;
  currentView: string;
  onLogout: () => void;
}

export function SellerHeader({ user, onNavigate, currentView, onLogout }: SellerHeaderProps) {
  const { t } = useLanguage();
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button
            onClick={() => onNavigate('products')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Store className="size-8 text-blue-600" />
            <div className="text-left">
              <span className="text-xl text-gray-900 block">ShopHub</span>
            </div>
          </button>

          <nav className="flex items-center gap-4">
            <Button
              variant={currentView === 'products' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onNavigate('products')}
              className="gap-2"
            >
              <Store className="size-4" />
              <span className="hidden sm:inline">{t('products')}</span>
            </Button>

            <Button
              variant={currentView === 'orders' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onNavigate('orders')}
              className="gap-2"
            >
              <Package className="size-4" />
              <span className="hidden sm:inline">{t('orders')}</span>
            </Button>

            <Button
              variant={currentView === 'inbox' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onNavigate('inbox')}
              className="gap-2"
            >
              <Mail className="size-4" />
              <span className="hidden sm:inline">{t('inbox') ?? 'Inbox'}</span>
            </Button>

            <Button
              variant={currentView === 'analytics' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onNavigate('analytics')}
              className="gap-2"
            >
              <BarChart3 className="size-4" />
              <span className="hidden sm:inline">{t('analytics')}</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="size-4" />
                  <span className="hidden sm:inline">{user.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t('myAccount')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-2 py-2 text-sm text-gray-600">
                  {user.email}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onNavigate('profile')}>
                  <User className="size-4 mr-2" />
                  {t('profile')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onNavigate('reset-password')}>
                  <Key className="size-4 mr-2" />
                  Reset Password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="text-red-600">
                  <LogOut className="size-4 mr-2" />
                  {t('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </div>
    </header>
  );
}
