import { useState } from 'react';
import { me } from './data';
import Icon from '@/components/ui/icon';

export default function ProfilePanel() {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('Александр Космос');
  const [bio, setBio] = useState('Люблю технологии и звёзды 🚀');
  const [status, setStatus] = useState<'online' | 'away' | 'busy' | 'offline'>('online');

  const statusOptions = [
    { value: 'online' as const, label: 'В сети', color: 'bg-[var(--neon-green)]' },
    { value: 'away' as const, label: 'Отошёл', color: 'bg-yellow-400' },
    { value: 'busy' as const, label: 'Занят', color: 'bg-red-500' },
    { value: 'offline' as const, label: 'Не беспокоить', color: 'bg-gray-500' },
  ];

  const stats = [
    { label: 'Контактов', value: '8', icon: 'Users' },
    { label: 'Чатов', value: '5', icon: 'MessageCircle' },
    { label: 'Звонков', value: '24', icon: 'Phone' },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-5 py-4 border-b border-white/5">
        <h2 className="font-display text-lg font-semibold gradient-text tracking-wide">ПРОФИЛЬ</h2>
      </div>

      <div className="flex flex-col items-center pt-8 pb-6 px-6">
        <div className="relative mb-4">
          <div className="w-24 h-24 rounded-3xl glass neon-glow flex items-center justify-center text-5xl animate-pulse-neon">
            {me.avatar}
          </div>
          <button className="absolute -bottom-1 -right-1 w-7 h-7 gradient-bg rounded-xl flex items-center justify-center hover:scale-110 transition-transform">
            <Icon name="Camera" size={12} className="text-white" />
          </button>
        </div>

        {editing ? (
          <div className="w-full max-w-xs space-y-3 animate-scale-in">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[var(--neon-purple)]/50"
              placeholder="Имя"
            />
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[var(--neon-purple)]/50 resize-none"
              placeholder="О себе"
            />
            <button
              onClick={() => setEditing(false)}
              className="w-full gradient-bg text-white text-sm py-2.5 rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              Сохранить
            </button>
          </div>
        ) : (
          <>
            <h3 className="font-display text-xl font-bold text-white">{name}</h3>
            <p className="text-sm text-muted-foreground mt-1 text-center">{bio}</p>
            <button
              onClick={() => setEditing(true)}
              className="mt-3 text-xs text-[var(--neon-purple)] hover:text-[var(--neon-cyan)] transition-colors flex items-center gap-1"
            >
              <Icon name="Pencil" size={10} />
              Редактировать
            </button>
          </>
        )}
      </div>

      <div className="flex justify-center gap-4 px-6 pb-6">
        {stats.map(s => (
          <div key={s.label} className="flex flex-col items-center glass rounded-2xl px-5 py-3">
            <span className="font-display text-xl font-bold gradient-text">{s.value}</span>
            <span className="text-xs text-muted-foreground mt-0.5">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="px-5 pb-6 border-t border-white/5 pt-5">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Статус</h4>
        <div className="grid grid-cols-2 gap-2">
          {statusOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className={`flex items-center gap-2 p-3 rounded-xl transition-all ${
                status === opt.value
                  ? 'glass border border-white/15 bg-white/8'
                  : 'glass hover:bg-white/5'
              }`}
            >
              <div className={`w-2.5 h-2.5 rounded-full ${opt.color} ${status === opt.value ? 'animate-pulse' : ''}`} />
              <span className="text-sm text-foreground/80">{opt.label}</span>
              {status === opt.value && <Icon name="Check" size={12} className="ml-auto text-[var(--neon-purple)]" />}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pb-6 border-t border-white/5 pt-5">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Контакт</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 glass rounded-xl">
            <Icon name="Phone" size={14} className="text-[var(--neon-purple)]" />
            <span className="text-sm text-foreground/80">{me.phone}</span>
          </div>
          <div className="flex items-center gap-3 p-3 glass rounded-xl">
            <Icon name="AtSign" size={14} className="text-[var(--neon-cyan)]" />
            <span className="text-sm text-foreground/80">@neochat_user</span>
          </div>
        </div>
      </div>
    </div>
  );
}
