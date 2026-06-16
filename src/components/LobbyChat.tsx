import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Smile } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { ChatMessage } from '../types';

interface LobbyChatProps {
  socket: Socket | null;
  roomId: string;
  currentUsername: string;
}

const QUICK_EMOJIS = ['👋', '😂', '🔥', '💀', '😤', '🏆', '⚡', '🎯', '💪', '😎', '🤝', '👑', '🎉', '😱', '🥳', '😏'];

const QUICK_MESSAGES = [
  { label: 'HAKKINI VER', text: 'Hakkını verdin, helal olsun. 🏆' },
  { label: 'RAKİP', text: 'İyi rakiptin, keyif aldım. 🤝' },
  { label: 'ŞANSI', text: 'Şans bugün senden yanaydı. 🎯' },
  { label: 'RÖVANŞ', text: 'Rövanşı isterim, hazır ol. ⚔️' },
  { label: 'DAHA İYİSİ', text: 'Daha iyisini görmek lazım. 👀' },
  { label: 'FARK', text: 'Fark atılmış ama olsun. 😌' },
  { label: 'BİR DAHA', text: 'Bir daha deneyelim mi? 🤔' },
  { label: 'SENİ BEKLEMİYORDUM', text: 'Seni beklemiyordum, şaşırttın. 🙃' },
  { label: 'TOPARLAN', text: 'Toparlan da gel, bitmedi. 🧘' },
  { label: 'SAYGIM VAR', text: 'Oyununa saygım var, cidden. 👏' },
];

export default function LobbyChat({ socket, roomId, currentUsername }: LobbyChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showEmojis, setShowEmojis] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;

    socket.emit('get-chat-history', { roomId }, (history: ChatMessage[]) => {
      setMessages(history || []);
    });

    const handleMessageReceive = (newMsg: ChatMessage) => {
      setMessages((prev) => [...prev, newMsg]);
    };

    socket.on('receive-message', handleMessageReceive);
    socket.emit('send-message', { roomId, message: '' });

    return () => {
      socket.off('receive-message', handleMessageReceive);
    };
  }, [socket, roomId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = (text: string) => {
    if (!socket || !text.trim()) return;
    socket.emit('send-message', { roomId, message: text });
    setShowEmojis(false);
  };

  const isLobby = roomId === 'lobby';

  return (
    <div className={`flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden h-full ${isLobby ? 'min-h-[480px] max-h-[520px]' : 'h-[360px] md:h-full'}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-indigo-50/30 border-b border-slate-100 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-slate-800 leading-tight">
              {isLobby ? 'Genel Sohbet' : 'Oda Sohbeti'}
            </h4>
            <p className="text-[10px] text-slate-400">{isLobby ? 'Lobideki oyuncular' : `#${roomId}`}</p>
          </div>
        </div>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-xs text-slate-400">
            <MessageSquare className="w-8 h-8 opacity-20 stroke-[1.5] mb-2" />
            <span className="font-medium">İlk reaksiyon senden gelsin!</span>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.username === currentUsername;
            const isSystem = msg.username === 'Sistem';

            if (isSystem) {
              return (
                <div key={index} className="flex justify-center my-1">
                  <span className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100/80 rounded-xl px-3 py-1 text-[10px] font-semibold text-amber-700 max-w-[90%] text-center shadow-sm">
                    {msg.message}
                  </span>
                </div>
              );
            }

            return (
              <div key={index} className={`flex gap-2 w-full ${isMe ? 'flex-row-reverse' : ''}`}>
                <img
                  src={msg.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.username}`}
                  alt={msg.username}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full bg-slate-100 self-end shrink-0 border border-slate-100"
                />
                <div className={`max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[9px] text-slate-400 font-semibold mb-0.5 px-1 truncate">{msg.username}</span>
                  <div className={`rounded-2xl px-3 py-1.5 text-[13px] leading-relaxed shadow-sm ${isMe ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-br-sm' : 'bg-slate-100 text-slate-700 rounded-bl-sm'}`}>
                    <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                  </div>
                  <span className="text-[9px] text-slate-400 mt-0.5 px-1">{msg.timeString || 'Şimdi'}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Emoji Picker */}
      {showEmojis && (
        <div className="border-t border-slate-100 bg-white px-3 py-2.5 grid grid-cols-8 gap-1 flex-shrink-0">
          {QUICK_EMOJIS.map((em) => (
            <button
              key={em}
              onClick={() => send(em)}
              className="text-xl hover:scale-125 transition-transform cursor-pointer rounded-lg hover:bg-slate-50 p-1 flex items-center justify-center"
            >
              {em}
            </button>
          ))}
        </div>
      )}

      {/* Quick Message Buttons — NO free text input */}
      <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex-shrink-0 space-y-2">
        <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
          <button
            onClick={() => setShowEmojis((v) => !v)}
            className={`flex-shrink-0 p-2 rounded-xl border transition-all cursor-pointer ${showEmojis ? 'bg-indigo-100 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'}`}
            title="Emoji"
          >
            <Smile className="w-4 h-4" />
          </button>
          {QUICK_MESSAGES.map((qm) => (
            <button
              key={qm.label}
              onClick={() => send(qm.text)}
              className="flex-shrink-0 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 text-[11px] font-bold px-3 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-sm"
            >
              {qm.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
