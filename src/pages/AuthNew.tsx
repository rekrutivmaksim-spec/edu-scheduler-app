import { useState, useEffect, useRef } from 'react';
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
const AI_API_URL = 'https://functions.poehali.dev/8e8cbd4e-7731-4853-8e29-a84b3d178249';
const SUBSCRIPTION_URL = 'https://functions.poehali.dev/7fe183c2-49af-4817-95f3-6ab4912778c4';

const DEMO_LIMIT = 2;

const benefits = [
  { icon: 'Lightbulb', text: 'Объясню тему простыми словами' },
  { icon: 'Target', text: 'Подберу задания под твой уровень' },
  { icon: 'FileText', text: 'Загружай PDF/Word — объясню и отвечу по материалу' },
];

const DEMO_HINTS = [
  'Объясни теорему Пифагора',
  'Что такое фотосинтез?',
  'Помоги с заданием по химии',
];

type Screen = 'landing' | 'demo' | 'login' | 'register' | 'forgot';

interface DemoMessage {
  role: 'user' | 'assistant';
  text: string;
}

export default function AuthNew() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref') || '';

  const [screen, setScreen] = useState<Screen>('landing');
  const [demoStarting, setDemoStarting] = useState(false);

  // Demo state
  const [demoMessages, setDemoMessages] = useState<DemoMessage[]>([]);
  const [demoInput, setDemoInput] = useState('');
  const [demoCount, setDemoCount] = useState(0);
  const [demoLoading, setDemoLoading] = useState(false);
  const demoBottomRef = useRef<HTMLDivElement>(null);

  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (refCode) localStorage.setItem('pendingReferral', refCode);
    const savedEmail = localStorage.getItem('savedEmail');
    if (savedEmail) { setEmail(savedEmail); setRememberMe(true); }
  }, [refCode]);

  useEffect(() => {
    demoBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [demoMessages]);

  const clearErrors = () => { setFieldErrors({}); setTermsError(false); };

  const validateEmail = (v: string) => v.includes('@') && v.includes('.');

  const sendDemo = async (text?: string) => {
    const q = (text || demoInput).trim();
    if (!q || demoLoading) return;
    setDemoInput('');
    const newCount = demoCount + 1;
    setDemoCount(newCount);
    setDemoMessages(prev => [...prev, { role: 'user', text: q }]);
    setDemoLoading(true);
    try {
      const res = await fetch(AI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'demo_ask', question: q }),
      });
      const data = await res.json();
      const answer = data.answer || data.response || data.message || 'Не удалось получить ответ';
      setDemoMessages(prev => [...prev, { role: 'assistant', text: answer }]);
    } catch {
      setDemoMessages(prev => [...prev, { role: 'assistant', text: 'Проблемы с соединением — попробуй ещё раз.' }]);
      setDemoCount(c => c - 1);
    } finally {
      setDemoLoading(false);
    }
  };

  const applyReferral = async (token: string) => {
    const pending = localStorage.getItem('pendingReferral');
    if (!pending) return;
    localStorage.removeItem('pendingReferral');
    try {
      await fetch(SUBSCRIPTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'use_referral', referral_code: pending.toUpperCase() }),
      });
    } catch (e) { console.warn('referral', e); }
  };

  const afterLogin = async (data: { token: string; user: { full_name: string } }) => {
    authService.setToken(data.token);
    authService.setUser(data.user);
    await applyReferral(data.token);
    toast({ title: '✅ Вход выполнен!', description: `Добро пожаловать, ${data.user.full_name}!` });
    navigate('/');
  };

  const handleLogin = async () => {
    clearErrors();
    const errs: Record<string, string> = {};
    if (!validateEmail(email)) errs.email = 'Неверный email';
    if (!password) errs.password = 'Введите пароль';
    if (!agreedToTerms) { setTermsError(true); return; }
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    setLoading(true);
    try {
      const device_id = await getDeviceId();
      const res = await fetch(AUTH_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password, device_id }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        if (rememberMe) localStorage.setItem('savedEmail', email);
        else localStorage.removeItem('savedEmail');
        await afterLogin(data);
      } else {
        setFieldErrors({ password: data.error || 'Неверный email или пароль' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Не удалось выполнить вход' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    clearErrors();
    const errs: Record<string, string> = {};
    if (!validateEmail(email)) errs.email = 'Неверный email';
    if (password.length < 8) errs.password = 'Минимум 8 символов';
    if (passwordConfirm && passwordConfirm !== password) errs.passwordConfirm = 'Пароли не совпадают';
    if (!agreedToTerms) { setTermsError(true); return; }
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    setLoading(true);
    try {
      const device_id = await getDeviceId();
      const res = await fetch(AUTH_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', email, password, device_id }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        await afterLogin(data);
      } else {
        setFieldErrors({ email: data.error || 'Не удалось создать аккаунт' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Не удалось создать аккаунт' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    clearErrors();
    if (!validateEmail(email)) { setFieldErrors({ email: 'Неверный email' }); return; }
    if (password.length < 8) { setFieldErrors({ password: 'Минимум 8 символов' }); return; }

    setLoading(true);
    try {
      const res = await fetch(AUTH_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_password', email, new_password: password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        await afterLogin(data);
      } else if (res.ok && data.message) {
        toast({ title: 'Готово', description: data.message });
        setScreen('login');
      } else {
        setFieldErrors({ password: data.error || 'Не удалось сбросить пароль' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Не удалось сбросить пароль' });
    } finally {
      setLoading(false);
    }
  };

  const FieldError = ({ name }: { name: string }) =>
    fieldErrors[name] ? <p className="text-red-500 text-xs mt-1">{fieldErrors[name]}</p> : null;

  const PasswordInput = ({ placeholder, value, onChange, onEnter, fieldName }: {
    placeholder: string; value: string;
    onChange: (v: string) => void;
    onEnter?: () => void;
    fieldName: string;
  }) => (
    <div>
      <div className="relative">
        <Input
          type={showPassword ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onEnter?.()}
          autoComplete="current-password"
          className={`h-11 border-2 rounded-xl text-sm pr-10 ${fieldErrors[fieldName] ? 'border-red-400 focus:border-red-400' : 'border-gray-200 focus:border-purple-400'}`}
        />
        <button
          type="button"
          onClick={() => setShowPassword(p => !p)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <Icon name={showPassword ? 'EyeOff' : 'Eye'} size={16} />
        </button>
      </div>
      <FieldError name={fieldName} />
    </div>
  );

  const TermsBlock = () => (
    <div>
      <div className="flex items-start gap-2">
        <Checkbox
          id="terms"
          checked={agreedToTerms}
          onCheckedChange={c => { setAgreedToTerms(c as boolean); setTermsError(false); }}
          className="mt-0.5"
        />
        <label htmlFor="terms" className="text-xs text-gray-500 cursor-pointer leading-relaxed">
          Согласен(на) с{' '}
          <Link to="/terms" className="text-purple-600 hover:underline font-medium">условиями</Link>
          {' '}и{' '}
          <Link to="/privacy" className="text-purple-600 hover:underline font-medium">политикой</Link>
        </label>
      </div>
      {termsError && <p className="text-red-500 text-xs mt-1">Нужно согласиться с условиями и политикой</p>}
    </div>
  );

  const LegalFooter = ({ showDelete = false }: { showDelete?: boolean }) => (
    <div className="flex items-center justify-center gap-2 pb-4 pt-2">
      <Link to="/terms" className="text-white/35 text-xs hover:text-white/55 transition-colors">Соглашение</Link>
      <span className="text-white/25 text-xs">|</span>
      <Link to="/privacy" className="text-white/35 text-xs hover:text-white/55 transition-colors">Конфиденциальность</Link>
      {showDelete && <>
        <span className="text-white/25 text-xs">|</span>
        <Link to="/privacy#delete" className="text-white/25 text-xs hover:text-white/45 transition-colors">Удаление аккаунта</Link>
      </>}
    </div>
  );

  if (screen === 'demo') {
    const limitReached = demoCount >= DEMO_LIMIT;
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        {/* Шапка */}
        <div className="flex items-center gap-3 p-4 pt-6">
          <button onClick={() => setScreen('landing')} className="text-white/70 hover:text-white">
            <Icon name="ArrowLeft" size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
              <Icon name="GraduationCap" size={14} className="text-white" />
            </div>
            <span className="text-white font-semibold text-sm">Studyfay — демо</span>
          </div>
          <span className="ml-auto text-white/50 text-xs">{demoCount}/{DEMO_LIMIT} вопроса</span>
        </div>

        {/* Чат */}
        <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-3">
          {demoMessages.length === 0 && (
            <div className="flex flex-col gap-3 mt-4">
              <p className="text-white/70 text-sm text-center">Попробуй спросить что-нибудь:</p>
              {DEMO_HINTS.map(h => (
                <button
                  key={h}
                  onClick={() => sendDemo(h)}
                  className="bg-white/15 backdrop-blur rounded-2xl px-4 py-3 text-white text-sm text-left hover:bg-white/25 transition-colors"
                >
                  {h}
                </button>
              ))}
            </div>
          )}

          {demoMessages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-white text-purple-700 font-medium'
                  : 'bg-white/15 backdrop-blur text-white'
              }`}>
                {m.text}
              </div>
            </div>
          ))}

          {demoLoading && (
            <div className="flex justify-start">
              <div className="bg-white/15 backdrop-blur rounded-2xl px-4 py-3">
                <Icon name="Loader2" size={16} className="text-white animate-spin" />
              </div>
            </div>
          )}

          <div ref={demoBottomRef} />
        </div>

        {/* Мягкий стоп после лимита */}
        {limitReached && (
          <div className="mx-4 mb-3 bg-white rounded-3xl p-5 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-300">
            <h3 className="font-bold text-gray-800 text-base mb-1">Создайте аккаунт, чтобы продолжить</h3>
            <p className="text-gray-500 text-xs mb-4 leading-relaxed">
              С аккаунтом: сохранение истории, доступ каждый день, разбор файлов
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => setScreen('register')}
                className="w-full h-11 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl"
              >
                Создать аккаунт
              </Button>
              <Button
                variant="outline"
                onClick={() => setScreen('login')}
                className="w-full h-11 rounded-xl border-2 border-gray-200 text-gray-700 font-medium"
              >
                Войти
              </Button>
            </div>
          </div>
        )}

        {/* Ввод */}
        {!limitReached && (
          <div className="p-4 flex gap-2">
            <Input
              placeholder="Задай вопрос…"
              value={demoInput}
              onChange={e => setDemoInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendDemo()}
              disabled={demoLoading}
              className="flex-1 h-11 bg-white/15 backdrop-blur border-white/20 text-white placeholder:text-white/40 rounded-2xl focus:border-white/50"
            />
            <Button
              onClick={() => sendDemo()}
              disabled={!demoInput.trim() || demoLoading}
              className="h-11 w-11 bg-white text-purple-700 hover:bg-white/90 rounded-2xl flex-shrink-0 p-0"
            >
              <Icon name="Send" size={16} />
            </Button>
          </div>
        )}

        <LegalFooter />
      </div>
    );
  }

  if (screen === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 w-full max-w-sm flex flex-col gap-4">

          <button onClick={() => setScreen('landing')} className="flex items-center gap-1 text-white/70 hover:text-white text-sm self-start">
            <Icon name="ArrowLeft" size={16} /> Назад
          </button>

          <div className="bg-white rounded-3xl p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-800 mb-5">Вход в аккаунт</h2>
            <div className="space-y-3">
              <div>
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  autoCapitalize="none"
                  className={`h-11 border-2 rounded-xl text-sm ${fieldErrors.email ? 'border-red-400' : 'border-gray-200 focus:border-purple-400'}`}
                />
                <FieldError name="email" />
              </div>

              <div>
                <PasswordInput
                  placeholder="Пароль"
                  value={password}
                  onChange={setPassword}
                  onEnter={handleLogin}
                  fieldName="password"
                />
                <button
                  onClick={() => setScreen('forgot')}
                  className="text-xs text-purple-600 hover:underline mt-1 block text-right w-full"
                >
                  Забыли пароль?
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox id="remember" checked={rememberMe} onCheckedChange={c => setRememberMe(c as boolean)} />
                <label htmlFor="remember" className="text-xs text-gray-600 cursor-pointer">Запомнить меня</label>
              </div>

              <TermsBlock />

              <Button
                onClick={handleLogin}
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white font-semibold rounded-xl"
              >
                {loading ? <Icon name="Loader2" size={18} className="animate-spin" /> : 'Войти'}
              </Button>

              <p className="text-center text-xs text-gray-400">
                Нет аккаунта?{' '}
                <button onClick={() => { clearErrors(); setScreen('register'); }} className="text-purple-600 font-medium hover:underline">
                  Создать
                </button>
              </p>
            </div>
          </div>

          <LegalFooter />
        </div>
      </div>
    );
  }

  if (screen === 'register') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 w-full max-w-sm flex flex-col gap-4">

          <button onClick={() => setScreen('landing')} className="flex items-center gap-1 text-white/70 hover:text-white text-sm self-start">
            <Icon name="ArrowLeft" size={16} /> Назад
          </button>

          <div className="bg-white rounded-3xl p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-800 mb-5">Создать аккаунт</h2>
            <div className="space-y-3">
              <div>
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  autoCapitalize="none"
                  className={`h-11 border-2 rounded-xl text-sm ${fieldErrors.email ? 'border-red-400' : 'border-gray-200 focus:border-purple-400'}`}
                />
                <FieldError name="email" />
              </div>

              <PasswordInput
                placeholder="Пароль (минимум 8 символов)"
                value={password}
                onChange={setPassword}
                fieldName="password"
              />

              <div>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Повторите пароль"
                  value={passwordConfirm}
                  onChange={e => setPasswordConfirm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRegister()}
                  autoComplete="new-password"
                  className={`h-11 border-2 rounded-xl text-sm ${fieldErrors.passwordConfirm ? 'border-red-400' : 'border-gray-200 focus:border-purple-400'}`}
                />
                <FieldError name="passwordConfirm" />
              </div>

              <TermsBlock />

              <Button
                onClick={handleRegister}
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white font-semibold rounded-xl"
              >
                {loading ? <Icon name="Loader2" size={18} className="animate-spin" /> : 'Создать аккаунт'}
              </Button>

              <p className="text-center text-xs text-gray-400">
                Уже есть аккаунт?{' '}
                <button onClick={() => { clearErrors(); setScreen('login'); }} className="text-purple-600 font-medium hover:underline">
                  Войти
                </button>
              </p>
            </div>
          </div>

          <LegalFooter />
        </div>
      </div>
    );
  }

  if (screen === 'forgot') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 w-full max-w-sm flex flex-col gap-4">

          <button onClick={() => setScreen('login')} className="flex items-center gap-1 text-white/70 hover:text-white text-sm self-start">
            <Icon name="ArrowLeft" size={16} /> Назад к входу
          </button>

          <div className="bg-white rounded-3xl p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Сброс пароля</h2>
            <p className="text-xs text-gray-500 mb-5">Введите email и придумайте новый пароль</p>
            <div className="space-y-3">
              <div>
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  autoCapitalize="none"
                  className={`h-11 border-2 rounded-xl text-sm ${fieldErrors.email ? 'border-red-400' : 'border-gray-200 focus:border-purple-400'}`}
                />
                <FieldError name="email" />
              </div>
              <PasswordInput
                placeholder="Новый пароль (минимум 8 символов)"
                value={password}
                onChange={setPassword}
                onEnter={handleForgot}
                fieldName="password"
              />
              <Button
                onClick={handleForgot}
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90 text-white font-semibold rounded-xl"
              >
                {loading ? <Icon name="Loader2" size={18} className="animate-spin" /> : 'Сохранить новый пароль'}
              </Button>
            </div>
          </div>

          <LegalFooter />
        </div>
      </div>
    );
  }

  // Landing
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col items-center justify-center p-4 relative overflow-x-hidden">
      <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -right-16 w-96 h-96 bg-pink-400/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm flex flex-col gap-5">

        {/* Логотип */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center shadow-xl">
            <Icon name="GraduationCap" size={28} className="text-white" />
          </div>
          <span className="text-white/70 text-xs font-semibold tracking-widest uppercase">Studyfay</span>
        </div>

        {/* Ценность */}
        <div className="text-center">
          <h1 className="text-[2rem] font-extrabold text-white leading-tight tracking-tight mb-2">
            ИИ-репетитор для<br />экзаменов и учёбы
          </h1>
          <p className="text-white/70 text-sm leading-relaxed mb-2">
            ЕГЭ/ОГЭ и ВУЗ: объяснение тем,<br />задания и разбор PDF/Word
          </p>
          <p className="text-white/90 text-sm font-medium">
            Пойми тему за 2–3 минуты
          </p>
        </div>

        {/* 3 выгоды */}
        <div className="flex flex-col gap-2">
          {benefits.map(b => (
            <div key={b.text} className="flex items-center gap-3 bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3">
              <div className="w-8 h-8 bg-white/25 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon name={b.icon} size={15} className="text-white" />
              </div>
              <span className="text-white text-sm font-medium">{b.text}</span>
            </div>
          ))}
        </div>

        {/* Главная кнопка */}
        <div className="flex flex-col items-center gap-1.5">
          <Button
            onClick={async () => {
              setDemoStarting(true);
              await new Promise(r => setTimeout(r, 400));
              setDemoStarting(false);
              setScreen('demo');
            }}
            disabled={demoStarting}
            className="w-full h-14 bg-white text-purple-700 hover:bg-white/95 active:scale-[0.98] font-extrabold text-base rounded-2xl shadow-2xl transition-all"
          >
            {demoStarting
              ? <Icon name="Loader2" size={20} className="animate-spin text-purple-600" />
              : <>Начать бесплатно <Icon name="ArrowRight" size={18} className="ml-1.5" /></>
            }
          </Button>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-white/60 text-xs">1–2 вопроса без регистрации и карты</span>
            <span className="text-white/40 text-xs">Ответ за несколько секунд</span>
          </div>
        </div>

        {/* Вход / Регистрация — вторичные */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => { clearErrors(); setScreen('login'); }}
              className="text-white/70 text-sm hover:text-white transition-colors"
            >
              Уже есть аккаунт? <span className="font-semibold text-white underline underline-offset-2">Войти</span>
            </button>
            <span className="text-white/30 text-sm">·</span>
            <button
              onClick={() => { clearErrors(); setScreen('register'); }}
              className="text-white/70 text-sm hover:text-white transition-colors"
            >
              Нет аккаунта? <span className="font-semibold text-white underline underline-offset-2">Создать</span>
            </button>
          </div>
        </div>

        {/* Реферал */}
        {refCode && (
          <div className="bg-green-500/20 backdrop-blur border border-green-400/30 rounded-2xl p-3">
            <p className="text-white text-xs text-center">
              <Icon name="Gift" size={14} className="inline mr-1" />
              Вас пригласил друг — получите +5 бонусных вопросов к ИИ
            </p>
          </div>
        )}

        {/* Юридические ссылки */}
        <LegalFooter />
      </div>
    </div>
  );
}