import { useState } from 'react';
import { notifications as initNotifs } from './data';
import type { Notification } from './data';
import Icon from '@/components/ui/icon';

export default function NotificationsPanel() {
  const [notifs, setNotifs] = useState<Notification[]>(initNotifs);

  const markAll = () => setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  const markOne = (id: string) => setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  const unread = notifs.filter(n => !n.read).length;

  const iconMap = {
    message: { icon: 'MessageCircle', color: 'text-[var(--neon-purple)]', bg: 'bg-purple-500/20' },
    call: { icon: 'Phone', color: 'text-[var(--neon-green)]', bg: 'bg-green-500/20' },
    contact: { icon: 'UserPlus', color: 'text-[var(--neon-cyan)]', bg: 'bg-cyan-500/20' },
    system: { icon: 'Zap', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold gradient-text tracking-wide">УВЕДОМЛЕНИЯ</h2>
          {unread > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">{unread} непрочитанных</p>
          )}
        </div>
        {unread > 0 && (
          <button
            onClick={markAll}
            className="text-xs text-[var(--neon-purple)] hover:text-[var(--neon-cyan)] transition-colors glass px-3 py-1 rounded-full"
          >
            Прочитать все
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {notifs.map((notif, i) => {
          const cfg = iconMap[notif.type];
          return (
            <div
              key={notif.id}
              onClick={() => markOne(notif.id)}
              className={`flex items-start gap-3 p-4 rounded-2xl cursor-pointer transition-all duration-200 animate-slide-up ${
                !notif.read
                  ? 'glass border border-white/10 hover:border-[var(--neon-purple)]/30'
                  : 'bg-white/2 hover:bg-white/4 border border-transparent'
              }`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className={`w-10 h-10 rounded-2xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                {notif.avatar ? (
                  <span className="text-lg">{notif.avatar}</span>
                ) : (
                  <Icon name={cfg.icon} size={16} className={cfg.color} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-semibold truncate ${!notif.read ? 'text-white' : 'text-foreground/70'}`}>
                    {notif.title}
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{notif.time}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{notif.text}</p>
              </div>
              {!notif.read && (
                <div className="w-2 h-2 rounded-full gradient-bg flex-shrink-0 mt-1" />
              )}
            </div>
          );
        })}

        {notifs.every(n => n.read) && (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
            <div className="text-5xl mb-4 animate-float">✅</div>
            <p className="text-muted-foreground text-sm">Все уведомления прочитаны</p>
          </div>
        )}
      </div>
    </div>
  );
}
