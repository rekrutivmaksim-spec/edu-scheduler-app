import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { notificationService } from '@/lib/notifications';
import { authService } from '@/lib/auth';

interface ExamReminderProps {
  isOpen: boolean;
  onClose: () => void;
}

const ExamReminder = ({ isOpen, onClose }: ExamReminderProps) => {
  const { toast } = useToast();
  const [examName, setExamName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [examTime, setExamTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateReminder = async () => {
    if (!examName || !examDate || !examTime) {
      toast({
        title: 'Заполните все поля',
        description: 'Укажите название экзамена, дату и время',
        variant: 'destructive'
      });
      return;
    }

    // Проверяем поддержку уведомлений
    if (!notificationService.isSupported()) {
      toast({
        title: 'Уведомления не поддерживаются',
        description: 'Ваш браузер не поддерживает push-уведомления',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);

    try {
      // Запрашиваем разрешение на уведомления
      const permission = await notificationService.requestPermission();
      
      if (permission !== 'granted') {
        toast({
          title: 'Разрешение не получено',
          description: 'Для напоминаний об экзаменах нужно разрешить уведомления',
          variant: 'destructive'
        });
        setIsLoading(false);
        return;
      }

      // Подписываемся на уведомления (если еще не подписаны)
      const token = authService.getToken();
      if (!token) {
        throw new Error('Не авторизован');
      }

      const subscription = await notificationService.getSubscription();
      if (!subscription) {
        await notificationService.subscribe(token);
      }

      // Создаем напоминание в календаре (сохраняем как задачу с высоким приоритетом)
      const examDateTime = new Date(`${examDate}T${examTime}`);
      const SCHEDULE_URL = 'https://functions.poehali.dev/7030dc26-77cd-4b59-91e6-1be52f31cf8d';
      
      const response = await fetch(`${SCHEDULE_URL}?path=tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: `🎓 Экзамен: ${examName}`,
          description: `Экзамен назначен на ${examDateTime.toLocaleString('ru-RU')}`,
          deadline: examDate,
          priority: 'high',
          subject: examName
        })
      });

      if (response.ok) {
        // Проверяем, можем ли мы показать локальное уведомление
        if ('serviceWorker' in navigator && 'Notification' in window) {
          // Показываем тестовое уведомление
          try {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification('Напоминание создано! 🎓', {
              body: `Экзамен "${examName}" назначен на ${examDateTime.toLocaleDateString('ru-RU')} в ${examTime}`,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: 'exam-reminder',
              requireInteraction: false,
              vibrate: [200, 100, 200]
            });
          } catch (error) {
            console.error('Ошибка показа уведомления:', error);
          }
        }

        toast({
          title: '✅ Напоминание создано!',
          description: `Вы получите уведомление о экзамене "${examName}" в день экзамена`
        });

        // Очищаем форму и закрываем
        setExamName('');
        setExamDate('');
        setExamTime('');
        onClose();
      } else {
        throw new Error('Не удалось создать напоминание');
      }
    } catch (error) {
      console.error('Ошибка создания напоминания:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать напоминание об экзамене',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="max-w-lg w-full bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Напоминание об экзамене</h2>
            <p className="text-sm text-gray-600 mt-1">
              Получите уведомление на телефон в день экзамена
            </p>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="rounded-xl"
          >
            <Icon name="X" size={24} />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="examName">Название экзамена</Label>
            <Input
              id="examName"
              placeholder="Например: Математический анализ"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="examDate">Дата экзамена</Label>
              <Input
                id="examDate"
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="mt-1.5"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div>
              <Label htmlFor="examTime">Время</Label>
              <Input
                id="examTime"
                type="time"
                value={examTime}
                onChange={(e) => setExamTime(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <div className="flex items-start gap-2">
              <Icon name="Info" size={20} className="text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Как работают напоминания:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>В день экзамена вы получите push-уведомление на телефон</li>
                  <li>Уведомление придет утром и за час до экзамена</li>
                  <li>Для работы нужно разрешить уведомления в браузере</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleCreateReminder}
              disabled={isLoading}
              className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
            >
              {isLoading ? (
                <>
                  <Icon name="Loader2" size={20} className="mr-2 animate-spin" />
                  Создаю...
                </>
              ) : (
                <>
                  <Icon name="Bell" size={20} className="mr-2" />
                  Создать напоминание
                </>
              )}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              disabled={isLoading}
            >
              Отмена
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ExamReminder;
