import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';

const tabs = [
  { path: '/', icon: 'Home', label: '\u0413\u043b\u0430\u0432\u043d\u0430\u044f' },
  { path: '/dashboard', icon: 'LayoutDashboard', label: '\u0421\u0432\u043e\u0434\u043a\u0430' },
  { path: '/assistant', icon: 'Bot', label: '\u0418\u0418' },
  { path: '/gradebook', icon: 'BookOpen', label: '\u041e\u0446\u0435\u043d\u043a\u0438' },
  { path: '/profile', icon: 'User', label: '\u041f\u0440\u043e\u0444\u0438\u043b\u044c' },
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