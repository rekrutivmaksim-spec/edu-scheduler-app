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
import { Haptics, ImpactStyle } from '@capacitor/haptics';

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

// ─── Данные ──────────────────────────────────────────────────────────────────

const GOALS = [
  { id: 'ege', emoji: '🎯', label: 'Сдать ЕГЭ', desc: '10–11 класс', percent: 68, groupLabel: 'учеников 11 класса' },
  { id: 'oge', emoji: '📚', label: 'Сдать ОГЭ', desc: '8–9 класс', percent: 71, groupLabel: 'учеников 9 класса' },
  { id: 'university', emoji: '🎓', label: 'Учёба в вузе', desc: 'Студент', percent: 74, groupLabel: 'студентов' },
  { id: 'other', emoji: '✨', label: 'Саморазвитие', desc: 'Для себя', percent: 65, groupLabel: 'пользователей' },
] as const;

type GoalId = typeof GOALS[number]['id'];

const MOTIVATIONS: Record<GoalId, { emoji: string; label: string }[]> = {
  ege: [
    { emoji: '🏆', label: 'Поступить в топ-вуз' },
    { emoji: '💯', label: 'Набрать 80+ баллов' },
    { emoji: '😰', label: 'Просто не провалиться' },
    { emoji: '📈', label: 'Улучшить результат' },
  ],
  oge: [
    { emoji: '✅', label: 'Сдать на отлично' },
    { emoji: '😌', label: 'Не краснеть на экзамене' },
    { emoji: '🎒', label: 'Перейти в 10 класс' },
    { emoji: '📈', label: 'Подтянуть оценки' },
  ],
  university: [
    { emoji: '🏅', label: 'Закрыть сессию на отлично' },
    { emoji: '😅', label: 'Просто не завалить' },
    { emoji: '💼', label: 'Разобраться для работы' },
    { emoji: '🧠', label: 'Понять, а не зазубрить' },
  ],
  other: [
    { emoji: '🧠', label: 'Стать умнее' },
    { emoji: '💬', label: 'Говорить уверенно' },
    { emoji: '🎯', label: 'Заполнить пробелы' },
    { emoji: '🚀', label: 'Развиваться каждый день' },
  ],
};

const SUBJECTS = [
  { id: 'math', emoji: '📐', label: 'Математика' },
  { id: 'russian', emoji: '📝', label: 'Русский язык' },
  { id: 'physics', emoji: '⚡', label: 'Физика' },
  { id: 'history', emoji: '🏛️', label: 'История' },
  { id: 'english', emoji: '🇬🇧', label: 'Английский' },
  { id: 'chemistry', emoji: '🧪', label: 'Химия' },
];

const LEVELS = [
  { id: 'beginner', emoji: '🌱', label: 'С нуля', desc: 'Тема почти незнакома' },
  { id: 'middle', emoji: '📖', label: 'Знаю основы', desc: 'Но есть пробелы' },
  { id: 'advanced', emoji: '🔥', label: 'Уверенно', desc: 'Хочу закрепить' },
];

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

// ─── Типы экранов ─────────────────────────────────────────────────────────────
// Флоу: splash → goal → subject → level → lesson → result → register
// Отдельно: login, forgot
type Screen = 'splash' | 'goal' | 'subject' | 'level' | 'lesson' | 'result' | 'register' | 'login' | 'forgot';
type LessonStage = 'explain' | 'question' | 'answered';

// ─── Вспомогательные компоненты ───────────────────────────────────────────────

const ProgressBar = ({ current, total }: { current: number; total: number }) => (
  <div className="w-full h-2.5 bg-white/20 rounded-full overflow-hidden">
    <div
      className="h-full bg-white rounded-full transition-all duration-500 ease-out"
      style={{ width: `${Math.round((current / total) * 100)}%` }}
    />
  </div>
);

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
        className={`h-12 border-2 rounded-2xl text-sm pr-10 ${errors[fieldName] ? 'border-red-400 focus:border-red-400' : 'border-gray-200 focus:border-purple-400'}`}
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
    className="w-full h-12 rounded-2xl border-2 border-[#0077FF]/30 text-[#0077FF] font-semibold hover:bg-[#0077FF]/5 active:scale-[0.98] transition-all"
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

// ─── Обёртка для шагов онбординга ────────────────────────────────────────────
const OnboardingShell = ({
  step, totalSteps, onBack, children, hideBack = false,
}: {
  step: number; totalSteps: number; onBack?: () => void; children: React.ReactNode; hideBack?: boolean;
}) => (
  <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col">
    <div className="px-5 pt-12 pb-4 flex items-center gap-3">
      {!hideBack && onBack && (
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <Icon name="ChevronLeft" size={20} className="text-white" />
        </button>
      )}
      <div className="flex-1">
        <ProgressBar current={step} total={totalSteps} />
      </div>
    </div>
    <div className="flex-1 flex flex-col px-5 pb-8">
      {children}
    </div>
    <div className="px-5">
      <LegalFooter showDelete />
    </div>
  </div>
);

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function AuthNew() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref') || '';
  if (refCode) localStorage.setItem('pendingReferral', refCode);

  // Навигация
  const [screen, setScreen] = useState<Screen>('splash');
  const [history, setHistory] = useState<Screen[]>([]);

  const goTo = (s: Screen) => {
    setHistory(h => [...h, screen]);
    setScreen(s);
  };

  const goBack = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setScreen(prev);
  };

  // Данные онбординга
  const [goal, setGoal] = useState<GoalId | ''>('');
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('');

  // Предзагрузка ИИ — стартует фоном когда пользователь на экране level
  const preloadedExplanation = useRef<string>('');
  const isPreloading = useRef(false);

  // Урок
  const [lessonStage, setLessonStage] = useState<LessonStage>('explain');
  const [selectedSubject, setSelectedSubject] = useState<typeof LESSON_SUBJECTS[0] | null>(null);
  const [explanation, setExplanation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [typingText, setTypingText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [flashCorrect, setFlashCorrect] = useState(false);
  const thinkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auth
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vkLoading, setVkLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (authService.isAuthenticated()) navigate('/');
  }, [navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [typingText, lessonStage]);

  const clearErrors = () => { setFieldErrors({}); setTermsError(false); };
  const validateEmail = (v: string) => v.includes('@') && v.includes('.');

  const typeText = (fullText: string, onDone: () => void) => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    setTypingText('');
    setIsTyping(true);
    let i = 0;
    const speed = Math.max(8, Math.min(20, Math.floor(2000 / fullText.length)));
    typingTimerRef.current = setInterval(() => {
      i++;
      setTypingText(fullText.slice(0, i));
      if (i >= fullText.length) {
        clearInterval(typingTimerRef.current!);
        setIsTyping(false);
        onDone();
      }
    }, speed);
  };

  // Фоновая предзагрузка ИИ — вызывается когда пользователь видит экран level
  const preloadLesson = async (subj: typeof LESSON_SUBJECTS[0]) => {
    if (isPreloading.current || preloadedExplanation.current) return;
    isPreloading.current = true;
    try {
      const res = await fetch(API.AI_ASSISTANT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'demo_ask',
          question: `Объясни за 1-2 предложения, максимально просто, как другу: ${subj.topic}. Без списков, без терминов.`,
          history: [],
        }),
      });
      const data = await res.json();
      preloadedExplanation.current = sanitizeText(data.answer || data.response || '');
    } catch { /* silent */ } finally {
      isPreloading.current = false;
    }
  };

  const startLesson = async (subj: typeof LESSON_SUBJECTS[0]) => {
    setSelectedSubject(subj);
    setLessonStage('explain');
    setExplanation('');
    setTypingText('');
    setSelectedAnswer(null);

    // Если уже предзагружено — показываем мгновенно
    if (preloadedExplanation.current) {
      const text = preloadedExplanation.current;
      preloadedExplanation.current = '';
      setIsLoading(false);
      setExplanation(text);
      typeText(text, () => {});
      return;
    }

    // Иначе грузим с индикатором
    setIsLoading(true);
    setThinkingStep(0);
    let step = 0;
    thinkingTimerRef.current = setInterval(() => {
      step = (step + 1) % THINKING_STEPS.length;
      setThinkingStep(step);
    }, 900);

    try {
      const res = await fetch(API.AI_ASSISTANT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'demo_ask',
          question: `Объясни за 1-2 предложения, максимально просто, как другу: ${subj.topic}. Без списков, без терминов.`,
          history: [],
        }),
      });
      const data = await res.json();
      const text = sanitizeText(data.answer || data.response || 'Не удалось загрузить объяснение.');
      clearInterval(thinkingTimerRef.current!);
      setIsLoading(false);
      setExplanation(text);
      typeText(text, () => {});
    } catch {
      clearInterval(thinkingTimerRef.current!);
      setIsLoading(false);
      setExplanation('Не удалось загрузить объяснение.');
      setLessonStage('question');
    }
  };

  const handleAnswer = async (idx: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(idx);
    setLessonStage('answered');
    const correct = idx === selectedSubject?.correct;
    try {
      if (correct) {
        await Haptics.notification({ type: 'SUCCESS' as never });
        setFlashCorrect(true);
        setTimeout(() => setFlashCorrect(false), 600);
      } else {
        await Haptics.notification({ type: 'ERROR' as never });
      }
    } catch { /* silent */ }
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
      // Передаём собранные данные в онбординг
      if (goal) localStorage.setItem('onboarding_goal', goal);
      if (subject) localStorage.setItem('onboarding_subject', subject);
    } else {
      am.login('phone');
    }
    if (isRegister || data.is_new_user) {
      navigate('/onboarding');
    } else {
      navigate('/');
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
        body: JSON.stringify({ action: 'login', email, password, full_name: name.trim() || undefined, device_id, browser_fp }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        if (data.is_new_user && data.trial_available === false) {
          authService.setToken(data.token);
          authService.setUser(data.user);
          await applyReferral(data.token);
          am.register('phone');
          if (goal) localStorage.setItem('onboarding_goal', goal);
          if (subject) localStorage.setItem('onboarding_subject', subject);
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
        await afterLogin(data, false);
      } else {
        setFieldErrors({ password: data.error || 'Неверный email или пароль' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Нет соединения' });
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

  const handleVKLogin = async () => {
    setVkLoading(true);
    try {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const codeVerifier = btoa(String.fromCharCode(...array)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 43);
      const state = Math.random().toString(36).substring(2);
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

  // Флоу: splash(0) → goal(1) → subject(2) → level(3) → lesson(4) → result(5) → register(6)
  const TOTAL_STEPS = 6;

  // ─── SPLASH ──────────────────────────────────────────────────────────────────
  if (screen === 'splash') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col items-center justify-between relative overflow-hidden px-6 py-12">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-pink-400/20 rounded-full blur-3xl pointer-events-none" />

        <div className="flex-1 flex flex-col items-center justify-center gap-8 relative z-10">
          {/* Маскот на весь экран */}
          <div className="relative flex items-center justify-center">
            <div className="absolute rounded-full bg-white/10 animate-ping" style={{ animationDuration: '2.5s', width: 180, height: 180 }} />
            <div className="absolute rounded-full bg-white/5 animate-ping" style={{ animationDuration: '3.5s', width: 220, height: 220 }} />
            <FoxMascot size={160} />
          </div>

          <div className="text-center">
            <h1 className="text-white font-extrabold text-3xl leading-tight mb-3">
              Учись быстрее.<br />Понимай глубже.
            </h1>
            <p className="text-white/65 text-base">
              ИИ-репетитор объяснит любую тему<br />за 2 минуты — бесплатно
            </p>
          </div>

          {/* Социальное доказательство */}
          <div className="flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-4 py-2">
            <span className="text-yellow-300 text-sm">★★★★★</span>
            <span className="text-white/80 text-sm font-medium">12 400+ учеников</span>
          </div>
        </div>

        <div className="w-full relative z-10 flex flex-col gap-3">
          <Button
            onClick={() => goTo('goal')}
            className="w-full h-16 bg-white text-purple-700 hover:bg-white/95 active:scale-[0.98] font-extrabold text-lg rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all"
          >
            Начать бесплатно 🚀
          </Button>
          <VKButton onClick={handleVKLogin} loading={vkLoading} disabled={loading} />
          <button
            onClick={() => { clearErrors(); setScreen('login'); }}
            className="text-white/55 text-sm text-center hover:text-white transition-colors py-1"
          >
            Уже есть аккаунт? <span className="underline text-white/75">Войти</span>
          </button>
        </div>

        <div className="relative z-10 w-full mt-2">
          <LegalFooter showDelete />
        </div>
      </div>
    );
  }

  // ─── ШАГ 1: Выбор цели ──────────────────────────────────────────────────────
  if (screen === 'goal') {
    return (
      <OnboardingShell step={1} totalSteps={TOTAL_STEPS} onBack={goBack}>
        <div className="flex flex-col gap-6 mt-4 animate-in fade-in duration-300">
          <div>
            <p className="text-white/65 text-sm">Шаг 1 из 3 · Настройка</p>
            <h2 className="text-white font-extrabold text-2xl leading-tight mt-1">Какая у тебя цель?</h2>
          </div>

          <div className="flex flex-col gap-3">
            {GOALS.map(g => (
              <button
                key={g.id}
                onClick={async () => {
                  try { await Haptics.impact({ style: ImpactStyle.Light }); } catch { /* silent */ }
                  setGoal(g.id);
                  goTo('subject');
                }}
                className="flex items-center gap-4 bg-white rounded-2xl px-5 py-4 text-left active:scale-[0.97] transition-all shadow-lg shadow-black/10"
              >
                <span className="text-3xl">{g.emoji}</span>
                <div className="flex-1">
                  <p className="text-gray-800 font-bold text-base">{g.label}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{g.desc}</p>
                </div>
                <Icon name="ChevronRight" size={18} className="text-gray-300" />
              </button>
            ))}
          </div>
        </div>
      </OnboardingShell>
    );
  }

  // ─── ШАГ 2: Предмет ─────────────────────────────────────────────────────────
  if (screen === 'subject') {
    return (
      <OnboardingShell step={2} totalSteps={TOTAL_STEPS} onBack={goBack}>
        <div className="flex flex-col gap-6 mt-4 animate-in fade-in duration-300">
          <div>
            <p className="text-white/65 text-sm">Шаг 2 из 3 · Настройка</p>
            <h2 className="text-white font-extrabold text-2xl leading-tight mt-1">Какой предмет прокачаем?</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {SUBJECTS.map(s => {
              const lessonSubj = LESSON_SUBJECTS.find(ls => ls.id === s.id) || LESSON_SUBJECTS[0];
              return (
                <button
                  key={s.id}
                  onClick={async () => {
                    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch { /* silent */ }
                    setSubject(s.id);
                    // Предзагружаем ИИ фоном пока пользователь смотрит на экран уровня
                    preloadLesson(lessonSubj);
                    goTo('level');
                  }}
                  className="flex flex-col items-center gap-2 bg-white rounded-2xl py-5 px-3 active:scale-[0.95] transition-all shadow-lg shadow-black/10"
                >
                  <span className="text-3xl">{s.emoji}</span>
                  <p className="text-gray-800 font-bold text-sm text-center">{s.label}</p>
                </button>
              );
            })}
          </div>
        </div>
      </OnboardingShell>
    );
  }

  // ─── ШАГ 3: Уровень ─────────────────────────────────────────────────────────
  if (screen === 'level') {
    const subjectInfo = SUBJECTS.find(s => s.id === subject);
    return (
      <OnboardingShell step={3} totalSteps={TOTAL_STEPS} onBack={goBack}>
        <div className="flex flex-col gap-6 mt-4 animate-in fade-in duration-300">
          <div>
            <p className="text-white/65 text-sm">Шаг 3 из 3 · {subjectInfo?.emoji} {subjectInfo?.label}</p>
            <h2 className="text-white font-extrabold text-2xl leading-tight mt-1">Какой у тебя уровень?</h2>
          </div>

          <div className="flex flex-col gap-3">
            {LEVELS.map(l => (
              <button
                key={l.id}
                onClick={async () => {
                  try { await Haptics.impact({ style: ImpactStyle.Light }); } catch { /* silent */ }
                  setLevel(l.id);
                  const lessonSubject = LESSON_SUBJECTS.find(ls => ls.id === subject) || LESSON_SUBJECTS[0];
                  startLesson(lessonSubject);
                  goTo('lesson');
                }}
                className="flex items-center gap-4 bg-white rounded-2xl px-5 py-4 text-left active:scale-[0.97] transition-all shadow-lg shadow-black/10"
              >
                <span className="text-3xl">{l.emoji}</span>
                <div className="flex-1">
                  <p className="text-gray-800 font-bold text-base">{l.label}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{l.desc}</p>
                </div>
                <Icon name="ChevronRight" size={18} className="text-gray-300" />
              </button>
            ))}
          </div>

          {/* Индикатор предзагрузки — успокаивает пользователя */}
          <div className="flex items-center gap-2 justify-center opacity-60">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            <span className="text-white/60 text-xs ml-1">Готовлю урок…</span>
          </div>
        </div>
      </OnboardingShell>
    );
  }

  // ─── ШАГ 5: Урок ────────────────────────────────────────────────────────────
  if (screen === 'lesson' && selectedSubject) {
    const isCorrectAnswer = selectedAnswer === selectedSubject.correct;
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col relative overflow-hidden">
        {/* Вспышка на правильный ответ */}
        <div className={`absolute inset-0 z-50 bg-green-400/30 pointer-events-none transition-opacity duration-300 ${flashCorrect ? 'opacity-100' : 'opacity-0'}`} />

        {/* Шапка */}
        <div className="px-5 pt-12 pb-4 flex items-center gap-3">
          <div className="flex-shrink-0">
            <FoxMascot size={36} jumping={flashCorrect} />
          </div>
          <div className="flex-1">
            <ProgressBar current={4} total={TOTAL_STEPS} />
            <p className="text-white/55 text-xs mt-1.5">{selectedSubject.emoji} {selectedSubject.label}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-10 flex flex-col gap-5">

          {/* Тема */}
          <div className="bg-white/10 rounded-2xl px-4 py-3">
            <p className="text-white/60 text-xs uppercase tracking-wide font-semibold mb-0.5">Тема</p>
            <p className="text-white font-bold text-base">{selectedSubject.topic}</p>
          </div>

          {/* Объяснение */}
          <div className="bg-white rounded-3xl px-5 py-5 shadow-xl">
            {isLoading ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-gray-400 text-sm">{THINKING_STEPS[thinkingStep]}</span>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-100 rounded-full w-full animate-pulse" />
                  <div className="h-3 bg-gray-100 rounded-full w-4/5 animate-pulse" />
                  <div className="h-3 bg-gray-100 rounded-full w-3/5 animate-pulse" />
                </div>
              </div>
            ) : (
              <p className="text-gray-800 text-base leading-relaxed font-medium">
                {typingText}
                {isTyping && <span className="inline-block w-0.5 h-5 bg-purple-400 ml-0.5 animate-pulse" />}
              </p>
            )}
          </div>

          {/* Кнопка после объяснения */}
          {lessonStage === 'explain' && !isLoading && !isTyping && typingText && (
            <button
              onClick={() => setLessonStage('question')}
              className="w-full bg-white text-purple-700 font-extrabold rounded-2xl py-4 text-base active:scale-[0.98] transition-all shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-400"
            >
              Понял, дальше →
            </button>
          )}

          {/* Вопрос + варианты */}
          {(lessonStage === 'question' || lessonStage === 'answered') && (
            <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-400">
              <div className="bg-white/10 rounded-2xl px-4 py-3">
                <p className="text-white/60 text-xs uppercase tracking-wide font-semibold mb-1">Вопрос</p>
                <p className="text-white font-bold text-base leading-snug">{selectedSubject.question}</p>
              </div>

              <div className="flex flex-col gap-2">
                {selectedSubject.answers.map((ans, idx) => {
                  const isSelected = selectedAnswer === idx;
                  const isCorrectAns = idx === selectedSubject.correct;
                  const revealed = lessonStage === 'answered';
                  let cls = 'bg-white text-gray-800 border-transparent';
                  if (revealed && isCorrectAns) cls = 'bg-green-500 text-white border-transparent';
                  if (revealed && isSelected && !isCorrectAns) cls = 'bg-red-500 text-white border-transparent';
                  return (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(idx)}
                      disabled={lessonStage === 'answered'}
                      className={`w-full text-left px-5 py-4 rounded-2xl border-2 font-semibold text-base transition-all active:scale-[0.97] shadow-md ${cls}`}
                    >
                      <span className="mr-3 opacity-50 text-sm">{String.fromCharCode(65 + idx)}.</span>
                      {ans}
                      {revealed && isCorrectAns && <span className="ml-2">✓</span>}
                      {revealed && isSelected && !isCorrectAns && <span className="ml-2">✗</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Фидбек + кнопка продолжить */}
          {lessonStage === 'answered' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-400 flex flex-col gap-3">
              <div className={`rounded-2xl px-5 py-4 ${isCorrectAnswer ? 'bg-green-500/20 border border-green-400/40' : 'bg-white/10 border border-white/20'}`}>
                <p className="text-white font-bold text-base">
                  {isCorrectAnswer ? '🎉 Верно!' : '💡 Почти!'}
                </p>
                {!isCorrectAnswer && (
                  <p className="text-white/80 text-sm mt-1">
                    Правильный ответ: <strong>{selectedSubject.answers[selectedSubject.correct]}</strong>
                  </p>
                )}
              </div>
              <button
                onClick={() => goTo('result')}
                className="w-full bg-white text-purple-700 font-extrabold rounded-2xl py-4 text-base active:scale-[0.98] transition-all shadow-lg"
              >
                Продолжить →
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    );
  }

  // ─── ШАГ 6: Результат — вау-момент ──────────────────────────────────────────
  if (screen === 'result') {
    const isCorrect = selectedAnswer === selectedSubject?.correct;
    const goalData = GOALS.find(g => g.id === goal) ?? GOALS[0];

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col items-center justify-center px-5 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-pink-400/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-sm flex flex-col gap-5">

          {/* Карточка результата */}
          <div className="bg-white rounded-3xl p-6 shadow-2xl text-center animate-in zoom-in-95 duration-500">
            <div className="text-5xl mb-3">{isCorrect ? '🏆' : '💪'}</div>
            <h2 className="text-gray-900 font-extrabold text-xl leading-tight mb-2">
              {isCorrect
                ? `Ты лучше ${goalData.percent}% ${goalData.groupLabel}!`
                : `Не знают ${100 - goalData.percent}% ${goalData.groupLabel}`}
            </h2>
            <p className="text-gray-500 text-sm">
              {isCorrect
                ? 'Отличное начало. Сохрани прогресс и продолжай расти.'
                : 'Именно для этого я здесь. Разберём всё вместе.'}
            </p>

            {/* Достижения */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-around">
              <div className="text-center">
                <div className="text-2xl">🔥</div>
                <p className="text-gray-800 font-bold text-sm">День 1</p>
                <p className="text-gray-400 text-xs">Стрик</p>
              </div>
              <div className="text-center">
                <div className="text-2xl">⭐</div>
                <p className="text-gray-800 font-bold text-sm">+10 XP</p>
                <p className="text-gray-400 text-xs">Заработано</p>
              </div>
              <div className="text-center">
                <div className="text-2xl">🎁</div>
                <p className="text-gray-800 font-bold text-sm">3 дня</p>
                <p className="text-gray-400 text-xs">Premium</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <Button
            onClick={() => goTo('register')}
            className="w-full h-14 bg-white text-purple-700 hover:bg-white/95 active:scale-[0.98] font-extrabold text-base rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.25)] transition-all"
          >
            Продолжить →
          </Button>

          <VKButton onClick={handleVKLogin} loading={vkLoading} disabled={loading} />

          <p className="text-white/40 text-xs text-center">
            Уйдёшь — прогресс и стрик не сохранятся
          </p>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <LegalFooter showDelete />
        </div>
      </div>
    );
  }

  // ─── ШАГ 6: Регистрация ─────────────────────────────────────────────────────
  if (screen === 'register') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        <div className="px-5 pt-12 pb-4">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Icon name="ChevronLeft" size={20} className="text-white" />
            </button>
            <div className="flex-1">
              <ProgressBar current={6} total={TOTAL_STEPS} />
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-5 pb-8">
          <div className="bg-white rounded-3xl p-6 shadow-2xl">
            {/* Заголовок с маскотом */}
            <div className="flex items-center gap-3 mb-5">
              <FoxMascot size={48} />
              <div>
                <h2 className="text-gray-900 font-extrabold text-xl leading-tight">Последний шаг!</h2>
                <p className="text-gray-400 text-xs mt-0.5">Сохрани прогресс — займёт 15 секунд</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  autoCapitalize="none"
                  className={`h-12 border-2 rounded-2xl text-sm ${fieldErrors.email ? 'border-red-400' : 'border-gray-200 focus:border-purple-400'}`}
                />
                <FieldError name="email" errors={fieldErrors} />
              </div>
              <div>
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

              <div>
                <label htmlFor="terms" className="flex items-start gap-3 cursor-pointer group">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={c => { setAgreedToTerms(c as boolean); setTermsError(false); }}
                    className="mt-0.5 w-5 h-5 flex-shrink-0 rounded-md border-2 border-gray-300 group-hover:border-purple-400 transition-colors"
                  />
                  <span className="text-xs text-gray-500 leading-relaxed pt-0.5">
                    Согласен(на) с{' '}
                    <Link to="/terms" className="text-purple-600 hover:underline font-medium" onClick={e => e.stopPropagation()}>условиями</Link>
                    {' '}и{' '}
                    <Link to="/privacy" className="text-purple-600 hover:underline font-medium" onClick={e => e.stopPropagation()}>политикой</Link>
                  </span>
                </label>
                {termsError && <p className="text-red-500 text-xs mt-1">Нужно согласиться с условиями</p>}
              </div>

              <Button
                onClick={handleRegister}
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 active:scale-[0.98] text-white font-bold text-base rounded-2xl shadow-[0_4px_16px_rgba(99,102,241,0.35)] transition-all"
              >
                {loading ? <Icon name="Loader2" size={18} className="animate-spin" /> : 'Создать аккаунт →'}
              </Button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-gray-400 text-xs">или</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <VKButton onClick={handleVKLogin} loading={vkLoading} disabled={loading} />

              <p className="text-center text-xs text-gray-400">
                Уже есть аккаунт?{' '}
                <button onClick={() => { clearErrors(); setScreen('login'); }} className="text-purple-600 font-medium hover:underline">
                  Войти
                </button>
              </p>
            </div>
          </div>
        </div>

        <div className="px-5">
          <LegalFooter />
        </div>
      </div>
    );
  }

  // ─── ЛОГИН ──────────────────────────────────────────────────────────────────
  if (screen === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col items-center justify-center p-5 relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 w-full max-w-sm flex flex-col gap-4">
          <button onClick={() => setScreen('goal')} className="flex items-center gap-1 text-white/70 hover:text-white text-sm self-start">
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
                  className={`h-12 border-2 rounded-2xl text-sm ${fieldErrors.email ? 'border-red-400' : 'border-gray-200 focus:border-purple-400'}`}
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
                  onClick={() => { clearErrors(); setScreen('forgot'); }}
                  className="text-purple-600 text-xs hover:underline mt-1 block text-right w-full"
                >
                  Забыл пароль?
                </button>
              </div>
              <Button
                onClick={handleLogin}
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 active:scale-[0.98] text-white font-bold text-base rounded-2xl shadow-[0_6px_20px_rgba(99,102,241,0.4)] transition-all"
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
                <button onClick={() => { clearErrors(); setScreen('goal'); }} className="text-purple-600 font-medium hover:underline">
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

  // ─── ВОССТАНОВЛЕНИЕ ПАРОЛЯ ───────────────────────────────────────────────────
  if (screen === 'forgot') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col items-center justify-center p-5 relative overflow-hidden">
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
                  className={`h-12 border-2 rounded-2xl text-sm ${fieldErrors.email ? 'border-red-400' : 'border-gray-200 focus:border-purple-400'}`}
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
              </div>
              <Button
                onClick={handleForgot}
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-white font-bold text-base rounded-2xl transition-all"
              >
                {loading ? <Icon name="Loader2" size={18} className="animate-spin" /> : 'Сменить пароль'}
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