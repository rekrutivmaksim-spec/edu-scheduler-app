import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { notificationService } from '@/lib/notifications';
import { authService } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { API } from '@/lib/api-urls';

const PUSH_ASKED_KEY = 'push_asked_after_session';
const PUSH_DECLINED_COUNT_KEY = 'push_declined_count';

function wasAlreadyAsked(): boolean {
  try {
    const count = parseInt(localStorage.getItem(PUSH_DECLINED_COUNT_KEY) || '0', 10);
    if (count >= 3) return true;
    return false;
  } catch {
    return false;
  }
}

function markDeclined() {
  try {
    const count = parseInt(localStorage.getItem(PUSH_DECLINED_COUNT_KEY) || '0', 10);
    localStorage.setItem(PUSH_DECLINED_COUNT_KEY, String(count + 1));
    localStorage.setItem(PUSH_ASKED_KEY, String(Date.now()));
  } catch { /* noop */ }
}

function shouldAskAgain(): boolean {
  try {
    const lastAsked = localStorage.getItem(PUSH_ASKED_KEY);
    if (!lastAsked) return true;
    const hoursSince = (Date.now() - parseInt(lastAsked, 10)) / (1000 * 60 * 60);
    return hoursSince >= 48;
  } catch {
    return true;
  }
}

interface Props {
  visible: boolean;
  streak: number;
  onClose: () => void;
}

const NotificationPrompt = ({ visible, streak, onClose }: Props) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!visible) { setShow(false); return; }
    if (wasAlreadyAsked() || !shouldAskAgain()) { onClose(); return; }

    const checkSubscription = async () => {
      const token = authService.getToken();
      if (!token) { onClose(); return; }
      try {
        const res = await fetch(API.PUSH_NOTIFICATIONS, {
          headers: { 'Authorization': `Bearer ${token}`, 'X-Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.subscribed) { onClose(); return; }
      } catch { onClose(); return; }
      if (!notificationService.isSupported()) { onClose(); return; }
      if (notificationService.getPermission() === 'denied') { onClose(); return; }
      setTimeout(() => setShow(true), 800);
    };
    checkSubscription();
  }, [visible]);

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      const token = authService.getToken();
      if (!token) throw new Error('no token');
      await notificationService.subscribe(token);
      const res = await fetch(API.PUSH_NOTIFICATIONS, {
        headers: { 'Authorization': `Bearer ${token}`, 'X-Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.subscribed) {
        toast({ title: '🔔 Готово!', description: 'Напомним, если стрик будет в опасности' });
        setShow(false);
        onClose();
      } else {
        toast({ variant: 'destructive', title: 'Не удалось', description: 'Разреши уведомления в настройках браузера' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Попробуй ещё раз' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    markDeclined();
    setShow(false);
    onClose();
  };

  if (!show) return null;

  const daysWord = streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-6 px-4 bg-black/40 backdrop-blur-sm"
      style={{ animation: 'fade-in 0.3s ease' }}>
      <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ animation: 'slide-up 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔥</span>
          </div>
          <h3 className="text-white font-extrabold text-xl mb-2">
            {streak > 1
              ? `Серия ${streak} ${daysWord}!`
              : 'Первое занятие завершено!'}
          </h3>
          <p className="text-white/70 text-sm leading-relaxed">
            {streak > 1
              ? 'Хочешь, напомню завтра, чтобы не потерять серию?'
              : 'Хочешь, напомню завтра, чтобы начать серию?'}
          </p>
        </div>

        <div className="bg-white p-5 space-y-3">
          <Button
            onClick={handleEnable}
            disabled={isLoading}
            className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-base rounded-2xl"
          >
            {isLoading ? (
              <Icon name="Loader2" size={18} className="animate-spin" />
            ) : (
              'Да, напомни завтра'
            )}
          </Button>
          <button
            onClick={handleDismiss}
            className="w-full h-10 text-gray-400 text-sm font-medium hover:text-gray-600 transition-colors"
          >
            Не сейчас
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slide-up { from { transform: translateY(100px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  );
};

export default NotificationPrompt;