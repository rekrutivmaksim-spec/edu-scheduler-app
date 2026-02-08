import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/lib/auth';

const NOTIFICATIONS_URL = 'https://functions.poehali.dev/1fef5a49-94ad-4d77-9a17-ee2a10d22e2a';

export default function Settings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState(authService.getUser());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [settings, setSettings] = useState({
    sms_notifications: false,
    push_notifications: true,
    email_notifications: false,
    notify_lessons: true,
    notify_deadlines: true,
    notify_materials: false,
    notify_before_minutes: 30
  });

  useEffect(() => {
    const checkAuth = async () => {
      if (!authService.isAuthenticated()) {
        navigate('/auth');
        return;
      }
      const verifiedUser = await authService.verifyToken();
      if (!verifiedUser) {
        navigate('/auth');
      } else {
        setUser(verifiedUser);
        loadSettings();
      }
    };
    checkAuth();
  }, [navigate]);

  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(NOTIFICATIONS_URL, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(NOTIFICATIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'update_settings',
          ...settings
        })
      });

      if (response.ok) {
        toast({
          title: '✅ Настройки сохранены',
          description: 'Ваши предпочтения обновлены'
        });
      } else {
        throw new Error('Не удалось сохранить настройки');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: error.message || 'Не удалось сохранить настройки'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: string, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <Icon name="Loader2" size={48} className="animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            onClick={() => navigate('/profile')}
            variant="ghost"
          >
            <Icon name="ArrowLeft" size={18} className="mr-2" />
            Назад
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Настройки уведомлений</h1>
        </div>

        <div className="space-y-6">
          {/* Общие настройки */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center">
                <Icon name="Bell" size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Каналы уведомлений</h2>
                <p className="text-sm text-gray-600">Выберите, как вы хотите получать уведомления</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* SMS уведомления */}
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex-1">
                  <Label className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <Icon name="MessageSquare" size={20} className="text-blue-600" />
                    SMS-уведомления
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Напоминания о занятиях и дедлайнах по SMS
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    ⚠️ SMS-коды для входа отключить нельзя (требуется для безопасности)
                  </p>
                </div>
                <Switch
                  checked={settings.sms_notifications}
                  onCheckedChange={(checked) => handleToggle('sms_notifications', checked)}
                />
              </div>

              {/* Push уведомления */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex-1">
                  <Label className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <Icon name="Smartphone" size={20} className="text-purple-600" />
                    Push-уведомления
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Уведомления в браузере/приложении
                  </p>
                </div>
                <Switch
                  checked={settings.push_notifications}
                  onCheckedChange={(checked) => handleToggle('push_notifications', checked)}
                />
              </div>

              {/* Email уведомления */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex-1">
                  <Label className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <Icon name="Mail" size={20} className="text-indigo-600" />
                    Email-уведомления
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Еженедельные дайджесты на почту
                  </p>
                </div>
                <Switch
                  checked={settings.email_notifications}
                  onCheckedChange={(checked) => handleToggle('email_notifications', checked)}
                />
              </div>
            </div>
          </Card>

          {/* Типы событий */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl flex items-center justify-center">
                <Icon name="Calendar" size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">О чём уведомлять</h2>
                <p className="text-sm text-gray-600">Выберите типы событий для уведомлений</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex-1">
                  <Label className="text-base font-semibold text-gray-900">
                    Занятия
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Напоминания о предстоящих парах
                  </p>
                </div>
                <Switch
                  checked={settings.notify_lessons}
                  onCheckedChange={(checked) => handleToggle('notify_lessons', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex-1">
                  <Label className="text-base font-semibold text-gray-900">
                    Дедлайны
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Напоминания о сроках сдачи задач
                  </p>
                </div>
                <Switch
                  checked={settings.notify_deadlines}
                  onCheckedChange={(checked) => handleToggle('notify_deadlines', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex-1">
                  <Label className="text-base font-semibold text-gray-900">
                    Новые материалы
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Уведомления о добавленных материалах
                  </p>
                </div>
                <Switch
                  checked={settings.notify_materials}
                  onCheckedChange={(checked) => handleToggle('notify_materials', checked)}
                />
              </div>
            </div>
          </Card>

          {/* Время уведомлений */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl flex items-center justify-center">
                <Icon name="Clock" size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Время уведомлений</h2>
                <p className="text-sm text-gray-600">За сколько минут напоминать</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[15, 30, 60, 120].map((minutes) => (
                <Button
                  key={minutes}
                  onClick={() => handleToggle('notify_before_minutes', minutes)}
                  variant={settings.notify_before_minutes === minutes ? 'default' : 'outline'}
                  className={`h-16 ${
                    settings.notify_before_minutes === minutes
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
                      : ''
                  }`}
                >
                  <div className="text-center">
                    <div className="text-lg font-bold">{minutes}</div>
                    <div className="text-xs">минут</div>
                  </div>
                </Button>
              ))}
            </div>
          </Card>

          {/* Документы */}
          <Card className="p-6 bg-gray-50">
            <div className="flex items-center gap-3 mb-4">
              <Icon name="FileText" size={24} className="text-gray-600" />
              <h2 className="text-lg font-bold text-gray-900">Юридическая информация</h2>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <Link to="/privacy" className="text-purple-600 hover:underline font-medium">
                📜 Политика конфиденциальности
              </Link>
              <Link to="/terms" className="text-purple-600 hover:underline font-medium">
                📄 Пользовательское соглашение
              </Link>
            </div>
            <p className="text-xs text-gray-600 mt-4">
              Используя Studyfay, вы соглашаетесь с нашими условиями. 
              Мы не продаём ваши данные и не рассылаем рекламу.
            </p>
          </Card>

          {/* Информация о подписке и возврате */}
          <Card className="p-6 bg-blue-50 border-2 border-blue-200">
            <div className="flex items-center gap-3 mb-4">
              <Icon name="CreditCard" size={24} className="text-blue-600" />
              <h2 className="text-lg font-bold text-gray-900">Подписка и возврат средств</h2>
            </div>
            <div className="space-y-3 text-sm text-gray-700">
              <div className="flex items-start gap-2">
                <Icon name="Info" size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <p><strong>Подписка не продлевается автоматически.</strong> Для продолжения использования ИИ-ассистента необходимо повторно оформить подписку после окончания срока действия.</p>
              </div>
              <div className="flex items-start gap-2">
                <Icon name="RotateCcw" size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <p><strong>Возврат средств возможен в течение 14 дней</strong> с момента оплаты при условии отсутствия использования ИИ-ассистента. Для запроса возврата обратитесь в службу поддержки.</p>
              </div>
              <div className="flex items-start gap-2">
                <Icon name="Mail" size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <p>Служба поддержки: <a href="mailto:support@studyfay.ru" className="text-purple-600 underline">support@studyfay.ru</a></p>
              </div>
            </div>
          </Card>

          {/* Кнопка сохранения */}
          <div className="flex gap-4">
            <Button
              onClick={handleSaveSettings}
              disabled={saving}
              className="flex-1 h-14 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold shadow-lg"
            >
              {saving ? (
                <Icon name="Loader2" size={20} className="animate-spin" />
              ) : (
                <>
                  <Icon name="Save" size={20} className="mr-2" />
                  Сохранить настройки
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}