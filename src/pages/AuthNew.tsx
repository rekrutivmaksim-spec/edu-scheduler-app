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
  { icon: 'Lightbulb', text: 'Поясню тему простыми словами' },
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
  const [showLoginForm, setShowLoginForm] = useState(false);
  const refCode = searchParams.get('ref') || '';

  useEffect(() => {
    if (refCode) localStorage.setItem('pendingReferral', refCode);
    const savedEmail = localStorage.getItem('savedEmail');
    localStorage.removeItem('savedPassword');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, [refCode]);

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
      <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -right-16 w-96 h-96 bg-pink-400/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm flex flex-col gap-5">

        {/* Блок 1 — Логотип */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center shadow-xl">
            <Icon name="GraduationCap" size={28} className="text-white" />
          </div>
          <span className="text-white/70 text-xs font-semibold tracking-widest uppercase">Studyfay</span>
        </div>

        {/* Блок 2 — Ценность */}
        <div className="text-center">
          <h1 className="text-[2rem] font-extrabold text-white leading-tight tracking-tight mb-2">
            ИИ-репетитор<br />для учёбы
          </h1>
          <p className="text-white/70 text-sm leading-relaxed">
            Объясню темы, подберу задания<br />и разберу PDF/Word
          </p>
        </div>

        {/* Блок 3 — 3 выгоды */}
        <div className="flex flex-col gap-2">
          {benefits.map((b) => (
            <div
              key={b.text}
              className="flex items-center gap-3 bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3"
            >
              <div className="w-8 h-8 bg-white/25 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon name={b.icon} size={15} className="text-white" />
              </div>
              <span className="text-white text-sm font-medium">{b.text}</span>
            </div>
          ))}
        </div>

        {/* Блок 4 — Главная кнопка */}
        <div className="flex flex-col items-center gap-1.5">
          <Button
            onClick={() => navigate('/assistant')}
            className="w-full h-14 bg-white text-purple-700 hover:bg-white/90 font-extrabold text-base rounded-2xl shadow-2xl"
          >
            Попробовать бесплатно
            <Icon name="ArrowRight" size={18} className="ml-2" />
          </Button>
          <span className="text-white/50 text-xs">1–2 вопроса без регистрации</span>
        </div>

        {/* Блок 5 — Уже есть аккаунт */}
        {!showLoginForm && (
          <div className="flex items-center justify-center gap-2">
            <span className="text-white/60 text-sm">Уже есть аккаунт?</span>
            <button
              onClick={() => setShowLoginForm(true)}
              className="text-white font-semibold text-sm underline underline-offset-2 hover:text-white/80 transition-colors"
            >
              Войти
            </button>
          </div>
        )}

        {/* Блок 6 — Форма входа (скрытая, Вариант А) */}
        {showLoginForm && (
          <div className="bg-white rounded-3xl p-5 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-300">

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-800">
                {mode === 'login' ? 'Вход в аккаунт' : 'Сброс пароля'}
              </h2>
              <button
                onClick={() => { setShowLoginForm(false); setMode('login'); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Icon name="X" size={18} />
              </button>
            </div>

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
                  {loading
                    ? <Icon name="Loader2" size={18} className="animate-spin" />
                    : 'Войти / Зарегистрироваться'
                  }
                </Button>
              ) : (
                <Button
                  onClick={handleResetPassword}
                  disabled={loading}
                  className="w-full h-12 bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90 text-white font-semibold rounded-xl"
                >
                  {loading
                    ? <Icon name="Loader2" size={18} className="animate-spin" />
                    : 'Сохранить новый пароль'
                  }
                </Button>
              )}

              <div className="flex justify-between items-center">
                <p className="text-xs text-gray-400">
                  Нет аккаунта? Введи email и пароль — создадим автоматически
                </p>
                <button
                  onClick={() => setMode(mode === 'login' ? 'forgot' : 'login')}
                  className="text-xs text-purple-600 hover:underline whitespace-nowrap ml-2 flex-shrink-0"
                >
                  {mode === 'login' ? 'Забыли пароль?' : '← Назад'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Реферальный бонус */}
        {refCode && (
          <div className="bg-green-500/20 backdrop-blur border border-green-400/30 rounded-2xl p-3">
            <p className="text-white text-xs text-center">
              <Icon name="Gift" size={14} className="inline mr-1" />
              Вас пригласил друг — получите +5 бонусных вопросов к ИИ
            </p>
          </div>
        )}

        {/* Подходит для */}
        <p className="text-center text-white/40 text-xs pb-2">
          Подходит школьникам и студентам
        </p>

      </div>
    </div>
  );
}
