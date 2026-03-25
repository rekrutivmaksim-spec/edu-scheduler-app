import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { authService } from '@/lib/auth';

interface Tab {
  path: string;
  icon: string;
  label: string;
  activeColor: string;
  activeBg: string;
}

const TABS_EGE: Tab[] = [
  { path: '/', icon: 'Rocket', label: 'Учёба', activeColor: 'text-purple-600', activeBg: 'bg-purple-100' },
  { path: '/exam', icon: 'GraduationCap', label: 'Экзамен', activeColor: 'text-indigo-600', activeBg: 'bg-indigo-100' },
  { path: '/league', icon: 'Flame', label: 'Лига', activeColor: 'text-red-500', activeBg: 'bg-red-100' },
  { path: '/assistant', icon: 'Brain', label: 'ИИ', activeColor: 'text-blue-600', activeBg: 'bg-blue-100' },
  { path: '/profile', icon: 'User', label: 'Профиль', activeColor: 'text-emerald-600', activeBg: 'bg-emerald-100' },
];

const TABS_UNI: Tab[] = [
  { path: '/', icon: 'Rocket', label: 'Учёба', activeColor: 'text-purple-600', activeBg: 'bg-purple-100' },
  { path: '/university', icon: 'Building2', label: 'ВУЗ', activeColor: 'text-indigo-600', activeBg: 'bg-indigo-100' },
  { path: '/league', icon: 'Flame', label: 'Лига', activeColor: 'text-red-500', activeBg: 'bg-red-100' },
  { path: '/assistant', icon: 'Brain', label: 'ИИ', activeColor: 'text-blue-600', activeBg: 'bg-blue-100' },
  { path: '/profile', icon: 'User', label: 'Профиль', activeColor: 'text-emerald-600', activeBg: 'bg-emerald-100' },
];

const TABS_OTHER: Tab[] = [
  { path: '/', icon: 'Rocket', label: 'Учёба', activeColor: 'text-purple-600', activeBg: 'bg-purple-100' },
  { path: '/quests', icon: 'Zap', label: 'Задания', activeColor: 'text-amber-600', activeBg: 'bg-amber-100' },
  { path: '/league', icon: 'Flame', label: 'Лига', activeColor: 'text-red-500', activeBg: 'bg-red-100' },
  { path: '/assistant', icon: 'Brain', label: 'ИИ', activeColor: 'text-blue-600', activeBg: 'bg-blue-100' },
  { path: '/profile', icon: 'User', label: 'Профиль', activeColor: 'text-emerald-600', activeBg: 'bg-emerald-100' },
];

function getTabsForGoal(goal?: string | null): Tab[] {
  if (goal === 'ege' || goal === 'oge') return TABS_EGE;
  if (goal === 'university') return TABS_UNI;
  return TABS_OTHER;
}

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = authService.getUser();
  const tabs = getTabsForGoal(user?.goal);

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
