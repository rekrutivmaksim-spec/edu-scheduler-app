import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { am } from '@/lib/appmetrica';

const SCREEN_NAMES: Record<string, string> = {
  '/': 'Главная',
  '/auth': 'Авторизация',
  '/login': 'Вход',
  '/register': 'Регистрация',
  '/onboarding': 'Онбординг',
  '/assistant': 'ИИ-ассистент',
  '/pricing': 'Тарифы',
  '/profile': 'Профиль',
  '/achievements': 'Достижения',
  '/session': 'Сессия',
  '/flashcards': 'Карточки',
  '/photo-solve': 'Решение по фото',
  '/mock-exam': 'Пробный экзамен',
  '/materials': 'Материалы',
  '/pomodoro': 'Помодоро',
  '/settings': 'Настройки',
  '/referral': 'Рефералка',
  '/groups': 'Учебные группы',
  '/exam': 'Экзамены',
  '/dashboard': 'Дашборд',
  '/university': 'Университет',
  '/universities': 'Поиск вузов',
  '/calculator': 'Калькулятор',
  '/parent': 'Родительский кабинет',
};

export default function AppMetricaTracker() {
  const location = useLocation();
  const utmCaptured = useRef(false);

  // UTM-параметры — один раз при первом входе
  useEffect(() => {
    if (utmCaptured.current) return;
    const params = new URLSearchParams(location.search);
    const utm: Record<string, string> = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(key => {
      const val = params.get(key);
      if (val) utm[key] = val;
    });
    if (Object.keys(utm).length > 0) {
      am.utmCapture(utm);
      // Сохраняем в sessionStorage чтобы знать источник при оплате
      sessionStorage.setItem('utm', JSON.stringify(utm));
    }
    utmCaptured.current = true;
  }, []);

  // Трекинг каждого экрана
  useEffect(() => {
    const screenName = SCREEN_NAMES[location.pathname] || location.pathname;
    am.hit(location.pathname);
    am.event('screen_view', { screen: screenName, path: location.pathname });
  }, [location.pathname]);

  return null;
}
