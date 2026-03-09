import { useState } from 'react';
import { contacts } from './data';
import type { Contact } from './data';
import Icon from '@/components/ui/icon';

interface ContactsPanelProps {
  onCall: (type: 'audio' | 'video', contactId: string) => void;
  onMessage: (contactId: string) => void;
}

export default function ContactsPanel({ onCall, onMessage }: ContactsPanelProps) {
  const [selected, setSelected] = useState<Contact | null>(null);
  const [filter, setFilter] = useState<'all' | 'online'>('all');

  const filtered = contacts.filter(c => filter === 'all' || c.status === 'online');

  return (
    <div className="flex h-full">
      <div className="w-64 border-r border-white/5 flex flex-col">
        <div className="px-4 py-4 border-b border-white/5">
          <h2 className="font-display text-lg font-semibold gradient-text tracking-wide">КОНТАКТЫ</h2>
          <div className="flex gap-2 mt-3">
            {(['all', 'online'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1 rounded-full transition-all ${
                  filter === f ? 'gradient-bg text-white' : 'glass text-muted-foreground hover:text-foreground'
                }`}
              >
                {f === 'all' ? `Все (${contacts.length})` : `Онлайн (${contacts.filter(c => c.status === 'online').length})`}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {filtered.map((contact, i) => (
            <button
              key={contact.id}
              onClick={() => setSelected(contact)}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-200 text-left animate-slide-up ${
                selected?.id === contact.id ? 'bg-white/6 border-r-2 border-[var(--neon-purple)]' : 'hover:bg-white/3'
              }`}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-2xl glass flex items-center justify-center text-lg">
                  {contact.avatar}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${
                  contact.status === 'online' ? 'bg-[var(--neon-green)]' :
                  contact.status === 'busy' ? 'bg-red-500' :
                  contact.status === 'away' ? 'bg-yellow-400' : 'bg-gray-500'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground/90 truncate">{contact.name}</div>
                <div className="text-xs text-muted-foreground">
                  {contact.status === 'online' ? 'В сети' :
                   contact.status === 'busy' ? 'Занят' :
                   contact.status === 'away' ? 'Отошёл' : contact.lastSeen || 'Не в сети'}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selected ? (
          <div className="flex flex-col h-full animate-fade-in">
            <div className="flex flex-col items-center pt-10 pb-6 px-6 border-b border-white/5">
              <div className="w-20 h-20 rounded-3xl glass neon-glow flex items-center justify-center text-4xl mb-4">
                {selected.avatar}
              </div>
              <h3 className="font-display text-xl font-bold text-white">{selected.name}</h3>
              <span className={`text-sm mt-1 ${
                selected.status === 'online' ? 'text-[var(--neon-green)]' :
                selected.status === 'busy' ? 'text-red-400' :
                selected.status === 'away' ? 'text-yellow-400' : 'text-muted-foreground'
              }`}>
                {selected.status === 'online' ? '● В сети' :
                 selected.status === 'busy' ? '● Занят' :
                 selected.status === 'away' ? '● Отошёл' : `Был(а) ${selected.lastSeen}`}
              </span>
              {selected.bio && (
                <p className="text-sm text-muted-foreground mt-3 text-center italic">"{selected.bio}"</p>
              )}
            </div>

            <div className="flex justify-center gap-3 p-5">
              <button
                onClick={() => onMessage(selected.id)}
                className="flex flex-col items-center gap-2 px-5 py-3 glass rounded-2xl hover-glow hover:bg-white/8 transition-all group"
              >
                <Icon name="MessageCircle" size={20} className="text-[var(--neon-purple)] group-hover:scale-110 transition-transform" />
                <span className="text-xs text-muted-foreground">Написать</span>
              </button>
              <button
                onClick={() => onCall('audio', selected.id)}
                className="flex flex-col items-center gap-2 px-5 py-3 glass rounded-2xl hover:bg-white/8 transition-all group"
              >
                <Icon name="Phone" size={20} className="text-[var(--neon-green)] group-hover:scale-110 transition-transform" />
                <span className="text-xs text-muted-foreground">Позвонить</span>
              </button>
              <button
                onClick={() => onCall('video', selected.id)}
                className="flex flex-col items-center gap-2 px-5 py-3 glass rounded-2xl hover:bg-white/8 transition-all group"
              >
                <Icon name="Video" size={20} className="text-[var(--neon-cyan)] group-hover:scale-110 transition-transform" />
                <span className="text-xs text-muted-foreground">Видео</span>
              </button>
            </div>

            {selected.phone && (
              <div className="px-6 py-4 border-t border-white/5">
                <div className="flex items-center gap-3 p-3 glass rounded-xl">
                  <Icon name="Phone" size={14} className="text-muted-foreground" />
                  <span className="text-sm text-foreground/80">{selected.phone}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <div className="text-6xl mb-4 animate-float">👥</div>
              <p className="text-muted-foreground text-sm">Выберите контакт</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
