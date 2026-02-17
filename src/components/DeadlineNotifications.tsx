import { useEffect, useState } from 'react';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const NOTIFICATIONS_URL = 'https://functions.poehali.dev/c2aee6d8-f8ac-45e7-a0c7-67f1ee6c4fe7';

interface DeadlineNotification {
  id: number;
  title: string;
  subject: string;
  deadline: string;
  priority: string;
  urgency: string;
  message: string;
  hours_until: number;
}

const DeadlineNotifications = () => {
  const [notifications, setNotifications] = useState<DeadlineNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000); // Обновляем каждую минуту
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${NOTIFICATIONS_URL}?action=list&limit=5`, {
        headers: { 'X-Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'AlertCircle';
      case 'high': return 'Clock';
      case 'medium': return 'Bell';
      default: return 'Info';
    }
  };

  if (loading || notifications.length === 0) {
    return null;
  }

  return (
    <Card className="p-4 sm:p-6 bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 border-2 border-red-200 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
          <Icon name="Bell" size={20} className="text-white" />
        </div>
        <div>
          <h3 className="font-bold text-lg">⏰ Ближайшие дедлайны</h3>
          <p className="text-sm text-gray-600">Не забудь про эти задачи</p>
        </div>
      </div>

      <div className="space-y-3">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className="flex items-start gap-3 p-3 bg-white rounded-lg border-l-4 hover:shadow-md transition-shadow"
            style={{ borderColor: `var(--${notif.urgency})` }}
          >
            <div className={`w-8 h-8 ${getUrgencyColor(notif.urgency)} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <Icon name={getUrgencyIcon(notif.urgency)} size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm sm:text-base truncate">{notif.title}</h4>
              {notif.subject && (
                <p className="text-xs text-gray-600 mt-0.5">{notif.subject}</p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {notif.message}
                </Badge>
                <span className="text-xs text-gray-500">
                  {format(new Date(notif.deadline), 'dd MMM, HH:mm', { locale: ru })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default DeadlineNotifications;