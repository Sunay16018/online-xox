import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Send, MessageSquare, Flame } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { ChatMessage } from '../types';

interface LobbyChatProps {
  socket: Socket | null;
  roomId: string; // 'lobby' or roomCode
  currentUsername: string;
}

export default function LobbyChat({ socket, roomId, currentUsername }: LobbyChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typedMessage, setTypedMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;

    // Load message history from DB
    socket.emit('get-chat-history', { roomId }, (history: ChatMessage[]) => {
      setMessages(history || []);
    });

    const handleMessageReceive = (newMsg: ChatMessage) => {
      setMessages((prev) => [...prev, newMsg]);
    };

    socket.on('receive-message', handleMessageReceive);

    // Join room channel in socket
    socket.emit('send-message', { roomId, message: '' }); // Silent ping trigger or join

    return () => {
      socket.off('receive-message', handleMessageReceive);
    };
  }, [socket, roomId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!socket || !typedMessage.trim()) return;

    socket.emit('send-message', {
      roomId,
      message: typedMessage,
    });
    setTypedMessage('');
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const isLobby = roomId === 'lobby';

  return (
    <div className={`flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden h-full ${isLobby ? 'min-h-[480px] max-h-[520px]' : 'h-[360px] md:h-full'}`}>
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-500 rounded-lg">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-slate-800 leading-tight">
              {isLobby ? 'Genel Sohbet' : 'Oda Sohbeti'}
            </h4>
            <p className="text-[11px] text-slate-400">
              {isLobby ? 'Meydan Okuyanlar Odası' : `#${roomId}`}
            </p>
          </div>
        </div>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-xs text-slate-400">
            <MessageSquare className="w-8 h-8 opacity-30 stroke-[1.5] mb-2" />
            Henüz mesaj yok. İlk yazan sen ol!
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.username === currentUsername;
            const isSystem = msg.username === 'Sistem';

            if (isSystem) {
              return (
                <div key={index} className="flex justify-center my-1.5">
                  <span className="bg-amber-50 border border-amber-100/60 rounded-lg px-2.5 py-1 text-[11px] font-medium text-amber-700 max-w-[90%] text-center">
                    {msg.message}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={index}
                className={`flex gap-2 w-full ${isMe ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <img
                  src={msg.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.username}`}
                  alt={msg.username}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full bg-slate-100 self-end shrink-0 border border-slate-100"
                />

                {/* Message Box */}
                <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Name Header */}
                  <span className="text-[10px] text-slate-400 font-semibold mb-0.5 px-1 truncate">
                    {msg.username}
                  </span>

                  {/* Bubble */}
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-slate-100 text-slate-700 rounded-bl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                  </div>

                  {/* Hour */}
                  <span className="text-[9px] text-slate-400 mt-1 px-1">
                    {msg.timeString || 'Şimdi'}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
        <input
          type="text"
          placeholder="Mesajınızı yazın..."
          value={typedMessage}
          onChange={(e) => setTypedMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          className="flex-1 bg-white border border-slate-200 text-sm px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
        />
        <button
          onClick={handleSendMessage}
          disabled={!typedMessage.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white p-2.5 rounded-xl transition-all shadow-sm shadow-indigo-500/10 shrink-0 cursor-pointer flex items-center justify-center"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
