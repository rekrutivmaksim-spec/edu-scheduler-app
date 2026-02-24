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

// Категории → чипы тем
const DEMO_CATEGORIES = [
  { icon: 'BookOpen', label: 'Объясни тему', topics: ['Производная', 'Логарифмы', 'Фотосинтез', 'Теорема Пифагора', 'Закон Ома'] },
  { icon: 'PenLine', label: 'Дай задание', topics: ['Задание по алгебре', 'Задание по физике', 'Задание по химии', 'Задание по биологии'] },
  { icon: 'Zap', label: 'Быстрый вопрос', topics: ['Что такое интеграл?', 'Чем ДНК отличается от РНК?', 'Что такое молярная масса?', 'Как найти площадь фигуры?'] },
];

// Follow-up кнопки под каждым ответом ИИ
const FOLLOWUP = [
  { label: 'Объясни проще', q: 'Объясни то же самое ещё проще, как для 5-классника' },
  { label: 'Дай задание', q: 'Дай мне короткое задание по этой теме чтобы проверить понимание' },
  { label: 'Следующий вопрос', q: 'Что ещё важно знать по этой теме? Объясни следующий шаг.' },
];

// Очистка markdown и иероглифов из ответов ИИ
function sanitizeText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold**
    .replace(/\*(.+?)\*/g, '$1')        // *italic*
    .replace(/__(.+?)__/g, '$1')        // __bold__
    .replace(/_(.+?)_/g, '$1')          // _italic_
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1') // `code`
    .replace(/#{1,6}\s/g, '')           // ## headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [link](url)
    .replace(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, '') // CJK иероглифы
    .replace(/\n{3,}/g, '\n\n')         // лишние переносы
    .trim();
}

type Screen = 'landing' | 'demo' | 'login' | 'register' | 'forgot';
type DemoStage = 'greeting' | 'topics' | 'chat';

interface DemoMessage {
  role: 'user' | 'assistant';
  text: string;
}

const GREETING: DemoMessage = {
  role: 'assistant',
  text: 'Привет! Я помогу объяснить тему, разобрать задание или ответить по материалу.\nВыбери с чего начать 👇',
};

export default function AuthNew() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref') || '';

  const [screen, setScreen] = useState<Screen>('landing');
  const [demoStarting, setDemoStarting] = useState(false);

  // Demo state
  const [demoMessages, setDemoMessages] = useState<DemoMessage[]>([GREETING]);
  const [demoInput, setDemoInput] = useState('');
  const [demoCount, setDemoCount] = useState(0);
  const [demoLoading, setDemoLoading] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [demoStage, setDemoStage] = useState<DemoStage>('greeting');
  const [selectedCategory, setSelectedCategory] = useState<typeof DEMO_CATEGORIES[0] | null>(null);
  const demoBottomRef = useRef<HTMLDivElement>(null);
  const thinkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const THINKING_STEPS = [
    'Анализирую вопрос…',
    'Подбираю объяснение…',
    'Добавляю пример…',
    'Формирую ответ…',
    'Почти готово…',
  ];

  const sendDemo = async (text?: string) => {
    const q = (text || demoInput).trim();
    if (!q || demoLoading) return;
    setDemoInput('');
    setDemoStage('chat');
    setSelectedCategory(null);
    const newCount = demoCount + 1;
    setDemoCount(newCount);
    setDemoMessages(prev => [...prev, { role: 'user', text: q }]);
    setDemoLoading(true);
    setThinkingStep(0);

    // Крутим шаги мышления каждые 4 сек
    thinkingTimerRef.current = setInterval(() => {
      setThinkingStep(s => Math.min(s + 1, THINKING_STEPS.length - 1));
    }, 4000);

    try {
      const res = await fetch(AI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'demo_ask', question: q }),
      });
      const data = await res.json();
      const raw = data.answer || data.response || data.message || 'Не удалось получить ответ';
      setDemoMessages(prev => [...prev, { role: 'assistant', text: sanitizeText(raw) }]);
    } catch {
      setDemoMessages(prev => [...prev, { role: 'assistant', text: 'Проблемы с соединением — попробуй ещё раз.' }]);
      setDemoCount(c => c - 1);
    } finally {
      if (thinkingTimerRef.current) clearInterval(thinkingTimerRef.current);
      setDemoLoading(false);
      setThinkingStep(0);
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
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col relative overflow-x-hidden">
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        {/* Шапка — с отступом под статусбар */}
        <div className="flex items-center gap-3 px-4 pb-3" style={{ paddingTop: 'max(24px, env(safe-area-inset-top, 24px))' }}>
          <button onClick={() => setScreen('landing')} className="text-white/70 hover:text-white transition-colors p-1 -ml-1">
            <Icon name="ArrowLeft" size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
              <Icon name="GraduationCap" size={14} className="text-white" />
            </div>
            <span className="text-white font-semibold text-sm">Studyfay</span>
            <span className="text-white/40 text-xs">демо</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="flex gap-1">
              {Array.from({ length: DEMO_LIMIT }).map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-all ${i < demoCount ? 'bg-white' : 'bg-white/25'}`} />
              ))}
            </div>
            <span className="text-white/40 text-xs">{Math.max(0, DEMO_LIMIT - demoCount)} осталось</span>
          </div>
        </div>

        {/* Чат */}
        <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-3">

          {/* Сообщения */}
          {demoMessages.map((m, i) => {
            const isLastAssistant = m.role === 'assistant' && i === demoMessages.length - 1 && i > 0;
            const showFollowupHere = isLastAssistant && !demoLoading && !limitReached;
            return (
              <div key={i}>
                <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                      <Icon name="GraduationCap" size={13} className="text-white" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
                    m.role === 'user'
                      ? 'bg-white text-purple-700 font-medium rounded-br-sm'
                      : 'bg-white/15 backdrop-blur text-white rounded-bl-sm'
                  }`}>
                    {m.text}
                    {i === 0 && (
                      <p className="text-white/40 text-xs mt-1.5 flex items-center gap-1">
                        <Icon name="Zap" size={11} />
                        Ответ обычно за 20–60 секунд
                      </p>
                    )}
                  </div>
                </div>
                {/* Follow-up под каждым последним ответом ИИ */}
                {showFollowupHere && (
                  <div className="flex flex-wrap gap-2 mt-2 ml-9 animate-in fade-in duration-300">
                    {FOLLOWUP.map(f => (
                      <button
                        key={f.label}
                        onClick={() => sendDemo(f.q)}
                        className="bg-white/15 border border-white/25 rounded-full px-3 py-1.5 text-white text-xs font-medium hover:bg-white/25 active:scale-95 transition-all"
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* СТАДИЯ 1: Выбор категории */}
          {demoStage === 'greeting' && (
            <div className="flex flex-col gap-2 mt-1 animate-in fade-in duration-300">
              {DEMO_CATEGORIES.map(cat => (
                <button
                  key={cat.label}
                  onClick={() => { setDemoStage('topics'); setSelectedCategory(cat); }}
                  className="flex items-center gap-3 bg-white/12 backdrop-blur border border-white/15 rounded-2xl px-4 py-3 text-left hover:bg-white/20 active:scale-[0.98] transition-all"
                >
                  <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon name={cat.icon} size={15} className="text-white" />
                  </div>
                  <span className="text-white text-sm font-medium">{cat.label}</span>
                  <Icon name="ChevronRight" size={14} className="text-white/40 ml-auto" />
                </button>
              ))}
            </div>
          )}

          {/* СТАДИЯ 2: Чипы тем */}
          {demoStage === 'topics' && selectedCategory && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
              <button
                onClick={() => { setDemoStage('greeting'); setSelectedCategory(null); }}
                className="flex items-center gap-1 text-white/60 text-xs mb-3 hover:text-white"
              >
                <Icon name="ArrowLeft" size={12} /> Назад
              </button>
              <p className="text-white/70 text-xs mb-2">Выбери тему:</p>
              <div className="flex flex-wrap gap-2">
                {selectedCategory.topics.map(topic => (
                  <button
                    key={topic}
                    onClick={() => sendDemo(
                      selectedCategory.label === 'Объясни тему'
                        ? `Объясни простыми словами: ${topic}`
                        : selectedCategory.label === 'Дай задание'
                        ? `Дай мне одно ${topic} уровня ЕГЭ`
                        : topic
                    )}
                    className="bg-white/15 backdrop-blur border border-white/20 rounded-full px-3 py-1.5 text-white text-sm hover:bg-white/25 active:scale-95 transition-all"
                  >
                    {topic}
                  </button>
                ))}
                <button
                  onClick={() => { setDemoStage('chat'); setSelectedCategory(null); }}
                  className="bg-white/8 border border-white/15 rounded-full px-3 py-1.5 text-white/60 text-sm hover:bg-white/15 transition-all"
                >
                  Свой вопрос ✏️
                </button>
              </div>
            </div>
          )}

          {/* Лоадер с шагами мышления */}
          {demoLoading && (
            <div className="flex justify-start animate-in fade-in duration-200">
              <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                <Icon name="GraduationCap" size={13} className="text-white" />
              </div>
              <div className="bg-white/15 backdrop-blur rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <p className="text-white/70 text-xs transition-all duration-500">
                  {THINKING_STEPS[thinkingStep]}
                </p>
                <p className="text-white/35 text-xs mt-0.5">Ответ может занять до минуты</p>
              </div>
            </div>
          )}

          <div ref={demoBottomRef} />
        </div>

        {/* Мягкий стоп — НЕ paywall */}
        {limitReached && (
          <div className="mx-4 mb-3 bg-white rounded-3xl p-5 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Icon name="GraduationCap" size={18} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-sm">Продолжить бесплатно</h3>
                <p className="text-gray-400 text-xs">можно после регистрации</p>
              </div>
            </div>
            <div className="space-y-1.5 mb-4 pl-1">
              {['История диалога сохранится', 'Доступ каждый день', 'Регистрация займёт 10 секунд'].map(t => (
                <p key={t} className="text-gray-500 text-xs flex items-center gap-1.5">
                  <span className="text-green-500">✓</span> {t}
                </p>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => setScreen('register')}
                className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl"
              >
                Создать аккаунт
              </Button>
              <Button
                variant="outline"
                onClick={() => setScreen('login')}
                className="w-full h-11 rounded-xl border-2 border-gray-200 text-gray-600 font-medium"
              >
                Уже есть аккаунт — войти
              </Button>
            </div>
          </div>
        )}

        {/* Ввод — всегда в стадии chat */}
        {!limitReached && demoStage === 'chat' && (
          <div className="px-3 pt-2 flex gap-2" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}>
            <Input
              placeholder="Напиши свой вопрос…"
              value={demoInput}
              onChange={e => setDemoInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendDemo()}
              disabled={demoLoading}
              className="flex-1 h-12 bg-white/15 backdrop-blur border border-white/20 text-white placeholder:text-white/40 rounded-2xl focus:border-white/50 text-sm"
            />
            <Button
              onClick={() => sendDemo()}
              disabled={!demoInput.trim() || demoLoading}
              className="h-12 w-12 bg-white text-purple-700 hover:bg-white/90 rounded-2xl flex-shrink-0 p-0 disabled:opacity-40"
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col items-center relative overflow-x-hidden overflow-y-auto">
      <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -right-16 w-96 h-96 bg-pink-400/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm flex flex-col gap-4 px-4 py-8 min-h-screen justify-center">

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
            <span className="text-white/40 text-xs">Ответ обычно за 20–60 секунд</span>
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