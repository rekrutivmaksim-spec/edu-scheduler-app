import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { authService } from '@/lib/auth';
import { API } from '@/lib/api-urls';
import AiText from '@/components/AiText';

type Stage = 'upload' | 'solving' | 'result';

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

const SOLVING_PHRASES = [
  { text: 'Распознаю задачу...', emoji: '🔍' },
  { text: 'Подбираю формулы...', emoji: '📐' },
  { text: 'Решаю пошагово...', emoji: '✨' },
  { text: 'Проверяю ответ...', emoji: '✅' },
];

const EXAMPLE_TEXTS = [
  '2x² + 3x - 5 = 0',
  'Найти производную f(x)=sin(2x)',
  'Напиши сочинение по Евгению Онегину',
  'Закон Ома для участка цепи',
  'Валентность кислорода',
];

const STEP_ICONS: Record<string, string> = {
  arrow: '➡️',
  pin: '📌',
  check: '✅',
};

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

function FloatingExamples() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActive(prev => (prev + 1) % EXAMPLE_TEXTS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-2 mt-6">
      <p className="text-white/40 text-xs font-medium uppercase tracking-wider">Например</p>
      <div className="h-8 relative overflow-hidden">
        {EXAMPLE_TEXTS.map((text, i) => (
          <div
            key={i}
            className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
              i === active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <span className="text-white/60 text-sm font-mono bg-white/10 px-4 py-1.5 rounded-full">
              {text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SolvingAnimation({ phrases }: { phrases: typeof SOLVING_PHRASES }) {
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

export default function AhaFirst() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>('upload');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate('/auth');
    }
  }, [navigate]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 15 * 1024 * 1024) return;

    const preview = URL.createObjectURL(file);
    setImagePreview(preview);
    setStage('solving');

    try {
      const base64 = await compressImage(file);
      const token = authService.getToken();
      const resp = await fetch(API.AI_ASSISTANT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'photo_solve',
          image_base64: base64,
          hint: '',
        }),
      });

      if (!resp.ok) {
        setError(true);
        setTimeout(() => {
          localStorage.setItem('aha_first_done', '1');
          navigate('/onboarding');
        }, 1500);
        return;
      }

      const data = await resp.json() as SolveResult;
      setResult(data);
      localStorage.setItem('aha_first_done', '1');
      setTimeout(() => setStage('result'), 800);
    } catch {
      setError(true);
      setTimeout(() => {
        localStorage.setItem('aha_first_done', '1');
        navigate('/onboarding');
      }, 1500);
    }
  }, [navigate]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const goOnboarding = () => {
    localStorage.setItem('aha_first_done', '1');
    navigate('/onboarding');
  };

  if (stage === 'upload') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-800 flex flex-col relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-32 w-96 h-96 bg-pink-400/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 right-0 w-40 h-40 bg-yellow-300/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
          <div className="w-20 h-20 rounded-3xl bg-white/15 backdrop-blur-sm flex items-center justify-center mb-8 shadow-2xl">
            <Icon name="Sparkles" size={36} className="text-white" />
          </div>

          <h1 className="text-white font-extrabold text-[26px] leading-tight text-center mb-3">
            Сфоткай задачу —{'\n'}ИИ решит за секунды
          </h1>
          <p className="text-white/60 text-base text-center leading-relaxed max-w-xs">
            Домашка, пример, уравнение — просто наведи камеру
          </p>

          <div className="flex gap-3 mt-10 w-full max-w-sm">
            <Button
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1 h-14 bg-white text-indigo-700 font-bold text-base rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:bg-white/95 active:scale-[0.98] transition-all"
            >
              <span className="text-xl mr-2">📷</span>
              Сфоткать
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 h-14 bg-white/15 backdrop-blur-sm text-white font-bold text-base rounded-2xl border border-white/20 hover:bg-white/25 active:scale-[0.98] transition-all"
            >
              <span className="text-xl mr-2">🖼️</span>
              Из галереи
            </Button>
          </div>

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

          <FloatingExamples />
        </div>

        <div className="pb-8 pt-4 flex justify-center relative z-10">
          <button
            onClick={goOnboarding}
            className="text-white/40 text-sm hover:text-white/60 transition-colors"
          >
            Пропустить
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'solving') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="px-6 pt-14 pb-6">
          {imagePreview && (
            <div className="w-full max-w-[200px] mx-auto mb-8 rounded-2xl overflow-hidden shadow-lg">
              <img src={imagePreview} alt="" className="w-full h-auto" />
            </div>
          )}

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            {error ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <span className="text-3xl">😔</span>
                <p className="text-gray-600 text-center">Не удалось решить. Переходим к настройке...</p>
              </div>
            ) : (
              <SolvingAnimation phrases={SOLVING_PHRASES} />
            )}
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'result' && result) {
    const s = result.structured;
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="px-4 pt-10 pb-6 flex-1 overflow-y-auto">
          {imagePreview && (
            <div className="w-full max-w-[140px] mx-auto mb-5 rounded-xl overflow-hidden shadow-md opacity-80">
              <img src={imagePreview} alt="" className="w-full h-auto" />
            </div>
          )}

          {result.recognized_text && (
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl px-4 py-3 mb-4 text-white">
              <p className="text-xs font-semibold text-white/70 mb-1">Условие задачи</p>
              <div className="text-sm font-medium leading-relaxed">
                <AiText text={result.recognized_text} className="[&_p]:text-white/95 [&_strong]:text-white" />
              </div>
            </div>
          )}

          {s?.steps?.length ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-50 bg-violet-50/50">
                <Icon name="ListOrdered" size={15} className="text-violet-600" />
                <span className="text-sm font-bold text-gray-800">Пошаговое решение</span>
              </div>
              <div className="p-4 space-y-4">
                {s.steps.map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-lg flex-shrink-0 mt-0.5">
                      {STEP_ICONS[step.icon] || (i === s.steps.length - 1 ? '✅' : '➡️')}
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

          {s?.answer && (
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl px-4 py-4 shadow-md mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🎉</span>
                <span className="text-white/80 text-xs font-semibold uppercase tracking-wider">Ответ</span>
              </div>
              <p className="text-white font-bold text-xl leading-snug">{s.answer}</p>
            </div>
          )}

          {!s && result.solution && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
              <AiText text={result.solution} />
            </div>
          )}

          {s?.check && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 mb-4">
              <div className="flex items-start gap-2">
                <span className="text-base mt-0.5">🔍</span>
                <div>
                  <p className="text-xs font-semibold text-blue-600 mb-1">Проверка</p>
                  <AiText text={s.check} />
                </div>
              </div>
            </div>
          )}

          {s?.tip && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4">
              <div className="flex items-start gap-2">
                <span className="text-base mt-0.5">💡</span>
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-1">Совет</p>
                  <AiText text={s.tip} />
                </div>
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border border-indigo-100 rounded-2xl p-5 mt-6">
            <div className="text-center">
              <p className="text-2xl mb-2">🎉</p>
              <p className="font-bold text-gray-900 text-lg mb-1">Вот так просто!</p>
              <p className="text-gray-600 text-sm mb-1">Сфоткай → получи решение</p>
              <p className="text-gray-400 text-xs mb-5">
                Это работает с ЛЮБЫМ предметом: математика, физика, химия, русский...
              </p>
              <Button
                onClick={goOnboarding}
                className="w-full h-14 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base rounded-2xl shadow-[0_4px_20px_rgba(99,102,241,0.35)] hover:opacity-95 active:scale-[0.98] transition-all"
              >
                Настроить под себя
                <Icon name="ArrowRight" size={18} className="ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
