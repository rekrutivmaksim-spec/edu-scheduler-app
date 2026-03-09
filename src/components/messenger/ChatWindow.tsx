import { useState } from 'react';
import { chats, contacts } from './data';
import type { Message } from './data';
import Icon from '@/components/ui/icon';

interface ChatWindowProps {
  chatId: string | null;
  onCall: (type: 'audio' | 'video', contactId: string) => void;
}

export default function ChatWindow({ chatId, onCall }: ChatWindowProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Record<string, Message[]>>(() => {
    const map: Record<string, Message[]> = {};
    chats.forEach(c => { map[c.id] = [...c.messages]; });
    return map;
  });

  const chat = chats.find(c => c.id === chatId);
  const contact = chat ? contacts.find(c => c.id === chat.contactId) : null;
  const msgs = chatId ? (messages[chatId] || []) : [];

  const sendMessage = () => {
    if (!input.trim() || !chatId) return;
    const newMsg: Message = {
      id: `m${Date.now()}`,
      senderId: 'me',
      text: input.trim(),
      time: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };
    setMessages(prev => ({ ...prev, [chatId]: [...(prev[chatId] || []), newMsg] }));
    setInput('');
  };

  if (!chatId || !contact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center mesh-bg">
        <div className="animate-float text-center">
          <div className="text-8xl mb-6 filter drop-shadow-lg">💬</div>
          <h2 className="font-display text-2xl font-bold gradient-text mb-2">🍊 СЫТЫЙ АПЕЛЬСИН</h2>
          <p className="text-muted-foreground text-sm">Выберите диалог чтобы начать общение</p>
        </div>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full opacity-5 gradient-bg"
              style={{
                width: `${80 + i * 40}px`,
                height: `${80 + i * 40}px`,
                left: `${10 + i * 15}%`,
                top: `${20 + (i % 3) * 25}%`,
                animation: `float ${3 + i * 0.5}s ease-in-out infinite`,
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 glass border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl glass flex items-center justify-center text-xl">
              {contact.avatar}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
              contact.status === 'online' ? 'bg-[var(--neon-green)]' :
              contact.status === 'busy' ? 'bg-red-500' :
              contact.status === 'away' ? 'bg-yellow-400' : 'bg-gray-500'
            }`} />
          </div>
          <div>
            <div className="font-semibold text-sm text-white">{contact.name}</div>
            <div className={`text-xs ${
              contact.status === 'online' ? 'text-[var(--neon-green)]' :
              contact.status === 'busy' ? 'text-red-400' :
              contact.status === 'away' ? 'text-yellow-400' : 'text-muted-foreground'
            }`}>
              {contact.status === 'online' ? 'В сети' :
               contact.status === 'busy' ? 'Занят' :
               contact.status === 'away' ? 'Отошёл' : `Был(а) ${contact.lastSeen}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onCall('audio', contact.id)}
            className="w-9 h-9 rounded-xl hover:bg-white/8 flex items-center justify-center text-muted-foreground hover:text-[var(--neon-green)] transition-colors hover-glow"
          >
            <Icon name="Phone" size={16} />
          </button>
          <button
            onClick={() => onCall('video', contact.id)}
            className="w-9 h-9 rounded-xl hover:bg-white/8 flex items-center justify-center text-muted-foreground hover:text-[var(--neon-cyan)] transition-colors hover-glow"
          >
            <Icon name="Video" size={16} />
          </button>
          <button className="w-9 h-9 rounded-xl hover:bg-white/8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <Icon name="MoreVertical" size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 mesh-bg">
        {msgs.map((msg, i) => {
          const isMe = msg.senderId === 'me';
          return (
            <div
              key={msg.id}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-slide-up`}
              style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }}
            >
              {!isMe && (
                <div className="w-7 h-7 rounded-xl glass flex items-center justify-center text-sm mr-2 flex-shrink-0 self-end mb-1">
                  {contact.avatar}
                </div>
              )}
              <div className={`max-w-[65%] px-4 py-2.5 rounded-2xl ${
                isMe ? 'message-bubble-out rounded-tr-sm' : 'message-bubble-in rounded-tl-sm'
              }`}>
                <p className="text-sm leading-relaxed text-white/95">{msg.text}</p>
                <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <span className="text-[10px] text-white/40">{msg.time}</span>
                  {isMe && (
                    <Icon name={msg.read ? 'CheckCheck' : 'Check'} size={10} className="text-[var(--neon-cyan)]/60" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-3 glass border-t border-white/5">
        <div className="flex items-center gap-2 bg-white/5 rounded-2xl px-4 py-2 border border-white/8">
          <button className="text-muted-foreground hover:text-[var(--neon-purple)] transition-colors">
            <Icon name="Smile" size={18} />
          </button>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Написать сообщение..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button className="text-muted-foreground hover:text-[var(--neon-purple)] transition-colors">
            <Icon name="Paperclip" size={16} />
          </button>
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="w-8 h-8 gradient-bg rounded-xl flex items-center justify-center disabled:opacity-30 transition-all hover:neon-glow active:scale-95"
          >
            <Icon name="Send" size={14} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}