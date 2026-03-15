import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { notificationService } from '@/lib/notifications';
import { authService } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

const NotificationPrompt = () => {
  const { toast } = useToast();
  const [isVisible, setIsVisible] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkNotificationStatus();
  }, []);

  const checkNotificationStatus = async () => {
    if (!notificationService.isSupported()) {
      return;
    }

    const permission = notificationService.getPermission();
    const subscription = await notificationService.getSubscription();

    if (permission === 'default' && !subscription) {
      const dismissed = localStorage.getItem('notification_prompt_dismissed');
      if (dismissed) return;
      const visits = parseInt(localStorage.getItem('studyfay_visit_count') || '0', 10);
      localStorage.setItem('studyfay_visit_count', String(visits + 1));
      if (visits >= 2) {
        setTimeout(() => setIsVisible(true), 5000);
      }
    } else if (permission === 'granted' && subscription) {
      setIsSubscribed(true);
    }
  };

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      const permission = await notificationService.requestPermission();
      
      if (permission === 'granted') {
        const token = authService.getToken();
        if (!token) throw new Error('Не авторизован');

        await notificationService.subscribe(token);
        setIsSubscribed(true);
        setIsVisible(false);
        
        toast({
          title: '🔔 Уведомления включены!',
          description: 'Теперь вы будете получать напоминания о парах и задачах'
        });
      } else {
        toast({
          title: 'Разрешение не получено',
          description: 'Вы можете включить уведомления позже в настройках браузера',
          variant: 'destructive'
        });
        setIsVisible(false);
        localStorage.setItem('notification_prompt_dismissed', 'true');
      }
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось включить уведомления',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    setIsLoading(true);
    try {
      const token = authService.getToken();
      if (token) {
        await notificationService.unsubscribe(token);
      }
      setIsSubscribed(false);
      toast({
        title: 'Уведомления отключены',
        description: 'Вы не будете получать push-уведомления'
      });
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось отключить уведомления',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('notification_prompt_dismissed', 'true');
  };

  if (!notificationService.isSupported()) {
    return null;
  }

  if (isSubscribed) {
    return (
      <Card className="p-4 bg-green-50 border-2 border-green-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <Icon name="BellRing" size={20} className="text-green-600" />
          </div>
          <div>
            <p className="font-semibold text-green-800">Уведомления включены</p>
            <p className="text-xs text-green-600">Вы получаете напоминания о парах и задачах</p>
          </div>
        </div>
        <Button
          onClick={handleDisable}
          disabled={isLoading}
          variant="ghost"
          size="sm"
          className="text-green-700 hover:bg-green-100"
        >
          {isLoading ? (
            <Icon name="Loader2" size={16} className="animate-spin" />
          ) : (
            'Отключить'
          )}
        </Button>
      </Card>
    );
  }

  if (!isVisible) {
    return null;
  }

  return (
    <Card className="p-5 bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-300 shadow-lg shadow-purple-500/20">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/30">
          <Icon name="Bell" size={24} className="text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-800 mb-1">Включите уведомления 🔔</h3>
          <p className="text-sm text-gray-600 mb-1.5">
            Получайте напоминания о парах, дедлайнах и важных задачах прямо на телефон
          </p>
          <p className="text-xs text-indigo-600 font-medium mb-3">
            {'\u{1F525}'} Не потеряй свой стрик — включи уведомления и мы напомним!
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handleEnable}
              disabled={isLoading}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
            >
              {isLoading ? (
                <>
                  <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                  Подключаем...
                </>
              ) : (
                <>
                  <Icon name="BellRing" size={16} className="mr-2" />
                  Включить
                </>
              )}
            </Button>
            <Button
              onClick={handleDismiss}
              variant="ghost"
              className="text-gray-600"
            >
              Позже
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default NotificationPrompt;