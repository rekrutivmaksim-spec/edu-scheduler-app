import { useState, useMemo } from 'react';
import { contacts, chats } from './data';
import Icon from '@/components/ui/icon';

interface SearchPanelProps {
  onChatSelect: (chatId: string) => void;
  onContactSelect: (contactId: string) => void;
}

export default function SearchPanel({ onChatSelect, onContactSelect }: SearchPanelProps) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();

    const foundContacts = contacts.filter(c =>
      c.name.toLowerCase().includes(q) || c.bio?.toLowerCase().includes(q)
    );

    const foundMessages: Array<{ chatId: string; contactName: string; contactAvatar: string; text: string; time: string }> = [];
    chats.forEach(chat => {
      const contact = contacts.find(c => c.id === chat.contactId);
      if (!contact) return;
      chat.messages.forEach(msg => {
        if (msg.text.toLowerCase().includes(q)) {
          foundMessages.push({
            chatId: chat.id,
            contactName: contact.name,
            contactAvatar: contact.avatar,
            text: msg.text,
            time: msg.time,
          });
        }
      });
    });

    return { contacts: foundContacts, messages: foundMessages };
  }, [query]);

  const highlight = (text: string) => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-[var(--neon-purple)]/30 text-[var(--neon-purple)] rounded px-0.5">
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-white/5">
        <h2 className="font-display text-lg font-semibold gradient-text tracking-wide mb-3">ПОИСК</h2>
        <div className="flex items-center gap-2 bg-white/5 rounded-2xl px-4 py-2.5 border border-white/8 focus-within:border-[var(--neon-purple)]/40 transition-colors">
          <Icon name="Search" size={16} className="text-muted-foreground flex-shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск контактов и сообщений..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
              <Icon name="X" size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!query && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4 animate-float">🔍</div>
            <p className="text-muted-foreground text-sm">Введите запрос для поиска</p>
            <p className="text-muted-foreground/50 text-xs mt-1">по контактам и сообщениям</p>
          </div>
        )}

        {results && results.contacts.length === 0 && results.messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
            <div className="text-5xl mb-4">😕</div>
            <p className="text-muted-foreground text-sm">Ничего не найдено</p>
          </div>
        )}

        {results && results.contacts.length > 0 && (
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              Контакты
            </h3>
            <div className="space-y-1">
              {results.contacts.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => onContactSelect(contact.id)}
                  className="w-full flex items-center gap-3 p-3 glass rounded-2xl hover:bg-white/8 transition-all text-left animate-scale-in"
                >
                  <div className="w-10 h-10 rounded-2xl glass flex items-center justify-center text-lg flex-shrink-0">
                    {contact.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{highlight(contact.name)}</div>
                    {contact.bio && <div className="text-xs text-muted-foreground">{highlight(contact.bio)}</div>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {results && results.messages.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              Сообщения
            </h3>
            <div className="space-y-1">
              {results.messages.map((msg, i) => (
                <button
                  key={i}
                  onClick={() => onChatSelect(msg.chatId)}
                  className="w-full flex items-center gap-3 p-3 glass rounded-2xl hover:bg-white/8 transition-all text-left animate-scale-in"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <div className="w-10 h-10 rounded-2xl glass flex items-center justify-center text-lg flex-shrink-0">
                    {msg.contactAvatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{msg.contactName}</div>
                    <div className="text-xs text-muted-foreground truncate">{highlight(msg.text)}</div>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{msg.time}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
