import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/context/AuthContext';
import Footer from '@/components/Footer';
import CookieBanner from '@/components/CookieBanner';
import Sidebar from '@/components/Sidebar';
import HeaderBalance from '@/components/HeaderBalance';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className="lg:pl-20">
        <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-40">
          <div className="container mx-auto px-4 py-4">
            <nav className="flex items-center justify-between lg:justify-end">
              <div className="flex items-center gap-2 lg:hidden">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors z-[60]"
                  aria-label="Toggle menu"
                >
                  <Icon name="Menu" size={24} />
                </button>
                {user && <HeaderBalance />}
              </div>
              
              <Link to="/" className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0 lg:mr-auto flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Icon name="GraduationCap" size={20} className="text-white" />
                </div>
                <span className="font-bold text-lg hidden sm:inline bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Studyfay</span>
              </Link>
              <div className="flex items-center gap-2 lg:gap-4">
              {user ? (
                <>
                  <div className="hidden lg:block">
                    <HeaderBalance />
                  </div>
                  <span className="text-sm text-muted-foreground hidden lg:inline">{user.name}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => navigate('/profile')}
                    className={`hidden lg:flex ${location.pathname.startsWith('/profile') ? 'text-white hover:text-white' : 'hover:bg-purple-700 hover:text-white'}`}
                    style={location.pathname.startsWith('/profile') ? { backgroundColor: 'rgb(150, 115, 211)' } : {}}
                  >
                    <Icon name="User" size={16} className="mr-2" />
                    Личный кабинет
                  </Button>
                  <button
                    onClick={() => navigate('/profile')}
                    className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors"
                    aria-label="Profile"
                  >
                    <Icon name="User" size={24} />
                  </button>
                  <Button variant="outline" size="sm" onClick={handleLogout} className="hidden lg:flex">
                    <Icon name="LogOut" size={16} className="mr-2" />
                    Выйти
                  </Button>
                  <button
                    onClick={handleLogout}
                    className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors"
                    aria-label="Logout"
                  >
                    <Icon name="LogOut" size={24} />
                  </button>
                </>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => navigate('/login')}
                    className="hidden md:flex"
                  >
                    Войти
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => navigate('/register')}
                    className="hidden md:flex"
                  >
                    Регистрация
                  </Button>
                  <button
                    onClick={() => navigate('/login')}
                    className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors"
                    aria-label="Login"
                  >
                    <Icon name="User" size={24} />
                  </button>
                </>
              )}
              </div>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <Footer />
        <CookieBanner />
      </div>
    </div>
  );
}