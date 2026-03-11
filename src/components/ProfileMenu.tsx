import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import Icon from '@/components/ui/icon';

const ProfileMenu = () => {
  const location = useLocation();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const menuItems = [
    { path: '/profile', icon: 'Home', label: 'Главная' },
    { path: '/profile/lookbooks', icon: 'Album', label: 'Лукбуки' },
    { path: '/profile/wallet', icon: 'Wallet', label: 'Кошелёк' },
    { path: '/profile/settings', icon: 'Settings', label: 'Настройки' },
  ];

  const historyItems = [
    { path: '/profile/history', icon: 'Shirt', label: 'История примерок' },
    { path: '/profile/history-colortypes', icon: 'Palette', label: 'История цветотипов' },
  ];

  const isHistoryActive = location.pathname === '/profile/history' || location.pathname === '/profile/history-colortypes';

  return (
    <>
      {/* Desktop Menu */}
      <nav className="hidden lg:block w-64 flex-shrink-0">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon name={item.icon} size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
          
          {/* History submenu */}
          <div className="space-y-1">
            <button
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-colors ${
                isHistoryActive
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon name="History" size={20} />
                <span className="font-medium">История</span>
              </div>
              <Icon 
                name="ChevronDown" 
                size={16} 
                className={`transition-transform ${isHistoryOpen ? 'rotate-180' : ''}`}
              />
            </button>
            
            {isHistoryOpen && (
              <div className="ml-4 space-y-1 border-l-2 border-gray-200 pl-2">
                {historyItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-purple-50 text-purple-700'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon name={item.icon} size={18} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <nav className="lg:hidden mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon name={item.icon} size={18} />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
          
          {/* History items in mobile */}
          {historyItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon name={item.icon} size={18} />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default ProfileMenu;