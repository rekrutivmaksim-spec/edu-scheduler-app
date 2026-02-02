import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/lib/auth';

const AUTH_API_URL = 'https://functions.poehali.dev/0c04829e-3c05-40bd-a560-5dcd6c554dd5';

export default function AuthNew() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('savedEmail');
    const savedPassword = localStorage.getItem('savedPassword');
    if (savedEmail && savedPassword) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, []);

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
        
        if (rememberMe) {
          localStorage.setItem('savedEmail', email);
          localStorage.setItem('savedPassword', password);
        } else {
          localStorage.removeItem('savedEmail');
          localStorage.removeItem('savedPassword');
        }
        
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



  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <Card className="relative z-10 w-full max-w-md p-6 sm:p-8 bg-white/95 backdrop-blur-xl border-0 shadow-2xl rounded-3xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-3xl shadow-xl mb-4">
            <Icon name="GraduationCap" size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            Studyfay
          </h1>
          <p className="text-gray-600">
            {mode === 'login' ? 'Войдите в аккаунт' : 'Сброс пароля'}
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

            {/* Запомнить пароль */}
            {mode === 'login' && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <label htmlFor="remember" className="text-sm text-gray-700 cursor-pointer">
                  Запомнить пароль
                </label>
              </div>
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