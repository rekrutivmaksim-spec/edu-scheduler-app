import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import authService from '@/services/authService';

const VK_AUTH_URL = 'https://functions.poehali.dev/1875b272-ccd5-4605-acd1-44f343ebd7d3';
const AUTH_API_URL = 'https://functions.poehali.dev/0c04829e-3c05-40bd-a560-5dcd6c554dd5';

export default function AuthNew() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleEmailLogin = async () => {
    if (!agreedToTerms) {
      toast({
        variant: 'destructive',
        title: 'Необходимо согласие',
        description: 'Подтвердите согласие с условиями использования'
      });
      return;
    }

    if (!email || !email.includes('@')) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Введите корректный email'
      });
      return;
    }

    if (!password) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Введите пароль'
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(AUTH_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email,
          password
        })
      });

      const data = await response.json();

      if (response.ok && data.token) {
        authService.setToken(data.token);
        authService.setUser(data.user);
        
        toast({
          title: '✅ Вход выполнен!',
          description: `Добро пожаловать, ${data.user.full_name}!`
        });

        navigate('/');
      } else {
        toast({
          variant: 'destructive',
          title: 'Ошибка входа',
          description: data.error || 'Неверный email или пароль'
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось выполнить вход'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email || !email.includes('@')) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Введите корректный email'
      });
      return;
    }

    if (!password || password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Пароль должен быть минимум 6 символов'
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(AUTH_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_password',
          email,
          new_password: password
        })
      });

      const data = await response.json();

      if (response.ok && data.token) {
        authService.setToken(data.token);
        authService.setUser(data.user);

        toast({
          title: '✅ Пароль обновлен!',
          description: 'Вход выполнен с новым паролем'
        });

        navigate('/');
      } else {
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: data.error || 'Не удалось обновить пароль'
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось обновить пароль'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVKAuth = async () => {
    if (!agreedToTerms) {
      toast({
        variant: 'destructive',
        title: 'Необходимо согласие',
        description: 'Подтвердите согласие с условиями использования'
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(VK_AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_auth_url',
          redirect_uri: `${window.location.origin}/auth/vk`
        })
      });

      const data = await response.json();
      
      if (response.ok && data.auth_url) {
        window.location.href = data.auth_url;
      } else {
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: 'VK авторизация временно недоступна'
        });
        setLoading(false);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось подключиться к VK'
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <Card className="relative z-10 w-full max-w-md p-8 bg-white/95 backdrop-blur-xl border-0 shadow-2xl rounded-3xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-3xl shadow-xl mb-4">
            <Icon name="GraduationCap" size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            Studyfay
          </h1>
          <p className="text-gray-600">
            {mode === 'login' ? 'Вход в аккаунт' : 'Сброс пароля'}
          </p>
        </div>

        <div className="space-y-6">
          {/* Согласие с условиями */}
          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <Checkbox
              id="terms"
              checked={agreedToTerms}
              onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              className="mt-1"
            />
            <label htmlFor="terms" className="text-sm text-gray-700 cursor-pointer">
              Я согласен(на) с{' '}
              <Link to="/terms" className="text-purple-600 font-semibold hover:underline">
                Пользовательским соглашением
              </Link>
              {' '}и{' '}
              <Link to="/privacy" className="text-purple-600 font-semibold hover:underline">
                Политикой конфиденциальности
              </Link>
            </label>
          </div>

          {/* Email и пароль */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email
              </label>
              <Input
                type="email"
                placeholder="student@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 text-base border-2 border-gray-300 focus:border-purple-500 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {mode === 'login' ? 'Пароль' : 'Новый пароль'}
              </label>
              <Input
                type="password"
                placeholder={mode === 'login' ? 'Введите пароль' : 'Минимум 6 символов'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 text-base border-2 border-gray-300 focus:border-purple-500 rounded-xl"
              />
              {mode === 'forgot' && (
                <p className="text-xs text-gray-500 mt-2">
                  Введите новый пароль - он сразу сохранится в базу
                </p>
              )}
            </div>

            {/* Кнопка входа / сброса */}
            {mode === 'login' ? (
              <Button
                onClick={handleEmailLogin}
                disabled={loading || !agreedToTerms}
                className="w-full h-14 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-90 text-white text-base font-semibold shadow-lg rounded-xl"
              >
                {loading ? (
                  <Icon name="Loader2" size={20} className="animate-spin" />
                ) : (
                  <>
                    <Icon name="LogIn" size={20} className="mr-2" />
                    Войти
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleResetPassword}
                disabled={loading}
                className="w-full h-14 bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90 text-white text-base font-semibold shadow-lg rounded-xl"
              >
                {loading ? (
                  <Icon name="Loader2" size={20} className="animate-spin" />
                ) : (
                  <>
                    <Icon name="KeyRound" size={20} className="mr-2" />
                    Сохранить новый пароль
                  </>
                )}
              </Button>
            )}

            {/* Переключение режима */}
            <div className="text-center">
              <button
                onClick={() => setMode(mode === 'login' ? 'forgot' : 'login')}
                className="text-sm text-purple-600 hover:underline font-medium"
              >
                {mode === 'login' ? '🔑 Забыли пароль?' : '← Вернуться к входу'}
              </button>
            </div>
          </div>

          {/* Разделитель */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">или</span>
            </div>
          </div>

          {/* VK вход */}
          <Button
            onClick={handleVKAuth}
            disabled={loading || !agreedToTerms}
            className="w-full h-14 bg-[#0077FF] hover:bg-[#0066DD] text-white text-base font-semibold shadow-lg rounded-xl"
          >
            {loading ? (
              <Icon name="Loader2" size={20} className="animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.07 2H8.93C3.33 2 2 3.33 2 8.93v6.14C2 20.67 3.33 22 8.93 22h6.14c5.6 0 6.93-1.33 6.93-6.93V8.93C22 3.33 20.67 2 15.07 2zm3.06 13.54h-1.39c-.56 0-.73-.45-1.73-1.45-.87-.82-1.25-.93-1.47-.93-.3 0-.38.08-.38.47v1.32c0 .36-.11.57-1.06.57-1.52 0-3.21-.92-4.4-2.64-1.78-2.42-2.27-4.25-2.27-4.63 0-.22.08-.43.47-.43h1.39c.35 0 .48.16.62.53.69 2.02 1.84 3.79 2.31 3.79.18 0 .26-.08.26-.54v-2.09c-.06-.99-.58-1.08-.58-1.43 0-.17.14-.35.37-.35h2.18c.3 0 .4.16.4.50v2.81c0 .3.13.4.22.4.18 0 .33-.1.66-.43 1.02-1.14 1.75-2.90 1.75-2.90.1-.2.25-.43.64-.43h1.39c.42 0 .51.21.42.50-.15.71-1.54 2.74-1.54 2.74-.15.24-.21.35 0 .62.15.2.64.63.97 1.01.61.67 1.08 1.23 1.21 1.62.12.42.19.50-.02.50z" />
                </svg>
                Войти через ВКонтакте
              </>
            )}
          </Button>

          {/* Подсказка */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
            <p className="text-xs text-blue-900">
              <Icon name="Info" size={14} className="inline mr-1" />
              {mode === 'login' 
                ? 'Нет аккаунта? Просто введите email и пароль - аккаунт создастся автоматически при первом входе.' 
                : 'Если у вас нет VK - введите новый пароль и он сохранится для входа по email.'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}