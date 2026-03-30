import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import AiText from '@/components/AiText';
import { API } from '@/lib/api-urls';
import { authService } from '@/lib/auth';


type PageState = 'action' | 'loading' | 'answer';

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

interface PhotoResponse {
  recognized_text: string;
  solution: string;
  subject: string;
  structured?: StructuredResponse;
}

interface TextResponse {
  answer: string;
}

interface FollowUpEntry {
  question: string;
  answer: string;
}

function getFingerprint(): string {
  let fp = localStorage.getItem('aha_fp');
  if (fp) return fp;
  fp = Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem('aha_fp', fp);
  return fp;
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

const AHA_PHRASES = [
  'Сэкономил тебе 10\u201315 минут',
  'Обычно это ищут на 2\u20133 сайтах',
  'Быстрее, чем листать учебник',
];

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-indigo-400"
          style={{
            animation: 'aha-bounce 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes aha-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </span>
  );
}

function AnimatedBlock({
  delay,
  children,
  className = '',
}: {
  delay: number;
  children: React.ReactNode;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      className={`transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      } ${className}`}
    >
      {children}
    </div>
  );
}

export default function AhaExperience() {
  const navigate = useNavigate();

  useEffect(() => {
    if (authService.isAuthenticated()) {
      navigate('/', { replace: true });
      return;
    }
    if (localStorage.getItem('aha_completed') === 'true') {
      navigate('/aha-main', { replace: true });
    }
  }, [navigate]);

  const [pageState, setPageState] = useState<PageState>('action');
  const [question, setQuestion] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isPhoto, setIsPhoto] = useState(false);
  const [photoResponse, setPhotoResponse] = useState<PhotoResponse | null>(null);
  const [textResponse, setTextResponse] = useState<TextResponse | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [finalTime, setFinalTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [actionCount, setActionCount] = useState(0);
  const [followUps, setFollowUps] = useState<FollowUpEntry[]>([]);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [originalContext, setOriginalContext] = useState('');
  const [ahaCompleted, setAhaCompleted] = useState(
    () => localStorage.getItem('aha_completed') === 'true'
  );
  const [showContinue, setShowContinue] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  const ahaPhrase = useRef(AHA_PHRASES[Math.floor(Math.random() * AHA_PHRASES.length)]).current;

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = parseFloat(getComputedStyle(el).lineHeight) * 4 + 24;
    el.style.height = Math.min(el.scrollHeight, max) + 'px';
  }, []);

  useEffect(() => {
    autoResize();
  }, [question, autoResize]);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    setElapsedTime(0);
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const total = Math.round((Date.now() - startTimeRef.current) / 1000);
    setFinalTime(total);
    return total;
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleError = useCallback(
    (status: number, body: string) => {
      if (status === 429) {
        setRateLimited(true);
        setError(null);
      } else {
        setError(body || 'Что-то пошло не так. Попробуй ещё раз.');
      }
      stopTimer();
      setPageState('answer');
    },
    [stopTimer]
  );

  const submitText = useCallback(
    async (q: string) => {
      setIsPhoto(false);
      setImagePreview(null);
      setImageBase64(null);
      setPhotoResponse(null);
      setTextResponse(null);
      setError(null);
      setRateLimited(false);
      setFollowUps([]);
      setQuestion(q);
      setOriginalContext(q);
      setPageState('loading');
      startTimer();

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
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          handleError(res.status, text);
          return;
        }
        const data: TextResponse = await res.json();
        stopTimer();
        setTextResponse(data);
        setActionCount((c) => {
          const next = c + 1;
          if (next >= 2) {
            localStorage.setItem('aha_completed', 'true');
            localStorage.setItem('aha_initial_used', 'true');
            localStorage.setItem('aha_questions_left', '0');
            localStorage.setItem('aha_photos_left', '0');
            setAhaCompleted(true);
          }
          return next;
        });
        setPageState('answer');
      } catch {
        stopTimer();
        setError('Не удалось подключиться к серверу.');
        setPageState('answer');
      }
    },
    [startTimer, stopTimer, handleError]
  );

  const submitPhoto = useCallback(
    async (base64: string, preview: string) => {
      setIsPhoto(true);
      setImagePreview(preview);
      setImageBase64(base64);
      setPhotoResponse(null);
      setTextResponse(null);
      setError(null);
      setRateLimited(false);
      setFollowUps([]);
      setQuestion('');
      setPageState('loading');
      startTimer();

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
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          handleError(res.status, text);
          return;
        }
        const data: PhotoResponse = await res.json();
        stopTimer();
        setPhotoResponse(data);
        setOriginalContext(data.recognized_text || data.solution || '');
        setActionCount((c) => {
          const next = c + 1;
          if (next >= 2) {
            localStorage.setItem('aha_completed', 'true');
            localStorage.setItem('aha_initial_used', 'true');
            localStorage.setItem('aha_questions_left', '0');
            localStorage.setItem('aha_photos_left', '0');
            setAhaCompleted(true);
          }
          return next;
        });
        setPageState('answer');
      } catch {
        stopTimer();
        setError('Не удалось подключиться к серверу.');
        setPageState('answer');
      }
    },
    [startTimer, stopTimer, handleError]
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      try {
        const preview = URL.createObjectURL(file);
        const base64 = await compressImage(file);
        submitPhoto(base64, preview);
      } catch {
        setError('Не удалось обработать изображение.');
      }
    },
    [submitPhoto]
  );

  const handleSubmitText = useCallback(() => {
    const q = question.trim();
    if (!q) return;
    submitText(q);
  }, [question, submitText]);

  const handleChipClick = useCallback(
    (chip: string) => {
      submitText(chip);
    },
    [submitText]
  );

  const handleFollowUp = useCallback(
    async (label: string, promptPrefix: string) => {
      setFollowUpLoading(true);
      const fullQ = `${promptPrefix}: ${originalContext}`;

      try {
        const res = await fetch(API.AI_ASSISTANT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'free_ask',
            question: fullQ,
            fingerprint: getFingerprint(),
          }),
        });
        if (!res.ok) {
          if (res.status === 429) {
            setRateLimited(true);
          }
          setFollowUpLoading(false);
          return;
        }
        const data: TextResponse = await res.json();
        setFollowUps((prev) => [...prev, { question: label, answer: data.answer }]);
        setActionCount((c) => {
          const next = c + 1;
          if (next >= 2 && !ahaCompleted) {
            localStorage.setItem('aha_completed', 'true');
            localStorage.setItem('aha_initial_used', 'true');
            localStorage.setItem('aha_questions_left', '0');
            localStorage.setItem('aha_photos_left', '0');
            setAhaCompleted(true);
            setTimeout(() => setShowContinue(true), 600);
          }
          return next;
        });
      } catch {
        setError('Не удалось получить ответ.');
      }
      setFollowUpLoading(false);
    },
    [originalContext, ahaCompleted]
  );

  const resetToAction = useCallback(() => {
    setPageState('action');
    setQuestion('');
    setImagePreview(null);
    setImageBase64(null);
    setPhotoResponse(null);
    setTextResponse(null);
    setError(null);
    setRateLimited(false);
    setFollowUps([]);
    setFollowUpLoading(false);
  }, []);

  useEffect(() => {
    if (ahaCompleted && actionCount >= 2) {
      setTimeout(() => setShowContinue(true), 800);
    }
  }, [ahaCompleted, actionCount]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmitText();
      }
    },
    [handleSubmitText]
  );

  if (pageState === 'action') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
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

        <div className="px-5 pt-6 pb-2 flex items-center gap-2">
          <Icon name="Sparkles" size={20} className="text-indigo-500" />
          <span className="font-heading font-bold text-base text-indigo-700">Studyfay</span>
        </div>

        <div className="px-5 pt-8 pb-6 max-w-lg mx-auto">
          <h1 className="font-heading font-extrabold text-[26px] leading-tight text-gray-900 mb-3">
            Сфоткай задачу — разберу и решу
          </h1>
          <p className="text-gray-500 text-[15px] leading-relaxed mb-8">
            Сразу покажу ответ, шаги решения и объяснение
          </p>

          <div className="flex gap-3 mb-6">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="no-mobile-padding flex-1 flex items-center justify-center gap-2 h-14 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-[15px] shadow-lg shadow-indigo-200 active:scale-[0.97] transition-transform"
            >
              <span className="text-lg">📸</span>
              Сфоткать задачу
            </button>
            <button
              onClick={() => galleryInputRef.current?.click()}
              className="no-mobile-padding flex items-center justify-center gap-2 h-14 px-5 rounded-2xl border-2 border-indigo-200 text-indigo-700 font-semibold text-[15px] active:scale-[0.97] transition-transform bg-white"
            >
              <span className="text-lg">🖼</span>
              Из галереи
            </button>
          </div>

          <div className="relative mb-4">
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Например: реши 2x² – 5x + 3 = 0"
              rows={1}
              className="no-mobile-padding w-full resize-none rounded-2xl border-2 border-gray-200 focus:border-indigo-400 bg-white px-4 py-3.5 pr-12 text-[15px] text-gray-800 placeholder:text-gray-400 outline-none transition-colors"
            />
            {question.trim() && (
              <button
                onClick={handleSubmitText}
                className="no-mobile-padding absolute right-2 bottom-2 w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white active:scale-90 transition-transform"
              >
                <Icon name="ArrowUp" size={18} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-10">
            {EXAMPLE_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => handleChipClick(chip)}
                className="no-mobile-padding px-4 py-2.5 rounded-full bg-white border border-gray-200 text-[13px] text-gray-600 font-medium active:bg-indigo-50 active:border-indigo-300 transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>

          <p className="text-center text-[13px] text-gray-400">
            Обычно ответ занимает 3–5 секунд
          </p>
        </div>
      </div>
    );
  }

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white flex flex-col">
        <div className="px-5 pt-6 pb-2 flex items-center gap-2">
          <Icon name="Sparkles" size={20} className="text-indigo-500" />
          <span className="font-heading font-bold text-base text-indigo-700">Studyfay</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-5 max-w-lg mx-auto w-full">
          {imagePreview && (
            <div className="w-full mb-6 animate-fade-in">
              <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                <img
                  src={imagePreview}
                  alt="Задача"
                  className="w-full max-h-48 object-cover"
                />
              </div>
            </div>
          )}

          {!isPhoto && question && (
            <div className="w-full mb-6 animate-fade-in">
              <div className="bg-indigo-600 text-white rounded-2xl rounded-br-md px-4 py-3 text-[15px] max-w-[85%] ml-auto">
                {question}
              </div>
            </div>
          )}

          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
              <TypingDots />
            </div>
            <p className="text-indigo-600 font-semibold text-[15px]">Анализирую...</p>
            <div className="flex items-center gap-1.5 text-gray-400 text-[13px]">
              <Icon name="Clock" size={14} />
              <span>{elapsedTime} сек</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (rateLimited) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white flex flex-col items-center justify-center px-5">
        <div className="max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mx-auto mb-5">
            <Icon name="Sparkles" size={26} className="text-indigo-500" />
          </div>
          <h2 className="font-heading font-bold text-xl text-gray-900 mb-2">
            Впечатляет, правда?
          </h2>
          <p className="text-gray-500 text-[15px] mb-6 leading-relaxed">
            Переходи в полный чат — там ещё больше возможностей
          </p>
          <Button
            onClick={() => navigate('/aha-main')}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-[15px]"
          >
            Продолжить
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white flex flex-col items-center justify-center px-5">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5">
            <Icon name="AlertTriangle" size={28} className="text-red-500" />
          </div>
          <h2 className="font-heading font-bold text-xl text-gray-900 mb-2">Ошибка</h2>
          <p className="text-gray-500 text-[15px] mb-6">{error}</p>
          <Button
            onClick={() => {
              if (isPhoto && imageBase64 && imagePreview) {
                submitPhoto(imageBase64, imagePreview);
              } else if (question) {
                submitText(question);
              } else {
                resetToAction();
              }
            }}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold"
          >
            Попробовать снова
          </Button>
          <button
            onClick={resetToAction}
            className="mt-3 text-indigo-600 text-sm font-medium"
          >
            Назад
          </button>
        </div>
      </div>
    );
  }

  const structured = photoResponse?.structured;
  const hasStructured = isPhoto && structured;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white pb-12">
      <div className="px-5 pt-6 pb-2 flex items-center gap-2">
        <Icon name="Sparkles" size={20} className="text-indigo-500" />
        <span className="font-heading font-bold text-base text-indigo-700">Studyfay</span>
      </div>

      <div className="px-4 pt-4 max-w-lg mx-auto space-y-4">
        {imagePreview && (
          <AnimatedBlock delay={0}>
            <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
              <img
                src={imagePreview}
                alt="Задача"
                className="w-full max-h-40 object-cover"
              />
            </div>
          </AnimatedBlock>
        )}

        {!isPhoto && question && (
          <AnimatedBlock delay={0}>
            <div className="bg-indigo-600 text-white rounded-2xl rounded-br-md px-4 py-3 text-[15px] max-w-[85%] ml-auto">
              {question}
            </div>
          </AnimatedBlock>
        )}

        <AnimatedBlock delay={100}>
          <div className="flex items-center gap-3 py-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
              <Icon name="Check" size={22} className="text-white" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-xl text-gray-900">Готово</h2>
              <p className="text-gray-400 text-[13px]">Решено за {finalTime} сек</p>
            </div>
          </div>
        </AnimatedBlock>

        {hasStructured && structured.answer && (
          <AnimatedBlock delay={300}>
            <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 p-5 shadow-lg shadow-green-200/50">
              <p className="text-green-100 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Ответ:
              </p>
              <p className="text-white font-bold text-xl leading-snug">
                {structured.answer}
              </p>
            </div>
          </AnimatedBlock>
        )}

        {hasStructured && structured.steps && structured.steps.length > 0 && (
          <AnimatedBlock delay={500}>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-heading font-bold text-base text-gray-900 mb-4 flex items-center gap-2">
                <Icon name="ListOrdered" size={18} className="text-indigo-500" />
                Решение по шагам
              </h3>
              <div className="space-y-4">
                {structured.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center text-xs font-bold text-indigo-600 mt-0.5">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      {step.title && (
                        <p className="font-semibold text-sm text-gray-800 mb-0.5">
                          {step.title}
                        </p>
                      )}
                      <AiText text={step.text} className="text-sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedBlock>
        )}

        {hasStructured && structured.check && (
          <AnimatedBlock delay={700}>
            <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
              <h3 className="font-semibold text-sm text-blue-800 mb-2 flex items-center gap-2">
                <Icon name="CheckCircle" size={16} className="text-blue-500" />
                Проверка
              </h3>
              <AiText text={structured.check} variant="info" className="text-sm" />
            </div>
          </AnimatedBlock>
        )}

        {hasStructured && structured.tip && (
          <AnimatedBlock delay={900}>
            <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100">
              <div className="flex items-start gap-2">
                <span className="text-lg flex-shrink-0">💡</span>
                <AiText text={structured.tip} variant="warning" className="text-sm" />
              </div>
            </div>
          </AnimatedBlock>
        )}

        {!hasStructured && textResponse && (
          <AnimatedBlock delay={300}>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <AiText text={textResponse.answer} />
            </div>
          </AnimatedBlock>
        )}

        {!hasStructured && isPhoto && photoResponse && !structured && (
          <AnimatedBlock delay={300}>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <AiText text={photoResponse.solution} />
            </div>
          </AnimatedBlock>
        )}

        <AnimatedBlock delay={hasStructured ? 1100 : 500}>
          <p className="text-center text-[13px] text-gray-400 py-1">{ahaPhrase}</p>
        </AnimatedBlock>

        <AnimatedBlock delay={hasStructured ? 1300 : 700}>
          <div className="space-y-2.5 pt-2">
            <button
              onClick={() =>
                handleFollowUp(
                  'Объясни ещё проще',
                  'Объясни ещё проще'
                )
              }
              disabled={followUpLoading}
              className="no-mobile-padding w-full h-12 rounded-2xl border-2 border-indigo-200 text-indigo-700 font-semibold text-[14px] active:bg-indigo-50 transition-colors disabled:opacity-50 bg-white"
            >
              Объясни ещё проще
            </button>
            <button
              onClick={() =>
                handleFollowUp(
                  'Похожее задание',
                  'Дай похожее задание по теме'
                )
              }
              disabled={followUpLoading}
              className="no-mobile-padding w-full h-12 rounded-2xl border-2 border-indigo-200 text-indigo-700 font-semibold text-[14px] active:bg-indigo-50 transition-colors disabled:opacity-50 bg-white"
            >
              Дай похожее задание
            </button>
            <button
              onClick={resetToAction}
              className="no-mobile-padding w-full h-12 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-[14px] active:bg-gray-50 transition-colors bg-white"
            >
              Задать ещё вопрос
            </button>
          </div>
        </AnimatedBlock>

        {followUpLoading && (
          <div className="flex items-center justify-center gap-3 py-4">
            <TypingDots />
            <span className="text-indigo-500 text-sm font-medium">Отвечаю...</span>
          </div>
        )}

        {followUps.map((fu, i) => (
          <AnimatedBlock key={i} delay={0} className="pt-2">
            <div className="bg-indigo-600 text-white rounded-2xl rounded-br-md px-4 py-3 text-[14px] max-w-[75%] ml-auto mb-3">
              {fu.question}
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <AiText text={fu.answer} />
            </div>
          </AnimatedBlock>
        ))}

        {showContinue && (
          <AnimatedBlock delay={0} className="pt-4 pb-4">
            <button
              onClick={() => navigate('/aha-main')}
              className="no-mobile-padding w-full h-14 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-[16px] shadow-lg shadow-indigo-200 active:scale-[0.97] transition-transform"
            >
              Продолжить
            </button>
          </AnimatedBlock>
        )}
      </div>
    </div>
  );
}