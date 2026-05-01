import { FC, useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { AlertCircle, MessageSquare, ChevronDown, ChevronUp, Send, Headphones } from 'lucide-react';
import { supabase } from '../../utils/supabase/client';
import { useLanguage } from '../../utils/i18n/LanguageContext';

interface BuyerHelpCenterProps {
  onBackToProducts: () => void;
}

type HelpCategoryId = 'orders' | 'payments' | 'delivery' | 'returns' | 'account';
type MainTab = 'help' | 'disputes' | 'chat';

interface HelpQuestion {
  id: string;
  question: string;
  answer: string;
}

interface Complaint {
  id: string;
  order_id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  replies: ComplaintReply[];
}

interface ComplaintReply {
  id: string;
  sender_role: string;
  message: string;
  created_at: string;
}

interface SupportChatMsg {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  created_at: string;
}

const HELP_DATA: Record<HelpCategoryId, { label: string; questions: HelpQuestion[] }> = {
  orders: {
    label: 'Orders',
    questions: [
      { id: 'place-order', question: 'How do I place an order on ShopHub?', answer: 'Browse products, add items to your cart, then go to Checkout to confirm your shipping address and payment method. Once you confirm, your order will be created and you will see it in the Orders page.' },
      { id: 'order-status', question: 'Where can I see the status of my order?', answer: 'Open the Help dropdown and click "Orders" or "Track Order". You will see each order with its current status (processing, shipped, delivered, or cancelled).' },
    ],
  },
  payments: {
    label: 'Payments',
    questions: [
      { id: 'payment-methods', question: 'What payment methods are accepted on ShopHub?', answer: 'ShopHub supports major debit and credit cards via Paystack. Depending on your region, additional options like wallet or bank transfer may be available.' },
      { id: 'payment-failed', question: 'My payment failed. What should I do?', answer: 'First check that your card details are correct and that you have enough funds. If the problem continues, try another card or contact your bank. You can then try to place the order again on ShopHub.' },
    ],
  },
  delivery: {
    label: 'Delivery',
    questions: [
      { id: 'delivery-time', question: 'How long does delivery take?', answer: 'Delivery time depends on the seller and your location. Most ShopHub orders are delivered within 2–7 working days. You can see an estimated date on the checkout page and in your order details.' },
      { id: 'delivery-fees', question: 'How are delivery fees calculated?', answer: 'Delivery fees depend on the weight of the items, the seller, and your address. The final fee is always shown before you confirm your order on ShopHub.' },
    ],
  },
  returns: {
    label: 'Returns & Refunds',
    questions: [
      { id: 'return-policy', question: "What is ShopHub's return policy?", answer: 'Most items can be returned within a limited period if they are damaged, defective, or not as described. Please check the Returns & Refunds page for the exact rules in your region.' },
      { id: 'refund-time', question: 'How long does it take to receive my refund?', answer: 'Once your return is approved, refunds are usually processed within 3–7 working days, depending on your payment provider.' },
    ],
  },
  account: {
    label: 'Account',
    questions: [
      { id: 'update-details', question: 'How do I update my ShopHub account details?', answer: 'Go to the Account section from the top-right menu, then update your name, email, or other details. Remember to save your changes before leaving the page.' },
      { id: 'password-reset', question: 'I forgot my password. How can I reset it?', answer: 'On the login page, click "Forgot password" and follow the steps. You will receive a reset link at the email address linked to your ShopHub account.' },
    ],
  },
};

export const BuyerHelpCenter: FC<BuyerHelpCenterProps> = ({ onBackToProducts }) => {
  const { t } = useLanguage();
  const [mainTab, setMainTab] = useState<MainTab>('help');
  const [activeCategory, setActiveCategory] = useState<HelpCategoryId>('orders');
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);

  /* disputes */
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loadingComplaints, setLoadingComplaints] = useState(false);
  const [expandedComplaintId, setExpandedComplaintId] = useState<string | null>(null);

  /* live chat */
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [supportMsgs, setSupportMsgs] = useState<SupportChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mainTab === 'disputes') loadComplaints();
  }, [mainTab]);

  /* init chat when tab opens */
  useEffect(() => {
    if (mainTab !== 'chat') return;
    let ch: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      setLoadingChat(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingChat(false); return; }
      setUserId(user.id);

      /* find or create a session */
      const { data: existing } = await supabase
        .from('support_chats')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1);

      let sessionId: string;
      if (existing && existing.length > 0) {
        sessionId = existing[0].id;
      } else {
        const { data: newChat } = await supabase
          .from('support_chats')
          .insert({
            user_id: user.id,
            user_email: user.email,
            user_name: (user.user_metadata as any)?.name || user.email,
          })
          .select('id')
          .single();
        if (!newChat) { setLoadingChat(false); return; }
        sessionId = newChat.id;
      }
      setChatSessionId(sessionId);

      const { data: msgs } = await supabase
        .from('support_chat_messages')
        .select('*')
        .eq('chat_id', sessionId)
        .order('created_at', { ascending: true });
      setSupportMsgs(msgs || []);
      setLoadingChat(false);

      ch = supabase.channel(`buyer-chat-${sessionId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public',
          table: 'support_chat_messages',
        }, (payload) => {
          const m = payload.new as SupportChatMsg;
          if (m.chat_id !== sessionId) return;
          setSupportMsgs(prev => {
            if (prev.some(x => x.id === m.id)) return prev;
            // Replace optimistic temp msg if same sender+text
            const filtered = prev.filter(x => !(x.id.startsWith('tmp-') && x.message === m.message && x.sender_id === m.sender_id));
            return [...filtered, m];
          });
        })
        .subscribe();
    };

    init();
    return () => { if (ch) supabase.removeChannel(ch); };
  }, [mainTab]);

  /* auto-scroll */
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [supportMsgs]);

  const loadComplaints = async () => {
    setLoadingComplaints(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingComplaints(false); return; }

    const { data } = await supabase
      .from('complaints')
      .select('id, order_id, subject, message, status, created_at')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false });

    if (!data) { setLoadingComplaints(false); return; }

    const withReplies: Complaint[] = await Promise.all(
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
    setLoadingComplaints(false);
  };

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || !chatSessionId || !userId || sendingChat) return;
    setSendingChat(true);
    setChatInput('');
    // Optimistic update
    const tempId = `tmp-${Date.now()}`;
    setSupportMsgs(prev => [...prev, {
      id: tempId, chat_id: chatSessionId, sender_id: userId,
      sender_role: 'buyer', message: text, created_at: new Date().toISOString(),
    }]);
    const { data } = await supabase.from('support_chat_messages').insert({
      chat_id: chatSessionId, sender_id: userId, sender_role: 'buyer', message: text,
    }).select().single();
    if (data) {
      setSupportMsgs(prev => prev.map(m => m.id === tempId ? data as SupportChatMsg : m));
    }
    await supabase.from('support_chats').update({ updated_at: new Date().toISOString() }).eq('id', chatSessionId);
    setSendingChat(false);
  };

  const current = HELP_DATA[activeCategory];
  const openCount = complaints.filter(c => c.status === 'open' && c.replies.length === 0).length;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in-up">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">{t('helpCenterTitle')}</h1>
          <p className="text-sm text-gray-600">{t('helpCenterSubtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onBackToProducts}>{t('backToProducts')}</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setMainTab('help')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mainTab === 'help' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
        >
          {t('helpCenterTab')}
        </button>
        <button
          onClick={() => setMainTab('disputes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mainTab === 'disputes' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
        >
          <AlertCircle className="size-4" />
          {t('myDisputesTab')}
          {openCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{openCount}</span>
          )}
        </button>
        <button
          onClick={() => setMainTab('chat')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mainTab === 'chat' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
        >
          <Headphones className="size-4" />
          {t('liveChatTab')}
        </button>
      </div>

      {/* ── Help Center ──────────────────────────────────── */}
      {mainTab === 'help' && (
        <div className="grid grid-cols-1 md:grid-cols-[260px,1fr] gap-6">
          <aside className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-1">
            {(Object.keys(HELP_DATA) as HelpCategoryId[]).map((id) => {
              const cat = HELP_DATA[id];
              const isActive = id === activeCategory;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setActiveCategory(id); setOpenQuestionId(null); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm border transition-colors ${isActive ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                  <span>{cat.label}</span>
                  <span className={`text-xs ${isActive ? 'text-gray-300' : 'text-gray-400'}`}>{cat.questions.length}</span>
                </button>
              );
            })}
          </aside>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h2 className="text-sm font-medium text-gray-800 mb-3">{current.label} questions</h2>
            <div className="divide-y divide-gray-200">
              {current.questions.map((q) => {
                const isOpen = openQuestionId === q.id;
                return (
                  <button key={q.id} type="button" onClick={() => setOpenQuestionId(isOpen ? null : q.id)} className="w-full text-left py-3 focus:outline-none">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm font-medium text-gray-900">{q.question}</p>
                      <span className="text-xs text-gray-400 mt-1">{isOpen ? '−' : '+'}</span>
                    </div>
                    {isOpen && <p className="mt-2 text-sm text-gray-600">{q.answer}</p>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── My Disputes ──────────────────────────────────── */}
      {mainTab === 'disputes' && (
        <div className="space-y-4">
          {loadingComplaints ? (
            <div className="flex items-center justify-center py-16">
              <div className="loading"><span /><span /><span /><span /><span /></div>
            </div>
          ) : complaints.length === 0 ? (
            <Card className="p-12 text-center">
              <AlertCircle className="size-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">{t('noDisputesFiled')}</p>
              <p className="text-sm text-gray-400 mt-1">{t('noDisputesText')}</p>
            </Card>
          ) : (
            complaints.map(complaint => {
              const isOpen = expandedComplaintId === complaint.id;
              const hasNewReplies = complaint.replies.some(r => r.sender_role !== 'buyer');
              return (
                <Card key={complaint.id} className="overflow-hidden">
                  <button
                    className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedComplaintId(isOpen ? null : complaint.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-gray-900 text-sm">{complaint.subject}</span>
                        <Badge
                          variant="outline"
                          className={complaint.status === 'open'
                            ? 'bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px]'
                            : 'bg-green-50 text-green-700 border-green-200 text-[10px]'}
                        >
                          {complaint.status}
                        </Badge>
                        {hasNewReplies && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                            <MessageSquare className="size-2.5 mr-1" /> {t('replyReceivedText')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        Order #{complaint.order_id?.slice(-8).toUpperCase()} · {new Date(complaint.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {isOpen ? <ChevronUp className="size-4 text-gray-400 shrink-0" /> : <ChevronDown className="size-4 text-gray-400 shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="border-t px-5 py-4 space-y-3">
                      <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                        <p className="text-xs font-medium text-gray-500 mb-1">Your complaint:</p>
                        {complaint.message}
                      </div>
                      {complaint.replies.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-gray-500">Responses:</p>
                          {complaint.replies.map(reply => (
                            <div
                              key={reply.id}
                              className={`rounded-lg p-3 text-sm ${
                                reply.sender_role === 'admin' ? 'bg-purple-50 text-purple-900' : 'bg-blue-50 text-blue-900'
                              }`}
                            >
                              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1 opacity-60 capitalize">{reply.sender_role}</p>
                              {reply.message}
                              <p className="text-[10px] opacity-50 mt-1">{new Date(reply.created_at).toLocaleString()}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">{t('awaitingResponseText')}</p>
                      )}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── Live Chat ────────────────────────────────────── */}
      {mainTab === 'chat' && (
        <div className="max-w-2xl">
          <Card className="overflow-hidden flex flex-col" style={{ height: '520px' }}>
            {/* Header */}
            <div className="px-5 py-4 bg-gray-900 text-white flex items-center gap-3 shrink-0">
              <div className="size-9 rounded-full bg-white/10 flex items-center justify-center">
                <Headphones className="size-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold">{t('supportChatTitle')}</p>
                <p className="text-xs text-gray-300">{t('supportChatSubtitle')}</p>
              </div>
              <span className="ml-auto flex items-center gap-1.5 text-xs text-green-400 font-medium">
                <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
                {t('onlineStatus')}
              </span>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
              {loadingChat ? (
                <div className="flex items-center justify-center h-full">
                  <div className="loading"><span /><span /><span /><span /><span /></div>
                </div>
              ) : supportMsgs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                  <Headphones className="size-10 text-gray-300" />
                  <p className="text-sm font-medium text-gray-600">{t('chatWelcomeTitle')}</p>
                  <p className="text-xs text-gray-400">{t('chatWelcomeText')}</p>
                </div>
              ) : (
                supportMsgs.map(msg => {
                  const isMe = msg.sender_role === 'buyer';
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        isMe ? 'bg-gray-900 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
                      }`}>
                        {!isMe && <p className="text-[10px] font-semibold text-purple-600 mb-1 uppercase tracking-wide">{t('supportAgentLabel')}</p>}
                        {msg.message}
                        <p className={`text-[10px] mt-1 ${isMe ? 'text-gray-400' : 'text-gray-400'}`}>
                          {new Date(msg.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 border-t bg-white px-4 py-3">
              <form
                className="flex items-end gap-2"
                onSubmit={e => { e.preventDefault(); sendChatMessage(); }}
              >
                <textarea
                  rows={1}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  placeholder={t('typeMessagePlaceholder')}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
                  }}
                />
                <Button
                  type="submit"
                  size="sm"
                  className="shrink-0 bg-gray-900 hover:bg-black"
                  disabled={!chatInput.trim() || sendingChat}
                >
                  <Send className="size-3.5" />
                </Button>
              </form>
            </div>
          </Card>
        </div>
      )}
    </section>
  );
};
