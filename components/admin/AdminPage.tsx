import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../utils/supabase/client';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '../ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { useLanguage } from '../../utils/i18n/LanguageContext';
import {
  LayoutDashboard, ShoppingBag, Users, DollarSign, Settings,
  LogOut, Menu, X, TrendingUp, Store, Package,
  Search, RefreshCw, Download, AlertCircle, MessageSquare,
  ChevronDown, ChevronUp, Send, Megaphone, Headphones, Clock,
  Radio, History, ShoppingCart, Play, Mail, Smartphone, MessageCircle,
  User, KeyRound, Eye, EyeOff, ShieldCheck, CheckCircle2, Pencil,
} from 'lucide-react';

const NIGERIAN_BANKS = [
  { code: '058', name: 'GTBank' }, { code: '057', name: 'Zenith Bank' },
  { code: '033', name: 'UBA' }, { code: '011', name: 'First Bank' },
  { code: '044', name: 'Access Bank' }, { code: '070', name: 'Fidelity Bank' },
  { code: '076', name: 'Polaris Bank' }, { code: '221', name: 'Stanbic IBTC' },
  { code: '032', name: 'Union Bank' }, { code: '035', name: 'WEMA Bank' },
  { code: '999992', name: 'OPay' }, { code: '999991', name: 'PalmPay' },
  { code: '301', name: 'Jaiz Bank' }, { code: '063', name: 'Access (Diamond)' },
  { code: '101', name: 'ProvidusBank' }, { code: '214', name: 'FCMB' },
  { code: '030', name: 'Heritage Bank' }, { code: '232', name: 'Sterling Bank' },
  { code: '100', name: 'SunTrust Bank' }, { code: '102', name: 'Titan Trust Bank' },
];

interface SectionConfig {
  id: string;
  title: string;
  type: 'best_sellers' | 'new_arrivals' | 'flash_sales';
  enabled: boolean;
  wallpaper_url: string;
  low_stock_threshold?: number | null;
  flash_ends_at?: string | null;
}

interface AdminSettings {
  id: number;
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
  hero_wallpapers: string[];
  sections_config: SectionConfig[];
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'buyer' | 'seller' | 'admin';
}

interface LoginEvent {
  id: string;
  user_id: string;
  role: 'buyer' | 'seller' | 'admin' | null;
  event_type: 'login' | 'logout';
  created_at: string;
}

type AdminSection = 'dashboard' | 'orders' | 'users' | 'revenue' | 'complaints' | 'messages' | 'settings' | 'cart-retention' | 'profile';

interface RetentionInterval { key: string; minutes: number; enabled: boolean; label: string; }
interface RetentionChannels {
  email: { enabled: boolean; from_name: string; };
  sms: { enabled: boolean; provider: string; account_sid: string; auth_token: string; from_number: string; };
  whatsapp: { enabled: boolean; token: string; phone_number_id: string; };
}
interface RetentionTemplate { subject: string; email: string; sms: string; whatsapp: string; }
interface CartRetentionConfig {
  id: number;
  enabled: boolean;
  intervals: RetentionInterval[];
  channels: RetentionChannels;
  templates: Record<string, RetentionTemplate>;
}

const DEFAULT_RETENTION: CartRetentionConfig = {
  id: 1, enabled: false,
  intervals: [
    { key: '5min',  minutes: 5,     enabled: true, label: '5 Minutes' },
    { key: '30min', minutes: 30,    enabled: true, label: '30 Minutes' },
    { key: '1hr',   minutes: 60,    enabled: true, label: '1 Hour' },
    { key: '1day',  minutes: 1440,  enabled: true, label: '1 Day' },
    { key: '7days', minutes: 10080, enabled: true, label: '7 Days' },
  ],
  channels: {
    email:    { enabled: true,  from_name: 'ShopHub' },
    sms:      { enabled: false, provider: 'twilio', account_sid: '', auth_token: '', from_number: '' },
    whatsapp: { enabled: false, token: '', phone_number_id: '' },
  },
  templates: {
    '5min':  { subject: 'You left something behind!', email: 'Hi {name}, your cart is waiting! You have {item_count} item(s) worth {total}.', sms: 'Hi {name}! Your ShopHub cart has {item_count} item(s) worth {total}. Shop: {link}', whatsapp: 'Hi {name}! 🛒 Your cart is waiting with {item_count} item(s) worth {total}.' },
    '30min': { subject: 'Still thinking it over?', email: 'Hi {name}, your cart has {item_count} item(s) worth {total}. Don\'t let them sell out!', sms: 'Hi {name}! Still thinking? Your cart: {item_count} items, {total}. {link}', whatsapp: 'Hey {name}! ⏰ Your cart ({item_count} items, {total}) is still waiting.' },
    '1hr':   { subject: 'Your cart misses you', email: 'Hi {name}, it\'s been an hour! Your {item_count} items are still reserved.', sms: 'Hi {name}! 1hr and your cart still has {item_count} items worth {total}. {link}', whatsapp: 'Hi {name}! 🕐 1 hour passed — your {item_count} item(s) ({total}) are saved.' },
    '1day':  { subject: "Don't forget your items", email: 'Hi {name}, your cart has been waiting a whole day! Items: {items_list}. Total: {total}.', sms: 'Hi {name}! Cart waiting 1 day: {item_count} items, {total}. {link}', whatsapp: 'Hi {name}! 📦 1 day later — your cart with {item_count} item(s) worth {total} is still saved.' },
    '7days': { subject: 'Last chance — cart expiring soon', email: 'Hi {name}, final reminder! Your cart expires soon. {item_count} items worth {total}.', sms: 'LAST CHANCE {name}! Cart expires: {item_count} items, {total}. {link}', whatsapp: '⚠️ Final reminder, {name}! Cart ({item_count} items, {total}) is expiring.' },
  },
};

interface ChatSession {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  status: string;
  updated_at: string;
}

interface SupportChatMsg {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  created_at: string;
}

interface AdminPageProps {
  onLogout: () => void;
  accessToken: string;
}

const fmt = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;

const STATUS_COLORS: Record<string, string> = {
  processing: 'bg-blue-100 text-blue-700',
  pending:    'bg-yellow-100 text-yellow-700',
  shipped:    'bg-purple-100 text-purple-700',
  delivered:  'bg-green-100 text-green-700',
  cancelled:  'bg-red-100 text-red-700',
};

export function AdminPage({ onLogout, accessToken }: AdminPageProps) {
  const { t } = useLanguage();

  /* ── sidebar ── */
  const [section, setSection]       = useState<AdminSection>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* ── settings ── */
  const [settings, setSettings]     = useState<AdminSettings | null>(null);
  const [saving, setSaving]         = useState(false);
  const [savingSections, setSavingSections] = useState(false);
  const [newWallpaper, setNewWallpaper] = useState('');

  /* ── orders ── */
  const [allOrders, setAllOrders]           = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders]   = useState(true);
  const [orderSearch, setOrderSearch]       = useState('');
  const [orderFilter, setOrderFilter]       = useState('all');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  /* ── users ── */
  const [users, setUsers]           = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editingSaving, setEditingSaving] = useState(false);
  const [loginEvents, setLoginEvents]   = useState<LoginEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  /* ── revenue ── */
  const [showWithdraw, setShowWithdraw]     = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawBankCode, setWithdrawBankCode] = useState('');
  const [withdrawAcctNum, setWithdrawAcctNum]   = useState('');
  const [withdrawAcctName, setWithdrawAcctName] = useState('');
  const [withdrawError, setWithdrawError]   = useState('');
  const [withdrawing, setWithdrawing]       = useState(false);

  /* ── complaints ── */
  const [complaints, setComplaints]         = useState<any[]>([]);
  const [loadingComplaints, setLoadingComplaints] = useState(false);
  const [expandedComplaint, setExpandedComplaint] = useState<string | null>(null);
  const [complaintReply, setComplaintReply] = useState<Record<string, string>>({});
  const [submittingReply, setSubmittingReply] = useState<string | null>(null);

  /* ── messages ── */
  const [showCompose, setShowCompose]       = useState(false);
  const [msgSubject, setMsgSubject]         = useState('');
  const [msgBody, setMsgBody]               = useState('');
  const [msgRecipientId, setMsgRecipientId] = useState('');
  const [msgBroadcast, setMsgBroadcast]     = useState(false);
  const [sendingMsg, setSendingMsg]         = useState(false);
  const [msgError, setMsgError]             = useState('');
  const [sentMessages, setSentMessages]     = useState<any[]>([]);
  const [loadingSent, setLoadingSent]       = useState(false);
  const [chatSessions, setChatSessions]     = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId]     = useState<string | null>(null);
  const [liveChatMsgs, setLiveChatMsgs]     = useState<SupportChatMsg[]>([]);
  const [adminChatInput, setAdminChatInput] = useState('');
  const [sendingAdminChat, setSendingAdminChat] = useState(false);
  const [adminId, setAdminId]               = useState<string | null>(null);
  const [msgTab, setMsgTab]                 = useState<'compose' | 'inbox' | 'history' | 'chats'>('compose');

  /* ── admin profile ── */
  const [adminName, setAdminName]           = useState('Admin');
  const [adminEmail, setAdminEmail]         = useState('');
  const [profileTab, setProfileTab]         = useState<'info' | 'email' | 'password'>('info');
  // name
  const [editName, setEditName]             = useState('');
  const [savingName, setSavingName]         = useState(false);
  const [nameMsg, setNameMsg]               = useState('');
  // email change
  const [newEmail, setNewEmail]             = useState('');
  const [emailOtp, setEmailOtp]             = useState('');
  const [emailOtpSent, setEmailOtpSent]     = useState(false);
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [emailMsg, setEmailMsg]             = useState('');
  const [emailErr, setEmailErr]             = useState('');
  // password change
  const [newPassword, setNewPassword]       = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPwd, setShowNewPwd]         = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [pwdOtp, setPwdOtp]                 = useState('');
  const [pwdOtpSent, setPwdOtpSent]         = useState(false);
  const [sendingPwdOtp, setSendingPwdOtp]   = useState(false);
  const [verifyingPwd, setVerifyingPwd]     = useState(false);
  const [pwdMsg, setPwdMsg]                 = useState('');
  const [pwdErr, setPwdErr]                 = useState('');
  // otp cooldown
  const [otpCooldown, setOtpCooldown]       = useState(0);
  const adminChatBottomRef                  = useRef<HTMLDivElement>(null);
  const [inboxMessages, setInboxMessages]   = useState<any[]>([]);
  const [loadingInbox, setLoadingInbox]     = useState(false);
  const [inboxExpandedId, setInboxExpandedId] = useState<string | null>(null);
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);

  /* ── cart retention ── */
  const [retention, setRetention]           = useState<CartRetentionConfig>(DEFAULT_RETENTION);
  const [savingRetention, setSavingRetention] = useState(false);
  const [retentionTab, setRetentionTab]     = useState<'overview' | 'intervals' | 'channels'>('overview');
  const [retentionStats, setRetentionStats] = useState({ activeCarts: 0, sentToday: 0, recovered: 0 });
  const [processingNow, setProcessingNow]   = useState(false);
  const [retentionHistory, setRetentionHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showActiveCarts, setShowActiveCarts] = useState(false);
  const [activeCarts, setActiveCarts]       = useState<any[]>([]);
  const [loadingActiveCarts, setLoadingActiveCarts] = useState(false);

  /* ──────────────────── effects ──────────────────── */

  // Restore last section
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('adminSection') as AdminSection | null;
      if (stored && ['dashboard','orders','users','revenue','complaints','messages','settings','cart-retention','profile'].includes(stored)) {
        setSection(stored);
      }
    } catch { /* ignore */ }

    // Load cart retention config
    supabase.from('cart_retention_config').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) {
        // Deep-merge DB data with defaults so missing fields (e.g. old SMS structure) don't crash render
        setRetention({
          ...DEFAULT_RETENTION,
          ...data,
          channels: {
            ...DEFAULT_RETENTION.channels,
            ...(data.channels || {}),
            sms: { ...DEFAULT_RETENTION.channels.sms, ...(data.channels?.sms || {}) },
          },
        } as CartRetentionConfig);
      }
    });

    // Load retention stats
    const today = new Date(); today.setHours(0,0,0,0);
    Promise.all([
      // Use edge function for cart count — bypasses RLS that blocks admin from seeing other users' carts
      fetch(`https://${projectId}.supabase.co/functions/v1/server`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`, 'apikey': publicAnonKey },
        body: JSON.stringify({ action: 'cart-stats' }),
      }).then(r => r.json()).then((j: any) => j.activeCarts ?? 0).catch(() => 0),
      supabase.from('cart_reminder_log').select('id', { count: 'exact', head: true })
        .eq('status', 'sent').gte('sent_at', today.toISOString()),
      // Carts recovered: users who got a reminder AND later placed an order
      Promise.all([
        supabase.from('cart_reminder_log').select('user_id, sent_at').eq('status', 'sent'),
        supabase.from('orders').select('buyer_id, created_at'),
      ]).then(([reminders, orders]) => {
        if (orders.error) { console.warn('orders stat error:', orders.error.message); return 0; }
        const reminderMap = new Map<string, string>();
        for (const r of reminders.data || []) {
          const ex = reminderMap.get(r.user_id);
          if (!ex || r.sent_at > ex) reminderMap.set(r.user_id, r.sent_at);
        }
        const recovered = new Set<string>();
        for (const o of orders.data || []) {
          const sentAt = reminderMap.get(o.buyer_id);
          if (sentAt && o.created_at > sentAt) recovered.add(o.buyer_id);
        }
        return recovered.size;
      }),
    ]).then(([activeCarts, logs, recovered]) => {
      setRetentionStats({ activeCarts, sentToday: logs.count || 0, recovered });
    });
  }, []);

  const handleSetSection = (next: AdminSection) => {
    setSection(next);
    setSidebarOpen(false);
    try { window.localStorage.setItem('adminSection', next); } catch { /* ignore */ }
    if (next === 'complaints') fetchComplaints();
    if (next === 'cart-retention') loadRetentionHistory();
  };

  const fetchComplaints = async () => {
    setLoadingComplaints(true);
    const { data } = await supabase
      .from('complaints')
      .select('id, order_id, buyer_id, buyer_email, seller_id, subject, message, status, created_at')
      .order('created_at', { ascending: false });
    if (data) {
      const withReplies = await Promise.all(
        data.map(async (c: any) => {
          const { data: replies } = await supabase
            .from('complaint_replies')
            .select('id, sender_role, message, created_at')
            .eq('complaint_id', c.id)
            .order('created_at', { ascending: true });
          return { ...c, replies: replies || [] };
        })
      );
      setComplaints(withReplies);
    }
    setLoadingComplaints(false);
  };

  const handleComplaintReply = async (complaintId: string) => {
    const text = (complaintReply[complaintId] || '').trim();
    if (!text) return;
    setSubmittingReply(complaintId);
    const { data: { user: adminUser } } = await supabase.auth.getUser();
    const { data } = await supabase.from('complaint_replies').insert({
      complaint_id: complaintId,
      sender_id: adminUser?.id,
      sender_role: 'admin',
      message: text,
    }).select().single();
    if (data) {
      setComplaints(prev => prev.map(c =>
        c.id === complaintId ? { ...c, replies: [...c.replies, data] } : c
      ));
      setComplaintReply(r => ({ ...r, [complaintId]: '' }));

      // Send inbox message to buyer
      const comp = complaints.find(c => c.id === complaintId);
      if (comp?.buyer_id) {
        await supabase.from('messages').insert({
          sender_id: adminUser?.id,
          sender_role: 'admin',
          recipient_id: comp.buyer_id,
          subject: `Admin reply to your complaint: ${comp.subject}`,
          body: text,
          is_broadcast: false,
        });
      }
    }
    setSubmittingReply(null);
  };

  const fetchAdminInbox = async (uid: string) => {
    setLoadingInbox(true);
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, sender_role, subject, body, is_broadcast, created_at')
      .or(`recipient_id.eq.${uid},is_broadcast.eq.true`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!data) { setLoadingInbox(false); return; }

    const { data: reads } = await supabase
      .from('message_reads')
      .select('message_id')
      .eq('user_id', uid);

    const readIds = new Set((reads || []).map((r: any) => r.message_id));
    setInboxMessages(data.map((m: any) => ({ ...m, read: readIds.has(m.id) })));
    setAdminUnreadCount(data.filter((m: any) => !readIds.has(m.id)).length);
    setLoadingInbox(false);
  };

  const markAdminMessageRead = async (msgId: string, uid: string) => {
    await supabase.from('message_reads').upsert(
      { message_id: msgId, user_id: uid },
      { onConflict: 'message_id,user_id' }
    );
    setInboxMessages(prev => prev.map(m => m.id === msgId ? { ...m, read: true } : m));
    setAdminUnreadCount(prev => Math.max(0, prev - 1));
  };

  const sendAdminChatMessage = async () => {
    const text = adminChatInput.trim();
    if (!text || !activeChatId || !adminId || sendingAdminChat) return;
    setSendingAdminChat(true);
    setAdminChatInput('');
    const tempId = `tmp-${Date.now()}`;
    setLiveChatMsgs(prev => [...prev, {
      id: tempId, chat_id: activeChatId, sender_id: adminId,
      sender_role: 'admin', message: text, created_at: new Date().toISOString(),
    }]);
    const { data } = await supabase.from('support_chat_messages').insert({
      chat_id: activeChatId, sender_id: adminId, sender_role: 'admin', message: text,
    }).select().single();
    if (data) {
      setLiveChatMsgs(prev => prev.map(m => m.id === tempId ? data as SupportChatMsg : m));
    }
    await supabase.from('support_chats').update({ updated_at: new Date().toISOString() }).eq('id', activeChatId);
    setSendingAdminChat(false);
  };

  const handleSendMessage = async () => {
    setMsgError('');
    if (!msgSubject.trim() || !msgBody.trim()) { setMsgError('Subject and body are required.'); return; }
    if (!msgBroadcast && !msgRecipientId) { setMsgError('Select a recipient or enable broadcast.'); return; }
    setSendingMsg(true);
    const { data: { user: adminUser } } = await supabase.auth.getUser();
    const { error } = await supabase.from('messages').insert({
      sender_id: adminUser?.id,
      sender_role: 'admin',
      recipient_id: msgBroadcast ? null : msgRecipientId,
      subject: msgSubject,
      body: msgBody,
      is_broadcast: msgBroadcast,
    });
    setSendingMsg(false);
    if (error) { setMsgError(error.message); return; }
    setShowCompose(false);
    setMsgSubject(''); setMsgBody(''); setMsgRecipientId(''); setMsgBroadcast(false);
  };

  // Admin settings
  useEffect(() => {
    supabase.from('admin_settings').select('*').eq('id', 1).maybeSingle().then(({ data, error }) => {
      const row = data as any;
      setSettings({
        id: 1,
        contact_email:   !error ? (row?.contact_email   ?? '') : '',
        contact_phone:   !error ? (row?.contact_phone   ?? '') : '',
        contact_address: !error ? (row?.contact_address ?? '') : '',
        hero_wallpapers: !error ? (row?.hero_wallpapers  ?? []) : [],
        sections_config: !error ? (row?.sections_config  ?? []) : [],
      });
    });
  }, []);

  // Orders (realtime)
  useEffect(() => {
    const load = async () => {
      setLoadingOrders(true);
      const { data } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      setAllOrders(data || []);
      setLoadingOrders(false);
    };
    load();
    const ch = supabase.channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Users (realtime)
  useEffect(() => {
    const load = async () => {
      setLoadingUsers(true);
      const { data } = await supabase.from('profiles').select('id, email, name, role');
      setUsers((data || []).map((r: any) => ({
        id: r.id, email: r.email || '', name: r.name || '',
        role: (r.role as AdminUser['role']) || 'buyer',
      })));
      setLoadingUsers(false);
    };
    load();
    const ch = supabase.channel('admin-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Login events
  useEffect(() => {
    const load = async () => {
      setLoadingEvents(true);
      const { data } = await supabase
        .from('login_events')
        .select('id, user_id, role, event_type, created_at')
        .order('created_at', { ascending: false })
        .limit(25);
      setLoginEvents((data || []) as LoginEvent[]);
      setLoadingEvents(false);
    };
    load();
    const ch = supabase.channel('admin-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'login_events' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Sent messages history + chat sessions + admin id
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setAdminId(user.id);
        setAdminEmail(user.email || '');
        const { data: profile } = await supabase.from('profiles').select('name, email').eq('id', user.id).maybeSingle();
        const name = (profile as any)?.name || user.email || 'Admin';
        setAdminName(name);
        setEditName(name);
        await fetchAdminInbox(user.id);
      }
    };
    init();

    const loadSent = async () => {
      setLoadingSent(true);
      const { data } = await supabase
        .from('messages')
        .select('id, subject, body, recipient_id, is_broadcast, created_at')
        .eq('sender_role', 'admin')
        .order('created_at', { ascending: false })
        .limit(50);
      setSentMessages(data || []);
      setLoadingSent(false);
    };
    loadSent();

    const loadChatSessions = async () => {
      const { data } = await supabase
        .from('support_chats')
        .select('id, user_id, user_email, user_name, status, updated_at')
        .order('updated_at', { ascending: false });
      setChatSessions(data || []);
    };
    loadChatSessions();

    // Realtime: new chat sessions
    const chSessions = supabase.channel('admin-chat-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_chats' }, loadChatSessions)
      .subscribe();

    return () => { supabase.removeChannel(chSessions); };
  }, []);

  // When admin selects a chat, load its messages and subscribe
  useEffect(() => {
    if (!activeChatId) return;
    let ch: ReturnType<typeof supabase.channel>;

    const load = async () => {
      const { data } = await supabase
        .from('support_chat_messages')
        .select('*')
        .eq('chat_id', activeChatId)
        .order('created_at', { ascending: true });
      setLiveChatMsgs(data || []);
    };
    load();

    ch = supabase.channel(`admin-chat-${activeChatId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'support_chat_messages',
      }, (payload) => {
        const m = payload.new as SupportChatMsg;
        if (m.chat_id !== activeChatId) return;
        setLiveChatMsgs(prev => {
          if (prev.some(x => x.id === m.id)) return prev;
          const filtered = prev.filter(x => !(x.id.startsWith('tmp-') && x.message === m.message && x.sender_id === m.sender_id));
          return [...filtered, m];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [activeChatId]);

  // Auto-scroll admin chat
  useEffect(() => {
    adminChatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveChatMsgs]);

  /* ──────────────────── computed ──────────────────── */
  const paidOrders    = allOrders.filter(o => o.payment_status === 'completed');
  const totalRevenue  = paidOrders.reduce((s, o) => s + (o.platform_fee || 0), 0);
  const totalGMV      = paidOrders.reduce((s, o) => s + (o.total       || 0), 0);
  const sellerIds     = new Set(allOrders.flatMap(o => Object.keys(o.seller_earnings || {})));

  /* ──────────────────── handlers ──────────────────── */
  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    await supabase.from('admin_settings').upsert({ id: 1,
      contact_email: settings.contact_email, contact_phone: settings.contact_phone,
      contact_address: settings.contact_address, hero_wallpapers: settings.hero_wallpapers,
      sections_config: settings.sections_config,
    }, { onConflict: 'id' });
    setSaving(false);
    alert(t('settingsSavedAlert'));
  };

  const handleSaveSections = async () => {
    if (!settings) return;
    setSavingSections(true);
    const { error } = await supabase.from('admin_settings').upsert(
      { id: 1, sections_config: settings.sections_config }, { onConflict: 'id' }
    );
    setSavingSections(false);
    if (error) { alert(`Failed to save: ${error.message}`); return; }
    alert(t('settingsSavedAlert'));
  };

  const handleAddWallpaper = () => {
    if (!settings || !newWallpaper.trim()) return;
    setSettings({ ...settings, hero_wallpapers: [...settings.hero_wallpapers, newWallpaper.trim()] });
    setNewWallpaper('');
  };

  const handleRemoveWallpaper = (i: number) => {
    if (!settings) return;
    const next = [...settings.hero_wallpapers];
    next.splice(i, 1);
    setSettings({ ...settings, hero_wallpapers: next });
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    setEditingSaving(true);
    await supabase.from('profiles').update({ name: editingUser.name, role: editingUser.role }).eq('id', editingUser.id);
    setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...editingUser } : u));
    setEditingUser(null);
    setEditingSaving(false);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm(t('removeUserConfirm'))) return;
    await supabase.from('profiles').delete().eq('id', userId);
    setUsers(prev => prev.filter(u => u.id !== userId));
    setEditingUser(null);
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    setUpdatingOrderId(orderId);
    const prevOrder = allOrders.find(o => o.id === orderId);
    await supabase.from('orders').update({ status }).eq('id', orderId);
    setAllOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));

    // Decrement product stock when order is marked delivered (guard against double-decrement)
    if (status === 'delivered' && prevOrder?.status !== 'delivered') {
      const items: any[] = prevOrder?.items || [];
      for (const item of items) {
        const productId = item.productId || item.product_id;
        const qty = item.quantity || 1;
        if (!productId) continue;
        const { data: prod } = await supabase
          .from('products')
          .select('stock')
          .eq('id', productId)
          .maybeSingle();
        if (prod != null) {
          await supabase
            .from('products')
            .update({ stock: Math.max(0, prod.stock - qty) })
            .eq('id', productId);
        }
      }
    }
    setUpdatingOrderId(null);
  };

  const exportOrdersCSV = () => {
    const header = 'Order ID,Buyer,Date,Status,Payment,Total,Commission';
    const rows = allOrders.map(o =>
      [o.id, o.buyer_email, o.created_at, o.status, o.payment_status,
       o.total, o.platform_fee].join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'orders.csv'; a.click();
  };

  /* ──────────────────── sidebar nav ──────────────────── */
  const navItems: { id: AdminSection; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
    { id: 'orders',     label: 'Orders',     icon: ShoppingBag,    badge: allOrders.filter(o=>o.status==='processing').length || undefined },
    { id: 'users',      label: 'Customers',  icon: Users },
    { id: 'revenue',    label: 'Revenue',    icon: DollarSign },
    { id: 'complaints', label: 'Complaints', icon: MessageSquare,  badge: complaints.filter(c=>c.status==='open').length || undefined },
    { id: 'messages',       label: 'Messages',      icon: Megaphone, badge: adminUnreadCount || undefined },
    { id: 'cart-retention', label: 'Cart Recovery',  icon: ShoppingCart },
    { id: 'settings',       label: 'Settings',       icon: Settings },
  ];

  /* ──────────────────── render sections ──────────────────── */

  const renderDashboard = () => {
    const recentOrders = allOrders.slice(0, 6);
    const kpis = [
      { label: 'Total Revenue (20%)', value: fmt(totalRevenue), icon: DollarSign, color: 'from-emerald-500 to-green-600', sub: `GMV ${fmt(totalGMV)}` },
      { label: 'Total Orders',        value: allOrders.length,  icon: ShoppingBag, color: 'from-blue-500 to-blue-600',   sub: `${paidOrders.length} paid` },
      { label: 'Registered Users',    value: users.length,      icon: Users,       color: 'from-violet-500 to-purple-600', sub: `${users.filter(u=>u.role==='seller').length} sellers` },
      { label: 'Active Sellers',      value: sellerIds.size,    icon: Store,       color: 'from-orange-500 to-amber-600', sub: 'with orders' },
    ];

    return (
      <div className="space-y-6 animate-fade-in-up">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map(({ label, value, icon: Icon, color, sub }, i) => (
            <Card key={i} className="overflow-hidden">
              <div className={`bg-gradient-to-br ${color} p-4 text-white`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium opacity-90">{label}</p>
                  <Icon className="size-4 opacity-80" />
                </div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs opacity-75 mt-0.5">{sub}</p>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent orders */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <h3 className="font-semibold text-gray-900">Recent Orders</h3>
                <button onClick={() => handleSetSection('orders')} className="text-xs text-blue-600 hover:underline">
                  View all →
                </button>
              </div>
              {loadingOrders ? (
                <div className="py-10 text-center text-sm text-gray-500">Loading orders…</div>
              ) : recentOrders.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">
                  <Package className="size-8 mx-auto mb-2 text-gray-300" />
                  No orders yet
                </div>
              ) : (
                <div className="divide-y text-sm">
                  {recentOrders.map(o => (
                    <div key={o.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 font-medium truncate">#{o.id?.slice(-8)}</p>
                        <p className="text-gray-500 text-xs truncate">{o.buyer_email}</p>
                      </div>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>
                        {o.status}
                      </span>
                      <span className="text-gray-900 font-semibold text-xs shrink-0">{fmt(o.total || 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Revenue breakdown */}
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h3 className="font-semibold text-gray-900">Revenue Split</h3>
              <p className="text-xs text-gray-500 mt-0.5">Platform 20% / Sellers 80%</p>
            </div>
            <div className="p-5 space-y-4">
              {[
                { label: 'Platform (20%)', value: totalRevenue, color: 'bg-emerald-500', pct: 20 },
                { label: 'Sellers (80%)',  value: totalGMV - totalRevenue, color: 'bg-blue-500', pct: 80 },
              ].map(({ label, value, color, pct }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-semibold text-gray-900">{fmt(value)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Gross Merchandise Value</span>
                  <span className="font-bold text-gray-900">{fmt(totalGMV)}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Pending',    count: allOrders.filter(o=>o.status==='pending').length,    color: 'text-yellow-600' },
            { label: 'Processing', count: allOrders.filter(o=>o.status==='processing').length, color: 'text-blue-600' },
            { label: 'Shipped',    count: allOrders.filter(o=>o.status==='shipped').length,    color: 'text-purple-600' },
            { label: 'Delivered',  count: allOrders.filter(o=>o.status==='delivered').length,  color: 'text-green-600' },
          ].map(({ label, count, color }) => (
            <Card key={label} className="p-4 text-center cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => { setOrderFilter(label.toLowerCase()); handleSetSection('orders'); }}>
              <p className={`text-2xl font-bold ${color}`}>{count}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderOrders = () => {
    const filtered = allOrders.filter(o => {
      const matchesStatus = orderFilter === 'all' || o.status === orderFilter;
      const term = orderSearch.trim().toLowerCase();
      const matchesSearch = !term ||
        (o.id || '').toLowerCase().includes(term) ||
        (o.buyer_email || '').toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });

    return (
      <div className="space-y-4 animate-fade-in-up">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b">
            <h3 className="font-semibold text-gray-900 flex-1">All Orders</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
                <input
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  placeholder="Search orders…"
                  className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 w-44"
                />
              </div>
              <Select value={orderFilter} onValueChange={setOrderFilter}>
                <SelectTrigger className="w-36 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <button onClick={exportOrdersCSV} className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
                <Download className="size-3.5" /> Export CSV
              </button>
            </div>
          </div>

          {loadingOrders ? (
            <div className="py-16 text-center text-sm text-gray-500">Loading orders…</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="size-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">No orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-[11px] text-gray-500 uppercase">
                    <th className="px-5 py-3 text-left font-medium">Order</th>
                    <th className="px-4 py-3 text-left font-medium">Customer</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Payment</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                    <th className="px-4 py-3 text-right font-medium">Commission</th>
                    <th className="px-4 py-3 text-left font-medium">Update status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((o, idx) => (
                    <tr key={o.id} className="hover:bg-gray-50/60 animate-fade-in-up" style={{ animationDelay: `${idx * 0.03}s` }}>
                      <td className="px-5 py-3 text-gray-900 font-medium whitespace-nowrap">#{o.id?.slice(-8)}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">{o.buyer_email}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {new Date(o.created_at).toLocaleDateString('en-NG', { day:'2-digit', month:'short', year:'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${o.payment_status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {o.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">{fmt(o.total || 0)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-medium whitespace-nowrap">{fmt(o.platform_fee || 0)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Select
                            value={o.status}
                            onValueChange={v => handleUpdateOrderStatus(o.id, v)}
                            disabled={updatingOrderId === o.id}
                          >
                            <SelectTrigger className="h-7 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="processing">Processing</SelectItem>
                              <SelectItem value="shipped">Shipped</SelectItem>
                              <SelectItem value="delivered">Delivered</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                          {updatingOrderId === o.id && <RefreshCw className="size-3.5 animate-spin text-blue-500" />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t bg-gray-50 flex justify-between text-xs text-gray-500">
              <span>{filtered.length} order{filtered.length !== 1 ? 's' : ''}</span>
              <span>Commission: <strong className="text-emerald-700">{fmt(filtered.reduce((s,o)=>s+(o.platform_fee||0),0))}</strong></span>
            </div>
          )}
        </Card>
      </div>
    );
  };

  const renderUsers = () => {
    const filtered = users.filter(u => {
      const term = userSearch.trim().toLowerCase();
      return !term || u.email.toLowerCase().includes(term) || u.name.toLowerCase().includes(term);
    });

    return (
      <div className="space-y-5 animate-fade-in-up">
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Users',   value: users.length },
            { label: 'Buyers',        value: users.filter(u=>u.role==='buyer').length },
            { label: 'Sellers',       value: users.filter(u=>u.role==='seller').length },
          ].map(({ label, value }) => (
            <Card key={label} className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b">
            <h3 className="font-semibold text-gray-900 flex-1">All Users</h3>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder={t('userSearchPlaceholder')}
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 w-48"
              />
            </div>
          </div>

          {loadingUsers ? (
            <div className="py-12 text-center text-sm text-gray-500">Loading users…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-[11px] text-gray-500 uppercase">
                    <th className="px-5 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Email</th>
                    <th className="px-4 py-3 text-left font-medium">Role</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((u, i) => (
                    <tr key={u.id} className="hover:bg-gray-50/60 animate-fade-in-up" style={{ animationDelay: `${i * 0.03}s` }}>
                      <td className="px-5 py-3 font-medium text-gray-900">{u.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize
                          ${u.role === 'admin' ? 'bg-red-100 text-red-700' :
                            u.role === 'seller' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setEditingUser(u)} className="text-xs text-blue-600 hover:underline font-medium">
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Activity log */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h3 className="font-semibold text-gray-900">Recent Activity</h3>
            <p className="text-xs text-gray-500 mt-0.5">Latest login / logout events</p>
          </div>
          {loadingEvents ? (
            <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
          ) : loginEvents.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No activity yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-[11px] text-gray-500 uppercase">
                    <th className="px-5 py-2 text-left font-medium">User</th>
                    <th className="px-4 py-2 text-left font-medium">Role</th>
                    <th className="px-4 py-2 text-left font-medium">Event</th>
                    <th className="px-4 py-2 text-left font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loginEvents.map(ev => {
                    const u = users.find(x => x.id === ev.user_id);
                    return (
                      <tr key={ev.id} className="hover:bg-gray-50/60">
                        <td className="px-5 py-2 text-gray-800 truncate max-w-[160px]">{u?.name || u?.email || ev.user_id}</td>
                        <td className="px-4 py-2 capitalize text-gray-600">{ev.role || u?.role || 'buyer'}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded-full font-medium ${ev.event_type === 'login' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {ev.event_type}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{new Date(ev.created_at).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    );
  };

  const renderRevenue = () => {
    const today     = new Date(); today.setHours(0,0,0,0);
    const weekAgo   = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo  = new Date(today); monthAgo.setDate(monthAgo.getDate() - 30);

    const revInPeriod = (from: Date) =>
      paidOrders.filter(o => new Date(o.created_at) >= from).reduce((s,o) => s + (o.platform_fee||0), 0);

    const kpis = [
      { label: 'All-time Revenue',  value: fmt(totalRevenue),            sub: '20% platform cut' },
      { label: 'This Month',        value: fmt(revInPeriod(monthAgo)),   sub: 'last 30 days' },
      { label: 'This Week',         value: fmt(revInPeriod(weekAgo)),    sub: 'last 7 days' },
      { label: 'Today',             value: fmt(revInPeriod(today)),      sub: 'since midnight' },
    ];

    return (
      <div className="space-y-5 animate-fade-in-up">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map(({ label, value, sub }) => (
            <Card key={label} className="p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
            </Card>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Transaction History</h3>
          <div className="flex gap-2">
            <button
              onClick={() => { setWithdrawAmount(String(Math.floor(totalRevenue))); setWithdrawError(''); setShowWithdraw(true); }}
              className="flex items-center gap-1.5 text-xs bg-gray-900 text-white rounded-lg px-3 py-1.5 hover:bg-gray-800"
            >
              <DollarSign className="size-3.5" /> Withdraw
            </button>
            <button onClick={exportOrdersCSV} className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
              <Download className="size-3.5" /> Export CSV
            </button>
          </div>
        </div>

        <Card className="overflow-hidden">
          {paidOrders.length === 0 ? (
            <div className="py-16 text-center">
              <TrendingUp className="size-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">No transactions yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-[11px] text-gray-500 uppercase">
                    <th className="px-5 py-3 text-left font-medium">Reference</th>
                    <th className="px-4 py-3 text-left font-medium">Buyer</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">Order Total</th>
                    <th className="px-4 py-3 text-right font-medium">Commission (20%)</th>
                    <th className="px-4 py-3 text-right font-medium">Seller Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paidOrders.map((o, i) => (
                    <tr key={o.id} className="hover:bg-gray-50/60 animate-fade-in-up" style={{ animationDelay: `${i * 0.02}s` }}>
                      <td className="px-5 py-3 font-mono text-xs text-gray-700">{o.payment_reference || o.id?.slice(-10)}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">{o.buyer_email}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {new Date(o.created_at).toLocaleDateString('en-NG', { day:'2-digit', month:'short', year:'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(o.total || 0)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">{fmt(o.platform_fee || 0)}</td>
                      <td className="px-4 py-3 text-right text-blue-700">
                        {fmt(Object.values(o.seller_earnings || {}).reduce((s: number, v: unknown) => s + (Number(v) || 0), 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-gray-50">
                  <tr className="text-sm font-semibold">
                    <td colSpan={3} className="px-5 py-3 text-gray-700">Total</td>
                    <td className="px-4 py-3 text-right text-gray-900">{fmt(totalGMV)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{fmt(totalRevenue)}</td>
                    <td className="px-4 py-3 text-right text-blue-700">{fmt(totalGMV - totalRevenue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </div>
    );
  };

  const renderSettings = () => {
    if (!settings) return <div className="py-20 text-center text-sm text-gray-500">Loading settings…</div>;

    const ensureDefaultSections = (): SectionConfig[] => {
      const existingById = new Map(settings.sections_config.map(s => [s.id, s] as const));
      const defaults: SectionConfig[] = [
        { id: 'best-sellers', title: 'Best Sellers', type: 'best_sellers', enabled: true, wallpaper_url: '' },
        { id: 'new-arrivals', title: 'New Arrivals',  type: 'new_arrivals', enabled: true, wallpaper_url: '' },
        { id: 'flash-sales',  title: 'Flash Sales',   type: 'flash_sales',  enabled: true, wallpaper_url: '', low_stock_threshold: 20, flash_ends_at: null },
      ];
      const merged = defaults.map(d => existingById.get(d.id) ?? d);
      if (settings.sections_config.length !== merged.length) {
        setSettings({ ...settings, sections_config: merged });
      }
      return merged;
    };

    return (
      <div className="space-y-6 animate-fade-in-up max-w-3xl">
        {/* Contact info */}
        <Card className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900">{t('contactInfoTitle')}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{t('contactInfoSubtitle')}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Email</label>
              <input className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" value={settings.contact_email ?? ''} onChange={e => setSettings({ ...settings, contact_email: e.target.value })} placeholder={t('contactEmailPlaceholder')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Phone</label>
              <input className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" value={settings.contact_phone ?? ''} onChange={e => setSettings({ ...settings, contact_phone: e.target.value })} placeholder={t('contactPhonePlaceholder')} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Address</label>
              <textarea className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" rows={2} value={settings.contact_address ?? ''} onChange={e => setSettings({ ...settings, contact_address: e.target.value })} placeholder={t('contactAddressPlaceholder')} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>{saving ? t('savingSettings') : t('saveSettingsButton')}</Button>
          </div>
        </Card>

        {/* Hero wallpapers */}
        <Card className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900">{t('heroWallpapersTitle')}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{t('heroWallpapersSubtitle')}</p>
          </div>
          <div className="flex gap-2">
            <input className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" placeholder={t('heroWallpaperInputPlaceholder')} value={newWallpaper} onChange={e => setNewWallpaper(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddWallpaper()} />
            <Button size="sm" onClick={handleAddWallpaper}>{t('addWallpaperButton')}</Button>
          </div>
          {settings.hero_wallpapers.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">{t('noWallpapersText')}</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {settings.hero_wallpapers.map((url, idx) => (
                <li key={idx} className="flex items-center gap-3 border border-gray-100 rounded-lg p-2 bg-gray-50">
                  <img src={url} alt="" className="h-8 w-12 rounded object-cover bg-gray-200" onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; }} />
                  <p className="flex-1 text-xs text-gray-700 truncate">{url}</p>
                  <button onClick={() => handleRemoveWallpaper(idx)} className="text-xs text-red-500 hover:text-red-700">{t('removeWallpaperButton')}</button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>{saving ? t('savingSettings') : t('saveSettingsButton')}</Button>
          </div>
        </Card>

        {/* Homepage sections */}
        <Card className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900">Homepage Sections</h3>
            <p className="text-xs text-gray-500 mt-0.5">Configure Best Sellers, New Arrivals and Flash Sales sections.</p>
          </div>
          <div className="space-y-4">
            {ensureDefaultSections().map((cfg, index) => (
              <div key={cfg.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50/60 space-y-3">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={cfg.enabled} id={`sec-${cfg.id}`}
                    onChange={e => { const next = [...settings.sections_config]; next[index] = { ...cfg, enabled: e.target.checked }; setSettings({ ...settings, sections_config: next }); }}
                    className="h-4 w-4 rounded" />
                  <label htmlFor={`sec-${cfg.id}`} className="text-sm font-semibold text-gray-900">{cfg.title}</label>
                  <span className="text-[10px] text-gray-400 capitalize">{cfg.type.replace('_', ' ')}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-500 uppercase">Section title</label>
                    <input className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" value={cfg.title} onChange={e => { const next=[...settings.sections_config]; next[index]={...cfg,title:e.target.value}; setSettings({...settings,sections_config:next}); }} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-500 uppercase">Wallpaper URL</label>
                    <input className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" placeholder="https://…" value={cfg.wallpaper_url} onChange={e => { const next=[...settings.sections_config]; next[index]={...cfg,wallpaper_url:e.target.value}; setSettings({...settings,sections_config:next}); }} />
                  </div>
                  {cfg.type === 'flash_sales' && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-gray-500 uppercase">Low stock threshold</label>
                        <input type="number" min={1} className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" value={cfg.low_stock_threshold ?? 20} onChange={e => { const next=[...settings.sections_config]; next[index]={...cfg,low_stock_threshold:Number(e.target.value)||0}; setSettings({...settings,sections_config:next}); }} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-gray-500 uppercase">Flash sale ends at</label>
                        <input type="datetime-local" className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" value={cfg.flash_ends_at ?? ''} onChange={e => { const next=[...settings.sections_config]; next[index]={...cfg,flash_ends_at:e.target.value||null}; setSettings({...settings,sections_config:next}); }} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveSections} disabled={savingSections}>{savingSections ? t('savingSettings') : t('saveSettingsButton')}</Button>
          </div>
        </Card>
      </div>
    );
  };

  const renderComplaints = () => (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="font-semibold text-gray-900">Buyer Complaints</h2>
          <p className="text-xs text-gray-500 mt-0.5">{complaints.filter(c=>c.status==='open').length} open · {complaints.length} total</p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchComplaints} disabled={loadingComplaints}>
          <RefreshCw className={`size-3.5 mr-1 ${loadingComplaints ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {loadingComplaints ? (
        <div className="py-16 text-center text-sm text-gray-500">Loading…</div>
      ) : complaints.length === 0 ? (
        <Card className="p-12 text-center">
          <MessageSquare className="size-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500">No complaints filed yet</p>
        </Card>
      ) : (
        complaints.map(c => {
          const isOpen = expandedComplaint === c.id;
          return (
            <Card key={c.id} className="overflow-hidden">
              <button
                className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedComplaint(isOpen ? null : c.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium text-gray-900 text-sm">{c.subject}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${c.status === 'open' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                      {c.status}
                    </span>
                    {c.replies.length > 0 && <span className="text-[10px] text-gray-400">{c.replies.length} repl{c.replies.length === 1 ? 'y' : 'ies'}</span>}
                  </div>
                  <p className="text-xs text-gray-500">Buyer: {c.buyer_email}</p>
                  <p className="text-xs text-gray-400">
                    Seller: {users.find(u => u.id === c.seller_id)?.name || users.find(u => u.id === c.seller_id)?.email || c.seller_id?.slice(0,8) || '—'}
                  </p>
                  <p className="text-xs text-gray-400">Order #{c.order_id?.slice(-8).toUpperCase()} · {new Date(c.created_at).toLocaleDateString()}</p>
                </div>
                {isOpen ? <ChevronUp className="size-4 text-gray-400 shrink-0" /> : <ChevronDown className="size-4 text-gray-400 shrink-0" />}
              </button>

              {isOpen && (
                <div className="border-t px-5 py-4 space-y-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                    <p className="text-xs font-medium text-gray-500 mb-1">Buyer's complaint:</p>
                    {c.message}
                  </div>

                  {c.replies.length > 0 && (
                    <div className="space-y-2">
                      {c.replies.map((r: any) => (
                        <div key={r.id} className={`rounded-lg p-3 text-sm ${r.sender_role === 'admin' ? 'bg-purple-50 text-purple-900 ml-6' : 'bg-blue-50 text-blue-900'}`}>
                          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1 opacity-60 capitalize">{r.sender_role}</p>
                          {r.message}
                          <p className="text-[10px] opacity-50 mt-1">{new Date(r.created_at).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <textarea
                      rows={2}
                      className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      placeholder="Write a reply (visible to buyer and seller)…"
                      value={complaintReply[c.id] || ''}
                      onChange={e => setComplaintReply(r => ({ ...r, [c.id]: e.target.value }))}
                    />
                    <Button size="sm" className="self-end" onClick={() => handleComplaintReply(c.id)} disabled={submittingReply === c.id || !(complaintReply[c.id] || '').trim()}>
                      <Send className="size-3.5 mr-1" /> Reply
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        await supabase.from('complaints').update({ status: c.status === 'open' ? 'resolved' : 'open' }).eq('id', c.id);
                        setComplaints(prev => prev.map(x => x.id === c.id ? { ...x, status: x.status === 'open' ? 'resolved' : 'open' } : x));
                      }}
                      className={`text-xs px-3 py-1.5 rounded-md border font-medium ${c.status === 'open' ? 'border-green-200 text-green-700 hover:bg-green-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      {c.status === 'open' ? 'Mark resolved' : 'Reopen'}
                    </button>
                  </div>
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );

  const renderMessages = () => {
    const activeSession = chatSessions.find(s => s.id === activeChatId);
    return (
      <div className="space-y-5 animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Messages</h2>
            <p className="text-xs text-gray-500 mt-0.5">Compose messages, view history and live chats</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 pb-0">
          {([
            { id: 'compose', label: 'Compose', Icon: Megaphone },
            { id: 'inbox',   label: 'Inbox', Icon: Mail, badge: adminUnreadCount },
            { id: 'history', label: 'Sent History', Icon: History },
            { id: 'chats',   label: 'Live Support', Icon: Headphones, badge: chatSessions.filter(s => s.status === 'open').length },
          ] as { id: 'compose' | 'inbox' | 'history' | 'chats'; label: string; Icon: any; badge?: number }[]).map(({ id, label, Icon, badge }) => (
            <button
              key={id}
              onClick={() => setMsgTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                msgTab === id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="size-3.5" />
              {label}
              {badge !== undefined && badge > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Compose ── */}
        {msgTab === 'compose' && (
          <Card className="p-5 space-y-4 max-w-2xl">
            <h3 className="text-sm font-semibold text-gray-900">Compose a message</h3>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Audience</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" name="audience" checked={msgBroadcast} onChange={() => setMsgBroadcast(true)} />
                  Broadcast to all users
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" name="audience" checked={!msgBroadcast} onChange={() => setMsgBroadcast(false)} />
                  Specific user
                </label>
              </div>
            </div>
            {!msgBroadcast && (
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Recipient</label>
                <Select value={msgRecipientId} onValueChange={setMsgRecipientId}>
                  <SelectTrigger className="text-sm h-9">
                    <SelectValue placeholder="Select user…" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email} <span className="text-gray-400 text-xs">({u.role})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Subject</label>
              <input
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400/30"
                placeholder="e.g. New feature announcement"
                value={msgSubject}
                onChange={e => setMsgSubject(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Message</label>
              <textarea
                rows={4}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-400/30"
                placeholder="Write your message here…"
                value={msgBody}
                onChange={e => setMsgBody(e.target.value)}
              />
            </div>
            {msgError && (
              <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="size-3.5" /> {msgError}</p>
            )}
            <div className="flex justify-end">
              <Button onClick={handleSendMessage} disabled={sendingMsg}>
                <Send className="size-3.5 mr-1.5" />
                {sendingMsg ? 'Sending…' : msgBroadcast ? 'Broadcast to all' : 'Send message'}
              </Button>
            </div>
          </Card>
        )}

        {/* ── Inbox (received messages) ── */}
        {msgTab === 'inbox' && (
          <div className="space-y-2 max-w-2xl">
            {loadingInbox ? (
              <div className="flex items-center justify-center py-12">
                <div className="loading"><span /><span /><span /><span /><span /></div>
              </div>
            ) : inboxMessages.length === 0 ? (
              <Card className="p-10 text-center">
                <Mail className="size-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No messages received yet</p>
              </Card>
            ) : (
              inboxMessages.map(msg => (
                <Card
                  key={msg.id}
                  className={`overflow-hidden transition-shadow hover:shadow-md cursor-pointer ${!msg.read ? 'border-blue-200' : ''}`}
                  onClick={() => {
                    setInboxExpandedId(inboxExpandedId === msg.id ? null : msg.id);
                    if (!msg.read && adminId) markAdminMessageRead(msg.id, adminId);
                  }}
                >
                  <div className={`px-5 py-4 ${!msg.read ? 'bg-blue-50/40' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          {!msg.read && <span className="size-2 rounded-full bg-blue-500 shrink-0" />}
                          <p className={`text-sm truncate ${!msg.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>{msg.subject}</p>
                          {msg.is_broadcast && (
                            <span className="text-[10px] bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2 py-0.5">Broadcast</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 capitalize">From: {msg.sender_role}</p>
                      </div>
                      <p className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                        {new Date(msg.created_at).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                    {inboxExpandedId === msg.id && (
                      <div className="mt-3 pt-3 border-t text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {msg.body}
                      </div>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* ── Sent History ── */}
        {msgTab === 'history' && (
          <div className="space-y-2 max-w-2xl">
            {loadingSent ? (
              <div className="flex items-center justify-center py-12">
                <div className="loading"><span /><span /><span /><span /><span /></div>
              </div>
            ) : sentMessages.length === 0 ? (
              <Card className="p-10 text-center">
                <History className="size-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No messages sent yet</p>
              </Card>
            ) : (
              sentMessages.map(msg => {
                const recipient = msg.is_broadcast
                  ? 'All users (Broadcast)'
                  : users.find(u => u.id === msg.recipient_id)?.name
                    || users.find(u => u.id === msg.recipient_id)?.email
                    || 'Unknown user';
                return (
                  <Card key={msg.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <p className="text-sm font-medium text-gray-900 truncate">{msg.subject}</p>
                          {msg.is_broadcast && (
                            <span className="text-[10px] bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2 py-0.5">Broadcast</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">To: {recipient}</p>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{msg.body}</p>
                      </div>
                      <p className="text-xs text-gray-400 whitespace-nowrap shrink-0 flex items-center gap-1">
                        <Clock className="size-3" />
                        {new Date(msg.created_at).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* ── Live Support Chats ── */}
        {msgTab === 'chats' && (
          <div className="flex gap-4" style={{ height: '520px' }}>
            {/* Sessions list */}
            <div className="w-72 shrink-0 flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-widest">Conversations</p>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                {chatSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 p-6 text-center">
                    <Radio className="size-8 text-gray-300" />
                    <p className="text-xs text-gray-400">No chat sessions yet</p>
                  </div>
                ) : (
                  chatSessions.map(session => (
                    <button
                      key={session.id}
                      onClick={() => setActiveChatId(session.id)}
                      className={`w-full text-left px-4 py-3 transition-colors hover:bg-gray-50 ${activeChatId === session.id ? 'bg-gray-100' : ''}`}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="size-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                          {(session.user_name || session.user_email || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">{session.user_name || session.user_email}</p>
                          <p className="text-[10px] text-gray-400 truncate">{session.user_email}</p>
                        </div>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${session.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {session.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 pl-9">
                        {new Date(session.updated_at).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Chat panel */}
            <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden">
              {!activeChatId ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
                  <Headphones className="size-12 text-gray-200" />
                  <p className="text-sm font-medium text-gray-500">Select a conversation</p>
                  <p className="text-xs text-gray-400">Choose a chat from the left to view messages and reply</p>
                </div>
              ) : (
                <>
                  {/* Chat header */}
                  <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-3 shrink-0">
                    <div className="size-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-700">
                      {(activeSession?.user_name || activeSession?.user_email || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{activeSession?.user_name || activeSession?.user_email}</p>
                      <p className="text-xs text-gray-400">{activeSession?.user_email}</p>
                    </div>
                    <span className={`ml-auto text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${activeSession?.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {activeSession?.status}
                    </span>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
                    {liveChatMsgs.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-xs text-gray-400">No messages yet in this conversation.</p>
                      </div>
                    ) : (
                      liveChatMsgs.map(msg => {
                        const isAdmin = msg.sender_role === 'admin';
                        return (
                          <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                              isAdmin ? 'bg-gray-900 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
                            }`}>
                              {!isAdmin && <p className="text-[10px] font-semibold text-blue-600 mb-1 uppercase tracking-wide">{activeSession?.user_name || 'User'}</p>}
                              {msg.message}
                              <p className="text-[10px] mt-1 opacity-50">
                                {new Date(msg.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={adminChatBottomRef} />
                  </div>

                  {/* Input */}
                  <div className="shrink-0 border-t bg-white px-4 py-3">
                    <form
                      className="flex items-end gap-2"
                      onSubmit={e => { e.preventDefault(); sendAdminChatMessage(); }}
                    >
                      <textarea
                        rows={1}
                        className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-400/30"
                        placeholder="Reply to this user…"
                        value={adminChatInput}
                        onChange={e => setAdminChatInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAdminChatMessage(); }
                        }}
                      />
                      <Button type="submit" size="sm" disabled={!adminChatInput.trim() || sendingAdminChat} className="shrink-0">
                        <Send className="size-3.5" />
                      </Button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const saveRetention = async (updated: CartRetentionConfig) => {
    setSavingRetention(true);
    try {
      const { error } = await supabase
        .from('cart_retention_config')
        .update({
          enabled: updated.enabled,
          intervals: updated.intervals,
          channels: updated.channels,
          templates: updated.templates,
        })
        .eq('id', 1);
      setSavingRetention(false);
      if (error) { alert(`Failed to save: ${error.message}\nCode: ${error.code}`); return; }
      setRetention(updated);
    } catch (e: any) {
      setSavingRetention(false);
      alert(`Failed to save: ${e?.message || String(e)}`);
    }
  };

  const loadRetentionHistory = async () => {
    setLoadingHistory(true);
    const { data: logs } = await supabase
      .from('cart_reminder_log')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(100);
    if (!logs?.length) { setRetentionHistory([]); setLoadingHistory(false); return; }
    const userIds = [...new Set(logs.map((l: any) => l.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', userIds);
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    setRetentionHistory(logs.map((l: any) => ({ ...l, profile: profileMap.get(l.user_id) })));
    setLoadingHistory(false);
  };

  /* ──────────────────── admin profile helpers ──────────────────── */

  const startOtpCooldown = () => {
    setOtpCooldown(30);
    const timer = setInterval(() => {
      setOtpCooldown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSaveName = async () => {
    if (!editName.trim() || !adminId) return;
    setSavingName(true); setNameMsg('');
    await supabase.from('profiles').update({ name: editName.trim() }).eq('id', adminId);
    setAdminName(editName.trim());
    setNameMsg('Name updated successfully.');
    setSavingName(false);
    setTimeout(() => setNameMsg(''), 3000);
  };

  const sendProfileOtp = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email: adminEmail,
      options: { shouldCreateUser: false },
    });
    if (error) throw new Error(error.message);
    startOtpCooldown();
  };

  const handleSendEmailOtp = async () => {
    setEmailErr(''); setEmailMsg('');
    if (!newEmail.trim() || !/\S+@\S+\.\S+/.test(newEmail)) { setEmailErr('Enter a valid email address.'); return; }
    setSendingEmailOtp(true);
    try {
      await sendProfileOtp();
      setEmailOtpSent(true);
      setEmailMsg('Verification code sent to your current email.');
    } catch (e: any) { setEmailErr(e.message || 'Failed to send code.'); }
    finally { setSendingEmailOtp(false); }
  };

  const handleVerifyEmailOtp = async () => {
    if (emailOtp.length < 6) { setEmailErr('Enter the 6-digit code.'); return; }
    setVerifyingEmail(true); setEmailErr('');
    try {
      const { error } = await supabase.auth.verifyOtp({ email: adminEmail, token: emailOtp, type: 'email' });
      if (error) throw error;
      const { error: updateErr } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (updateErr) throw updateErr;
      await supabase.from('profiles').update({ email: newEmail.trim() }).eq('id', adminId!);
      setAdminEmail(newEmail.trim());
      setEmailMsg('Email updated! Check your new inbox for a confirmation link from Supabase.');
      setEmailOtpSent(false); setEmailOtp(''); setNewEmail('');
    } catch (e: any) {
      setEmailErr(e.message?.includes('expired') || e.message?.includes('invalid')
        ? 'Code expired or invalid. Resend and try again.'
        : e.message || 'Verification failed.');
    } finally { setVerifyingEmail(false); }
  };

  const handleSendPwdOtp = async () => {
    setPwdErr(''); setPwdMsg('');
    if (!newPassword || newPassword.length < 8) { setPwdErr('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setPwdErr('Passwords do not match.'); return; }
    setSendingPwdOtp(true);
    try {
      await sendProfileOtp();
      setPwdOtpSent(true);
      setPwdMsg('Verification code sent to your email.');
    } catch (e: any) { setPwdErr(e.message || 'Failed to send code.'); }
    finally { setSendingPwdOtp(false); }
  };

  const handleVerifyPwdOtp = async () => {
    if (pwdOtp.length < 6) { setPwdErr('Enter the 6-digit code.'); return; }
    setVerifyingPwd(true); setPwdErr('');
    try {
      const { error } = await supabase.auth.verifyOtp({ email: adminEmail, token: pwdOtp, type: 'email' });
      if (error) throw error;
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw updateErr;
      setPwdMsg('Password changed successfully.');
      setPwdOtpSent(false); setPwdOtp(''); setNewPassword(''); setConfirmPassword('');
    } catch (e: any) {
      setPwdErr(e.message?.includes('expired') || e.message?.includes('invalid')
        ? 'Code expired or invalid. Resend and try again.'
        : e.message || 'Verification failed.');
    } finally { setVerifyingPwd(false); }
  };

  const renderAdminProfile = () => (
    <div className="space-y-6 animate-fade-in-up max-w-2xl">
      {/* Avatar + info */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
            <span className="text-2xl font-bold text-white">{adminName[0]?.toUpperCase()}</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{adminName}</h2>
            <p className="text-sm text-gray-500">{adminEmail}</p>
            <span className="inline-flex items-center gap-1 mt-1 text-[11px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 font-medium">
              <ShieldCheck className="size-3" /> Administrator
            </span>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { id: 'info', label: 'Account Info', icon: User },
          { id: 'email', label: 'Change Email', icon: Mail },
          { id: 'password', label: 'Change Password', icon: KeyRound },
        ] as { id: typeof profileTab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setProfileTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${profileTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            <Icon className="size-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Tab: Account Info (name) */}
      {profileTab === 'info' && (
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Pencil className="size-4 text-gray-400" />Display Name</h3>
          <p className="text-xs text-gray-500">This is the name shown in the top-right of the admin console.</p>
          <div className="flex gap-3">
            <Input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="Your name"
              className="max-w-xs"
            />
            <Button onClick={handleSaveName} disabled={savingName || !editName.trim()}>
              {savingName ? 'Saving…' : 'Save Name'}
            </Button>
          </div>
          {nameMsg && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              <CheckCircle2 className="size-4 shrink-0" />{nameMsg}
            </div>
          )}

          <div className="pt-2 border-t space-y-1">
            <p className="text-xs font-medium text-gray-700">Email</p>
            <p className="text-sm text-gray-900">{adminEmail}</p>
            <p className="text-xs text-gray-400">To change your email, use the "Change Email" tab.</p>
          </div>
        </Card>
      )}

      {/* Tab: Change Email */}
      {profileTab === 'email' && (
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Mail className="size-4 text-gray-400" />Change Email Address</h3>
          <p className="text-xs text-gray-500">A verification code will be sent to your <strong>current</strong> email. Enter it to confirm the change.</p>

          {!emailOtpSent ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">New Email Address</label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={e => { setNewEmail(e.target.value); setEmailErr(''); }}
                  placeholder="new@example.com"
                  className="max-w-sm"
                />
              </div>
              {emailErr && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="size-3.5" />{emailErr}</p>}
              <Button onClick={handleSendEmailOtp} disabled={sendingEmailOtp || !newEmail}>
                <ShieldCheck className="size-3.5 mr-1.5" />
                {sendingEmailOtp ? 'Sending code…' : 'Send Verification Code'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-xs text-blue-800">
                Code sent to <strong>{adminEmail}</strong>. Enter it below to confirm changing your email to <strong>{newEmail}</strong>.
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">6-Digit Code</label>
                <Input
                  value={emailOtp}
                  onChange={e => { setEmailOtp(e.target.value.replace(/\D/g,'').slice(0,6)); setEmailErr(''); }}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  className="w-40 text-center text-xl tracking-widest"
                  autoFocus
                />
              </div>
              {emailErr && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="size-3.5" />{emailErr}</p>}
              {emailMsg && <p className="text-xs text-green-700">{emailMsg}</p>}
              <div className="flex gap-2">
                <Button onClick={handleVerifyEmailOtp} disabled={verifyingEmail || emailOtp.length < 6}>
                  {verifyingEmail ? 'Verifying…' : 'Confirm Change'}
                </Button>
                <Button variant="outline" disabled={otpCooldown > 0 || sendingEmailOtp} onClick={handleSendEmailOtp}>
                  {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : 'Resend Code'}
                </Button>
                <Button variant="ghost" onClick={() => { setEmailOtpSent(false); setEmailOtp(''); setEmailErr(''); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {emailMsg && !emailOtpSent && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              <CheckCircle2 className="size-4 shrink-0" />{emailMsg}
            </div>
          )}
        </Card>
      )}

      {/* Tab: Change Password */}
      {profileTab === 'password' && (
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><KeyRound className="size-4 text-gray-400" />Change Password</h3>
          <p className="text-xs text-gray-500">A verification code will be sent to <strong>{adminEmail}</strong> before the change is applied.</p>

          {!pwdOtpSent ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">New Password</label>
                <div className="relative max-w-sm">
                  <Input
                    type={showNewPwd ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setPwdErr(''); }}
                    placeholder="Min. 8 characters"
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowNewPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNewPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Confirm New Password</label>
                <div className="relative max-w-sm">
                  <Input
                    type={showConfirmPwd ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setPwdErr(''); }}
                    placeholder="Repeat password"
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowConfirmPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirmPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              {pwdErr && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="size-3.5" />{pwdErr}</p>}
              <Button onClick={handleSendPwdOtp} disabled={sendingPwdOtp || !newPassword || !confirmPassword}>
                <ShieldCheck className="size-3.5 mr-1.5" />
                {sendingPwdOtp ? 'Sending code…' : 'Send Verification Code'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-md px-3 py-2 text-xs text-green-800">
                {pwdMsg || `Code sent to ${adminEmail}. Enter it to confirm your new password.`}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">6-Digit Code</label>
                <Input
                  value={pwdOtp}
                  onChange={e => { setPwdOtp(e.target.value.replace(/\D/g,'').slice(0,6)); setPwdErr(''); }}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  className="w-40 text-center text-xl tracking-widest"
                  autoFocus
                />
              </div>
              {pwdErr && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="size-3.5" />{pwdErr}</p>}
              <div className="flex gap-2">
                <Button onClick={handleVerifyPwdOtp} disabled={verifyingPwd || pwdOtp.length < 6}>
                  {verifyingPwd ? 'Verifying…' : 'Confirm Change'}
                </Button>
                <Button variant="outline" disabled={otpCooldown > 0 || sendingPwdOtp} onClick={handleSendPwdOtp}>
                  {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : 'Resend Code'}
                </Button>
                <Button variant="ghost" onClick={() => { setPwdOtpSent(false); setPwdOtp(''); setPwdErr(''); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {pwdMsg && !pwdOtpSent && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              <CheckCircle2 className="size-4 shrink-0" />{pwdMsg}
            </div>
          )}
        </Card>
      )}
    </div>
  );

  const fetchActiveCartsDetail = async () => {
    setLoadingActiveCarts(true);
    // Get all cart items
    const { data: items } = await supabase
      .from('cart_items')
      .select('user_id, product_id, quantity, updated_at')
      .order('updated_at', { ascending: false });

    if (!items?.length) { setActiveCarts([]); setLoadingActiveCarts(false); return; }

    const userIds = [...new Set(items.map((i: any) => i.user_id))];
    const productIds = [...new Set(items.map((i: any) => i.product_id))];

    const [{ data: profiles }, { data: products }] = await Promise.all([
      supabase.from('profiles').select('id, name, email').in('id', userIds),
      supabase.from('products').select('id, name, price, image').in('id', productIds),
    ]);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const productMap = new Map((products || []).map((p: any) => [p.id, p]));

    // Group by user
    const byUser: Record<string, any> = {};
    for (const item of items) {
      if (!byUser[item.user_id]) {
        byUser[item.user_id] = {
          profile: profileMap.get(item.user_id) || { name: 'Unknown', email: item.user_id },
          items: [],
          lastUpdated: item.updated_at,
        };
      }
      byUser[item.user_id].items.push({
        ...item,
        product: productMap.get(item.product_id) || { name: 'Unknown product', price: 0 },
      });
      if (item.updated_at > byUser[item.user_id].lastUpdated) {
        byUser[item.user_id].lastUpdated = item.updated_at;
      }
    }

    setActiveCarts(Object.values(byUser).sort((a, b) =>
      new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    ));
    setLoadingActiveCarts(false);
  };

  const renderCartRetention = () => {
    const cronUrl = `https://${projectId}.supabase.co/functions/v1/server/cart-check`;

    return (
      <div className="space-y-6 animate-fade-in-up max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Cart Recovery</h2>
            <p className="text-sm text-gray-500 mt-0.5">Automatically remind customers who leave items in their cart</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-sm font-medium text-gray-700">{retention.enabled ? 'Active' : 'Inactive'}</span>
            <div
              onClick={() => saveRetention({ ...retention, enabled: !retention.enabled })}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${retention.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-1 size-4 bg-white rounded-full shadow transition-transform ${retention.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
          </label>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {/* Active Carts — clickable */}
          <Card className="overflow-hidden">
            <button
              className="w-full text-left bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white hover:from-blue-600 hover:to-blue-700 transition-colors group"
              onClick={() => {
                const next = !showActiveCarts;
                setShowActiveCarts(next);
                if (next) fetchActiveCartsDetail();
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium opacity-90">Active Carts</p>
                <div className="flex items-center gap-1.5 opacity-80">
                  <ShoppingCart className="size-4" />
                  <ChevronDown className={`size-3.5 transition-transform ${showActiveCarts ? 'rotate-180' : ''}`} />
                </div>
              </div>
              <p className="text-2xl font-bold">{retentionStats.activeCarts}</p>
              <p className="text-[10px] opacity-70 mt-0.5 group-hover:opacity-100">Click to view details</p>
            </button>
          </Card>

          {[
            { label: 'Reminders Today', value: retentionStats.sentToday, icon: Send, color: 'from-amber-500 to-orange-500' },
            { label: 'Carts Recovered', value: retentionStats.recovered, icon: TrendingUp, color: 'from-green-500 to-emerald-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="overflow-hidden">
              <div className={`bg-gradient-to-br ${color} p-4 text-white`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium opacity-90">{label}</p>
                  <Icon className="size-4 opacity-80" />
                </div>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Active Carts Detail Panel */}
        {showActiveCarts && (
          <Card className="overflow-hidden border-blue-200">
            <div className="flex items-center justify-between px-5 py-3 bg-blue-50 border-b border-blue-100">
              <div className="flex items-center gap-2">
                <ShoppingCart className="size-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-blue-900">Active Carts</h3>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{activeCarts.length} users</span>
              </div>
              <button
                onClick={() => setShowActiveCarts(false)}
                className="text-blue-400 hover:text-blue-700 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {loadingActiveCarts ? (
              <div className="flex items-center justify-center py-10">
                <div className="loading"><span /><span /><span /><span /><span /></div>
              </div>
            ) : activeCarts.length === 0 ? (
              <div className="py-10 text-center">
                <ShoppingCart className="size-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No active carts right now</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
                {activeCarts.map((cart, i) => {
                  const total = cart.items.reduce((s: number, it: any) => s + (it.product.price || 0) * it.quantity, 0);
                  return (
                    <div key={i} className="px-5 py-4">
                      {/* User row */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                            {(cart.profile.name || cart.profile.email || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{cart.profile.name || 'No name'}</p>
                            <p className="text-xs text-gray-500">{cart.profile.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">₦{Math.round(total).toLocaleString('en-NG')}</p>
                          <p className="text-[10px] text-gray-400">{cart.items.length} item{cart.items.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>

                      {/* Cart items */}
                      <div className="space-y-2 pl-11">
                        {cart.items.map((item: any, j: number) => (
                          <div key={j} className="flex items-center gap-3">
                            {item.product.image ? (
                              <img src={item.product.image} alt={item.product.name} className="size-9 rounded-md object-cover border border-gray-100 shrink-0" />
                            ) : (
                              <div className="size-9 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                                <Package className="size-4 text-gray-300" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">{item.product.name}</p>
                              <p className="text-[10px] text-gray-400">
                                ₦{Math.round(item.product.price || 0).toLocaleString('en-NG')} × {item.quantity}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-semibold text-gray-700">
                                ₦{Math.round((item.product.price || 0) * item.quantity).toLocaleString('en-NG')}
                              </p>
                              <p className="text-[10px] text-gray-400" title={new Date(item.updated_at).toLocaleString()}>
                                {(() => {
                                  const diff = Date.now() - new Date(item.updated_at).getTime();
                                  const mins = Math.floor(diff / 60000);
                                  if (mins < 60) return `${mins}m ago`;
                                  const hrs = Math.floor(mins / 60);
                                  if (hrs < 24) return `${hrs}h ago`;
                                  return `${Math.floor(hrs / 24)}d ago`;
                                })()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {(['overview', 'intervals', 'channels'] as const).map(tab => (
            <button key={tab} onClick={() => setRetentionTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${retentionTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>
              {tab === 'overview' ? 'Overview & Setup' : tab === 'intervals' ? 'Intervals & Templates' : 'Channels & Credentials'}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {retentionTab === 'overview' && (
          <div className="space-y-4">
            <Card className="p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Play className="size-4 text-green-600" /> Test Reminders</h3>

              {/* Helper to call edge function */}
              {(() => {
                const refreshRetentionStats = () => {
                  const today = new Date(); today.setHours(0, 0, 0, 0);
                  Promise.all([
                    fetch(`https://${projectId}.supabase.co/functions/v1/server`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`, 'apikey': publicAnonKey },
                      body: JSON.stringify({ action: 'cart-stats' }),
                    }).then(r => r.json()).then((j: any) => j.activeCarts ?? 0).catch(() => 0),
                    supabase.from('cart_reminder_log').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('sent_at', today.toISOString()),
                  ]).then(([activeCarts, logs]) => {
                    setRetentionStats(s => ({ ...s, activeCarts, sentToday: logs.count || 0 }));
                  });
                  loadRetentionHistory();
                };

                const callCartCheck = async (force: boolean) => {
                  const res = await fetch(`https://${projectId}.supabase.co/functions/v1/server`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${accessToken}`,
                      'apikey': publicAnonKey,
                      'x-cron-secret': 'manual-test',
                    },
                    body: JSON.stringify({ action: 'cart-check', force }),
                  });
                  const text = await res.text();
                  let json: any = {};
                  try { json = JSON.parse(text); } catch { throw new Error(`Status ${res.status}: ${text.slice(0, 100)}`); }
                  if (!res.ok) throw new Error(json.error || json.detail || json.message || `HTTP ${res.status}`);
                  return json;
                };

                return (
                  <div className="space-y-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-xs text-blue-800 space-y-1">
                      <p><strong>Process Now</strong> — checks time windows (same as cron). Only sends if a cart falls in 5min/30min/1hr/1day/7day window.</p>
                      <p><strong>Force Send Now</strong> — ignores time windows, sends to ALL active carts immediately. Use to test email/SMS delivery.</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={processingNow} onClick={async () => {
                        setProcessingNow(true);
                        try {
                          const json = await callCartCheck(false);
                          const dbg: string[] = json.debug || [];
                          const issues = dbg.filter((l: string) => l.includes('❌') || l.includes('FAILED') || l.includes('SKIP') || l.includes('ERROR') || l.includes('NONE'));
                          const summary = dbg.find((l: string) => l.includes('SUMMARY')) || '';
                          const lines: string[] = [];
                          lines.push(json.message || `Done — ${json.sent ?? 0} sent, ${json.failed ?? 0} failed, ${json.skipped ?? 0} skipped`);
                          if (summary) lines.push(summary);
                          if (issues.length) lines.push('', '⚠️ Issues:', ...issues);
                          lines.push('', '--- Full Debug ---', ...dbg);
                          alert(lines.join('\n'));
                          refreshRetentionStats();
                        } catch (e: any) { alert(`Error: ${e?.message || 'Failed'}`); }
                        finally { setProcessingNow(false); }
                      }}>
                        {processingNow ? 'Processing…' : 'Process Now'}
                      </Button>

                      <Button size="sm" disabled={processingNow} className="bg-orange-500 hover:bg-orange-600 text-white" onClick={async () => {
                        if (!window.confirm('Force send to ALL active carts now?\n\nThis bypasses time windows and will send emails to every user with items in their cart.')) return;
                        setProcessingNow(true);
                        try {
                          const json = await callCartCheck(true);
                          const dbg: string[] = json.debug || [];
                          const issues = dbg.filter((l: string) => l.includes('❌') || l.includes('FAILED') || l.includes('SKIP') || l.includes('ERROR') || l.includes('NONE'));
                          const lines: string[] = [];
                          lines.push(`Force Send: ${json.sent ?? 0} sent, ${json.failed ?? 0} failed, ${json.skipped ?? 0} skipped`);
                          if (issues.length) lines.push('', '⚠️ Issues:', ...issues);
                          lines.push('', '--- Full Debug ---', ...dbg);
                          alert(lines.join('\n'));
                          refreshRetentionStats();
                        } catch (e: any) { alert(`Error: ${e?.message || 'Failed'}`); }
                        finally { setProcessingNow(false); }
                      }}>
                        {processingNow ? 'Sending…' : '⚡ Force Send Now'}
                      </Button>

                      <Button size="sm" variant="secondary" disabled={processingNow} onClick={async () => {
                        const email = window.prompt('Send test email to (enter your email):');
                        if (!email) return;
                        setProcessingNow(true);
                        try {
                          const res = await fetch(`https://${projectId}.supabase.co/functions/v1/server`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`, 'apikey': publicAnonKey },
                            body: JSON.stringify({ action: 'test-email', to: email }),
                          });
                          const json = await res.json();
                          if (json.ok) alert(`✅ Test email sent to ${email}!\nCheck your inbox (and spam folder).`);
                          else alert(`❌ Test email FAILED:\n${json.error || JSON.stringify(json)}\n\nThis means the email provider (Brevo/Resend) is not configured correctly in Supabase Edge Function secrets.`);
                        } catch (e: any) { alert(`Error: ${e?.message}`); }
                        finally { setProcessingNow(false); }
                      }}>
                        📧 Test Email
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><Clock className="size-4 text-blue-600" /> Cron Setup (Free — cron-job.org)</h3>
              <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
                <li>Go to <span className="font-mono text-blue-600">cron-job.org</span> and create a free account</li>
                <li>Click <strong>Create cronjob</strong></li>
                <li>Set URL to: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs break-all">{`https://${projectId}.supabase.co/functions/v1/server`}</code></li>
                <li>Method: <strong>POST</strong></li>
                <li>Request body: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{`{"action":"cart-check"}`}</code></li>
                <li>Add headers (click <strong>+ ADD</strong> for each):<br/>
                  <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">Content-Type: application/json</code><br/>
                  <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">apikey: {publicAnonKey.slice(0,30)}…</code><br/>
                  <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">Authorization: Bearer {publicAnonKey.slice(0,30)}…</code><br/>
                  <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">x-cron-secret: myshophub-cron-2024</code>
                </li>
                <li>Schedule: every <strong>5 minutes</strong></li>
                <li>Save — it will run automatically every 5 minutes for free</li>
              </ol>
              <p className="text-xs text-gray-400 mt-3">Optionally set <code className="bg-gray-100 px-1 rounded">CRON_SECRET</code> in Supabase Dashboard → Edge Functions → server → Secrets, then update the header value above.</p>
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Template Variables</h3>
              <p className="text-xs text-gray-500 mb-2">Use these in your message templates:</p>
              <div className="grid grid-cols-2 gap-2">
                {['{name}','Items count','{total}','Cart value','{item_count}','No. of items','{items_list}','Product names','{link}','Cart URL'].reduce<string[][]>((acc, v, i) => { if (i % 2 === 0) acc.push([v]); else acc[acc.length-1].push(v); return acc; }, []).map(([code, desc]) => (
                  <div key={code} className="flex items-center gap-2 text-xs">
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-700">{code}</code>
                    <span className="text-gray-500">{desc}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Recovery History */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Recovery History</h3>
                <button onClick={loadRetentionHistory} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  {loadingHistory ? 'Loading…' : '↻ Refresh'}
                </button>
              </div>
              {loadingHistory ? (
                <div className="text-center py-8 text-sm text-gray-400">Loading…</div>
              ) : retentionHistory.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">No reminders sent yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 pr-3 font-medium text-gray-500">Customer</th>
                        <th className="text-left py-2 pr-3 font-medium text-gray-500">Interval</th>
                        <th className="text-left py-2 pr-3 font-medium text-gray-500">Channel</th>
                        <th className="text-left py-2 pr-3 font-medium text-gray-500">Status</th>
                        <th className="text-left py-2 font-medium text-gray-500">Sent At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {retentionHistory.map((entry: any) => (
                        <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 pr-3">
                            <div className="font-medium text-gray-900 truncate max-w-[140px]">{entry.profile?.name || entry.profile?.email || entry.user_id.slice(0, 8) + '…'}</div>
                            {entry.profile?.email && <div className="text-gray-400 truncate max-w-[140px]">{entry.profile.email}</div>}
                          </td>
                          <td className="py-2 pr-3">
                            <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">{entry.interval_key}</span>
                          </td>
                          <td className="py-2 pr-3 capitalize text-gray-700">{entry.channel}</td>
                          <td className="py-2 pr-3">
                            <span className={`px-2 py-0.5 rounded-full font-medium ${entry.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                              {entry.status}
                            </span>
                            {entry.error && <div className="text-red-400 mt-0.5 max-w-[120px] truncate" title={entry.error}>{entry.error}</div>}
                          </td>
                          <td className="py-2 text-gray-500 whitespace-nowrap">{new Date(entry.sent_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 text-xs text-gray-400 text-right">{retentionHistory.length} entries (last 100)</div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Tab: Intervals & Templates */}
        {retentionTab === 'intervals' && (
          <div className="space-y-4">
            {retention.intervals.map((interval, idx) => {
              const tmpl = retention.templates[interval.key] || { subject: '', email: '', sms: '', whatsapp: '' };
              const update = (patch: Partial<RetentionInterval>) => {
                const intervals = retention.intervals.map((v, i) => i === idx ? { ...v, ...patch } : v);
                setRetention({ ...retention, intervals });
              };
              const updateTmpl = (patch: Partial<RetentionTemplate>) => {
                setRetention({ ...retention, templates: { ...retention.templates, [interval.key]: { ...tmpl, ...patch } } });
              };
              return (
                <Card key={interval.key} className="p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div onClick={() => update({ enabled: !interval.enabled })}
                      className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${interval.enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <div className={`absolute top-0.5 size-4 bg-white rounded-full shadow transition-transform ${interval.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">{interval.label}</h3>
                    <span className="text-xs text-gray-400">after last cart activity</span>
                  </div>
                  {interval.enabled && (
                    <div className="space-y-2 pl-12">
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Email Subject</label>
                        <input className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" value={tmpl.subject} onChange={e => updateTmpl({ subject: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1 flex items-center gap-1"><Mail className="size-3" /> Email Body</label>
                        <textarea rows={2} className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" value={tmpl.email} onChange={e => updateTmpl({ email: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1 flex items-center gap-1"><Smartphone className="size-3" /> SMS Text</label>
                        <textarea rows={2} className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" value={tmpl.sms} onChange={e => updateTmpl({ sms: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1 flex items-center gap-1"><MessageCircle className="size-3 text-green-600" /> WhatsApp Text</label>
                        <textarea rows={2} className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" value={tmpl.whatsapp} onChange={e => updateTmpl({ whatsapp: e.target.value })} />
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
            <Button onClick={() => saveRetention(retention)} disabled={savingRetention}>
              {savingRetention ? 'Saving…' : 'Save All Intervals'}
            </Button>
          </div>
        )}

        {/* Tab: Channels */}
        {retentionTab === 'channels' && (
          <div className="space-y-4">
            {/* Email */}
            <Card className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div onClick={() => setRetention(r => ({ ...r, channels: { ...r.channels, email: { ...r.channels.email, enabled: !r.channels.email.enabled } } }))}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${retention.channels.email.enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 size-4 bg-white rounded-full shadow transition-transform ${retention.channels.email.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <Mail className="size-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900">Email</h3>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Free · 3,000/month via Resend</span>
              </div>
              <div className="pl-12 space-y-2">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">From Name</label>
                  <input className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" value={retention.channels.email.from_name} onChange={e => setRetention(r => ({ ...r, channels: { ...r.channels, email: { ...r.channels.email, from_name: e.target.value } } }))} placeholder="ShopHub" />
                </div>
                <p className="text-xs text-gray-400">Resend API key is configured via <code className="bg-gray-100 px-1 rounded">RESEND_API_KEY</code> environment variable in Supabase.</p>
              </div>
            </Card>

            {/* SMS */}
            <Card className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div onClick={() => setRetention(r => ({ ...r, channels: { ...r.channels, sms: { ...r.channels.sms, enabled: !r.channels.sms.enabled } } }))}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${retention.channels.sms.enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 size-4 bg-white rounded-full shadow transition-transform ${retention.channels.sms.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <Smartphone className="size-4 text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-900">SMS</h3>
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Twilio · No CAC needed · Free trial</span>
              </div>
              <div className="pl-12 space-y-2">
                <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-xs text-blue-800 space-y-0.5">
                  <p className="font-semibold">Setup (2 minutes, no CAC needed):</p>
                  <p>1. Sign up free at <strong>twilio.com</strong> → get $15 free trial credit</p>
                  <p>2. From Console Dashboard, copy <strong>Account SID</strong> and <strong>Auth Token</strong></p>
                  <p>3. Go to Phone Numbers → Get a free trial number (starts with +1)</p>
                  <p>4. Paste all three below and Save</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Account SID</label>
                  <input className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" value={retention.channels.sms.account_sid} onChange={e => setRetention(r => ({ ...r, channels: { ...r.channels, sms: { ...r.channels.sms, account_sid: e.target.value } } }))} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Auth Token</label>
                  <input type="password" className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" value={retention.channels.sms.auth_token} onChange={e => setRetention(r => ({ ...r, channels: { ...r.channels, sms: { ...r.channels.sms, auth_token: e.target.value } } }))} placeholder="Your Twilio Auth Token" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Messaging Service SID <span className="text-gray-400 font-normal">(MG… from Twilio console) or phone number</span></label>
                  <input className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" value={retention.channels.sms.from_number} onChange={e => setRetention(r => ({ ...r, channels: { ...r.channels, sms: { ...r.channels.sms, from_number: e.target.value } } }))} placeholder="MG1247ea4bbe72b8d83be85147…" />
                </div>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">⚠️ Free trial only sends to verified numbers. To reach any Nigerian number without restriction, add $20 credit on twilio.com.</p>
              </div>
            </Card>

            {/* WhatsApp */}
            <Card className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div onClick={() => setRetention(r => ({ ...r, channels: { ...r.channels, whatsapp: { ...r.channels.whatsapp, enabled: !r.channels.whatsapp.enabled } } }))}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${retention.channels.whatsapp.enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 size-4 bg-white rounded-full shadow transition-transform ${retention.channels.whatsapp.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <MessageCircle className="size-4 text-green-600" />
                <h3 className="text-sm font-semibold text-gray-900">WhatsApp</h3>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Meta Cloud API · 1,000 free/month</span>
              </div>
              <div className="pl-12 space-y-2">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Access Token</label>
                  <input type="password" className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" value={retention.channels.whatsapp.token} onChange={e => setRetention(r => ({ ...r, channels: { ...r.channels, whatsapp: { ...r.channels.whatsapp, token: e.target.value } } }))} placeholder="Meta Cloud API token" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Phone Number ID</label>
                  <input className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" value={retention.channels.whatsapp.phone_number_id} onChange={e => setRetention(r => ({ ...r, channels: { ...r.channels, whatsapp: { ...r.channels.whatsapp, phone_number_id: e.target.value } } }))} placeholder="From Meta Business dashboard" />
                </div>
                <p className="text-xs text-gray-400">Get credentials from <span className="text-blue-600">developers.facebook.com</span> → WhatsApp Business → API Setup.</p>
              </div>
            </Card>

            <Button onClick={() => saveRetention(retention)} disabled={savingRetention}>
              {savingRetention ? 'Saving…' : 'Save Channel Settings'}
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    switch (section) {
      case 'dashboard':  return renderDashboard();
      case 'orders':     return renderOrders();
      case 'users':      return renderUsers();
      case 'revenue':    return renderRevenue();
      case 'complaints': return renderComplaints();
      case 'messages':   return renderMessages();
      case 'settings':   return renderSettings();
      case 'cart-retention': return renderCartRetention();
      case 'profile':        return renderAdminProfile();
    }
  };

  /* ──────────────────── main layout ──────────────────── */
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-60 bg-white border-r border-gray-200 flex flex-col shadow-sm
        transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand */}
        <div className="flex items-center gap-2 px-5 h-16 border-b border-gray-200 shrink-0">
          <Store className="size-8 text-blue-600" />
          <div>
            <p className="text-lg font-semibold text-gray-900 leading-none">ShopHub</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Admin Console</p>
          </div>
          <button className="ml-auto lg:hidden text-gray-400 hover:text-gray-700" onClick={() => setSidebarOpen(false)}>
            <X className="size-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => handleSetSection(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${section === id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {badge !== undefined && badge > 0 && (
                <span className="text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 font-bold">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-2 py-4 border-t border-gray-200">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="size-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top header */}
        <header className="bg-white border-b border-gray-200 shadow-sm px-4 h-16 flex items-center gap-3 shrink-0">
          <button className="lg:hidden text-gray-500 hover:text-gray-700" onClick={() => setSidebarOpen(v => !v)}>
            <Menu className="size-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-gray-900">
              {section === 'profile' ? 'Profile Settings' : navItems.find(n => n.id === section)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-3">

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 transition-colors outline-none">
                <div className="size-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                  <span className="text-xs text-white font-bold">{adminName[0]?.toUpperCase()}</span>
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-900 leading-none">{adminName}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Administrator</p>
                </div>
                <ChevronDown className="size-3.5 text-gray-400 hidden sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <p className="text-sm font-medium">{adminName}</p>
                <p className="text-xs text-gray-400 font-normal truncate">{adminEmail}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleSetSection('profile')}>
                <User className="size-4 mr-2" />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-red-600">
                <LogOut className="size-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div key={section} className="page-enter">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* ── Withdraw dialog ── */}
      <Dialog open={showWithdraw} onOpenChange={open => { if (!open) setShowWithdraw(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Withdraw Platform Revenue</DialogTitle>
            <DialogDescription>
              Initiate a Paystack transfer to your bank account. Available: <strong>{fmt(totalRevenue)}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-medium text-gray-700">Bank</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  value={withdrawBankCode}
                  onChange={e => setWithdrawBankCode(e.target.value)}
                >
                  <option value="">Select bank…</option>
                  {NIGERIAN_BANKS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Account Number</label>
                <input
                  type="text" maxLength={10}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="0123456789"
                  value={withdrawAcctNum}
                  onChange={e => setWithdrawAcctNum(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Account Name</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="John Doe"
                  value={withdrawAcctName}
                  onChange={e => setWithdrawAcctName(e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-medium text-gray-700">Amount (NGN)</label>
                <input type="number" min={1} step="1"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                />
              </div>
            </div>
            {withdrawError && (
              <p className="flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="size-3.5" /> {withdrawError}
              </p>
            )}
          </div>
          <DialogFooter className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowWithdraw(false)} className="text-xs border border-gray-200 rounded-md px-3 py-1.5 hover:bg-gray-50">Cancel</button>
            <button
              disabled={withdrawing}
              className="text-xs bg-gray-900 text-white rounded-md px-3 py-1.5 hover:bg-gray-800 disabled:opacity-60"
              onClick={async () => {
                setWithdrawError('');
                const amount = Number(withdrawAmount);
                if (!amount || amount <= 0) { setWithdrawError('Enter a valid amount.'); return; }
                if (amount > totalRevenue) { setWithdrawError('Amount exceeds available revenue.'); return; }
                if (!withdrawBankCode) { setWithdrawError('Select a bank.'); return; }
                if (withdrawAcctNum.length !== 10) { setWithdrawError('Account number must be 10 digits.'); return; }
                if (!withdrawAcctName.trim()) { setWithdrawError('Enter account name.'); return; }
                setWithdrawing(true);
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  const token = session?.access_token ?? publicAnonKey;
                  const res = await fetch(`https://${projectId}.supabase.co/functions/v1/server`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`,
                      'apikey': publicAnonKey,
                    },
                    body: JSON.stringify({
                      action: 'admin-transfer',
                      amount,
                      bank_code: withdrawBankCode,
                      account_number: withdrawAcctNum,
                      account_name: withdrawAcctName,
                    }),
                  });
                  const json = await res.json();
                  if (!res.ok) {
                    setWithdrawError(json.error || 'Transfer failed. Check your Paystack secret key settings.');
                    return;
                  }
                  setShowWithdraw(false);
                  setWithdrawAmount(''); setWithdrawBankCode(''); setWithdrawAcctNum(''); setWithdrawAcctName('');
                  alert(`Transfer initiated! Reference: ${json.reference || 'see Paystack dashboard'}`);
                } catch { setWithdrawError('Network error.'); }
                finally { setWithdrawing(false); }
              }}
            >
              {withdrawing ? 'Processing…' : 'Confirm withdrawal'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit user dialog ── */}
      <Dialog open={!!editingUser} onOpenChange={open => { if (!open && !editingSaving) setEditingUser(null); }}>
        <DialogContent>
          {editingUser && (
            <>
              <DialogHeader>
                <DialogTitle>{t('dialogEditUserTitle')}</DialogTitle>
                <DialogDescription>{t('dialogEditUserDescription')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">{t('dialogNameLabel')}</label>
                  <input className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" value={editingUser.name} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">{t('dialogEmailLabel')}</label>
                  <p className="text-sm text-gray-600">{editingUser.email}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">{t('dialogRoleLabel')}</label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value as AdminUser['role'] })}>
                    <option value="buyer">{t('dialogBuyerOption')}</option>
                    <option value="seller">{t('dialogSellerOption')}</option>
                    <option value="admin">{t('dialogAdminOption')}</option>
                  </select>
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(editingUser.id)} disabled={editingSaving}>
                  {t('dialogRemoveUserButton')}
                </Button>
                <Button size="sm" onClick={handleSaveUser} disabled={editingSaving}>
                  {editingSaving ? t('dialogSaving') : t('dialogSaveChangesButton')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
