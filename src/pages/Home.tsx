import { useNavigate } from "react-router-dom";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/CookieBanner";

const Home = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const services = [
    {
      id: "virtual-fitting",
      title: "Виртуальная примерочная",
      description:
        "Примерьте одежду онлайн с помощью ИИ — загрузите своё фото и посмотрите, как на вас сидит выбранная вещь",
      image:
        "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/AFOzmM93nFTwxvTxlbpUm.png",
      icon: "Shirt",
      path: "/virtualfitting",
    },
    {
      id: "color-type",
      title: "Определение цветотипа",
      description:
        "Узнайте свой цветотип и получите персональные рекомендации по цветам в одежде и макияже",
      image:
        "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vVKssj2jWDNvzCNyONYmW.png",
      icon: "Palette",
      path: "/colortype",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-800/40 to-gray-900">
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <div className="lg:pl-20">
        <header className="border-b border-gray-700/50 sticky top-0 bg-gray-900/50 backdrop-blur z-40">
          <div className="container mx-auto px-4 py-4">
            <nav className="flex items-center justify-between lg:justify-end">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 hover:bg-gray-700 rounded-lg transition-colors z-[60]"
                aria-label="Toggle menu"
              >
                <Icon name="Menu" size={24} className="text-white" />
              </button>

              <Link
                to="/"
                className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0 lg:mr-auto flex items-center hover:opacity-80 transition-opacity"
              >
                <img
                  src="https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/logo-fitting-room-2.svg"
                  alt="StyleSelect"
                  className="h-8 md:h-10"
                />
              </Link>
              <div className="flex items-center gap-2">
                {user ? (
                  <>
                    <span className="text-sm text-gray-300 hidden lg:inline">
                      {user.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate("/profile")}
                      className="hidden lg:flex text-white hover:bg-purple-700 hover:text-white"
                    >
                      <Icon name="User" size={16} className="mr-2" />
                      Личный кабинет
                    </Button>
                    <button
                      onClick={() => navigate("/profile")}
                      className="lg:hidden p-2 hover:bg-gray-700 rounded-lg transition-colors"
                      aria-label="Profile"
                    >
                      <Icon name="User" size={24} className="text-white" />
                    </button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogout}
                      className="hidden lg:flex text-white bg-transparent border-white/30 hover:bg-white/10 hover:border-white/50 hover:text-white"
                    >
                      <Icon name="LogOut" size={16} className="mr-2" />
                      Выйти
                    </Button>
                    <button
                      onClick={handleLogout}
                      className="lg:hidden p-2 hover:bg-gray-700 rounded-lg transition-colors"
                      aria-label="Logout"
                    >
                      <Icon name="LogOut" size={24} className="text-white" />
                    </button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate("/login")}
                      className="hidden md:flex text-white hover:bg-white/10"
                    >
                      Войти
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => navigate("/register")}
                      className="hidden md:flex text-white hover:opacity-90"
                      style={{ backgroundColor: "rgb(150, 115, 211)" }}
                    >
                      Регистрация
                    </Button>
                    <button
                      onClick={() => navigate("/login")}
                      className="lg:hidden p-2 hover:bg-gray-700 rounded-lg transition-colors"
                      aria-label="Login"
                    >
                      <Icon name="User" size={24} className="text-white" />
                    </button>
                  </>
                )}
              </div>
            </nav>
          </div>
        </header>

        <main>
          <div className="container mx-auto px-4 py-12">
            <div className="mb-12">
              <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
                Fashion-платформа StyleSelect
              </h1>
              <p className="text-gray-300 text-lg mb-3">
                Создайте Ваш идеальный стиль с технологиями ИИ
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
              {services.map((service) => (
                <div
                  key={service.id}
                  onClick={() => navigate(service.path)}
                  className="group cursor-pointer bg-gray-800/50 backdrop-blur-sm rounded-2xl overflow-hidden border border-gray-700 hover:border-purple-500 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/20"
                >
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={service.image}
                      alt={service.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  <div className="p-6 lg:p-8">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                        <Icon
                          name={service.icon}
                          size={24}
                          className="text-purple-400"
                        />
                      </div>
                      <h2 className="text-2xl font-bold text-white group-hover:text-purple-400 transition-colors">
                        {service.title}
                      </h2>
                    </div>

                    <p className="text-gray-300 leading-relaxed">
                      {service.description}
                    </p>

                    <div className="mt-6 flex items-center gap-2 text-purple-400 font-medium group-hover:gap-3 transition-all">
                      <span>Перейти к сервису</span>
                      <Icon name="ArrowRight" size={20} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        <Footer />
        <CookieBanner />
      </div>
    </div>
  );
};

export default Home;