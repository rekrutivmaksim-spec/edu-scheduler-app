import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/lib/auth';
import { API } from '@/lib/api-urls';
import { am } from '@/lib/appmetrica';
import { Device } from '@capacitor/device';
import FoxMascot from '@/components/FoxMascot';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

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
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  } catch {
    return '';
  }
}

function sanitizeText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Роли пользователя
const USER_ROLES = [
  { id: 'oge', emoji: '📚', label: 'Готовлюсь к ОГЭ', sublabel: '8–9 класс', percent: 71, groupLabel: 'учеников 9 класса' },
  { id: 'ege', emoji: '🎯', label: 'Готовлюсь к ЕГЭ', sublabel: '10–11 класс', percent: 68, groupLabel: 'учеников 11 класса' },
  { id: 'university', emoji: '🎓', label: 'Учусь в университете', sublabel: 'Студент', percent: 74, groupLabel: 'студентов твоего курса' },
] as const;

type UserRoleId = typeof USER_ROLES[number]['id'];

// Предметы для первого урока
const LESSON_SUBJECTS = [
  { id: 'math', emoji: '📐', label: 'Математика', topic: 'Что такое производная и зачем она нужна', question: 'Скорость машины — это производная от...', answers: ['расстояния по времени', 'времени по расстоянию', 'ускорения по времени'], correct: 0 },
  { id: 'russian', emoji: '📝', label: 'Русский язык', topic: 'Как не путать -н- и -нн- в прилагательных', question: 'В слове "деревянный" пишется -нн- потому что...', answers: ['суффикс -янн-', 'слово образовано от существительного с основой на -н-', 'это исключение'], correct: 1 },
  { id: 'physics', emoji: '⚡', label: 'Физика', topic: 'Закон Ома: почему чайник греет воду', question: 'Если сопротивление увеличить в 2 раза, ток...', answers: ['увеличится в 2 раза', 'уменьшится в 2 раза', 'не изменится'], correct: 1 },
  { id: 'history', emoji: '🏛️', label: 'История', topic: 'Почему Пётр I построил Петербург именно там', question: 'Северная война завершилась в...', answers: ['1700 году', '1709 году', '1721 году'], correct: 2 },
  { id: 'english', emoji: '🇬🇧', label: 'Английский', topic: 'Present Perfect vs Past Simple: раз и навсегда', question: 'Какое предложение правильное?', answers: ['I have seen him yesterday', 'I saw him yesterday', 'I did see him yesterday'], correct: 1 },
  { id: 'chemistry', emoji: '🧪', label: 'Химия', topic: 'Что такое валентность и как её определить', question: 'Валентность кислорода в большинстве соединений равна...', answers: ['I', 'II', 'III'], correct: 1 },
];

const THINKING_STEPS = [
  'Анализирую тему…',
  'Подбираю объяснение…',
  'Формирую урок…',
  'Почти готово…',
];

type Screen = 'landing' | 'role' | 'lesson' | 'hook' | 'login' | 'register' | 'forgot';
type LessonStage = 'pick' | 'explain' | 'question' | 'result';

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

const VKButton = ({ onClick, loading, disabled }: { onClick: () => void; loading: boolean; disabled: boolean }) => (
  <Button
    onClick={onClick}
    disabled={loading || disabled}
    variant="outline"
    className="w-full h-11 rounded-xl border-2 border-[#0077FF]/30 text-[#0077FF] font-semibold hover:bg-[#0077FF]/5 active:scale-[0.98] transition-all"
  >
    {loading ? (
      <Icon name="Loader2" size={18} className="animate-spin" />
    ) : (
      <>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="mr-2"><path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.587-1.496c.598-.188 1.368 1.259 2.184 1.814.616.42 1.084.328 1.084.328l2.178-.03s1.14-.07.6-.964c-.045-.073-.32-.661-1.644-1.868-1.386-1.263-1.2-1.058.468-3.243.834-1.09 1.17-1.754 1.065-2.039-.1-.27-.713-.198-.713-.198l-2.456.015s-.182-.025-.317.056c-.132.079-.217.263-.217.263s-.39 1.038-.91 1.92c-1.098 1.862-1.538 1.96-1.717 1.843-.418-.272-.313-1.092-.313-1.674 0-1.82.276-2.58-.537-2.776-.27-.065-.468-.108-1.155-.115-.882-.009-1.628.003-2.05.209-.282.138-.5.443-.367.46.164.022.535.1.731.367.253.344.244 1.117.244 1.117s.146 2.143-.34 2.408c-.334.182-.792-.19-1.774-1.893-.503-.872-.883-1.836-.883-1.836s-.073-.18-.204-.276c-.158-.117-.38-.154-.38-.154l-2.335.015s-.35.01-.479.163c-.114.135-.009.414-.009.414s1.838 4.3 3.919 6.464c1.907 1.984 4.073 1.854 4.073 1.854h.982z"/></svg>
        Войти через VK
      </>
    )}
  </Button>
);

export default function AuthNew() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref') || '';
  if (refCode) localStorage.setItem('pendingReferral', refCode);

  const [screen, setScreen] = useState<Screen>('landing');

  // Role state
  const [userRole, setUserRole] = useState<UserRoleId | null>(null);

  // Lesson state
  const [lessonStage, setLessonStage] = useState<LessonStage>('pick');
  const [selectedSubject, setSelectedSubject] = useState<typeof LESSON_SUBJECTS[0] | null>(null);
  const [explanation, setExplanation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [typingText, setTypingText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [flashCorrect, setFlashCorrect] = useState(false);
  const thinkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [typingText, lessonStage]);

  const clearErrors = () => { setFieldErrors({}); setTermsError(false); };

  const validateEmail = (v: string) => v.includes('@') && v.includes('.');

  const typeText = (fullText: string, onDone: () => void) => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    setIsTyping(true);
    setTypingText('');
    let i = 0;
    typingTimerRef.current = setInterval(() => {
      i++;
      setTypingText(fullText.slice(0, i));
      if (i >= fullText.length) {
        clearInterval(typingTimerRef.current!);
        setIsTyping(false);
        setTypingText('');
        onDone();
      }
    }, 16);
  };

  const startLesson = async (subject: typeof LESSON_SUBJECTS[0]) => {
    setSelectedSubject(subject);
    setLessonStage('explain');
    setIsLoading(true);
    setThinkingStep(0);
    setExplanation('');

    thinkingTimerRef.current = setInterval(() => {
      setThinkingStep(s => Math.min(s + 1, THINKING_STEPS.length - 1));
    }, 2000);

    let text = '';
    try {
      const res = await fetch(API.AI_ASSISTANT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'demo_ask',
          question: `Объясни за 1-2 предложения, максимально просто, как другу: ${subject.topic}. Без списков, без терминов.`,
          history: [],
        }),
      });
      const data = await res.json();
      text = sanitizeText(data.answer || data.response || data.message || '');
    } catch { /* silent */ }

    if (thinkingTimerRef.current) clearInterval(thinkingTimerRef.current);
    setIsLoading(false);

    if (!text) text = `${subject.topic} — это один из ключевых разделов. Разберём на примере, чтобы всё стало понятно.`;

    typeText(text, () => {
      setExplanation(text);
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

  const afterLogin = async (data: { token: string; user: { full_name: string }; is_new_user?: boolean }, isRegister = false) => {
    authService.setToken(data.token);
    authService.setUser(data.user);
    await applyReferral(data.token);
    if (data.is_new_user) {
      am.register('phone');
    } else {
      am.login('phone');
    }
    toast({ title: '✅ Вход выполнен!', description: `Добро пожаловать, ${data.user.full_name}!` });
    if (isRegister || data.is_new_user) {
      navigate('/onboarding');
    } else {
      navigate('/');
    }
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
          am.register('phone');
          toast({ title: 'Аккаунт создан!', description: 'Добро пожаловать!' });
          navigate('/onboarding');
        } else {
          await afterLogin(data, true);
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
        body: JSON.stringify({ action: 'get_auth_url', code_verifier: codeVerifier, state }),
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

  // ─── LANDING ────────────────────────────────────────────────────────────────
  if (screen === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col items-center justify-center relative overflow-hidden px-6">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-pink-400/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-xs flex flex-col items-center gap-8">

          {/* Персонаж */}
          <div className="relative flex items-center justify-center">
            <div className="absolute rounded-full bg-white/10 animate-ping" style={{ animationDuration: '2.8s', width: 140, height: 140 }} />
            <FoxMascot size={140} />
          </div>

          {/* Текст */}
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-white leading-tight mb-2">
              Привет!<br />Я твой репетитор
            </h1>
            <p className="text-white/70 text-sm">
              Объясню любую тему за 2 минуты.<br />Попробуй прямо сейчас — бесплатно
            </p>
          </div>

          {/* CTA */}
          <div className="w-full flex flex-col gap-3">
            <Button
              onClick={() => setScreen('role')}
              className="w-full h-16 bg-white text-purple-700 hover:bg-white/95 active:scale-[0.98] font-extrabold text-lg rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.25)] transition-all"
            >
              Начать первый урок 🚀
            </Button>
            <button
              onClick={() => { clearErrors(); setScreen('login'); }}
              className="text-white/60 text-sm text-center hover:text-white transition-colors"
            >
              Уже есть аккаунт? <span className="underline text-white/80">Войти</span>
            </button>
          </div>

          {refCode && (
            <div className="bg-green-500/20 backdrop-blur border border-green-400/30 rounded-2xl p-3 w-full">
              <p className="text-white text-xs text-center">
                <Icon name="Gift" size={14} className="inline mr-1" />
                Вас пригласил друг — получите +5 бонусных вопросов
              </p>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <LegalFooter showDelete />
        </div>
      </div>
    );
  }

  // ─── РОЛЬ ───────────────────────────────────────────────────────────────────
  if (screen === 'role') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col items-center justify-center px-6 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 w-full max-w-xs flex flex-col gap-6">

          <div className="flex items-center gap-3">
            <button onClick={() => setScreen('landing')} className="text-white/60 hover:text-white transition-colors">
              <Icon name="ArrowLeft" size={20} />
            </button>
            <div className="flex gap-1">
              <div className="w-6 h-1.5 bg-white rounded-full" />
              <div className="w-6 h-1.5 bg-white/30 rounded-full" />
              <div className="w-6 h-1.5 bg-white/30 rounded-full" />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-white mb-1">Расскажи о себе</h2>
            <p className="text-white/60 text-sm">Подберём урок специально для тебя</p>
          </div>

          <div className="flex flex-col gap-3">
            {USER_ROLES.map(role => (
              <button
                key={role.id}
                onClick={async () => {
                  try { await Haptics.impact({ style: ImpactStyle.Light }); } catch { /* silent */ }
                  setUserRole(role.id);
                  setLessonStage('pick');
                  setScreen('lesson');
                }}
                className="flex items-center gap-4 bg-white/15 backdrop-blur border-2 border-white/20 rounded-2xl px-5 py-4 text-left hover:bg-white/25 hover:border-white/40 active:scale-[0.97] transition-all"
              >
                <span className="text-3xl">{role.emoji}</span>
                <div>
                  <p className="text-white font-bold text-base leading-tight">{role.label}</p>
                  <p className="text-white/50 text-xs mt-0.5">{role.sublabel}</p>
                </div>
                <Icon name="ChevronRight" size={18} className="text-white/40 ml-auto" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── ПЕРВЫЙ УРОК ────────────────────────────────────────────────────────────
  if (screen === 'lesson') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        {/* Вспышка на правильный ответ */}
        <div className={`absolute inset-0 z-50 bg-green-400/50 pointer-events-none transition-opacity duration-300 ${flashCorrect ? 'opacity-100' : 'opacity-0'}`} />

        {/* Шапка */}
        <div className="px-4 pb-2" style={{ paddingTop: 'max(20px, env(safe-area-inset-top, 20px))' }}>
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => {
                setScreen('landing');
                setLessonStage('pick');
                setSelectedSubject(null);
                setExplanation('');
                setSelectedAnswer(null);
                setAnswerRevealed(false);
                if (typingTimerRef.current) clearInterval(typingTimerRef.current);
                if (thinkingTimerRef.current) clearInterval(thinkingTimerRef.current);
              }}
              className="text-white/60 hover:text-white transition-colors p-1 -ml-1 flex-shrink-0"
            >
              <Icon name="ArrowLeft" size={20} />
            </button>
            <div className="flex items-center gap-2 flex-shrink-0">
              <FoxMascot size={32} jumping={flashCorrect} />
              <span className="text-white font-semibold text-sm">Первый урок</span>
            </div>
            <div className="flex-1" />
            {/* Шаг */}
            <span className="text-white/50 text-xs flex-shrink-0">
              {lessonStage === 'pick' ? '1 / 3' : lessonStage === 'explain' ? '2 / 3' : '3 / 3'}
            </span>
          </div>
          {/* Прогресс-бар */}
          <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-700 ease-out"
              style={{
                width: lessonStage === 'pick' ? '10%'
                  : lessonStage === 'explain' ? '45%'
                  : lessonStage === 'question' ? '75%'
                  : '100%'
              }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-4 pb-8">

          {/* ШАГ 1 — Выбор предмета */}
          {lessonStage === 'pick' && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-300">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 -mt-1">
                  <FoxMascot size={36} />
                </div>
                <div className="bg-white/15 backdrop-blur rounded-2xl rounded-tl-sm px-4 py-3 flex-1">
                  <p className="text-white text-sm font-medium">Выбери предмет — и я объясню одну важную тему прямо сейчас</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {LESSON_SUBJECTS.map(s => (
                  <button
                    key={s.id}
                    onClick={async () => {
                      try { await Haptics.impact({ style: ImpactStyle.Light }); } catch { /* silent */ }
                      startLesson(s);
                    }}
                    className="bg-white/15 backdrop-blur border border-white/25 rounded-2xl p-4 text-left hover:bg-white/25 active:scale-95 transition-all"
                  >
                    <span className="text-2xl block mb-1">{s.emoji}</span>
                    <span className="text-white font-semibold text-sm">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ШАГ 2 — Объяснение */}
          {(lessonStage === 'explain' || lessonStage === 'question' || lessonStage === 'result') && selectedSubject && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-300">
              {/* Тема */}
              <div className="bg-white/10 rounded-2xl px-4 py-2 flex items-center gap-2">
                <span className="text-lg">{selectedSubject.emoji}</span>
                <span className="text-white/80 text-xs font-medium">{selectedSubject.label} · {selectedSubject.topic}</span>
              </div>

              {/* Объяснение от совы */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 -mt-1">
                  <FoxMascot size={36} jumping={flashCorrect} />
                </div>
                <div className="bg-white/15 backdrop-blur rounded-2xl rounded-tl-sm px-4 py-3 flex-1">
                  {isLoading ? (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {[0, 1, 2].map(i => (
                          <span key={i} className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                        ))}
                      </div>
                      <p className="text-white/60 text-xs">{THINKING_STEPS[thinkingStep]}</p>
                    </div>
                  ) : (
                    <p className="text-white text-sm leading-relaxed">
                      {isTyping ? typingText : explanation}
                      {isTyping && <span className="inline-block w-0.5 h-4 bg-white/80 ml-0.5 animate-pulse" />}
                    </p>
                  )}
                </div>
              </div>

              {/* Кнопка "Понял, дай задание" */}
              {lessonStage === 'explain' && !isLoading && !isTyping && explanation && (
                <button
                  onClick={() => setLessonStage('question')}
                  className="bg-white text-purple-700 font-bold rounded-2xl py-4 text-base active:scale-95 transition-all shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  Понял! Дай задание →
                </button>
              )}

              {/* ШАГ 3 — Вопрос */}
              {(lessonStage === 'question' || lessonStage === 'result') && (
                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 -mt-1">
                      <FoxMascot size={36} jumping={flashCorrect} />
                    </div>
                    <div className="bg-white/15 backdrop-blur rounded-2xl rounded-tl-sm px-4 py-3 flex-1">
                      <p className="text-white/70 text-xs mb-1">Проверим, как усвоил:</p>
                      <p className="text-white text-sm font-medium">{selectedSubject.question}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {selectedSubject.answers.map((ans, i) => {
                      const isSelected = selectedAnswer === i;
                      const isCorrect = i === selectedSubject.correct;
                      const showResult = answerRevealed;
                      let style = 'bg-white/15 border-white/25 text-white';
                      if (showResult && isCorrect) style = 'bg-green-400/30 border-green-400 text-white';
                      else if (showResult && isSelected && !isCorrect) style = 'bg-red-400/30 border-red-400 text-white';
                      else if (!showResult && isSelected) style = 'bg-white/30 border-white text-white';

                      return (
                        <button
                          key={i}
                          disabled={answerRevealed}
                          onClick={async () => {
                            setSelectedAnswer(i);
                            setAnswerRevealed(true);
                            const correct = i === selectedSubject.correct;
                            try {
                              if (correct) {
                                await Haptics.notification({ type: NotificationType.Success });
                              } else {
                                await Haptics.notification({ type: NotificationType.Error });
                              }
                            } catch { /* не Android — молча */ }
                            if (correct) {
                              setFlashCorrect(true);
                              setTimeout(() => setFlashCorrect(false), 600);
                            }
                            setTimeout(() => setLessonStage('result'), 800);
                          }}
                          className={`border backdrop-blur rounded-2xl px-4 py-3 text-left text-sm font-medium transition-all active:scale-98 ${style}`}
                        >
                          <span className="text-white/50 mr-2">{String.fromCharCode(65 + i)}.</span>
                          {ans}
                          {showResult && isCorrect && <span className="ml-2">✅</span>}
                          {showResult && isSelected && !isCorrect && <span className="ml-2">❌</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ШАГ 4 — Результат → hook */}
              {lessonStage === 'result' && answerRevealed && (
                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 -mt-1">
                      <FoxMascot size={36} jumping={flashCorrect} />
                    </div>
                    <div className="bg-white/15 backdrop-blur rounded-2xl rounded-tl-sm px-4 py-3 flex-1">
                      {selectedAnswer === selectedSubject.correct ? (
                        <p className="text-white text-sm">🎉 Правильно! Отличный старт. У нас ещё десятки таких тем — с заданиями и разбором ошибок.</p>
                      ) : (
                        <p className="text-white text-sm">Почти! Правильный ответ: <strong>{selectedSubject.answers[selectedSubject.correct]}</strong>. Это частая ошибка — именно такие разбираем в приложении.</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setScreen('hook')}
                    className="bg-white text-purple-700 font-extrabold rounded-2xl py-4 text-base active:scale-95 transition-all shadow-lg"
                  >
                    Продолжить обучение →
                  </button>
                </div>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    );
  }

  // ─── HOOK — "Продолжим?" ────────────────────────────────────────────────────
  if (screen === 'hook') {
    const isCorrect = selectedAnswer === selectedSubject?.correct;
    const role = USER_ROLES.find(r => r.id === userRole) ?? USER_ROLES[1];

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col items-center justify-center px-6 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-xs flex flex-col gap-5">

          {/* ВАУ-момент — сравнение */}
          <div className="bg-white rounded-3xl p-5 shadow-2xl text-center animate-in zoom-in-95 duration-500">
            <p className="text-4xl mb-3">{isCorrect ? '🏆' : '💪'}</p>
            <p className="text-gray-800 font-extrabold text-xl leading-tight mb-1">
              {isCorrect
                ? `Ты ответил лучше,\nчем ${role.percent}% ${role.groupLabel}`
                : `Эту тему не знают\n${100 - role.percent}% ${role.groupLabel}`}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {isCorrect
                ? 'Сильное начало. Продолжи — и будешь в топе.'
                : 'Именно для этого и нужен репетитор. Разберём вместе.'}
            </p>
          </div>

          {/* Прогресс урока */}
          <div className="bg-white/15 backdrop-blur rounded-2xl p-4 border border-white/20 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span>📚</span>
              <span className="text-white text-xs">Тема пройдена: <strong>{selectedSubject?.label}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span>🔥</span>
              <span className="text-white text-xs">Стрик: <strong>день 1</strong> — не потеряй его</span>
            </div>
            <div className="flex items-center gap-2">
              <span>⭐</span>
              <span className="text-white text-xs">Осталось разобрать: <strong>499 тем</strong></span>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => { clearErrors(); setScreen('register'); }}
              className="w-full h-14 bg-white text-purple-700 hover:bg-white/95 active:scale-[0.98] font-extrabold text-base rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.25)] transition-all"
            >
              Сохранить прогресс и продолжить 🚀
            </Button>
            <VKButton onClick={handleVKLogin} loading={vkLoading} disabled={loading} />
            <button
              onClick={() => { clearErrors(); setScreen('login'); }}
              className="text-white/60 text-sm text-center hover:text-white transition-colors"
            >
              Уже есть аккаунт? <span className="underline text-white/80">Войти</span>
            </button>
          </div>

          <p className="text-white/35 text-xs text-center">
            Уйдёшь — прогресс и результат не сохранятся
          </p>
        </div>
      </div>
    );
  }

  // ─── LOGIN ──────────────────────────────────────────────────────────────────
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
                <button onClick={() => setScreen('forgot')} className="text-xs text-purple-500 hover:underline mt-1 block text-right w-full">
                  Забыли пароль?
                </button>
              </div>
              <label htmlFor="remember" className="flex items-center gap-2 cursor-pointer w-fit">
                <Checkbox id="remember" checked={rememberMe} onCheckedChange={c => setRememberMe(c as boolean)} className="w-4 h-4" />
                <span className="text-xs text-gray-400">Запомнить меня</span>
              </label>
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
              <VKButton onClick={handleVKLogin} loading={vkLoading} disabled={loading} />
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

  // ─── REGISTER ───────────────────────────────────────────────────────────────
  if (screen === 'register') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 w-full max-w-sm flex flex-col gap-4">
          <button onClick={() => setScreen(selectedSubject ? 'hook' : 'landing')} className="flex items-center gap-1 text-white/70 hover:text-white text-sm self-start">
            <Icon name="ArrowLeft" size={16} /> Назад
          </button>
          <div className="bg-white rounded-3xl p-6 shadow-2xl">
            <div className="mb-5">
              <h2 className="text-2xl font-extrabold text-gray-800 mb-1">Создай аккаунт</h2>
              <div className="flex flex-col gap-1 mt-2">
                <p className="text-xs text-gray-500 flex items-center gap-1.5"><span className="text-green-500">✓</span> Прогресс урока сохранится</p>
                <p className="text-xs text-gray-500 flex items-center gap-1.5"><span className="text-green-500">✓</span> 3 дня Premium в подарок</p>
                <p className="text-xs text-gray-500 flex items-center gap-1.5"><span className="text-green-500">✓</span> Без карты, без подписки</p>
              </div>
            </div>
            <div className="space-y-3">
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
                {password.length > 0 && password.length < 8 && <p className="text-xs text-amber-500 mt-1">Минимум 8 символов</p>}
                {password.length >= 8 && <p className="text-xs text-green-500 mt-1">✓ Хороший пароль</p>}
              </div>
              <TermsBlock agreed={agreedToTerms} onToggle={v => { setAgreedToTerms(v); setTermsError(false); }} error={termsError} />
              <Button
                onClick={handleRegister}
                disabled={loading}
                className={`w-full h-[52px] bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 active:scale-[0.98] text-white font-bold text-base rounded-xl transition-all duration-300 ${regFieldFocused ? 'shadow-[0_8px_28px_rgba(99,102,241,0.6)] scale-[1.01]' : 'shadow-[0_4px_16px_rgba(99,102,241,0.35)]'}`}
              >
                {loading ? <Icon name="Loader2" size={18} className="animate-spin" /> : <>Создать и продолжить <Icon name="ArrowRight" size={16} className="ml-1.5" /></>}
              </Button>
              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-gray-400 text-xs">или</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <VKButton onClick={handleVKLogin} loading={vkLoading} disabled={loading} />
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-2.5 flex items-center gap-2 border border-emerald-200">
                <span className="text-base">🎁</span>
                <p className="text-xs text-emerald-700 font-medium">Бесплатный Premium при регистрации</p>
              </div>
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

  // ─── FORGOT ─────────────────────────────────────────────────────────────────
  if (screen === 'forgot') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 w-full max-w-sm flex flex-col gap-4">
          <button onClick={() => setScreen('login')} className="flex items-center gap-1 text-white/70 hover:text-white text-sm self-start">
            <Icon name="ArrowLeft" size={16} /> Назад к входу
          </button>
          <div className="bg-white rounded-3xl p-6 shadow-2xl">
            <h2 className="text-xl font-extrabold text-gray-800 mb-1">Восстановить пароль</h2>
            <p className="text-xs text-gray-500 mb-5">Введи email и новый пароль</p>
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
                  placeholder="Новый пароль"
                  value={password}
                  onChange={setPassword}
                  onEnter={handleForgot}
                  fieldName="password"
                  errors={fieldErrors}
                  showPassword={showPassword}
                  onToggleShow={() => setShowPassword(p => !p)}
                />
                {password.length >= 8 && <p className="text-xs text-green-500 mt-1">✓ Хороший пароль</p>}
              </div>
              <Button
                onClick={handleForgot}
                disabled={loading}
                className="w-full h-[52px] bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-[0_4px_16px_rgba(99,102,241,0.35)]"
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

  return null;
}