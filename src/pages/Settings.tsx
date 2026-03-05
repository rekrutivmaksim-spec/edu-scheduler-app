import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';

const NOTIFICATIONS_URL = 'https://functions.poehali.dev/710399d8-fbc7-4df6-8c6c-200b2828678f';
const VK_AUTH_URL = 'https://functions.poehali.dev/1875b272-ccd5-4605-acd1-44f343ebd7d3';

export default function Settings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState(authService.getUser());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vkLinked, setVkLinked] = useState(false);
  const [vkLinking, setVkLinking] = useState(false);

  const handleLinkVK = async () => {
    setVkLinking(true);
    try {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const codeVerifier = Array.from(array, b => b.toString(36).padStart(2, '0')).join('').slice(0, 64);
      const state = Math.random().toString(36).slice(2, 15);

      localStorage.setItem('vk_code_verifier', codeVerifier);
      localStorage.setItem('vk_state', state);
      localStorage.setItem('vk_link_mode', 'true');

      const res = await fetch(VK_AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_auth_url', code_verifier: codeVerifier, state })
      });
      const data = await res.json();
      if (data.auth_url) {
        window.location.href = data.auth_url;
      } else {
        toast({ variant: 'destructive', title: 'Ошибка', description: data.error || 'Не удалось получить ссылку VK' });
        setVkLinking(false);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Не удалось подключиться к VK' });
      setVkLinking(false);
    }
  };

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
        setVkLinked(!!verifiedUser.vk_id);
        loadSettings();
      }
    };
    checkAuth();
  }, [navigate]);

  const loadSettings = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(NOTIFICATIONS_URL, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      }
    } catch { /* silent */
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    
    try {
      const token = authService.getToken();
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
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось сохранить настройки'
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <header className="bg-white/70 backdrop-blur-xl border-b border-purple-200/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-5">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="rounded-xl hover:bg-purple-100/50 h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0"
            >
              <Icon name="ArrowLeft" size={20} className="text-purple-600 sm:w-6 sm:h-6" />
            </Button>
            <div>
              <h1 className="text-lg sm:text-2xl font-heading font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Настройки
              </h1>
              <p className="text-[10px] sm:text-xs text-purple-600/70 font-medium">Уведомления и предпочтения</p>
            </div>
          </div>
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8">

        <div className="space-y-6">
          {/* Тема оформления */}
          <Card className="p-6 border border-purple-200/60 dark:border-purple-800/40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-200/50 dark:shadow-purple-900/30">
                <Icon name={theme === 'dark' ? 'Moon' : 'Sun'} size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Тема оформления</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Внешний вид приложения</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 border border-purple-100 dark:border-purple-800/50">
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-xl bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-700 flex items-center justify-center overflow-hidden">
                  <Icon
                    name={theme === 'dark' ? 'Moon' : 'Sun'}
                    size={20}
                    className={theme === 'dark' ? 'text-indigo-400' : 'text-amber-500'}
                  />
                </div>
                <div>
                  <Label className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {theme === 'dark' ? 'Темная тема' : 'Светлая тема'}
                  </Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {theme === 'dark' ? 'Комфортно в темноте' : 'Классический светлый режим'}
                  </p>
                </div>
              </div>
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={toggleTheme}
              />
            </div>
          </Card>

          {/* Связанные аккаунты */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 bg-gradient-to-br from-[#0077FF] to-[#0055CC] rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200/50 dark:shadow-blue-900/30">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.587-1.496c.598-.188 1.368 1.259 2.184 1.814.616.42 1.084.328 1.084.328l2.178-.03s1.14-.07.6-.964c-.045-.073-.32-.661-1.644-1.868-1.386-1.263-1.2-1.058.468-3.243.834-1.09 1.17-1.754 1.065-2.039-.1-.27-.713-.198-.713-.198l-2.456.015s-.182-.025-.317.056c-.132.079-.217.263-.217.263s-.39 1.038-.91 1.92c-1.098 1.862-1.538 1.96-1.717 1.843-.418-.272-.313-1.092-.313-1.674 0-1.82.276-2.58-.537-2.776-.27-.065-.468-.108-1.155-.115-.882-.009-1.628.003-2.05.209-.282.138-.5.443-.367.46.164.022.535.1.731.367.253.344.244 1.117.244 1.117s.146 2.143-.34 2.408c-.334.182-.792-.19-1.774-1.893-.503-.872-.883-1.836-.883-1.836s-.073-.18-.204-.276c-.158-.117-.38-.154-.38-.154l-2.335.015s-.35.01-.479.163c-.114.135-.009.414-.009.414s1.838 4.3 3.919 6.464c1.907 1.984 4.073 1.854 4.073 1.854h.982z"/></svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Связанные аккаунты</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Быстрый вход через соцсети</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${vkLinked ? 'bg-[#0077FF]' : 'bg-gray-200 dark:bg-gray-700'}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={vkLinked ? 'white' : '#999'}><path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.587-1.496c.598-.188 1.368 1.259 2.184 1.814.616.42 1.084.328 1.084.328l2.178-.03s1.14-.07.6-.964c-.045-.073-.32-.661-1.644-1.868-1.386-1.263-1.2-1.058.468-3.243.834-1.09 1.17-1.754 1.065-2.039-.1-.27-.713-.198-.713-.198l-2.456.015s-.182-.025-.317.056c-.132.079-.217.263-.217.263s-.39 1.038-.91 1.92c-1.098 1.862-1.538 1.96-1.717 1.843-.418-.272-.313-1.092-.313-1.674 0-1.82.276-2.58-.537-2.776-.27-.065-.468-.108-1.155-.115-.882-.009-1.628.003-2.05.209-.282.138-.5.443-.367.46.164.022.535.1.731.367.253.344.244 1.117.244 1.117s.146 2.143-.34 2.408c-.334.182-.792-.19-1.774-1.893-.503-.872-.883-1.836-.883-1.836s-.073-.18-.204-.276c-.158-.117-.38-.154-.38-.154l-2.335.015s-.35.01-.479.163c-.114.135-.009.414-.009.414s1.838 4.3 3.919 6.464c1.907 1.984 4.073 1.854 4.073 1.854h.982z"/></svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">ВКонтакте</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {vkLinked ? 'Аккаунт привязан' : 'Не привязан'}
                  </p>
                </div>
              </div>
              {vkLinked ? (
                <div className="flex items-center gap-1.5 text-green-600">
                  <Icon name="CheckCircle" size={16} />
                  <span className="text-xs font-medium">Привязан</span>
                </div>
              ) : (
                <Button
                  onClick={handleLinkVK}
                  disabled={vkLinking}
                  size="sm"
                  className="bg-[#0077FF] hover:bg-[#0066DD] text-white rounded-xl text-xs h-9 px-4"
                >
                  {vkLinking ? <Icon name="Loader2" size={14} className="animate-spin" /> : 'Привязать'}
                </Button>
              )}
            </div>
          </Card>

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
                <p><strong>Подписка продлевается автоматически через RuStore.</strong> Отключить можно в RuStore → Аккаунт → Подписки → Studyfay. Доступ сохранится до конца оплаченного периода.</p>
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