import { Link, useLocation } from "react-router-dom";
import Icon from "@/components/ui/icon";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar = ({ isOpen, onToggle }: SidebarProps) => {
  const location = useLocation();

  const menuItems = [
    {
      id: "home",
      path: "/",
      icon: "Home",
      label: "Главная",
    },
    {
      id: "virtual-fitting",
      path: "/virtualfitting",
      icon: "Shirt",
      label: "Виртуальная примерочная",
    },
    {
      id: "color-analysis",
      path: "/colortype",
      icon: "Palette",
      label: "Определение цветотипа",
    },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-gradient-to-b from-gray-900 to-gray-800 
          border-r border-gray-700 z-50 transition-all duration-300 ease-in-out
          ${isOpen ? "w-64" : "-translate-x-full lg:translate-x-0 lg:w-20"}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Burger Button */}
          <div className="flex items-center px-3 py-4">
            <button
              onClick={onToggle}
              className={`
                flex items-center rounded-lg
                transition-all duration-200 text-gray-300 hover:bg-gray-700 hover:text-white
                ${
                  isOpen ? "px-4 py-3 justify-start" : "lg:w-14 lg:h-14 lg:p-0 lg:justify-center justify-center"
                }
              `}
              aria-label="Toggle menu"
            >
              <Icon name="Menu" size={24} className="flex-shrink-0" />
            </button>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 px-3 py-4 space-y-2">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.id}
                  to={item.path}
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      onToggle();
                    }
                  }}
                  className={`
                    flex items-center gap-4 rounded-lg
                    transition-all duration-200 relative group
                    ${
                      isActive
                        ? "bg-purple-500/30 text-white"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }
                    ${
                      isOpen ? "px-4 py-3 justify-start" : "lg:w-14 lg:h-14 lg:p-0 lg:justify-center justify-center"
                    }
                  `}
                  title={!isOpen ? item.label : undefined}
                >
                  <Icon
                    name={item.icon}
                    size={24}
                    className="flex-shrink-0"
                  />
                  
                  <span className={`transition-opacity duration-200 ${isOpen ? "opacity-100" : "lg:opacity-0 lg:hidden"}`} style={{ whiteSpace: 'normal' }}>
                    {item.label}
                  </span>
                  
                  {/* Tooltip for desktop when closed */}
                  {!isOpen && (
                    <span className="hidden lg:block absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;