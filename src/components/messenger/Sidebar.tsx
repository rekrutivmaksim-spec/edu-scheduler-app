import Icon from '@/components/ui/icon';

type Tab = 'chats' | 'contacts' | 'notifications' | 'search' | 'profile' | 'settings';

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  unreadChats: number;
  unreadNotifications: number;
}

const tabs = [
  { id: 'chats' as Tab, icon: 'MessageCircle', label: 'Чаты' },
  { id: 'contacts' as Tab, icon: 'Users', label: 'Контакты' },
  { id: 'notifications' as Tab, icon: 'Bell', label: 'Уведомления' },
  { id: 'search' as Tab, icon: 'Search', label: 'Поиск' },
  { id: 'profile' as Tab, icon: 'User', label: 'Профиль' },
  { id: 'settings' as Tab, icon: 'Settings', label: 'Настройки' },
];

export default function Sidebar({ activeTab, onTabChange, unreadChats, unreadNotifications }: SidebarProps) {
  return (
    <div className="flex flex-col items-center py-6 px-2 gap-2 glass border-r border-white/5 w-16 min-h-screen">
      <div className="mb-4 flex flex-col items-center">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center neon-glow animate-pulse-neon" style={{background: 'linear-gradient(135deg, #FF8C00, #FFA500)'}}>
          <span className="text-xl leading-none">🍊</span>
        </div>
      </div>

      <div className="flex flex-col gap-1 flex-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const badge = tab.id === 'chats' ? unreadChats : tab.id === 'notifications' ? unreadNotifications : 0;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              title={tab.label}
              className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group ${
                isActive
                  ? 'active-tab neon-glow'
                  : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon
                name={tab.icon}
                size={18}
                className={isActive ? 'text-[var(--neon-purple)]' : ''}
              />
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 gradient-bg rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-auto">
        <div className="w-8 h-8 rounded-full gradient-bg-pink flex items-center justify-center text-sm">
          😎
        </div>
      </div>
    </div>
  );
}