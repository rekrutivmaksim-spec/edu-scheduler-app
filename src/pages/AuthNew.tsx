import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/lib/auth';
import { Device } from '@capacitor/device';

async function getDeviceId(): Promise<string> {
  try {
    const info = await Device.getId();
    return info.identifier || '';
  } catch {
    return '';
  }
}

const AUTH_API_URL = 'https://functions.poehali.dev/0c04829e-3c05-40bd-a560-5dcd6c554dd5';
const SUBSCRIPTION_URL = 'https://functions.poehali.dev/7fe183c2-49af-4817-95f3-6ab4912778c4';

const benefits = [
  { icon: 'MessageCircle', text: 'Объясню тему простыми словами' },
  { icon: 'Target', text: 'Подберу задания под твой уровень' },
  { icon: 'FileText', text: 'Разберу PDF/Word и отвечу по ним' },
];

export default function AuthNew() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const refCode = searchParams.get('ref') || '';

  useEffect(() => {
    if (refCode) {
      localStorage.setItem('pendingReferral', refCode);
    }
    const savedEmail = localStorage.getItem('savedEmail');
    localStorage.removeItem('savedPassword');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleEmailLogin = async () => {
    if (!agreedToTerms) {
      toast({ variant: 'destructive', title: 'Необходимо согласие', description: 'Подтвердите согласие с условиями использования' });
      return;
    }
    if (!email || !email.includes('@')) {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Введите корректный email' });
      return;
    }
    if (!password) {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Введите пароль' });
      return;
    }

    setLoading(true);
    try {
      const device_id = await getDeviceId();
      const response = await fetch(AUTH_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password, device_id })
      });
      const data = await response.json();

      if (response.ok && data.token) {
        authService.setToken(data.token);
        authService.setUser(data.user);
        if (rememberMe) {
          localStorage.setItem('savedEmail', email);
        } else {
          localStorage.removeItem('savedEmail');
        }
        localStorage.removeItem('savedPassword');

        const pending = localStorage.getItem('pendingReferral');
        if (pending) {
          localStorage.removeItem('pendingReferral');
          try {
            await fetch(SUBSCRIPTION_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.token}` },
              body: JSON.stringify({ action: 'use_referral', referral_code: pending.toUpperCase() })
            });
          } catch (e) { console.warn('referral', e); }
        }

        toast({ title: '✅ Вход выполнен!', description: `Добро пожаловать, ${data.user.full_name}!` });
        navigate('/');
      } else {
        toast({ variant: 'destructive', title: 'Ошибка входа', description: data.error || 'Неверный email или пароль' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Не удалось выполнить вход' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email || !email.includes('@')) {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Введите корректный email' });
      return;
    }
    if (!password || password.length < 6) {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Пароль должен быть минимум 6 символов' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(AUTH_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_password', email, new_password: password })
      });
      const data = await response.json();

      if (response.ok && data.token) {
        authService.setToken(data.token);
        authService.setUser(data.user);
        toast({ title: '✅ Пароль обновлён!', description: 'Вход выполнен с новым паролем' });
        navigate('/');
      } else if (response.ok && data.message) {
        toast({ title: 'Готово', description: data.message });
        setMode('login');
      } else {
        toast({ variant: 'destructive', title: 'Ошибка', description: data.error || 'Не удалось обновить пароль' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Не удалось обновить пароль' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Фоновые блобы */}
      <div className="absolute top-[-80px] left-[-80px] w-72 h-72 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute bottom-[-60px] right-[-60px] w-96 h-96 bg-pink-400/20 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">

        {/* Логотип */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mb-3 shadow-xl">
            <Icon name="GraduationCap" size={32} className="text-white" />
          </div>
          <span className="text-white/80 text-sm font-medium tracking-widest uppercase">Studyfay</span>
        </div>

        {/* Заголовок */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white leading-tight mb-2">
            ИИ-репетитор для учёбы
          </h1>
          <p className="text-white/75 text-sm leading-relaxed">
            ЕГЭ/ОГЭ и ВУЗ: объяснение тем,<br />задания и разбор материалов
          </p>
        </div>

        {/* Плашки-выгоды */}
        <div className="space-y-2 mb-6">
          {benefits.map((b) => (
            <div key={b.text} className="flex items-center gap-3 bg-white/15 backdrop-blur rounded-xl px-4 py-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon name={b.icon} size={16} className="text-white" />
              </div>
              <span className="text-white text-sm font-medium">{b.text}</span>
            </div>
          ))}
        </div>

        {/* Социальное доказательство */}
        <div className="text-center mb-6">
          <span className="inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-4 py-2 text-white/80 text-xs">
            <Icon name="Users" size={14} className="text-white/60" />
            Подходит школьникам и студентам
          </span>
        </div>

        {/* CTA — кнопка открывает форму */}
        {!showForm && (
          <Button
            onClick={() => setShowForm(true)}
            className="w-full h-14 bg-white text-purple-700 hover:bg-white/90 font-bold text-base rounded-2xl shadow-xl mb-3"
          >
            Начать бесплатно
            <Icon name="ArrowRight" size={18} className="ml-2" />
          </Button>
        )}

        {/* Форма входа / сброса */}
        {showForm && (
          <div className="bg-white rounded-3xl p-5 shadow-2xl mb-3 animate-in fade-in slide-in-from-bottom-4 duration-300">

            {mode === 'forgot' && (
              <button
                onClick={() => setMode('login')}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-4"
              >
                <Icon name="ArrowLeft" size={14} />
                Вернуться к входу
              </button>
            )}

            <h2 className="text-base font-bold text-gray-800 mb-4">
              {mode === 'login' ? 'Вход или регистрация' : 'Сброс пароля'}
            </h2>

            <div className="space-y-3">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 border-2 border-gray-200 focus:border-purple-400 rounded-xl text-sm"
              />
              <Input
                type="password"
                placeholder={mode === 'login' ? 'Пароль' : 'Новый пароль (мин. 6 символов)'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (mode === 'login' ? handleEmailLogin() : handleResetPassword())}
                className="h-11 border-2 border-gray-200 focus:border-purple-400 rounded-xl text-sm"
              />

              {mode === 'login' && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(c) => setRememberMe(c as boolean)}
                  />
                  <label htmlFor="remember" className="text-xs text-gray-600 cursor-pointer">Запомнить меня</label>
                </div>
              )}

              {/* Согласие */}
              <div className="flex items-start gap-2">
                <Checkbox
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={(c) => setAgreedToTerms(c as boolean)}
                  className="mt-0.5"
                />
                <label htmlFor="terms" className="text-xs text-gray-500 cursor-pointer leading-relaxed">
                  Согласен(на) с{' '}
                  <Link to="/terms" className="text-purple-600 hover:underline font-medium">условиями</Link>
                  {' '}и{' '}
                  <Link to="/privacy" className="text-purple-600 hover:underline font-medium">политикой</Link>
                </label>
              </div>

              {mode === 'login' ? (
                <Button
                  onClick={handleEmailLogin}
                  disabled={loading || !agreedToTerms}
                  className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white font-semibold rounded-xl"
                >
                  {loading ? <Icon name="Loader2" size={18} className="animate-spin" /> : 'Войти / Зарегистрироваться'}
                </Button>
              ) : (
                <Button
                  onClick={handleResetPassword}
                  disabled={loading}
                  className="w-full h-12 bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90 text-white font-semibold rounded-xl"
                >
                  {loading ? <Icon name="Loader2" size={18} className="animate-spin" /> : 'Сохранить новый пароль'}
                </Button>
              )}

              {mode === 'login' && (
                <button
                  onClick={() => setMode('forgot')}
                  className="w-full text-center text-xs text-purple-600 hover:underline"
                >
                  Забыли пароль?
                </button>
              )}

              <p className="text-xs text-gray-400 text-center">
                Нет аккаунта? Просто введи email и пароль — зарегистрируем автоматически
              </p>
            </div>
          </div>
        )}

        {/* Реферальный бонус */}
        {refCode && (
          <div className="bg-green-500/20 backdrop-blur border border-green-400/30 rounded-2xl p-3 mb-3">
            <p className="text-white text-xs text-center">
              <Icon name="Gift" size={14} className="inline mr-1" />
              Вас пригласил друг — получите +5 бонусных вопросов к ИИ
            </p>
          </div>
        )}

      </div>
    </div>
  );
}