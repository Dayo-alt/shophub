import { useEffect, useState } from 'react';
import { ShoppingCart, Package, Store, LogOut, User, Heart, Mail, CircleHelp } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useLanguage } from '../../utils/i18n/LanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { supabase } from '../../utils/supabase/client';

interface BuyerHeaderProps {
  user: { name: string; email: string };
  cartItemCount: number;
  onNavigatePath: (path: string) => void;
  currentPath: string;
  onLogout: () => void;
}

export function BuyerHeader({ user, cartItemCount, onNavigatePath, currentPath, onLogout }: BuyerHeaderProps) {
  const { t } = useLanguage();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: msgs } = await supabase
        .from('messages')
        .select('id')
        .or(`recipient_id.eq.${authUser.id},is_broadcast.eq.true`);

      if (!msgs || msgs.length === 0) { setUnreadCount(0); return; }

      const { data: reads } = await supabase
        .from('message_reads')
        .select('message_id')
        .eq('user_id', authUser.id);

      const readIds = new Set((reads || []).map((r: any) => r.message_id));
      setUnreadCount(msgs.filter(m => !readIds.has(m.id)).length);
    };

    fetchUnread();

    // Subscribe to new messages
    const channel = supabase
      .channel('buyer-messages-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchUnread)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reads' }, fetchUnread)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Clear badge immediately when user navigates to inbox (inbox marks all read on load)
  useEffect(() => {
    if (currentPath === '/buyer/inbox') setUnreadCount(0);
  }, [currentPath]);

  const isProducts = currentPath === '/buyer';
  const isCart = currentPath === '/buyer/cart';
  const isOrders =
    currentPath === '/buyer/orders' ||
    currentPath === '/buyer/help-center' ||
    currentPath === '/buyer/track-order' ||
    currentPath === '/buyer/returns';

  const supportLabel = (() => {
    if (currentPath === '/buyer/help-center') return 'Help Center';
    if (currentPath === '/buyer/orders') return t('orders');
    if (currentPath === '/buyer/track-order') return 'Track Order';
    if (currentPath === '/buyer/returns') return 'Returns & Refunds';
    return 'Help';
  })();

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button
            onClick={() => onNavigatePath('/buyer')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Store className="size-8 text-blue-600" />
            <div className="text-left">
              <span className="text-xl text-gray-900 block">ShopHub</span>
            </div>
          </button>

          <nav className="flex items-center gap-4">
            <Button
              variant={isProducts ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onNavigatePath('/buyer')}
            >
              {t('home')}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={isOrders ? 'default' : 'ghost'} size="sm" className="gap-2">
                  <CircleHelp className="size-4" />
                  <span className="hidden sm:inline">{supportLabel}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Help</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onNavigatePath('/buyer/help-center')}>Help Center</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onNavigatePath('/buyer/orders')}>Orders</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onNavigatePath('/buyer/track-order')}>Track Order</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onNavigatePath('/buyer/returns')}>Returns & Refunds</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant={isCart ? 'default' : 'outline'}
              size="sm"
              onClick={() => onNavigatePath('/buyer/cart')}
              className="relative gap-2"
            >
              <ShoppingCart className="size-4" />
              <span className="hidden sm:inline">{t('cart')}</span>
              {cartItemCount > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 size-5 flex items-center justify-center p-0 text-xs">
                  {cartItemCount}
                </Badge>
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="relative gap-2">
                  <User className="size-4" />
                  <span className="hidden sm:inline">{user.name}</span>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 size-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t('myAccount')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-2 py-2 text-sm text-gray-600">{user.email}</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onNavigatePath('/buyer/account')}>
                  <User className="size-4 mr-2" />
                  Account
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onNavigatePath('/buyer/wishlist')}>
                  <Heart className="size-4 mr-2" />
                  Wishlist
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onNavigatePath('/buyer/inbox')} className="relative">
                  <Mail className="size-4 mr-2" />
                  Inbox
                  {unreadCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </DropdownMenuItem>
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
