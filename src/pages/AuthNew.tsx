import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/lib/auth';
import { API } from '@/lib/api-urls';
import { Device } from '@capacitor/device';

async function getDeviceId(): Promise<string> {
  try {
    const info = await Device.getId();
    return info.identifier || '';
  } catch {
    return '';
  }
}

async function getBrowserFingerprint(): Promise<string> {
  try {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.hardwareConcurrency?.toString() || '',
      (navigator as Navigator & { deviceMemory?: number }).deviceMemory?.toString() || '',
      navigator.platform || '',
    ];
    // Canvas fingerprint
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Studyfay🎓', 2, 2);
        components.push(canvas.toDataURL().slice(-32));
      }
    } catch (_e) { /* canvas not supported */ }
    const raw = components.join('|');
    // Simple hash
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  } catch {
    return '';
  }
}



const DEMO_LIMIT = 2;

const benefits = [
  { icon: 'Lightbulb', text: 'Объясню любую тему за 2 минуты' },
  { icon: 'Target', text: 'Подберу задания и проверю ответы' },
  { icon: 'FileText', text: 'Разберу PDF, фото задачи и конспекты' },
];

// Категории → чипы тем
const DEMO_CATEGORIES = [
  { icon: 'BookOpen', label: 'Объясни тему', topics: ['Производная', 'Логарифмы', 'Фотосинтез', 'Теорема Пифагора', 'Закон Ома'] },
  { icon: 'PenLine', label: 'Дай задание', topics: ['Задание по алгебре', 'Задание по физике', 'Задание по химии', 'Задание по биологии'] },
  { icon: 'Zap', label: 'Быстрый вопрос', topics: ['Что такое интеграл?', 'Чем ДНК отличается от РНК?', 'Что такое молярная масса?', 'Как найти площадь фигуры?'] },
];

// Follow-up кнопки — принимают тему последнего вопроса
const FOLLOWUP: { label: string; q: (topic: string) => string }[] = [
  { label: '🔹 Объясни проще', q: (t) => `Объясни "${t}" ещё проще — как для 5-классника, без терминов` },
  { label: '🔹 Дай похожее задание', q: (t) => `Дай одно задание по теме "${t}" уровня ЕГЭ, чтобы проверить понимание` },
  { label: '🔹 Разобрать глубже', q: (t) => `Разбери тему "${t}" глубже — что ещё важно знать, типичные ошибки и как это проверяют на ЕГЭ` },
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
  text: 'Привет! Я твой ИИ-репетитор. Объясню любую тему, дам задание и проверю ответ.\nПопробуй — выбери категорию 👇',
};

// --- Статичные компоненты ВНЕ AuthNew — не пересоздаются при каждом ренедере ---

const FieldError = ({ name, errors }: { name: string; errors: Record<string, string> }) =>
  errors[name] ? <p className="text-red-500 text-xs mt-1">{errors[name]}</p> : null;

const PasswordInput = ({
  placeholder, value, onChange, onEnter, fieldName, errors, showPassword, onToggleShow,
}: {
  placeholder: string; value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  fieldName: string;
  errors: Record<string, string>;
  showPassword: boolean;
  onToggleShow: () => void;
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
        className={`h-11 border-2 rounded-xl text-sm pr-10 ${errors[fieldName] ? 'border-red-400 focus:border-red-400' : 'border-gray-200 focus:border-purple-400'}`}
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        <Icon name={showPassword ? 'EyeOff' : 'Eye'} size={16} />
      </button>
    </div>
    <FieldError name={fieldName} errors={errors} />
  </div>
);

const TermsBlock = ({
  agreed, onToggle, error,
}: {
  agreed: boolean; onToggle: (v: boolean) => void; error: boolean;
}) => (
  <div>
    <label htmlFor="terms" className="flex items-start gap-3 cursor-pointer group">
      <Checkbox
        id="terms"
        checked={agreed}
        onCheckedChange={c => onToggle(c as boolean)}
        className="mt-0.5 w-5 h-5 flex-shrink-0 rounded-md border-2 border-gray-300 group-hover:border-purple-400 transition-colors"
      />
      <span className="text-xs text-gray-500 leading-relaxed pt-0.5">
        Согласен(на) с{' '}
        <Link to="/terms" className="text-purple-600 hover:underline font-medium" onClick={e => e.stopPropagation()}>условиями</Link>
        {' '}и{' '}
        <Link to="/privacy" className="text-purple-600 hover:underline font-medium" onClick={e => e.stopPropagation()}>политикой</Link>
      </span>
    </label>
    {error && <p className="text-red-500 text-xs mt-1">Нужно согласиться с условиями и политикой</p>}
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

export default function AuthNew() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref') || '';
  if (refCode) {
    localStorage.setItem('pendingReferral', refCode);
  }

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
  const [typingText, setTypingText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const demoBottomRef = useRef<HTMLDivElement>(null);
  const thinkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vkLoading, setVkLoading] = useState(false);
  const [regFieldFocused, setRegFieldFocused] = useState(false);
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

  const typeAnswer = (fullText: string, onDone: () => void) => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    setIsTyping(true);
    setTypingText('');
    let i = 0;
    // ~18ms на символ = ~55 символов/сек — живая скорость
    typingTimerRef.current = setInterval(() => {
      i++;
      setTypingText(fullText.slice(0, i));
      demoBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      if (i >= fullText.length) {
        clearInterval(typingTimerRef.current!);
        setIsTyping(false);
        setTypingText('');
        onDone();
      }
    }, 18);
  };

  const sendDemo = async (text?: string) => {
    const q = (text || demoInput).trim();
    if (!q || demoLoading || isTyping) return;
    setDemoInput('');
    setDemoStage('chat');
    setSelectedCategory(null);
    const newCount = demoCount + 1;
    setDemoCount(newCount);
    setDemoMessages(prev => [...prev, { role: 'user', text: q }]);
    setDemoLoading(true);
    setThinkingStep(0);

    // Крутим шаги мышления каждые 2.5 сек
    thinkingTimerRef.current = setInterval(() => {
      setThinkingStep(s => Math.min(s + 1, THINKING_STEPS.length - 1));
    }, 2500);

    const historySnap = demoMessages
      .filter(m => m.text)
      .slice(-4)
      .map(m => ({ role: m.role, content: m.text }));

    // Автоповтор до 3 раз — ответ должен прийти всегда
    let raw = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(API.AI_ASSISTANT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'demo_ask', question: q, history: historySnap }),
        });
        const data = await res.json();
        const candidate = sanitizeText(data.answer || data.response || data.message || '');
        if (candidate) { raw = candidate; break; }
      } catch {
        // сеть упала — пробуем ещё раз
      }
      if (attempt < 3) await new Promise(r => setTimeout(r, 1500));
    }

    // Если все 3 попытки без ответа — показываем нейтральный текст
    if (!raw) {
      raw = 'Секунду, сервер перегружен. Попробуй задать вопрос ещё раз 🔄';
      setDemoCount(c => c - 1); // не тратим попытку
    }

    if (thinkingTimerRef.current) clearInterval(thinkingTimerRef.current);
    setDemoLoading(false);
    setThinkingStep(0);
    setDemoMessages(prev => [...prev, { role: 'assistant', text: '' }]);
    typeAnswer(raw, () => {
      setDemoMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', text: raw };
        return copy;
      });
    });
  };

  const applyReferral = async (token: string) => {
    const pending = localStorage.getItem('pendingReferral');
    if (!pending) return;
    localStorage.removeItem('pendingReferral');
    try {
      await fetch(API.SUBSCRIPTION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'use_referral', referral_code: pending.toUpperCase() }),
      });
    } catch { /* silent */ }
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
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    setLoading(true);
    try {
      const device_id = await getDeviceId();
      const res = await fetch(API.AUTH, {
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
    if (!agreedToTerms) { setTermsError(true); return; }
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    setLoading(true);
    try {
      const [device_id, browser_fp] = await Promise.all([getDeviceId(), getBrowserFingerprint()]);
      // Бэкенд использует action 'login' — если email новый, создаёт аккаунт автоматически
      const res = await fetch(API.AUTH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password, device_id, browser_fp }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        if (data.is_new_user && data.trial_available === false) {
          authService.setToken(data.token);
          authService.setUser(data.user);
          await applyReferral(data.token);
          toast({ title: 'Аккаунт создан!', description: 'Добро пожаловать! У вас бесплатный тариф — 3 вопроса к ИИ в день.' });
          navigate('/');
        } else {
          await afterLogin(data);
        }
      } else {
        setFieldErrors({ email: data.error || 'Не удалось создать аккаунт' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Не удалось создать аккаунт' });
    } finally {
      setLoading(false);
    }
  };

  const handleVKLogin = async () => {
    setVkLoading(true);
    try {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const codeVerifier = Array.from(array, b => b.toString(36).padStart(2, '0')).join('').slice(0, 64);
      const state = Math.random().toString(36).slice(2, 15);

      localStorage.setItem('vk_code_verifier', codeVerifier);
      localStorage.setItem('vk_state', state);

      const res = await fetch(API.VK_AUTH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_auth_url',
          code_verifier: codeVerifier,
          state: state,
        })
      });
      const data = await res.json();
      if (data.auth_url) {
        window.location.href = data.auth_url;
      } else {
        toast({ variant: 'destructive', title: 'Ошибка', description: data.error || 'Не удалось получить ссылку VK' });
        setVkLoading(false);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Не удалось подключиться к VK' });
      setVkLoading(false);
    }
  };

  const handleForgot = async () => {
    clearErrors();
    if (!validateEmail(email)) { setFieldErrors({ email: 'Неверный email' }); return; }
    if (password.length < 8) { setFieldErrors({ password: 'Минимум 8 символов' }); return; }

    setLoading(true);
    try {
      const res = await fetch(API.AUTH, {
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
            const isBeingTyped = isLastAssistant && isTyping;
            const displayText = isBeingTyped ? typingText : m.text;
            const showFollowupHere = isLastAssistant && !demoLoading && !isTyping && !limitReached && m.text;
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
                    {displayText}
                    {isBeingTyped && (
                      <span className="inline-block w-0.5 h-4 bg-white/70 ml-0.5 animate-pulse align-middle" />
                    )}
                    {i === 0 && (
                      <p className="text-white/40 text-xs mt-1.5 flex items-center gap-1">
                        <Icon name="Zap" size={11} />
                        Ответ обычно за 30–60 секунд
                      </p>
                    )}
                  </div>
                </div>
                {/* Follow-up под каждым последним ответом ИИ */}
                {showFollowupHere && (() => {
                  // Берём последний вопрос пользователя как тему
                  const lastUserMsg = [...demoMessages].reverse().find(msg => msg.role === 'user');
                  const topic = lastUserMsg?.text?.slice(0, 80) || 'этой теме';
                  return (
                    <div className="flex flex-wrap gap-2 mt-2 ml-9 animate-in fade-in duration-300">
                      {FOLLOWUP.map(f => (
                        <button
                          key={f.label}
                          onClick={() => sendDemo(f.q(topic))}
                          className="bg-white/15 border border-white/25 rounded-full px-3 py-1.5 text-white text-xs font-medium hover:bg-white/25 active:scale-95 transition-all"
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  );
                })()}
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
                <h3 className="font-bold text-gray-800 text-base">Тебе понравилось?</h3>
                <p className="text-gray-400 text-xs">Создай аккаунт и продолжи бесплатно</p>
              </div>
            </div>
            <div className="space-y-1.5 mb-4 pl-1">
              {['Бесплатный доступ к ИИ-репетитору', 'Вся история диалогов сохранится', 'Безлимитные вопросы при регистрации'].map(t => (
                <p key={t} className="text-gray-500 text-xs flex items-center gap-1.5">
                  <span className="text-green-500">✓</span> {t}
                </p>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => setScreen('register')}
                className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base rounded-xl shadow-[0_6px_24px_rgba(99,102,241,0.45)] hover:opacity-95 active:scale-[0.98] transition-all"
              >
                Создать аккаунт
              </Button>
              <p className="text-center text-gray-400 text-xs">Без карты. Отменять нечего.</p>
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
            <h2 className="text-2xl font-extrabold text-gray-800 mb-5">Войти</h2>
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
                <FieldError name="email" errors={fieldErrors} />
              </div>

              <div>
                <PasswordInput
                  placeholder="Пароль"
                  value={password}
                  onChange={setPassword}
                  onEnter={handleLogin}
                  fieldName="password"
                  errors={fieldErrors}
                  showPassword={showPassword}
                  onToggleShow={() => setShowPassword(p => !p)}
                />
                <button
                  onClick={() => setScreen('forgot')}
                  className="text-xs text-purple-500 hover:underline mt-1 block text-right w-full"
                >
                  Забыли пароль?
                </button>
              </div>

              {/* Запомнить — второстепенный, без доминирования */}
              <label htmlFor="remember" className="flex items-center gap-2 cursor-pointer w-fit">
                <Checkbox id="remember" checked={rememberMe} onCheckedChange={c => setRememberMe(c as boolean)} className="w-4 h-4" />
                <span className="text-xs text-gray-400">Запомнить меня</span>
              </label>

              {/* TermsBlock убран — пользователь уже соглашался при регистрации */}

              <Button
                onClick={handleLogin}
                disabled={loading}
                className="w-full h-[52px] bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 active:scale-[0.98] text-white font-bold text-base rounded-xl shadow-[0_6px_20px_rgba(99,102,241,0.4)] transition-all"
              >
                {loading ? <Icon name="Loader2" size={18} className="animate-spin" /> : 'Войти'}
              </Button>

              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-gray-400 text-xs">или</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <Button
                onClick={handleVKLogin}
                disabled={vkLoading || loading}
                variant="outline"
                className="w-full h-11 rounded-xl border-2 border-[#0077FF]/30 text-[#0077FF] font-semibold hover:bg-[#0077FF]/5 active:scale-[0.98] transition-all"
              >
                {vkLoading ? (
                  <Icon name="Loader2" size={18} className="animate-spin" />
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="mr-2"><path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.587-1.496c.598-.188 1.368 1.259 2.184 1.814.616.42 1.084.328 1.084.328l2.178-.03s1.14-.07.6-.964c-.045-.073-.32-.661-1.644-1.868-1.386-1.263-1.2-1.058.468-3.243.834-1.09 1.17-1.754 1.065-2.039-.1-.27-.713-.198-.713-.198l-2.456.015s-.182-.025-.317.056c-.132.079-.217.263-.217.263s-.39 1.038-.91 1.92c-1.098 1.862-1.538 1.96-1.717 1.843-.418-.272-.313-1.092-.313-1.674 0-1.82.276-2.58-.537-2.776-.27-.065-.468-.108-1.155-.115-.882-.009-1.628.003-2.05.209-.282.138-.5.443-.367.46.164.022.535.1.731.367.253.344.244 1.117.244 1.117s.146 2.143-.34 2.408c-.334.182-.792-.19-1.774-1.893-.503-.872-.883-1.836-.883-1.836s-.073-.18-.204-.276c-.158-.117-.38-.154-.38-.154l-2.335.015s-.35.01-.479.163c-.114.135-.009.414-.009.414s1.838 4.3 3.919 6.464c1.907 1.984 4.073 1.854 4.073 1.854h.982z"/></svg>
                    Войти через VK
                  </>
                )}
              </Button>

              <p className="text-center text-xs text-gray-400">Быстро и бесплатно</p>

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

          <button onClick={() => setScreen(demoCount > 0 ? 'demo' : 'landing')} className="flex items-center gap-1 text-white/70 hover:text-white text-sm self-start">
            <Icon name="ArrowLeft" size={16} /> Назад
          </button>

          <div className="bg-white rounded-3xl p-6 shadow-2xl">
            {/* Заголовок с контекстом */}
            <div className="mb-5">
              <h2 className="text-2xl font-extrabold text-gray-800 mb-1">Создай аккаунт за 10 сек</h2>
              <div className="flex flex-col gap-1">
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <span className="text-green-500">✓</span> Бесплатный доступ к ИИ-репетитору
                </p>
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <span className="text-green-500">✓</span> Вся история диалогов сохранится
                </p>
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <span className="text-green-500">✓</span> Без карты, без подписки
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Email */}
              <div>
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setRegFieldFocused(true)}
                  onBlur={() => setRegFieldFocused(false)}
                  autoComplete="email"
                  autoCapitalize="none"
                  className={`h-11 border-2 rounded-xl text-sm ${fieldErrors.email ? 'border-red-400' : 'border-gray-200 focus:border-purple-400'}`}
                />
                <FieldError name="email" errors={fieldErrors} />
              </div>

              {/* Пароль — без повтора, с показом */}
              <div onFocus={() => setRegFieldFocused(true)} onBlur={() => setRegFieldFocused(false)}>
                <PasswordInput
                  placeholder="Придумай пароль"
                  value={password}
                  onChange={setPassword}
                  onEnter={handleRegister}
                  fieldName="password"
                  errors={fieldErrors}
                  showPassword={showPassword}
                  onToggleShow={() => setShowPassword(p => !p)}
                />
                {password.length > 0 && password.length < 8 && (
                  <p className="text-xs text-amber-500 mt-1">Минимум 8 символов</p>
                )}
                {password.length >= 8 && (
                  <p className="text-xs text-green-500 mt-1">✓ Хороший пароль</p>
                )}
              </div>

              {/* Чекбокс */}
              <TermsBlock agreed={agreedToTerms} onToggle={v => { setAgreedToTerms(v); setTermsError(false); }} error={termsError} />

              {/* Главная кнопка — подсвечивается при фокусе в полях */}
              <Button
                onClick={handleRegister}
                disabled={loading}
                className={`w-full h-[52px] bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 active:scale-[0.98] text-white font-bold text-base rounded-xl transition-all duration-300 ${
                  regFieldFocused
                    ? 'shadow-[0_8px_28px_rgba(99,102,241,0.6)] scale-[1.01]'
                    : 'shadow-[0_4px_16px_rgba(99,102,241,0.35)]'
                }`}
              >
                {loading
                  ? <Icon name="Loader2" size={18} className="animate-spin" />
                  : <>Создать и продолжить <Icon name="ArrowRight" size={16} className="ml-1.5" /></>
                }
              </Button>

              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-gray-400 text-xs">или</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <Button
                onClick={handleVKLogin}
                disabled={vkLoading || loading}
                variant="outline"
                className="w-full h-11 rounded-xl border-2 border-[#0077FF]/30 text-[#0077FF] font-semibold hover:bg-[#0077FF]/5 active:scale-[0.98] transition-all"
              >
                {vkLoading ? (
                  <Icon name="Loader2" size={18} className="animate-spin" />
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="mr-2"><path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.587-1.496c.598-.188 1.368 1.259 2.184 1.814.616.42 1.084.328 1.084.328l2.178-.03s1.14-.07.6-.964c-.045-.073-.32-.661-1.644-1.868-1.386-1.263-1.2-1.058.468-3.243.834-1.09 1.17-1.754 1.065-2.039-.1-.27-.713-.198-.713-.198l-2.456.015s-.182-.025-.317.056c-.132.079-.217.263-.217.263s-.39 1.038-.91 1.92c-1.098 1.862-1.538 1.96-1.717 1.843-.418-.272-.313-1.092-.313-1.674 0-1.82.276-2.58-.537-2.776-.27-.065-.468-.108-1.155-.115-.882-.009-1.628.003-2.05.209-.282.138-.5.443-.367.46.164.022.535.1.731.367.253.344.244 1.117.244 1.117s.146 2.143-.34 2.408c-.334.182-.792-.19-1.774-1.893-.503-.872-.883-1.836-.883-1.836s-.073-.18-.204-.276c-.158-.117-.38-.154-.38-.154l-2.335.015s-.35.01-.479.163c-.114.135-.009.414-.009.414s1.838 4.3 3.919 6.464c1.907 1.984 4.073 1.854 4.073 1.854h.982z"/></svg>
                    Войти через VK
                  </>
                )}
              </Button>

              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-2.5 flex items-center gap-2 border border-emerald-200">
                <span className="text-base">🎁</span>
                <p className="text-xs text-emerald-700 font-medium">Бесплатный Premium при регистрации</p>
              </div>

              <p className="text-center text-xs text-gray-400">Без карты. Отмена не нужна.</p>

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
                <FieldError name="email" errors={fieldErrors} />
              </div>
              <PasswordInput
                placeholder="Новый пароль (минимум 8 символов)"
                value={password}
                onChange={setPassword}
                onEnter={handleForgot}
                fieldName="password"
                errors={fieldErrors}
                showPassword={showPassword}
                onToggleShow={() => setShowPassword(p => !p)}
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

        {/* Ломоносов */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white/25 shadow-2xl">
              <img
                src="https://cdn.poehali.dev/projects/3ff43efa-4f20-46c2-b4c7-d9b10642fd31/files/ef592987-60a8-4d25-bd1c-5df290ab0020.jpg"
                alt="Ломоносов"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
              <span className="text-lg">🎓</span>
            </div>
          </div>
        </div>

        {/* Ценность */}
        <div className="text-center">
          <h1 className="text-[2rem] font-extrabold text-white leading-tight tracking-tight mb-2">
            Сдай экзамен<br />на высший балл
          </h1>
          <p className="text-white/70 text-sm leading-relaxed mb-2">
            ИИ-репетитор для ЕГЭ, ОГЭ и учёбы в вузе.<br />Объяснит тему, даст задание, разберёт ошибки.
          </p>
          <p className="text-white/90 text-sm font-medium">
            Уже помогает 12 000+ учеников по всей России
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
        <div className="flex flex-col items-center gap-2">
          <p className="text-white/55 text-xs tracking-wide">Бесплатно. ЕГЭ, ОГЭ и ВУЗ</p>
          <Button
            onClick={async () => {
              setDemoStarting(true);
              await new Promise(r => setTimeout(r, 400));
              setDemoStarting(false);
              setScreen('demo');
            }}
            disabled={demoStarting}
            className="w-full h-[60px] bg-white text-purple-700 hover:bg-white/95 active:scale-[0.98] font-extrabold text-[1.05rem] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.25)] transition-all duration-200 animate-in fade-in zoom-in-95"
          >
            {demoStarting
              ? <Icon name="Loader2" size={22} className="animate-spin text-purple-600" />
              : <>Попробовать — бесплатно <Icon name="ArrowRight" size={20} className="ml-1.5" /></>
            }
          </Button>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-white/60 text-xs">🎁 3 дня Premium в подарок при регистрации</span>
            <span className="text-white/40 text-xs">Без карты. Отмена не нужна.</span>
          </div>
        </div>

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