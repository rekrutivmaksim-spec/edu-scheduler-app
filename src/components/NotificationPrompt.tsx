import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { notificationService } from '@/lib/notifications';
import { authService } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { API } from '@/lib/api-urls';

const DISMISS_KEY = 'push_banner_dismissed_v2';

const NotificationPrompt = () => {
  const { toast } = useToast();
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const check = async () => {
      // Не показываем если уже скрыли в этой сессии
      if (sessionStorage.getItem(DISMISS_KEY)) return;
      const token = authService.getToken();
      if (!token) return;
      try {
        const res = await fetch(API.PUSH_NOTIFICATIONS, {
          headers: { 'Authorization': `Bearer ${token}`, 'X-Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        // Показываем баннер если нет подписки в БД
        if (!data.subscribed) {
          setTimeout(() => setIsVisible(true), 2000);
        }
      } catch { /* silent */ }
    };
    check();
  }, []);

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      const token = authService.getToken();
      if (!token) throw new Error('no token');
      await notificationService.subscribe(token);
      // Проверяем через бэкенд что реально сохранилось
      const res = await fetch(API.PUSH_NOTIFICATIONS, {
        headers: { 'Authorization': `Bearer ${token}`, 'X-Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.subscribed) {
        setIsVisible(false);
        toast({ title: '🔔 Уведомления включены!', description: 'Напомним о стрике, занятиях и бонусах' });
      } else {
        toast({ variant: 'destructive', title: 'Не удалось', description: 'Разреши уведомления в настройках телефона' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Попробуй ещё раз' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem(DISMISS_KEY, 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-4 shadow-2xl shadow-purple-900/40">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
        >
          <Icon name="X" size={16} />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-xl">🔔</span>
          </div>
          <div className="flex-1">
            <p className="font-bold text-white text-sm">Включи уведомления</p>
            <p className="text-white/70 text-xs mt-0.5 mb-3">Не потеряй стрик — напомним, если забудешь зайти</p>
            <div className="flex gap-2">
              <Button
                onClick={handleEnable}
                disabled={isLoading}
                size="sm"
                className="bg-white text-indigo-700 hover:bg-white/90 font-semibold rounded-xl h-9 px-4"
              >
                {isLoading ? (
                  <Icon name="Loader2" size={14} className="animate-spin" />
                ) : (
                  'Включить'
                )}
              </Button>
              <Button
                onClick={handleDismiss}
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white hover:bg-white/10 rounded-xl h-9 px-3"
              >
                Позже
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationPrompt;
