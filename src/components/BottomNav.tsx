import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';

const tabs = [
  { path: '/', icon: 'Rocket', label: 'Учёба', activeColor: 'text-purple-600', activeBg: 'bg-purple-100' },
  { path: '/quests', icon: 'Zap', label: 'Задания', activeColor: 'text-amber-600', activeBg: 'bg-amber-100' },
  { path: '/league', icon: 'Flame', label: 'Лига', activeColor: 'text-red-500', activeBg: 'bg-red-100' },
  { path: '/assistant', icon: 'Brain', label: 'ИИ', activeColor: 'text-blue-600', activeBg: 'bg-blue-100' },
  { path: '/profile', icon: 'User', label: 'Профиль', activeColor: 'text-emerald-600', activeBg: 'bg-emerald-100' },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/98 backdrop-blur-2xl border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-[60px]">
        {tabs.map((tab) => {
          const isActive = tab.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="relative flex flex-col items-center justify-center gap-1 flex-1 h-full min-w-[48px] transition-all duration-300 active:scale-90"
            >
              <div className={`flex items-center justify-center w-10 h-8 rounded-2xl transition-all duration-300 ${
                isActive ? `${tab.activeBg} scale-110` : 'scale-100'
              }`}>
                <Icon
                  name={tab.icon}
                  size={22}
                  className={`transition-all duration-300 ${
                    isActive ? `${tab.activeColor} drop-shadow-sm` : 'text-gray-400'
                  }`}
                />
              </div>
              <span className={`text-[10px] leading-none transition-all duration-300 ${
                isActive ? `font-bold ${tab.activeColor}` : 'font-medium text-gray-400'
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
