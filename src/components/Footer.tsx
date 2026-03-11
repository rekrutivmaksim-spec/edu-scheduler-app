import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";

const Footer = () => {
  const { user } = useAuth();

  return (
    <footer className="bg-gray-900 text-gray-300 py-12 mt-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center">
              <img 
                src="https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/logo-styleselect2.svg" 
                alt="StyleSelect" 
                className="h-8"
              />
            </div>
            <p className="text-sm leading-relaxed">
              Быстрая виртуальная примерка одежды и определение цветотипа. Экономьте время — подберите идеальный образ и палитру оттенков, которые идеально подчеркнут Вашу природную красоту.
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Сервисы</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/virtualfitting" className="hover:text-white transition-colors">
                  Онлайн примерочная
                </Link>
              </li>
              <li>
                <Link to="/colortype" className="hover:text-white transition-colors">
                  Определение цветотипа
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Информация</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/payment" className="hover:text-white transition-colors">
                  Информация об оплате
                </Link>
              </li>
              <li>
                <Link to="/offer" className="hover:text-white transition-colors">
                  Оферта
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-white transition-colors">
                  Конфиденциальность
                </Link>
              </li>
              <li>
                <Link to="/personal-data" className="hover:text-white transition-colors">
                  Обработка персональных данных
                </Link>
              </li>
              <li>
                <Link to="/contacts" className="hover:text-white transition-colors">
                  Контакты
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">
              {user ? "Аккаунт" : "Вход"}
            </h3>
            <ul className="space-y-2">
              {user ? (
                <li>
                  <Link to="/profile" className="hover:text-white transition-colors">
                    Личный кабинет
                  </Link>
                </li>
              ) : (
                <>
                  <li>
                    <Link to="/login" className="hover:text-white transition-colors">
                      Войти
                    </Link>
                  </li>
                  <li>
                    <Link to="/register" className="hover:text-white transition-colors">
                      Регистрация
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-sm flex flex-col items-center gap-4">
          <div className="flex items-center gap-4">
            <a href="https://t.me/styleselect_fashion" target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 transition-opacity">
              <img src="https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/fd97f432-49f8-4e1d-8f25-de135c1639fe.svg" alt="Telegram" className="w-[22px] h-[22px]" />
            </a>
            <a href="https://vk.com/styleselect_fashion" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
              <img src="https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/94866264-dedc-40e9-9b98-c0dea0b19e58.svg" alt="VK" className="w-[22px] h-[22px] opacity-60 hover:opacity-100 transition-opacity" />
            </a>
          </div>
          <p>&copy; {new Date().getFullYear()} StyleSelect. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;