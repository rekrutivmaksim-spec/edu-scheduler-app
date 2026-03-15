import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-gray-300 py-8 mt-16">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Icon name="GraduationCap" size={16} className="text-white" />
            </div>
            <span className="font-bold text-white">Studyfay</span>
          </div>
          <p className="text-sm text-center text-gray-400 max-w-md">
            ИИ-репетитор для подготовки к ЕГЭ, ОГЭ и учёбы в вузе.
          </p>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/privacy" className="hover:text-white transition-colors">Конфиденциальность</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Условия</Link>
            <Link to="/pricing" className="hover:text-white transition-colors">Тарифы</Link>
          </div>
          <p className="text-xs text-gray-500">&copy; {new Date().getFullYear()} Studyfay</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;