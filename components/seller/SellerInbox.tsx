import { useEffect, useState } from 'react';
import { Mail, MessageSquare, Reply, X, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { supabase } from '../../utils/supabase/client';
import { useLanguage } from '../../utils/i18n/LanguageContext';

interface SellerInboxProps {
  accessToken: string;
}

interface Complaint {
  id: string;
  order_id: string;
  buyer_id: string;
  buyer_email: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  replies: ComplaintReply[];
}

interface ComplaintReply {
  id: string;
  complaint_id: string;
  sender_role: string;
  message: string;
  created_at: string;
}

interface InboxMessage {
  id: string;
  subject: string;
  body: string;
  sender_role: string;
  is_broadcast: boolean;
  created_at: string;
  read: boolean;
}

type Tab = 'complaints' | 'messages';

export function SellerInbox({ accessToken }: SellerInboxProps) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('complaints');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [readComplaintIds, setReadComplaintIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let uid: string;
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      uid = user.id;
      setSellerId(uid);
      await Promise.all([fetchComplaints(uid), fetchMessages(uid), fetchComplaintReads(uid)]);
      setLoading(false);
    };
    init();

    const ch = supabase
      .channel('seller-inbox-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async () => {
        if (uid) await fetchMessages(uid);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, async () => {
        if (uid) await fetchComplaints(uid);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaint_replies' }, async () => {
        if (uid) await fetchComplaints(uid);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchComplaintReads = async (uid: string) => {
    const { data } = await supabase
      .from('message_reads')
      .select('message_id')
      .eq('user_id', uid)
      .like('message_id', 'complaint-%');
    const ids = new Set((data || []).map((r: any) => (r.message_id as string).replace('complaint-', '')));
    setReadComplaintIds(ids);
  };

  const markComplaintRead = async (complaintId: string, uid: string) => {
    if (readComplaintIds.has(complaintId)) return;
    await supabase.from('message_reads').upsert(
      { message_id: `complaint-${complaintId}`, user_id: uid },
      { onConflict: 'message_id,user_id' }
    );
    setReadComplaintIds(prev => new Set([...prev, complaintId]));
  };

  const fetchComplaints = async (uid: string) => {
    const { data } = await supabase
      .from('complaints')
      .select('id, order_id, buyer_id, buyer_email, subject, message, status, created_at')
      .eq('seller_id', uid)
      .order('created_at', { ascending: false });

    if (!data) return;

    const withReplies: Complaint[] = await Promise.all(
      data.map(async (c: any) => {
        const { data: replies } = await supabase
          .from('complaint_replies')
          .select('id, complaint_id, sender_role, message, created_at')
          .eq('complaint_id', c.id)
          .order('created_at', { ascending: true });
        return { ...c, replies: replies || [] };
      })
    );
    setComplaints(withReplies);
  };

  const fetchMessages = async (uid: string) => {
    const { data } = await supabase
      .from('messages')
      .select('id, subject, body, sender_role, is_broadcast, created_at')
      .or(`recipient_id.eq.${uid},is_broadcast.eq.true`)
      .order('created_at', { ascending: false });

    if (!data) return;

    const { data: reads } = await supabase
      .from('message_reads')
      .select('message_id')
      .eq('user_id', uid);

    const readIds = new Set((reads || []).map((r: any) => r.message_id));
    setMessages(data.map((m: any) => ({ ...m, read: readIds.has(m.id) })));
  };

  const handleReply = async (complaintId: string) => {
    const text = (replyText[complaintId] || '').trim();
    if (!text || !sellerId) return;
    setSubmitting(complaintId);
    const { data } = await supabase.from('complaint_replies').insert({
      complaint_id: complaintId,
      sender_id: sellerId,
      sender_role: 'seller',
      message: text,
    }).select().single();

    if (data) {
      setComplaints(prev => prev.map(c =>
        c.id === complaintId
          ? { ...c, replies: [...c.replies, data as ComplaintReply] }
          : c
      ));
      setReplyText(r => ({ ...r, [complaintId]: '' }));

      // Send inbox message to buyer so they see the reply in their Inbox
      const comp = complaints.find(c => c.id === complaintId);
      if (comp?.buyer_id) {
        await supabase.from('messages').insert({
          sender_id: sellerId,
          sender_role: 'seller',
          recipient_id: comp.buyer_id,
          subject: `Reply to your complaint: ${comp.subject}`,
          body: text,
          is_broadcast: false,
        });
      }
    }
    setSubmitting(null);
  };

  const markMessageRead = async (msgId: string) => {
    if (!sellerId) return;
    await supabase.from('message_reads').upsert({ message_id: msgId, user_id: sellerId }, { onConflict: 'message_id,user_id' });
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, read: true } : m));
  };

  const unreadMessages = messages.filter(m => !m.read).length;
  // Only count open complaints the seller hasn't read yet
  const openComplaints = complaints.filter(c => c.status === 'open' && !readComplaintIds.has(c.id)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="loading"><span /><span /><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in-up">
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1">{t('inboxTitle')}</h1>
        <p className="text-sm text-gray-500">{t('sellerInboxSubtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('complaints')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'complaints' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <MessageSquare className="size-4" />
          {t('complaintsTab')}
          {openComplaints > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{openComplaints}</span>
          )}
        </button>
        <button
          onClick={() => setTab('messages')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'messages' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Mail className="size-4" />
          {t('messagesTab')}
          {unreadMessages > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadMessages}</span>
          )}
        </button>
      </div>

      {/* Complaints tab */}
      {tab === 'complaints' && (
        <div className="space-y-4">
          {complaints.length === 0 ? (
            <Card className="p-12 text-center">
              <MessageSquare className="size-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">{t('noComplaintsYet')}</p>
            </Card>
          ) : (
            complaints.map(complaint => {
              const isOpen = expandedId === complaint.id;
              return (
                <Card key={complaint.id} className="overflow-hidden">
                  <button
                    className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      setExpandedId(isOpen ? null : complaint.id);
                      if (!isOpen && sellerId) markComplaintRead(complaint.id, sellerId);
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {!readComplaintIds.has(complaint.id) && complaint.status === 'open' && (
                          <span className="size-2 rounded-full bg-red-500 shrink-0" />
                        )}
                        <span className={`text-sm ${!readComplaintIds.has(complaint.id) && complaint.status === 'open' ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{complaint.subject}</span>
                        <Badge
                          variant="outline"
                          className={complaint.status === 'open'
                            ? 'bg-red-50 text-red-700 border-red-200 text-[10px]'
                            : 'bg-green-50 text-green-700 border-green-200 text-[10px]'}
                        >
                          {complaint.status}
                        </Badge>
                        {complaint.replies.length > 0 && (
                          <span className="text-[10px] text-gray-400">{complaint.replies.length} repl{complaint.replies.length === 1 ? 'y' : 'ies'}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{t('complaintFromLabel')} {complaint.buyer_email}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Order #{complaint.order_id?.slice(-8).toUpperCase()} · {new Date(complaint.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {isOpen ? <ChevronUp className="size-4 text-gray-400 shrink-0 mt-0.5" /> : <ChevronDown className="size-4 text-gray-400 shrink-0 mt-0.5" />}
                  </button>

                  {isOpen && (
                    <div className="border-t px-5 py-4 space-y-4">
                      {/* Original complaint */}
                      <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                        <p className="text-xs font-medium text-gray-500 mb-1">Buyer's message:</p>
                        {complaint.message}
                      </div>

                      {/* Replies thread */}
                      {complaint.replies.length > 0 && (
                        <div className="space-y-2">
                          {complaint.replies.map(reply => (
                            <div
                              key={reply.id}
                              className={`rounded-lg p-3 text-sm ${
                                reply.sender_role === 'seller'
                                  ? 'bg-blue-50 ml-6 text-blue-900'
                                  : reply.sender_role === 'admin'
                                    ? 'bg-purple-50 text-purple-900'
                                    : 'bg-gray-50 text-gray-700'
                              }`}
                            >
                              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1 opacity-60">
                                {reply.sender_role === 'seller' ? 'You' : reply.sender_role}
                              </p>
                              {reply.message}
                              <p className="text-[10px] opacity-50 mt-1">{new Date(reply.created_at).toLocaleString()}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply input */}
                      <div className="flex gap-2">
                        <textarea
                          rows={2}
                          className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                          placeholder={t('replyPlaceholder')}
                          value={replyText[complaint.id] || ''}
                          onChange={e => setReplyText(r => ({ ...r, [complaint.id]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleReply(complaint.id)}
                          disabled={submitting === complaint.id || !(replyText[complaint.id] || '').trim()}
                          className="self-end"
                        >
                          <Send className="size-3.5 mr-1" />
                          {submitting === complaint.id ? t('submittingReplyBtn') : t('submitReplyBtn')}
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Messages tab */}
      {tab === 'messages' && (
        <div className="space-y-3">
          {messages.length === 0 ? (
            <Card className="p-12 text-center">
              <Mail className="size-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">{t('sellerInboxNoMessages')}</p>
            </Card>
          ) : (
            messages.map(msg => (
              <Card
                key={msg.id}
                className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${!msg.read ? 'border-blue-200 bg-blue-50/30' : ''}`}
                onClick={() => {
                  setExpandedId(expandedId === msg.id ? null : msg.id);
                  if (!msg.read) markMessageRead(msg.id);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {!msg.read && <span className="size-2 rounded-full bg-blue-500 shrink-0" />}
                      <p className={`text-sm ${!msg.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>{msg.subject}</p>
                      {msg.is_broadcast && <Badge variant="outline" className="text-[10px]">Broadcast</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 capitalize">{t('fromLabel')} {msg.sender_role}</p>
                  </div>
                  <p className="text-xs text-gray-400 whitespace-nowrap">{new Date(msg.created_at).toLocaleDateString()}</p>
                </div>
                {expandedId === msg.id && (
                  <div className="mt-3 pt-3 border-t text-sm text-gray-700 whitespace-pre-wrap">{msg.body}</div>
                )}
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
