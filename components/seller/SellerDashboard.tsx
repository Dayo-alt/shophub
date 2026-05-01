import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "../../App";
import { SellerHeader } from "./SellerHeader";
import { SellerProducts } from "./SellerProducts";
import { SellerOrders } from "./SellerOrders";
import { SellerAnalytics } from "./SellerAnalytics";
import { SellerProfilePage } from "./SellerProfilePage";
import { SellerInbox } from "./SellerInbox";
import { PaymentMethodSelector } from "../payment/PaymentMethodSelector";
import { supabase } from "../../utils/supabase/client";
import { X, Bell, Mail, Megaphone } from "lucide-react";
import { useLanguage } from "../../utils/i18n/LanguageContext";

/* ─── Inbox toast ───────────────────────────────────────────────── */
interface ToastMsg { id: string; subject: string; body: string; sender_role: string; is_broadcast: boolean; }

function InboxToast({ msg, onDismiss, onOpen, t }: { msg: ToastMsg; onDismiss: () => void; onOpen: () => void; t: (key: string) => string }) {
  const [pct, setPct] = useState(100);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const start = performance.now();
    const DURATION = 5000;
    let raf: number;
    const tick = (now: number) => {
      const remaining = Math.max(0, 1 - (now - start) / DURATION);
      setPct(remaining * 100);
      if (remaining > 0) { raf = requestAnimationFrame(tick); }
      else { onDismiss(); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const icon = msg.is_broadcast
    ? <Megaphone className="size-4 text-orange-600" />
    : msg.sender_role === 'admin'
      ? <Bell className="size-4 text-purple-600" />
      : <Mail className="size-4 text-blue-600" />;
  const iconBg = msg.is_broadcast ? 'bg-orange-100' : msg.sender_role === 'admin' ? 'bg-purple-100' : 'bg-blue-100';

  return (
    <div className={`fixed top-4 right-4 z-[200] w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-[110%]'}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`size-9 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{msg.subject}</p>
            <p className="text-xs text-gray-500 capitalize">{msg.is_broadcast ? t('shopHubAnnouncement') : `From: ${msg.sender_role}`}</p>
            <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">{msg.body}</p>
          </div>
          <button onClick={onDismiss} className="shrink-0 text-gray-400 hover:text-gray-600"><X className="size-4" /></button>
        </div>
        <button onClick={onOpen} className="mt-2 text-xs font-semibold text-blue-600 hover:underline">{t('openInboxBtn')}</button>
      </div>
      <div className="h-1 bg-gray-100">
        <div className="h-full bg-blue-500" style={{ width: `${pct}%`, transition: 'none' }} />
      </div>
    </div>
  );
}

type View = "products" | "orders" | "analytics" | "profile" | "inbox" | "reset-password";

interface SellerDashboardProps {
  user: User;
  accessToken: string;
  onLogout: () => void;
}

export function SellerDashboard({
  user,
  accessToken,
  onLogout,
}: SellerDashboardProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [currentView, setCurrentView] = useState<View>(
    () => (localStorage.getItem('seller-view') as View) || 'products'
  );
  const [inboxToast, setInboxToast] = useState<ToastMsg | null>(null);

  useEffect(() => {
    let sellerId: string;

    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return;
      sellerId = u.id;

      // Show most recent unread on load
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, subject, body, sender_role, is_broadcast')
        .or(`recipient_id.eq.${sellerId},is_broadcast.eq.true`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (msgs?.length) {
        const { data: reads } = await supabase
          .from('message_reads')
          .select('message_id')
          .eq('user_id', sellerId);
        const readIds = new Set((reads || []).map((r: any) => r.message_id));
        const first = msgs.find((m: any) => !readIds.has(m.id));
        if (first) setInboxToast(first as ToastMsg);
      }
    };
    init();

    // Live subscription for new messages
    const ch = supabase
      .channel('seller-inbox-toast')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new as any;
        if (m.is_broadcast || m.recipient_id === sellerId) {
          setInboxToast({ id: m.id, subject: m.subject, body: m.body, sender_role: m.sender_role, is_broadcast: m.is_broadcast });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  const handleNavigate = (view: View) => {
    if (view === "reset-password") {
      navigate("/reset-password");
    } else {
      setCurrentView(view);
      localStorage.setItem('seller-view', view);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {inboxToast && (
        <InboxToast
          msg={inboxToast}
          onDismiss={() => setInboxToast(null)}
          onOpen={() => { setInboxToast(null); setCurrentView('inbox'); }}
          t={t}
        />
      )}
      <SellerHeader
        user={user}
        onNavigate={handleNavigate}
        currentView={currentView}
        onLogout={onLogout}
      />

      <main key={currentView} className="page-enter">
        {currentView === "products" && (
          <SellerProducts accessToken={accessToken} />
        )}

        {currentView === "orders" && (
          <SellerOrders accessToken={accessToken} />
        )}

        {currentView === "analytics" && (
          <SellerAnalytics accessToken={accessToken} />
        )}

        {currentView === "profile" && (
          <SellerProfilePage />
        )}

        {currentView === "inbox" && (
          <SellerInbox accessToken={accessToken} />
        )}
      </main>
    </div>
  );
}