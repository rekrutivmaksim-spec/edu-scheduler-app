import { useState } from 'react';
import Icon from '@/components/ui/icon';

export default function SettingsPanel() {
  const [notifications, setNotifications] = useState(true);
  const [sounds, setSounds] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [onlineStatus, setOnlineStatus] = useState(true);
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!value)}
      className={`w-10 h-6 rounded-full transition-all duration-200 relative ${value ? 'gradient-bg neon-glow' : 'bg-white/10'}`}
    >
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${value ? 'left-5' : 'left-1'}`} />
    </button>
  );

  const sections = [
    {
      title: 'Уведомления',
      icon: 'Bell',
      items: [
        { label: 'Push-уведомления', sub: 'Получать уведомления о сообщениях', value: notifications, onChange: setNotifications },
        { label: 'Звуки', sub: 'Звуковые сигналы при сообщениях', value: sounds, onChange: setSounds },
      ]
    },
    {
      title: 'Конфиденциальность',
      icon: 'Shield',
      items: [
        { label: 'Уведомления о прочтении', sub: 'Показывать статус прочтения', value: readReceipts, onChange: setReadReceipts },
        { label: 'Статус "онлайн"', sub: 'Показывать когда вы в сети', value: onlineStatus, onChange: setOnlineStatus },
      ]
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-5 py-4 border-b border-white/5">
        <h2 className="font-display text-lg font-semibold gradient-text tracking-wide">НАСТРОЙКИ</h2>
      </div>

      <div className="p-5 space-y-5">
        {sections.map(section => (
          <div key={section.title} className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <Icon name={section.icon} size={14} className="text-[var(--neon-purple)]" />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{section.title}</h3>
            </div>
            {section.items.map(item => (
              <div key={item.label} className="flex items-center justify-between p-4 glass rounded-2xl hover:bg-white/5 transition-colors">
                <div>
                  <div className="text-sm font-medium text-foreground/90">{item.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.sub}</div>
                </div>
                <Toggle value={item.value} onChange={item.onChange} />
              </div>
            ))}
          </div>
        ))}

        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="Type" size={14} className="text-[var(--neon-cyan)]" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Размер текста</h3>
          </div>
          <div className="flex gap-2 p-1 glass rounded-2xl">
            {(['small', 'medium', 'large'] as const).map(size => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  fontSize === size ? 'gradient-bg text-white' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {size === 'small' ? 'Мелкий' : size === 'medium' ? 'Средний' : 'Крупный'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="Info" size={14} className="text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">О приложении</h3>
          </div>
          <div className="p-4 glass rounded-2xl space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Версия</span>
              <span className="text-sm text-foreground/80">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Разработано на</span>
              <span className="text-sm gradient-text font-semibold">poehali.dev</span>
            </div>
          </div>
        </div>

        <button className="w-full p-4 glass rounded-2xl flex items-center gap-3 hover:bg-red-500/10 hover:border-red-500/20 border border-transparent transition-all group">
          <Icon name="LogOut" size={16} className="text-muted-foreground group-hover:text-red-400 transition-colors" />
          <span className="text-sm text-muted-foreground group-hover:text-red-400 transition-colors">Выйти из аккаунта</span>
        </button>
      </div>
    </div>
  );
}
