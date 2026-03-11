import { Link, useLocation } from 'react-router-dom';
import Icon from '@/components/ui/icon';

const AdminMenu = () => {
  const location = useLocation();

  const menuItems = [
    { path: '/vf-console/dashboard', icon: 'Home', label: 'Главная' },
    { path: '/vf-console/stats', icon: 'BarChart3', label: 'Статистика' },
    { path: '/vf-console/users', icon: 'Users', label: 'Пользователи' },
    { path: '/vf-console/lookbooks', icon: 'Album', label: 'Лукбуки' },
    { path: '/vf-console/payments', icon: 'CreditCard', label: 'Платежи' },
    { path: '/vf-console/catalog', icon: 'Package', label: 'Каталог' },
    { path: '/vf-console/generations', icon: 'Sparkles', label: 'Генерации' },
    { path: '/vf-console/colortypes', icon: 'Palette', label: 'Цветотипы' },
  ];

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
        </div>
      </nav>
    </>
  );
};

export default AdminMenu;