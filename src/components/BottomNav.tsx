import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';

const tabs = [
  { path: '/', icon: 'Home', label: 'Главная' },
  { path: '/dashboard', icon: 'LayoutDashboard', label: 'Сводка' },
  { path: '/assistant', icon: 'Bot', label: 'ИИ' },
  { path: '/exam', icon: 'GraduationCap', label: 'ЕГЭ/ОГЭ' },
  { path: '/profile', icon: 'User', label: 'Профиль' },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/90 backdrop-blur-xl border-t border-purple-200/50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div
        className="flex items-center justify-around h-16"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors duration-200 ${
                isActive ? 'text-purple-600' : 'text-gray-400 active:text-purple-400'
              }`}
            >
              <Icon
                name={tab.icon}
                size={22}
                className={`transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}
              />
              <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
                {tab.label}
              </span>
              {isActive && (
                <div className="absolute bottom-[env(safe-area-inset-bottom,0px)] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-purple-600" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;