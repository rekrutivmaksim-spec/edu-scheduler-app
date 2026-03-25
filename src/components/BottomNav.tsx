import { useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { path: '/', emoji: '🚀', label: 'Учёба' },
  { path: '/quests', emoji: '⚡', label: 'Задания' },
  { path: '/league', emoji: '🔥', label: 'Лига' },
  { path: '/assistant', emoji: '🧠', label: 'ИИ' },
  { path: '/profile', emoji: '😎', label: 'Профиль' },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-xl border-t border-gray-200/60 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const isActive = tab.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-w-[44px] transition-all duration-200 ${
                isActive ? 'scale-105' : 'opacity-60 active:opacity-80'
              }`}
            >
              <span className={`text-[20px] leading-none transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                {tab.emoji}
              </span>
              <span className={`text-[10px] leading-none ${isActive ? 'font-bold text-gray-900' : 'font-medium text-gray-400'}`}>
                {tab.label}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-purple-600" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
