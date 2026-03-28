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
import AiText from '@/components/AiText';

// ─── Утилиты ──────────────────────────────────────────────────────────────────

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
        ctx.fillText('Studyfay', 2, 2);
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

function compressImage(file: File, maxSize = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      let quality = 0.7;
      let result = canvas.toDataURL('image/jpeg', quality).split(',')[1];
      if (result.length > 2_000_000) {
        quality = 0.4;
        result = canvas.toDataURL('image/jpeg', quality).split(',')[1];
      }
      resolve(result);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// ─── Данные ───────────────────────────────────────────────────────────────────

interface StructuredResponse {
  steps: Array<{ icon: string; title: string; text: string }>;
  answer: string;
  check: string;
  tip: string;
  practice: Array<{ text: string }>;
  motivation: string;
}

interface SolveResult {
  recognized_text: string;
  solution: string;
  subject: string;
  structured?: StructuredResponse;
}

const STEP_ICONS: Record<string, string> = {
  arrow: '➡️',
  pin: '📌',
  check: '✅',
};

const EXAMPLE_TEXTS = [
  '2x^2 + 3x - 5 = 0',
  'Что такое валентность?',
  'Объясни закон Ома',
  'Найти производную sin(2x)',
  'Причины революции 1917',
];

const SOLVING_PHRASES_PHOTO = [
  { text: 'Распознаю задачу...', emoji: '🔍' },
  { text: 'Анализирую условие...', emoji: '📐' },
  { text: 'Решаю пошагово...', emoji: '✨' },
  { text: 'Проверяю ответ...', emoji: '✅' },
];
const SOLVING_PHRASES_TEXT = [
  { text: 'Анализирую вопрос...', emoji: '🔍' },
  { text: 'Подбираю объяснение...', emoji: '📐' },
  { text: 'Формулирую ответ...', emoji: '✨' },
  { text: 'Проверяю...', emoji: '✅' },
];

// ─── Типы экранов ─────────────────────────────────────────────────────────────
// Флоу: splash -> aha (photo/text) -> solving -> result -> register
// Отдельно: login, forgot
type Screen = 'splash' | 'aha' | 'solving' | 'result' | 'register' | 'login' | 'forgot';

// ─── Вспомогательные компоненты ───────────────────────────────────────────────

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

function FloatingExamples() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setActive(prev => (prev + 1) % EXAMPLE_TEXTS.length), 2500);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="flex flex-col items-center gap-2 mt-4">
      <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Например</p>
      <div className="h-8 relative overflow-hidden w-full">
        {EXAMPLE_TEXTS.map((text, i) => (
          <div key={i} className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${i === active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <span className="text-gray-400 text-sm font-mono bg-gray-100 px-4 py-1.5 rounded-full">{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SolvingAnimation({ phrases }: { phrases: typeof SOLVING_PHRASES_PHOTO }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (visibleCount < phrases.length) {
      const timer = setTimeout(() => setVisibleCount(c => c + 1), 1500);
      return () => clearTimeout(timer);
    }
  }, [visibleCount, phrases.length]);

  return (
    <div className="flex flex-col gap-4">
      {phrases.map((phrase, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 transition-all duration-500 ${
            i < visibleCount ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
          }`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
            i < visibleCount - 1 ? 'bg-green-100' : 'bg-indigo-100 animate-pulse'
          }`}>
            {phrase.emoji}
          </div>
          <span className={`text-base font-medium ${
            i < visibleCount - 1 ? 'text-gray-400' : 'text-gray-800'
          }`}>
            {phrase.text}
          </span>
          {i < visibleCount - 1 && (
            <Icon name="Check" size={16} className="text-green-500 ml-auto" />
          )}
        </div>
      ))}
      {visibleCount < phrases.length && (
        <div className="flex justify-center mt-2">
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
                style={{ animationDelay: `${i * 150}ms`, animationDuration: '0.8s' }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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

  // Aha state
  const [ahaImagePreview, setAhaImagePreview] = useState<string | null>(null);
  const [ahaQuestion, setAhaQuestion] = useState('');
  const [ahaResult, setAhaResult] = useState<SolveResult | null>(null);
  const [ahaTextAnswer, setAhaTextAnswer] = useState<string | null>(null);
  const [ahaResultType, setAhaResultType] = useState<'photo' | 'text'>('photo');
  const [ahaError, setAhaError] = useState(false);
  const [fingerprint, setFingerprint] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Auth state
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

  // Get fingerprint on mount
  useEffect(() => {
    getBrowserFingerprint().then(fp => setFingerprint(fp));
  }, []);

  const clearErrors = () => { setFieldErrors({}); setTermsError(false); };
  const validateEmail = (v: string) => v.includes('@') && v.includes('.');

  // ─── Auth handlers ──────────────────────────────────────────────────────────

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

  // ─── Aha handlers ───────────────────────────────────────────────────────────

  const handlePhotoFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 15 * 1024 * 1024) return;

    const preview = URL.createObjectURL(file);
    setAhaImagePreview(preview);
    setAhaResultType('photo');
    setAhaError(false);
    setAhaResult(null);
    setAhaTextAnswer(null);
    setHistory(h => [...h, 'aha']);
    setScreen('solving');

    try {
      const base64 = await compressImage(file);
      const fp = fingerprint || await getBrowserFingerprint();
      const resp = await fetch(API.AI_ASSISTANT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'free_photo_solve', image_base64: base64, hint: '', fingerprint: fp }),
      });

      if (!resp.ok) {
        setAhaError(true);
        setTimeout(() => setScreen('register'), 2000);
        return;
      }

      const data = await resp.json() as SolveResult;
      setAhaResult(data);
      setTimeout(() => setScreen('result'), 800);
    } catch {
      setAhaError(true);
      setTimeout(() => setScreen('register'), 2000);
    }
  };

  const handleTextQuestion = async () => {
    if (!ahaQuestion.trim()) return;

    const question = ahaQuestion.trim();
    setAhaResultType('text');
    setAhaError(false);
    setAhaResult(null);
    setAhaTextAnswer(null);
    setHistory(h => [...h, 'aha']);
    setScreen('solving');

    try {
      const fp = fingerprint || await getBrowserFingerprint();
      const resp = await fetch(API.AI_ASSISTANT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'free_ask', question, fingerprint: fp }),
      });

      if (!resp.ok) {
        setAhaError(true);
        setTimeout(() => setScreen('register'), 2000);
        return;
      }

      const data = await resp.json();
      // free_ask returns { answer: string } or { response: string }
      const answer = data.answer || data.response || '';
      if (data.recognized_text || data.structured) {
        // Structured photo-like response
        setAhaResult(data as SolveResult);
      } else {
        setAhaTextAnswer(sanitizeText(answer));
      }
      setTimeout(() => setScreen('result'), 800);
    } catch {
      setAhaError(true);
      setTimeout(() => setScreen('register'), 2000);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePhotoFile(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  // ─── SPLASH ─────────────────────────────────────────────────────────────────
  if (screen === 'splash') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col items-center justify-between relative overflow-hidden px-6 py-12">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-pink-400/20 rounded-full blur-3xl pointer-events-none" />

        <div className="flex-1 flex flex-col items-center justify-center gap-8 relative z-10">
          {/* Маскот */}
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
              ИИ-репетитор решит любую задачу<br />за секунды — бесплатно
            </p>
          </div>

          {/* Социальное доказательство */}
          <div className="flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-4 py-2">
            <span className="text-yellow-300 text-sm">★★★★★</span>
            <span className="text-white/80 text-sm font-medium">500+ учеников</span>
          </div>
        </div>

        <div className="w-full relative z-10 flex flex-col gap-3">
          <Button
            onClick={async () => {
              try { await Haptics.impact({ style: ImpactStyle.Light }); } catch { /* silent */ }
              goTo('aha');
            }}
            className="w-full h-16 bg-white text-purple-700 hover:bg-white/95 active:scale-[0.98] font-extrabold text-lg rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all"
          >
            Попробовать бесплатно
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

  // ─── AHA ─────────────────────────────────────────────────────────────────────
  if (screen === 'aha') {
    return (
      <div className="min-h-screen flex flex-col relative overflow-hidden">
        {/* Purple gradient top */}
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-800 px-6 pt-12 pb-10 relative">
          <div className="absolute -top-32 -left-32 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/3 right-0 w-40 h-40 bg-yellow-300/10 rounded-full blur-2xl pointer-events-none" />

          <button
            onClick={goBack}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center mb-6"
          >
            <Icon name="ChevronLeft" size={20} className="text-white" />
          </button>

          <div className="relative z-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 shadow-xl">
              <Icon name="Sparkles" size={28} className="text-white" />
            </div>
            <h1 className="text-white font-extrabold text-2xl leading-tight mb-2">
              Сфоткай задачу или задай вопрос
            </h1>
            <p className="text-white/60 text-sm">
              ИИ решит за секунды — без регистрации
            </p>
          </div>
        </div>

        {/* White bottom card */}
        <div className="flex-1 bg-white -mt-4 rounded-t-3xl px-6 pt-8 pb-8 flex flex-col gap-5">
          {/* Photo buttons */}
          <div className="flex gap-3">
            <Button
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base rounded-2xl shadow-[0_4px_20px_rgba(99,102,241,0.35)] hover:opacity-95 active:scale-[0.98] transition-all"
            >
              <span className="text-xl mr-2">
                <Icon name="Camera" size={20} className="inline" />
              </span>
              Сфоткать задачу
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="flex-1 h-14 font-bold text-base rounded-2xl border-2 border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all"
            >
              <span className="text-xl mr-2">
                <Icon name="Image" size={20} className="inline" />
              </span>
              Из галереи
            </Button>
          </div>

          {/* Text input area */}
          <div className="relative">
            <textarea
              value={ahaQuestion}
              onChange={e => setAhaQuestion(e.target.value)}
              placeholder="Или напиши вопрос текстом..."
              rows={3}
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-purple-400 transition-colors pr-12"
            />
            {ahaQuestion.trim().length > 0 && (
              <button
                onClick={handleTextQuestion}
                className="absolute right-3 bottom-3 w-9 h-9 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center shadow-md active:scale-95 transition-all"
              >
                <Icon name="Send" size={16} className="text-white" />
              </button>
            )}
          </div>

          {/* Floating examples */}
          <FloatingExamples />

          {/* Hidden file inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onFileChange}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileChange}
          />
        </div>
      </div>
    );
  }

  // ─── SOLVING ────────────────────────────────────────────────────────────────
  if (screen === 'solving') {
    const phrases = ahaResultType === 'photo' ? SOLVING_PHRASES_PHOTO : SOLVING_PHRASES_TEXT;
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="px-6 pt-14 pb-6">
          {/* Show uploaded photo */}
          {ahaResultType === 'photo' && ahaImagePreview && (
            <div className="w-full max-w-[200px] mx-auto mb-8 rounded-2xl overflow-hidden shadow-lg">
              <img src={ahaImagePreview} alt="" className="w-full h-auto" />
            </div>
          )}

          {/* Show question text */}
          {ahaResultType === 'text' && ahaQuestion && (
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl px-4 py-3 mb-8 text-white">
              <p className="text-xs font-semibold text-white/70 mb-1">Твой вопрос</p>
              <p className="text-sm font-medium leading-relaxed text-white/95">{ahaQuestion}</p>
            </div>
          )}

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            {ahaError ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <span className="text-3xl">😔</span>
                <p className="text-gray-600 text-center">Не удалось решить. Переходим к регистрации...</p>
              </div>
            ) : (
              <SolvingAnimation phrases={phrases} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── RESULT ─────────────────────────────────────────────────────────────────
  if (screen === 'result') {
    const hasStructuredResult = ahaResult && (ahaResult.structured || ahaResult.solution);

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="px-4 pt-10 pb-6 flex-1 overflow-y-auto">
          {/* Photo result */}
          {ahaResultType === 'photo' && hasStructuredResult && (
            <>
              {ahaImagePreview && (
                <div className="w-full max-w-[140px] mx-auto mb-5 rounded-xl overflow-hidden shadow-md opacity-80">
                  <img src={ahaImagePreview} alt="" className="w-full h-auto" />
                </div>
              )}

              {ahaResult!.recognized_text && (
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl px-4 py-3 mb-4 text-white">
                  <p className="text-xs font-semibold text-white/70 mb-1">Условие задачи</p>
                  <div className="text-sm font-medium leading-relaxed">
                    <AiText text={ahaResult!.recognized_text} className="[&_p]:text-white/95 [&_strong]:text-white" />
                  </div>
                </div>
              )}

              {ahaResult!.structured?.steps?.length ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-50 bg-violet-50/50">
                    <Icon name="ListOrdered" size={15} className="text-violet-600" />
                    <span className="text-sm font-bold text-gray-800">Пошаговое решение</span>
                  </div>
                  <div className="p-4 space-y-4">
                    {ahaResult!.structured!.steps.map((step, i) => (
                      <div key={i} className="flex gap-3">
                        <span className="text-lg flex-shrink-0 mt-0.5">
                          {STEP_ICONS[step.icon] || (i === ahaResult!.structured!.steps.length - 1 ? '-->>' : '-->')}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-[15px] mb-1">{step.title}</p>
                          <AiText text={step.text} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {ahaResult!.structured?.answer && (
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl px-4 py-4 shadow-md mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">!</span>
                    <span className="text-white/80 text-xs font-semibold uppercase tracking-wider">Ответ</span>
                  </div>
                  <p className="text-white font-bold text-xl leading-snug">{ahaResult!.structured!.answer}</p>
                </div>
              )}

              {!ahaResult!.structured && ahaResult!.solution && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
                  <AiText text={ahaResult!.solution} />
                </div>
              )}

              {ahaResult!.structured?.check && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 mb-4">
                  <div className="flex items-start gap-2">
                    <span className="text-base mt-0.5">
                      <Icon name="Search" size={16} className="text-blue-600" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-blue-600 mb-1">Проверка</p>
                      <AiText text={ahaResult!.structured!.check} />
                    </div>
                  </div>
                </div>
              )}

              {ahaResult!.structured?.tip && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4">
                  <div className="flex items-start gap-2">
                    <span className="text-base mt-0.5">
                      <Icon name="Lightbulb" size={16} className="text-amber-600" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-amber-700 mb-1">Совет</p>
                      <AiText text={ahaResult!.structured!.tip} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Text result */}
          {ahaResultType === 'text' && (ahaTextAnswer || hasStructuredResult) && (
            <>
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl px-4 py-3 mb-4 text-white">
                <p className="text-xs font-semibold text-white/70 mb-1">Твой вопрос</p>
                <p className="text-sm font-medium leading-relaxed text-white/95">{ahaQuestion}</p>
              </div>

              {ahaTextAnswer && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
                  <AiText text={ahaTextAnswer} />
                </div>
              )}

              {hasStructuredResult && ahaResult!.solution && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
                  <AiText text={ahaResult!.solution} />
                </div>
              )}
            </>
          )}

          {/* Celebration CTA block */}
          <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border border-indigo-100 rounded-2xl p-5 mt-6">
            <div className="text-center">
              <p className="text-2xl mb-2">!</p>
              <p className="font-bold text-gray-900 text-lg mb-1">Вот так это работает!</p>
              <p className="text-gray-600 text-sm mb-1">Хочешь решать без ограничений?</p>
              <p className="text-gray-400 text-xs mb-5">
                Регистрация за 15 секунд. 3 дня Premium в подарок.
              </p>
              <Button
                onClick={() => goTo('register')}
                className="w-full h-14 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base rounded-2xl shadow-[0_4px_20px_rgba(99,102,241,0.35)] hover:opacity-95 active:scale-[0.98] transition-all mb-3"
              >
                Продолжить бесплатно
                <Icon name="ArrowRight" size={18} className="ml-2" />
              </Button>
              <VKButton onClick={handleVKLogin} loading={vkLoading} disabled={loading} />
              <p className="text-gray-400 text-xs mt-3">3 дня Premium в подарок</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── REGISTER ───────────────────────────────────────────────────────────────
  if (screen === 'register') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        <div className="px-5 pt-12 pb-4">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Icon name="ChevronLeft" size={20} className="text-white" />
            </button>
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
                  type="text"
                  placeholder="Имя (необязательно)"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoComplete="name"
                  className="h-12 border-2 rounded-2xl text-sm border-gray-200 focus:border-purple-400"
                />
              </div>
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
                {password.length >= 8 && <p className="text-xs text-green-500 mt-1">Хороший пароль</p>}
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
                {loading ? <Icon name="Loader2" size={18} className="animate-spin" /> : 'Создать аккаунт'}
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

  // ─── LOGIN ──────────────────────────────────────────────────────────────────
  if (screen === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col items-center justify-center p-5 relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 w-full max-w-sm flex flex-col gap-4">
          <button onClick={() => setScreen('splash')} className="flex items-center gap-1 text-white/70 hover:text-white text-sm self-start">
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
                <button onClick={() => { clearErrors(); setScreen('splash'); }} className="text-purple-600 font-medium hover:underline">
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

  // ─── FORGOT ─────────────────────────────────────────────────────────────────
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