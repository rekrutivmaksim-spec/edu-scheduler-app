import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { authService } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

const API_URL = 'https://functions.poehali.dev/0c04829e-3c05-40bd-a560-5dcd6c554dd5';

export default function DeleteAccount() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<'info' | 'confirm'>('info');
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isLoggedIn = authService.isAuthenticated();

  const handleDelete = async () => {
    if (!password) {
      toast({ title: 'Введите пароль для подтверждения', variant: 'destructive' });
      return;
    }
    setIsDeleting(true);
    try {
      const token = authService.getToken();
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'delete_account', password }),
      });
      const d = await res.json();
      if (res.ok) {
        authService.logout();
        toast({ title: 'Аккаунт удалён', description: 'Все ваши данные будут удалены в течение 30 дней' });
        navigate('/auth');
      } else {
        toast({ title: 'Ошибка', description: d.error || 'Неверный пароль или ошибка сервера', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка сети', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8 flex flex-col">
      <div className="max-w-lg mx-auto w-full">
        <Button onClick={() => navigate(-1)} variant="ghost" className="mb-6">
          <Icon name="ArrowLeft" size={18} className="mr-2" />
          Назад
        </Button>

        <Card className="p-6 md:p-8 bg-white shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Icon name="UserX" size={24} className="text-red-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Удаление аккаунта</h1>
              <p className="text-sm text-gray-500">Studyfay</p>
            </div>
          </div>

          {step === 'info' && (
            <div className="space-y-5">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-red-800 font-semibold text-sm mb-2">Внимание! Это действие необратимо.</p>
                <p className="text-red-700 text-sm">После удаления аккаунта восстановление данных невозможно.</p>
              </div>

              <div>
                <h2 className="font-semibold text-gray-900 mb-3">Что будет удалено:</h2>
                <ul className="space-y-2">
                  {[
                    'Профиль и личные данные',
                    'Расписание занятий и задачи',
                    'Загруженные учебные материалы',
                    'История диалогов с ИИ-ассистентом',
                    'Достижения, стрики и прогресс',
                    'История платежей и подписок',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-gray-700">
                      <Icon name="X" size={14} className="text-red-500 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
                <p>Данные будут полностью удалены с наших серверов в течение <strong>30 дней</strong> после подтверждения запроса.</p>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
                <p>Если у вас активная подписка — она будет отменена без возврата средств за неиспользованный период. Для вопросов по возврату обратитесь: <a href="mailto:rekrutiw@yandex.ru" className="underline font-medium">rekrutiw@yandex.ru</a></p>
              </div>

              {!isLoggedIn ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 text-center">Чтобы удалить аккаунт, сначала войдите в систему</p>
                  <Button onClick={() => navigate('/auth')} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                    Войти в аккаунт
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setStep('confirm')}
                  variant="destructive"
                  className="w-full"
                >
                  Продолжить удаление
                </Button>
              )}
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-5">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-red-800 text-sm font-medium">Подтвердите удаление аккаунта паролем</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Введите пароль от аккаунта</label>
                <Input
                  type="password"
                  placeholder="Ваш пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setStep('info')} variant="outline" className="flex-1">
                  Отмена
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={isDeleting || !password}
                  variant="destructive"
                  className="flex-1"
                >
                  {isDeleting ? (
                    <Icon name="Loader2" size={16} className="animate-spin mr-2" />
                  ) : null}
                  Удалить аккаунт
                </Button>
              </div>

              <p className="text-xs text-gray-400 text-center">
                По вопросам: <a href="mailto:rekrutiw@yandex.ru" className="underline">rekrutiw@yandex.ru</a>
              </p>
            </div>
          )}
        </Card>

        <p className="text-center text-xs text-gray-400 mt-6">
          Это официальная страница удаления аккаунта сервиса Studyfay.{' '}
          <a href="/privacy" className="underline">Политика конфиденциальности</a>
        </p>
      </div>
    </div>
  );
}
