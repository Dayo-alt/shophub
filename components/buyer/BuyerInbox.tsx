import { FC, useEffect, useState } from 'react';
import { Mail, Bell, Megaphone, Send } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { supabase } from '../../utils/supabase/client';

interface BuyerInboxProps {
  onBackToProducts: () => void;
}

interface InboxMessage {
  id: string;
  sender_id: string | null;
  subject: string;
  body: string;
  sender_role: string;
  is_broadcast: boolean;
  created_at: string;
  read: boolean;
}

export const BuyerInbox: FC<BuyerInboxProps> = ({ onBackToProducts }) => {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [replySent, setReplySent] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let uid: string;
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      uid = user.id;
      setUserId(uid);
      await fetchMessages(uid);
      setLoading(false);
    };
    init();

    const ch = supabase
      .channel('buyer-inbox-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async () => {
        if (uid) await fetchMessages(uid);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchMessages = async (uid: string) => {
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, subject, body, sender_role, is_broadcast, created_at')
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

  const handleReply = async (msg: InboxMessage) => {
    const text = (replyText[msg.id] || '').trim();
    if (!text || !userId || !msg.sender_id) return;
    setSendingReply(msg.id);
    await supabase.from('messages').insert({
      sender_id: userId,
      sender_role: 'buyer',
      recipient_id: msg.sender_id,
      subject: `Re: ${msg.subject}`,
      body: text,
      is_broadcast: false,
    });
    setReplyText(r => ({ ...r, [msg.id]: '' }));
    setReplySent(r => ({ ...r, [msg.id]: true }));
    setSendingReply(null);
    setTimeout(() => setReplySent(r => ({ ...r, [msg.id]: false })), 3000);
  };

  const markRead = async (msgId: string) => {
    if (!userId) return;
    await supabase.from('message_reads').upsert(
      { message_id: msgId, user_id: userId },
      { onConflict: 'message_id,user_id' }
    );
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, read: true } : m));
  };

  const unreadCount = messages.filter(m => !m.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="loading"><span /><span /><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in-up">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            Inbox
            {unreadCount > 0 && (
              <span className="text-sm bg-red-500 text-white font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Messages from ShopHub admin and sellers</p>
        </div>
        <Button variant="outline" size="sm" onClick={onBackToProducts}>Back to products</Button>
      </div>

      {messages.length === 0 ? (
        <Card className="p-12 text-center">
          <Mail className="size-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No messages yet</p>
          <p className="text-sm text-gray-400 mt-1">Messages from ShopHub and sellers will appear here.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map(msg => (
            <Card
              key={msg.id}
              className={`overflow-hidden transition-shadow hover:shadow-md ${!msg.read ? 'border-blue-200' : ''}`}
            >
              <div className={`px-5 py-4 ${!msg.read ? 'bg-blue-50/50' : ''}`}>
                <div
                  className="flex items-start justify-between gap-3 cursor-pointer"
                  onClick={() => {
                    setExpandedId(expandedId === msg.id ? null : msg.id);
                    if (!msg.read) markRead(msg.id);
                  }}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`size-9 rounded-full flex items-center justify-center shrink-0 ${
                      msg.is_broadcast ? 'bg-orange-100' : msg.sender_role === 'admin' ? 'bg-purple-100' : 'bg-blue-100'
                    }`}>
                      {msg.is_broadcast
                        ? <Megaphone className="size-4 text-orange-600" />
                        : msg.sender_role === 'admin'
                          ? <Bell className="size-4 text-purple-600" />
                          : <Mail className="size-4 text-blue-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        {!msg.read && <span className="size-2 rounded-full bg-blue-500 shrink-0" />}
                        <p className={`text-sm truncate ${!msg.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {msg.subject}
                        </p>
                        {msg.is_broadcast && (
                          <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">Announcement</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 capitalize">
                        From: {msg.is_broadcast ? 'ShopHub Admin (Broadcast)' : msg.sender_role}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                    {new Date(msg.created_at).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })}
                  </p>
                </div>{/* ↑ end clickable header row */}

                {expandedId === msg.id && (
                  <div className="mt-3 pt-3 border-t space-y-3">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                    {!msg.is_broadcast && msg.sender_id && (
                      replySent[msg.id] ? (
                        <p className="text-xs text-green-600 font-medium">Reply sent ✓</p>
                      ) : (
                        <div className="flex gap-2 pt-1">
                          <textarea
                            rows={2}
                            className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            placeholder="Write a reply…"
                            value={replyText[msg.id] || ''}
                            onChange={e => setReplyText(r => ({ ...r, [msg.id]: e.target.value }))}
                          />
                          <Button
                            size="sm"
                            className="self-end"
                            disabled={sendingReply === msg.id || !(replyText[msg.id] || '').trim()}
                            onClick={() => handleReply(msg)}
                          >
                            <Send className="size-3.5 mr-1" />
                            {sendingReply === msg.id ? 'Sending…' : 'Send'}
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
};
