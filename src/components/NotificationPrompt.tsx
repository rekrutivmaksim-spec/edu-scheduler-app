import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { notificationService } from '@/lib/notifications';
import { authService } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { API } from '@/lib/api-urls';

const DISMISS_DATE_KEY = 'push_banner_dismissed_date';
const DISMISS_COUNT_KEY = 'push_dismiss_count';
const FIRST_VISIT_KEY = 'push_first_visit_date';

function getDismissCount(): number {
  try {
    return parseInt(localStorage.getItem(DISMISS_COUNT_KEY) || '0', 10);
  } catch {
    return 0;
  }
}

function getDismissDate(): number | null {
  try {
    const val = localStorage.getItem(DISMISS_DATE_KEY);
    return val ? parseInt(val, 10) : null;
  } catch {
    return null;
  }
}

function getFirstVisitDate(): number {
  try {
    const val = localStorage.getItem(FIRST_VISIT_KEY);
    if (val) return parseInt(val, 10);
    const now = Date.now();
    localStorage.setItem(FIRST_VISIT_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

function shouldShowBanner(): boolean {
  const dismissCount = getDismissCount();
  // After 3 dismissals, respect the user — stop showing
  if (dismissCount >= 3) return false;

  const dismissDate = getDismissDate();
  if (!dismissDate) return true; // Never dismissed — show

  // Show again after 24 hours
  const hoursSinceDismiss = (Date.now() - dismissDate) / (1000 * 60 * 60);
  return hoursSinceDismiss >= 24;
}

function isUrgentMode(): boolean {
  const firstVisit = getFirstVisitDate();
  const daysSinceFirst = (Date.now() - firstVisit) / (1000 * 60 * 60 * 24);
  return daysSinceFirst >= 2;
}

interface BannerContent {
  title: string;
  subtitle: string;
  emoji: string;
}

function getBannerContent(dismissCount: number): BannerContent {
  if (dismissCount === 0) {
    return {
      title: 'Включи уведомления — не потеряй стрик',
      subtitle: 'Напомним, если забудешь зайти',
      emoji: '🔔',
    };
  }
  if (dismissCount === 1) {
    return {
      title: 'Без уведомлений 90% учеников теряют стрик!',
      subtitle: 'Включи за 2 секунды — сохрани свой прогресс',
      emoji: '🔥',
    };
  }
  // dismissCount === 2 (final)
  return {
    title: 'Последний шанс! Включи пуши',
    subtitle: 'Получи +5 бонусных вопросов за подписку',
    emoji: '🎁',
  };
}

const NotificationPrompt = () => {
  const { toast } = useToast();
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dismissCount, setDismissCount] = useState(getDismissCount);
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    // Record first visit
    getFirstVisitDate();

    const check = async () => {
      if (!shouldShowBanner()) return;
      const token = authService.getToken();
      if (!token) return;
      try {
        const res = await fetch(API.PUSH_NOTIFICATIONS, {
          headers: { 'Authorization': `Bearer ${token}`, 'X-Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        // Show banner only if no subscription in DB
        if (!data.subscribed) {
          setUrgent(isUrgentMode());
          setDismissCount(getDismissCount());
          setTimeout(() => setIsVisible(true), 5000);
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
      // Verify subscription was saved
      const res = await fetch(API.PUSH_NOTIFICATIONS, {
        headers: { 'Authorization': `Bearer ${token}`, 'X-Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.subscribed) {
        setIsVisible(false);
        toast({ title: 'Уведомления включены!', description: 'Напомним о стрике, занятиях и бонусах' });
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
    const newCount = getDismissCount() + 1;
    try {
      localStorage.setItem(DISMISS_DATE_KEY, String(Date.now()));
      localStorage.setItem(DISMISS_COUNT_KEY, String(newCount));
    } catch { /* silent */ }
  };

  if (!isVisible) return null;

  const content = getBannerContent(dismissCount);

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className={`rounded-3xl p-4 shadow-2xl ${
        urgent
          ? 'bg-gradient-to-br from-red-500 to-orange-600 shadow-red-900/40'
          : 'bg-gradient-to-br from-indigo-600 to-purple-700 shadow-purple-900/40'
      }`}>
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
        >
          <Icon name="X" size={16} />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-xl">{content.emoji}</span>
          </div>
          <div className="flex-1">
            <p className="font-bold text-white text-sm">{content.title}</p>
            <p className="text-white/70 text-xs mt-0.5 mb-3">{content.subtitle}</p>
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
              {dismissCount < 2 && (
                <Button
                  onClick={handleDismiss}
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white hover:bg-white/10 rounded-xl h-9 px-3"
                >
                  Позже
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationPrompt;