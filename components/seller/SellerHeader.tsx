import { useEffect, useState } from 'react';
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
import { supabase } from '../../utils/supabase/client';

interface SellerHeaderProps {
  user: { name: string; email: string };
  onNavigate: (view: 'products' | 'orders' | 'analytics' | 'profile' | 'inbox' | 'reset-password') => void;
  currentView: string;
  onLogout: () => void;
}

export function SellerHeader({ user, onNavigate, currentView, onLogout }: SellerHeaderProps) {
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

      const { data: complaints } = await supabase
        .from('complaints')
        .select('id')
        .eq('seller_id', authUser.id)
        .eq('status', 'open');

      const { data: reads } = await supabase
        .from('message_reads')
        .select('message_id')
        .eq('user_id', authUser.id);

      const readIds = new Set((reads || []).map((r: any) => r.message_id));
      const unreadMsgs = (msgs || []).filter(m => !readIds.has(m.id)).length;
      const unreadComplaints = (complaints || []).filter(c => !readIds.has(`complaint-${c.id}`)).length;
      setUnreadCount(unreadMsgs + unreadComplaints);
    };

    fetchUnread();

    const channel = supabase
      .channel('seller-header-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchUnread)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, fetchUnread)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reads' }, fetchUnread)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (currentView === 'inbox') setUnreadCount(0);
  }, [currentView]);
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
              className="relative gap-2"
            >
              <Mail className="size-4" />
              <span className="hidden sm:inline">{t('inbox') ?? 'Inbox'}</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 size-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
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
