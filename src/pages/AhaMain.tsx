import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import AiText from '@/components/AiText';
import { API } from '@/lib/api-urls';
import { authService } from '@/lib/auth';

interface StructuredStep {
  icon: string;
  title: string;
  text: string;
}

interface StructuredResponse {
  steps: StructuredStep[];
  answer: string;
  check: string;
  tip: string;
  practice: { text: string }[];
  motivation: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  structured?: StructuredResponse;
  recognizedText?: string;
  subject?: string;
  timestamp: number;
}

function getFingerprint(): string {
  let fp = localStorage.getItem('aha_fp');
  if (fp) return fp;
  fp = Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem('aha_fp', fp);
  return fp;
}

/* ─── Limit management system ─── */

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function isInitialUsed(): boolean {
  return localStorage.getItem('aha_initial_used') === 'true';
}

function markInitialUsed(): void {
  localStorage.setItem('aha_initial_used', 'true');
}

function getInitialPhotosLeft(): number {
  const stored = localStorage.getItem('aha_photos_left');
  if (stored !== null) return parseInt(stored, 10);
  localStorage.setItem('aha_photos_left', '2');
  return 2;
}

function getInitialQuestionsLeft(): number {
  const stored = localStorage.getItem('aha_questions_left');
  if (stored !== null) return parseInt(stored, 10);
  localStorage.setItem('aha_questions_left', '2');
  return 2;
}

function decrementInitialPhotos(): number {
  const current = getInitialPhotosLeft();
  const next = Math.max(0, current - 1);
  localStorage.setItem('aha_photos_left', String(next));
  return next;
}

function decrementInitialQuestions(): number {
  const current = getInitialQuestionsLeft();
  const next = Math.max(0, current - 1);
  localStorage.setItem('aha_questions_left', String(next));
  return next;
}

function ensureDailyReset(): void {
  const today = getTodayStr();
  const lastReset = localStorage.getItem('aha_daily_reset');
  if (lastReset !== today) {
    localStorage.setItem('aha_daily_reset', today);
    localStorage.setItem('aha_daily_photos', '0');
    localStorage.setItem('aha_daily_questions', '0');
  }
}

function getDailyPhotosUsed(): number {
  ensureDailyReset();
  return parseInt(localStorage.getItem('aha_daily_photos') || '0', 10);
}

function getDailyQuestionsUsed(): number {
  ensureDailyReset();
  return parseInt(localStorage.getItem('aha_daily_questions') || '0', 10);
}

function incrementDailyPhotos(): void {
  ensureDailyReset();
  const used = getDailyPhotosUsed() + 1;
  localStorage.setItem('aha_daily_photos', String(used));
}

function incrementDailyQuestions(): void {
  ensureDailyReset();
  const used = getDailyQuestionsUsed() + 1;
  localStorage.setItem('aha_daily_questions', String(used));
}

const DAILY_PHOTO_LIMIT = 1;
const DAILY_QUESTION_LIMIT = 3;

interface Limits {
  photosLeft: number;
  questionsLeft: number;
  mode: 'initial' | 'daily';
}

function getLimits(): Limits {
  if (!isInitialUsed()) {
    return {
      photosLeft: getInitialPhotosLeft(),
      questionsLeft: getInitialQuestionsLeft(),
      mode: 'initial',
    };
  }
  ensureDailyReset();
  return {
    photosLeft: Math.max(0, DAILY_PHOTO_LIMIT - getDailyPhotosUsed()),
    questionsLeft: Math.max(0, DAILY_QUESTION_LIMIT - getDailyQuestionsUsed()),
    mode: 'daily',
  };
}

/* ─── End limit management ─── */

function loadChatHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem('aha_chat_history');
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveChatHistory(messages: ChatMessage[]) {
  const trimmed = messages.slice(-20);
  localStorage.setItem('aha_chat_history', JSON.stringify(trimmed));
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > 1200) {
          h = Math.round((h * 1200) / w);
          w = 1200;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context failed'));
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const EXAMPLE_CHIPS = [
  'Реши 2x\u00b2 \u2013 5x + 3 = 0',
  'Что такое валентность',
  'Объясни теорему Пифагора',
];

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-indigo-400"
          style={{
            animation: 'aha-main-bounce 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes aha-main-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </span>
  );
}

function StructuredAnswer({ structured }: { structured: StructuredResponse }) {
  return (
    <div className="space-y-3 mt-2">
      {structured.answer && (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 p-4 shadow-lg shadow-green-200/50">
          <p className="text-green-100 text-xs font-semibold uppercase tracking-wider mb-1">
            Ответ:
          </p>
          <p className="text-white font-bold text-lg leading-snug">
            {structured.answer}
          </p>
        </div>
      )}

      {structured.steps && structured.steps.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="font-heading font-bold text-sm text-gray-900 mb-3 flex items-center gap-2">
            <Icon name="ListOrdered" size={16} className="text-indigo-500" />
            Решение по шагам
          </h3>
          <div className="space-y-3">
            {structured.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center text-[11px] font-bold text-indigo-600 mt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  {step.title && (
                    <p className="font-semibold text-[13px] text-gray-800 mb-0.5">
                      {step.title}
                    </p>
                  )}
                  <AiText text={step.text} className="text-sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {structured.check && (
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
          <h3 className="font-semibold text-[13px] text-blue-800 mb-1.5 flex items-center gap-2">
            <Icon name="CheckCircle" size={14} className="text-blue-500" />
            Проверка
          </h3>
          <AiText text={structured.check} variant="info" className="text-sm" />
        </div>
      )}

      {structured.tip && (
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
          <div className="flex items-start gap-2">
            <span className="text-base flex-shrink-0">💡</span>
            <AiText text={structured.tip} variant="warning" className="text-sm" />
          </div>
        </div>
      )}
    </div>
  );
}

const PAYWALL_BENEFITS = [
  { icon: 'MessageCircle', text: 'Безлимитные вопросы к ИИ', sub: 'Спрашивай сколько хочешь, без ограничений' },
  { icon: 'Camera', text: 'Безлимитные фото-решения', sub: 'Фоткай и получай мгновенный разбор' },
  { icon: 'Headphones', text: 'Аудио-объяснения', sub: 'Слушай и понимай на ходу' },
  { icon: 'Target', text: 'Персональный план подготовки', sub: 'ИИ составит план под твой экзамен' },
  { icon: 'GraduationCap', text: 'Занятия с ИИ-репетитором', sub: 'Интерактивные уроки по всем предметам' },
  { icon: 'FileCheck', text: 'Разборы экзаменов ЕГЭ/ОГЭ', sub: 'Реальные задания с пошаговыми решениями' },
];

export default function AhaMain() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (authService.isAuthenticated()) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const [messages, setMessages] = useState<ChatMessage[]>(loadChatHistory);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [limits, setLimitsState] = useState<Limits>(getLimits);
  const [showPaywall, setShowPaywall] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ base64: string; preview: string } | null>(null);

  /* Handle payment return from YooKassa */
  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      localStorage.setItem('aha_payment_completed', 'true');
      navigate('/auth?after_payment=true');
    }
  }, [searchParams, navigate]);



  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const refreshLimits = useCallback(() => {
    setLimitsState(getLimits());
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  useEffect(() => {
    saveChatHistory(messages);
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = parseFloat(getComputedStyle(el).lineHeight) * 4 + 24;
    el.style.height = Math.min(el.scrollHeight, max) + 'px';
  }, []);

  useEffect(() => {
    autoResize();
  }, [input, autoResize]);

  const genId = useCallback(() => {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }, []);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const checkInitialExhausted = useCallback(() => {
    if (!isInitialUsed()) {
      const p = getInitialPhotosLeft();
      const q = getInitialQuestionsLeft();
      if (p <= 0 && q <= 0) {
        markInitialUsed();
        refreshLimits();
      }
    }
  }, [refreshLimits]);

  const submitText = useCallback(
    async (q: string) => {
      const currentLimits = getLimits();
      if (currentLimits.questionsLeft <= 0) {
        // If daily mode and all limits gone, do nothing (banner is visible)
        // If somehow called, just return
        return;
      }

      const userMsg: ChatMessage = {
        id: genId(),
        role: 'user',
        content: q,
        timestamp: Date.now(),
      };
      addMessage(userMsg);
      setInput('');
      setLoading(true);

      try {
        const res = await fetch(API.AI_ASSISTANT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'free_ask',
            question: q,
            fingerprint: getFingerprint(),
          }),
        });

        if (res.status === 429) {
          // Server-side rate limit — treat as exhausted
          if (!isInitialUsed()) {
            localStorage.setItem('aha_questions_left', '0');
            localStorage.setItem('aha_photos_left', '0');
            markInitialUsed();
            setShowPaywall(true);
          }
          refreshLimits();
          setLoading(false);
          return;
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          addMessage({
            id: genId(),
            role: 'assistant',
            content: errText || 'Что-то пошло не так. Попробуй ещё раз.',
            timestamp: Date.now(),
          });
          setLoading(false);
          return;
        }

        const data = await res.json();

        // Decrement the appropriate counter
        if (!isInitialUsed()) {
          decrementInitialQuestions();
        } else {
          incrementDailyQuestions();
        }
        refreshLimits();

        addMessage({
          id: genId(),
          role: 'assistant',
          content: data.answer,
          timestamp: Date.now(),
        });

        // Check if initial limits fully exhausted after this question
        checkInitialExhausted();
      } catch {
        addMessage({
          id: genId(),
          role: 'assistant',
          content: 'Не удалось подключиться к серверу.',
          timestamp: Date.now(),
        });
      }
      setLoading(false);
    },
    [genId, addMessage, refreshLimits, checkInitialExhausted]
  );

  const submitPhoto = useCallback(
    async (base64: string, preview: string) => {
      const currentLimits = getLimits();
      if (currentLimits.photosLeft <= 0) {
        return;
      }

      const userMsg: ChatMessage = {
        id: genId(),
        role: 'user',
        content: '',
        image: preview,
        timestamp: Date.now(),
      };
      addMessage(userMsg);
      setSelectedImage(null);
      setLoading(true);

      try {
        const res = await fetch(API.AI_ASSISTANT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'free_photo_solve',
            image_base64: base64,
            hint: '',
            fingerprint: getFingerprint(),
          }),
        });

        if (res.status === 429) {
          if (!isInitialUsed()) {
            localStorage.setItem('aha_questions_left', '0');
            localStorage.setItem('aha_photos_left', '0');
            markInitialUsed();
            setShowPaywall(true);
          }
          refreshLimits();
          setLoading(false);
          return;
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          addMessage({
            id: genId(),
            role: 'assistant',
            content: errText || 'Что-то пошло не так. Попробуй ещё раз.',
            timestamp: Date.now(),
          });
          setLoading(false);
          return;
        }

        const data = await res.json();

        // Decrement the appropriate counter
        if (!isInitialUsed()) {
          decrementInitialPhotos();
        } else {
          incrementDailyPhotos();
        }
        refreshLimits();

        addMessage({
          id: genId(),
          role: 'assistant',
          content: data.solution || '',
          structured: data.structured,
          recognizedText: data.recognized_text,
          subject: data.subject,
          timestamp: Date.now(),
        });

        // Check if initial limits fully exhausted after this photo
        checkInitialExhausted();
      } catch {
        addMessage({
          id: genId(),
          role: 'assistant',
          content: 'Не удалось подключиться к серверу.',
          timestamp: Date.now(),
        });
      }
      setLoading(false);
    },
    [genId, addMessage, refreshLimits, checkInitialExhausted]
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      try {
        const preview = URL.createObjectURL(file);
        const base64 = await compressImage(file);
        if (messages.length === 0) {
          submitPhoto(base64, preview);
        } else {
          setSelectedImage({ base64, preview });
        }
      } catch {
        /* silently fail */
      }
    },
    [messages.length, submitPhoto]
  );

  const handleSend = useCallback(() => {
    if (selectedImage) {
      submitPhoto(selectedImage.base64, selectedImage.preview);
      return;
    }
    const q = input.trim();
    if (!q) return;
    submitText(q);
  }, [input, selectedImage, submitText, submitPhoto]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleFollowUp = useCallback(
    (prompt: string) => {
      submitText(prompt);
    },
    [submitText]
  );

  const handleChipClick = useCallback(
    (chip: string) => {
      submitText(chip);
    },
    [submitText]
  );

  const handleCameraOnEmpty = useCallback(() => {
    cameraInputRef.current?.click();
  }, []);

  const createPayment = async () => {
    setPaymentLoading(true);
    try {
      const res = await fetch(API.PAYMENTS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_guest_payment',
          plan_type: '1month',
          fingerprint: getFingerprint(),
          return_url: window.location.origin + '/auth?after_payment=true',
        }),
      });
      const data = await res.json();
      if (data.confirmation_url) {
        localStorage.setItem('aha_pending_payment', data.payment_id || '');
        window.location.href = data.confirmation_url;
      }
    } catch {
      // payment error — silently fail, button will re-enable
    }
    setPaymentLoading(false);
  };

  const hasMessages = messages.length > 0;

  const allDailyExhausted = limits.mode === 'daily' && limits.photosLeft <= 0 && limits.questionsLeft <= 0;

  const photoDisabled = limits.photosLeft <= 0;
  const questionDisabled = limits.questionsLeft <= 0;

  // Build the counter label for photos
  const photoCountLabel = (() => {
    const n = limits.photosLeft;
    if (n === 0) return '0 фото';
    if (n === 1) return '1 фото';
    return `${n} фото`;
  })();

  // Build the counter label for questions
  const questionCountLabel = (() => {
    const n = limits.questionsLeft;
    if (n === 0) return '0 вопросов';
    if (n === 1) return '1 вопрос';
    if (n >= 2 && n <= 4) return `${n} вопроса`;
    return `${n} вопросов`;
  })();

  return (
    <div className="h-[100dvh] flex flex-col bg-gray-50">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="sticky top-0 z-30 bg-indigo-600 px-4 py-3 flex items-center gap-2">
        <Icon name="Sparkles" size={20} className="text-indigo-200" />
        <span className="font-heading font-bold text-base text-white">Studyfay</span>
      </div>

      {/* Counter display: separate photo + question counters */}
      {!allDailyExhausted && (
        <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-indigo-200 text-[13px] font-medium">
            <span className={limits.photosLeft > 0 ? 'text-indigo-700' : 'text-gray-400'}>
              <span className="mr-0.5">📷</span> {photoCountLabel}
            </span>
            <span className="text-gray-300">·</span>
            <span className={limits.questionsLeft > 0 ? 'text-indigo-700' : 'text-gray-400'}>
              <span className="mr-0.5">💬</span> {questionCountLabel}
            </span>
          </span>
        </div>
      )}

      {/* Daily limits exhausted banner */}
      {allDailyExhausted && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex flex-col items-center gap-2">
          <span className="text-[13px] font-medium text-amber-800 text-center">
            Лимит на сегодня исчерпан. Возвращайся завтра или оформи подписку
          </span>
          <button
            onClick={() => setShowPaywall(true)}
            className="px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[12px] font-semibold shadow-sm active:scale-95 transition-transform"
          >
            Подписка 499 ₽/мес
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {!hasMessages && (
          <div className="flex flex-col items-center justify-center px-5 pt-16 pb-8 max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mb-5">
              <Icon name="Sparkles" size={28} className="text-indigo-500" />
            </div>
            <h1 className="font-heading font-extrabold text-[22px] text-gray-900 mb-2 text-center">
              Спроси что угодно
            </h1>
            <p className="text-gray-500 text-[14px] mb-8 text-center">
              Решу задачу, объясню тему, помогу с домашкой
            </p>

            <div className="flex flex-wrap gap-2 justify-center mb-6 w-full">
              {EXAMPLE_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleChipClick(chip)}
                  disabled={questionDisabled}
                  className="no-mobile-padding px-4 py-2.5 rounded-full bg-white border border-gray-200 text-[13px] text-gray-600 font-medium active:bg-indigo-50 active:border-indigo-300 transition-colors shadow-sm disabled:opacity-40"
                >
                  {chip}
                </button>
              ))}
            </div>

            <button
              onClick={handleCameraOnEmpty}
              disabled={photoDisabled}
              className="no-mobile-padding flex items-center justify-center gap-2.5 w-full max-w-xs h-14 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-[15px] shadow-lg shadow-indigo-200 active:scale-[0.97] transition-transform disabled:opacity-40"
            >
              <Icon name="Camera" size={20} className="text-white" />
              Сфоткать задачу
            </button>
          </div>
        )}

        {hasMessages && (
          <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">
            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.role === 'user' && (
                  <div className="flex justify-end">
                    <div className="max-w-[80%]">
                      {msg.image && (
                        <div className="rounded-2xl overflow-hidden border border-indigo-200 shadow-sm mb-1.5 max-w-[200px] ml-auto">
                          <img
                            src={msg.image}
                            alt=""
                            className="w-full max-h-40 object-cover"
                          />
                        </div>
                      )}
                      {msg.content && (
                        <div className="bg-indigo-600 text-white rounded-2xl rounded-br-md px-4 py-3 text-[15px]">
                          {msg.content}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {msg.role === 'assistant' && (
                  <div className="flex items-start gap-2.5">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mt-0.5">
                      <Icon name="Sparkles" size={14} className="text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0 max-w-[85%]">
                      {msg.structured ? (
                        <StructuredAnswer structured={msg.structured} />
                      ) : (
                        <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-gray-100">
                          <AiText text={msg.content} />
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 mt-2.5">
                        <button
                          onClick={() =>
                            handleFollowUp(
                              `Объясни проще: ${msg.content.slice(0, 200)}`
                            )
                          }
                          disabled={loading || questionDisabled}
                          className="no-mobile-padding px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-[12px] text-indigo-700 font-medium active:bg-indigo-100 transition-colors disabled:opacity-40"
                        >
                          Объясни проще
                        </button>
                        <button
                          onClick={() =>
                            handleFollowUp(
                              `Дай похожее задание по теме: ${msg.content.slice(0, 200)}`
                            )
                          }
                          disabled={loading || questionDisabled}
                          className="no-mobile-padding px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-[12px] text-indigo-700 font-medium active:bg-indigo-100 transition-colors disabled:opacity-40"
                        >
                          Похожее задание
                        </button>
                        <button
                          onClick={() => navigate('/auth')}
                          className="no-mobile-padding px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-[12px] text-violet-700 font-medium active:bg-violet-100 transition-colors"
                        >
                          Прокачать тему
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-start gap-2.5">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mt-0.5">
                  <Icon name="Sparkles" size={14} className="text-indigo-500" />
                </div>
                <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3.5 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <TypingDots />
                    <span className="text-indigo-500 text-sm font-medium">Думаю...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        )}

        {!hasMessages && <div ref={chatEndRef} />}
      </div>

      {/* Paywall modal — shown when initial limits are exhausted and on every visit */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-5 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-7 max-w-sm w-full text-center shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mx-auto mb-4">
              <Icon name="Sparkles" size={26} className="text-indigo-500" />
            </div>
            <h2 className="font-heading font-bold text-xl text-gray-900 mb-1.5">
              Тебе понравилось?
            </h2>
            <p className="text-gray-500 text-[15px] mb-5 leading-relaxed">
              Оформи подписку — учись без ограничений
            </p>

            {/* Price block */}
            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-4 mb-5">
              <p className="font-heading font-extrabold text-3xl text-gray-900">
                499 <span className="text-lg font-bold">₽/мес</span>
              </p>
              <p className="text-gray-500 text-[12px] mt-1">
                Отменить можно в любой момент
              </p>
            </div>

            {/* Benefits list */}
            <div className="text-left space-y-3 mb-6">
              {PAYWALL_BENEFITS.map((benefit) => (
                <div key={benefit.text} className="flex items-start gap-2.5">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center mt-0.5">
                    <Icon name={benefit.icon} size={16} className="text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-gray-800 leading-tight">{benefit.text}</p>
                    <p className="text-[12px] text-gray-500 leading-snug mt-0.5">{benefit.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={createPayment}
              disabled={paymentLoading}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-[14px] hover:opacity-90 disabled:opacity-60"
            >
              {paymentLoading ? 'Загрузка...' : 'Оформить подписку — 499 ₽/мес'}
            </Button>

            <button
              onClick={() => setShowPaywall(false)}
              className="mt-3 text-gray-400 text-[12px] font-medium block mx-auto hover:text-gray-500 transition-colors"
            >
              Не сейчас
            </button>

            <p className="text-gray-400 text-[11px] mt-4">
              Гарантия возврата 14 дней
            </p>
          </div>
        </div>
      )}

      <div className="sticky bottom-0 z-20 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        {selectedImage && (
          <div className="px-4 pt-3 pb-1">
            <div className="relative inline-block">
              <img
                src={selectedImage.preview}
                alt=""
                className="h-16 rounded-xl border border-gray-200 object-cover"
              />
              <button
                onClick={() => setSelectedImage(null)}
                className="no-mobile-padding absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-800 text-white flex items-center justify-center"
              >
                <Icon name="X" size={12} />
              </button>
            </div>
          </div>
        )}

        <div className="px-3 py-2.5 flex items-end gap-2">
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={loading || photoDisabled}
            className="no-mobile-padding flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 active:bg-gray-100 transition-colors disabled:opacity-40"
          >
            <Icon name="Camera" size={20} />
          </button>
          <button
            onClick={() => galleryInputRef.current?.click()}
            disabled={loading || photoDisabled}
            className="no-mobile-padding flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 active:bg-gray-100 transition-colors disabled:opacity-40"
          >
            <Icon name="Image" size={20} />
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={questionDisabled ? 'Лимит вопросов исчерпан' : 'Задай вопрос...'}
            rows={1}
            disabled={loading || questionDisabled}
            className="no-mobile-padding flex-1 resize-none rounded-2xl border border-gray-200 focus:border-indigo-400 bg-gray-50 px-4 py-2.5 text-[15px] text-gray-800 placeholder:text-gray-400 outline-none transition-colors disabled:opacity-50 min-h-[40px]"
          />

          <button
            onClick={handleSend}
            disabled={loading || (!input.trim() && !selectedImage)}
            className="no-mobile-padding flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-center text-white active:scale-90 transition-transform disabled:opacity-40"
          >
            <Icon name="ArrowUp" size={18} />
          </button>
        </div>

        <div className="pb-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}