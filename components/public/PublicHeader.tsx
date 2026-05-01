import { ShoppingCart, Store } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useLanguage } from '../../utils/i18n/LanguageContext';

interface PublicHeaderProps {
  cartItemCount: number;
  onLogin: () => void;
  onSignup: () => void;
  onOpenCart?: () => void;
  onGoHome: () => void;
  onGoAbout: () => void;
  activePage: 'home' | 'about';
}

export function PublicHeader({ cartItemCount, onLogin, onSignup, onOpenCart, onGoHome, onGoAbout, activePage }: PublicHeaderProps) {
  const { t } = useLanguage();
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Left: logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
              <Store className="size-5" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-medium text-gray-500">ShopHub</span>
            </div>
          </div>

          {/* Center: simple nav */}
          <nav className="hidden md:flex items-center justify-center gap-6 text-sm text-gray-600 flex-1">
            <button
              type="button"
              className={activePage === 'home' ? 'font-medium text-gray-900' : 'hover:text-gray-900'}
              onClick={onGoHome}
            >
              {t('homeNavLink')}
            </button>
            <button
              type="button"
              className={activePage === 'about' ? 'font-medium text-gray-900' : 'hover:text-gray-900'}
              onClick={onGoAbout}
            >
              {t('aboutUsNavLink')}
            </button>
          </nav>

          {/* Right: cart + auth */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={onOpenCart}
              className="relative rounded-full"
            >
              <ShoppingCart className="size-4" />
              {cartItemCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-0 flex items-center justify-center text-[10px]"
                >
                  {cartItemCount}
                </Badge>
              )}
            </Button>

            <Button variant="ghost" size="sm" onClick={onLogin}>
              {t('login')}
            </Button>
            <Button size="sm" className="hidden xs:inline-flex" onClick={onSignup}>
              {t('signup')}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
