import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { authService } from '@/lib/auth';

const AI_API_URL = 'https://functions.poehali.dev/8e8cbd4e-7731-4853-8e29-a84b3d178249';

const SESSION_TOPIC = {
  subject: 'Математика',
  topic: 'Квадратные уравнения',
};

interface StepDef {
  label: string;
  icon: string;
  prompt: string;
  loaderPhrases: string[];
}

const STEPS: StepDef[] = [
  {
    label: 'Объяснение',
    icon: 'Lightbulb',
    prompt: `Объясни тему "${SESSION_TOPIC.topic}" (${SESSION_TOPIC.subject}) очень коротко — 2–3 предложения простыми словами, без формул и терминов. Как для человека, который первый раз слышит.`,
    loaderPhrases: ['Разбираю тему…', 'Подбираю слова…', 'Готовлю объяснение…'],
  },
  {
    label: 'Пример',
    icon: 'BookOpen',
    prompt: `Дай один конкретный пример по теме "${SESSION_TOPIC.topic}" — покажи как это работает на простом числе или ситуации. Только пример, без длинных объяснений.`,
    loaderPhrases: ['Ищу хороший пример…', 'Подбираю числа…', 'Формирую пример…'],
  },
  {
    label: 'Задание',
    icon: 'PenLine',
    prompt: `Дай одно короткое задание по теме "${SESSION_TOPIC.topic}" уровня базового ЕГЭ. Только условие задачи, без решения.`,
    loaderPhrases: ['Составляю задание…', 'Подбираю сложность…', 'Готовлю условие…'],
  },
];

function sanitize(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/[\u4e00-\u9fff]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

type Screen = 'ready' | 'session' | 'check_anim' | 'done';

export default function Session() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>('ready');
  const [stepIdx, setStepIdx] = useState(0);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [loaderPhrase, setLoaderPhrase] = useState('');
  const [typingText, setTypingText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [checkResult, setCheckResult] = useState('');
  const [checkLoading, setCheckLoading] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loaderRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const currentStep = STEPS[stepIdx];
  const isLastStep = stepIdx === STEPS.length - 1;
  const progressPct = Math.round(((stepIdx + (checkResult ? 1 : 0)) / STEPS.length) * 100);
  const elapsedMin = Math.max(1, Math.round(elapsedSec / 60));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [typingText, checkResult]);

  useEffect(() => {
    return () => {
      if (typingRef.current) clearInterval(typingRef.current);
      if (loaderRef.current) clearInterval(loaderRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startSession = () => {
    const t = Date.now();
    setStartTime(t);
    timerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - t) / 1000));
    }, 1000);
    setScreen('session');
    loadStep(0);
  };

  const startLoaderPhrases = (phrases: string[]) => {
    let i = 0;
    setLoaderPhrase(phrases[0]);
    loaderRef.current = setInterval(() => {
      i = (i + 1) % phrases.length;
      setLoaderPhrase(phrases[i]);
    }, 2200);
  };

  const stopLoaderPhrases = () => {
    if (loaderRef.current) clearInterval(loaderRef.current);
    setLoaderPhrase('');
  };

  const typeText = (full: string, onDone?: () => void) => {
    if (typingRef.current) clearInterval(typingRef.current);
    setIsTyping(true);
    setTypingText('');
    let i = 0;
    typingRef.current = setInterval(() => {
      i++;
      setTypingText(full.slice(0, i));
      if (i >= full.length) {
        clearInterval(typingRef.current!);
        setIsTyping(false);
        onDone?.();
      }
    }, 16);
  };

  const loadStep = async (idx: number) => {
    const step = STEPS[idx];
    setLoading(true);
    setContent('');
    setTypingText('');
    setUserAnswer('');
    setCheckResult('');
    startLoaderPhrases(step.loaderPhrases);

    try {
      const token = authService.getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(AI_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'demo_ask', question: step.prompt }),
      });
      const data = await res.json();
      const raw = sanitize(data.answer || data.response || '');
      stopLoaderPhrases();
      setLoading(false);
      setContent(raw);
      typeText(raw);
    } catch {
      stopLoaderPhrases();
      const fallback = 'Не удалось загрузить. Попробуй ещё раз.';
      setLoading(false);
      setContent(fallback);
      typeText(fallback);
    }
  };

  const checkAnswer = async () => {
    if (!userAnswer.trim()) return;
    setCheckLoading(true);
    startLoaderPhrases(['Проверяю ответ…', 'Смотрю внимательно…', 'Анализирую…']);
    try {
      const token = authService.getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(AI_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'demo_ask',
          question: `Задание: ${content}\n\nОтвет ученика: ${userAnswer}\n\nПроверь ответ. Если правильно — похвали коротко. Если неправильно — объясни где ошибка и дай правильный ответ. 2–3 предложения максимум.`,
          history: [{ role: 'assistant', content }],
        }),
      });
      const data = await res.json();
      const raw = sanitize(data.answer || data.response || '');
      stopLoaderPhrases();
      setCheckLoading(false);
      typeText(raw, () => setCheckResult(raw));
    } catch {
      stopLoaderPhrases();
      setCheckResult('Не удалось проверить. Попробуй ещё раз.');
      setCheckLoading(false);
    }
  };

  const goNext = () => {
    if (isLastStep && checkResult) {
      if (timerRef.current) clearInterval(timerRef.current);
      window.dispatchEvent(new Event('session_completed'));
      if (navigator.vibrate) navigator.vibrate([80, 40, 120]);
      setScreen('check_anim');
      setTimeout(() => setScreen('done'), 950);
      return;
    }
    if (stepIdx < STEPS.length - 1) {
      const next = stepIdx + 1;
      setStepIdx(next);
      loadStep(next);
    }
  };

  // ─── ЭКРАН 1: Готов? ─────────────────────────────────────────────────────
  if (screen === 'ready') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mb-6 shadow-xl">
          <Icon name="GraduationCap" size={36} className="text-white" />
        </div>
        <p className="text-white/60 text-sm mb-1 uppercase tracking-wide font-medium">{SESSION_TOPIC.subject}</p>
        <h1 className="text-white font-extrabold text-2xl mb-2 leading-tight">{SESSION_TOPIC.topic}</h1>

        <div className="bg-white/15 rounded-2xl px-5 py-4 mb-8 w-full max-w-xs">
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <p className="text-white font-bold text-xl">3</p>
              <p className="text-white/60 text-xs mt-0.5">шага</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center">
              <p className="text-white font-bold text-xl">2 мин</p>
              <p className="text-white/60 text-xs mt-0.5">всего</p>
            </div>
          </div>
          <div className="border-t border-white/15 mt-3 pt-3 flex flex-col gap-1.5">
            {STEPS.map((s, i) => (
              <div key={s.label} className="flex items-center gap-2 text-white/70 text-sm">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                  {i + 1}
                </div>
                {s.label}
              </div>
            ))}
          </div>
        </div>

        <Button
          onClick={startSession}
          className="w-full max-w-xs h-14 bg-white text-purple-700 font-extrabold text-lg rounded-2xl shadow-2xl active:scale-[0.97] transition-all"
        >
          Начать <Icon name="ArrowRight" size={20} className="ml-1.5" />
        </Button>
        <button onClick={() => navigate('/')} className="text-white/40 text-sm mt-4">
          Вернуться
        </button>
      </div>
    );
  }

  // ─── ЭКРАН: Анимация галочки ──────────────────────────────────────────────
  if (screen === 'check_anim') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl"
            style={{ animation: 'pop-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}
          >
            <Icon name="Check" size={48} className="text-green-500" />
          </div>
          <p className="text-white font-bold text-2xl">Отлично!</p>
        </div>
        <style>{`@keyframes pop-in { from { transform: scale(0); opacity:0 } to { transform: scale(1); opacity:1 } }`}</style>
      </div>
    );
  }

  // ─── ЭКРАН: Завершено ────────────────────────────────────────────────────
  if (screen === 'done') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col px-5 pt-14 pb-10 overflow-y-auto">
        <div className="text-center mb-5">
          <div className="text-6xl mb-2">🎉</div>
          <h1 className="text-white font-extrabold text-3xl mb-1">Занятие завершено!</h1>
          <p className="text-white/50 text-sm">{SESSION_TOPIC.topic} · {SESSION_TOPIC.subject}</p>
        </div>

        {/* Серия */}
        <div className="bg-white/15 backdrop-blur rounded-3xl px-5 py-4 mb-3">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🔥</span>
            <div className="flex-1">
              <p className="text-white font-bold text-base">Серия продолжается!</p>
              <p className="text-white/60 text-xs">Приходи завтра — не теряй прогресс</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((d, i) => {
              const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
              const isToday = i === todayIdx;
              const past = i < todayIdx;
              return (
                <div key={d} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`w-full h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                    isToday ? 'bg-white text-purple-700 shadow' :
                    past ? 'bg-white/35 text-white' :
                    'bg-white/10 text-white/20'
                  }`}>
                    {isToday || past ? '✓' : ''}
                  </div>
                  <span className="text-[9px] text-white/40">{d}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Прогресс вырос */}
        <div className="bg-white/15 backdrop-blur rounded-3xl px-5 py-4 mb-3">
          <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-2.5">📊 Прогресс вырос</p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-white/70 mb-1.5">
                <span>{SESSION_TOPIC.subject}</span>
                <span>48% → 50%</span>
              </div>
              <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full" style={{ width: '50%' }} />
              </div>
            </div>
            <span className="text-green-300 font-bold text-sm">+2%</span>
          </div>
        </div>

        {/* Статистика */}
        <div className="bg-white/10 rounded-3xl px-5 py-3 mb-6 flex items-center justify-around">
          <div className="text-center">
            <p className="text-white font-bold text-xl">3</p>
            <p className="text-white/50 text-xs">шага</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="text-white font-bold text-xl">{elapsedMin} мин</p>
            <p className="text-white/50 text-xs">потрачено</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="text-white font-bold text-xl">+1</p>
            <p className="text-white/50 text-xs">к серии</p>
          </div>
        </div>

        <Button
          onClick={() => navigate('/')}
          className="w-full h-14 bg-white text-purple-700 font-bold text-base rounded-2xl shadow-xl mb-3 active:scale-[0.98] transition-all"
        >
          Продолжим завтра 📅
        </Button>
        <button onClick={() => navigate('/assistant')} className="text-white/40 text-sm text-center w-full py-2">
          Задать дополнительный вопрос
        </button>
      </div>
    );
  }

  // ─── ЭКРАН 2: Само занятие ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Шапка */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate('/')} className="text-white/70 hover:text-white p-1">
            <Icon name="ArrowLeft" size={20} />
          </button>
          <div className="flex-1">
            <p className="text-white/60 text-xs">{SESSION_TOPIC.subject}</p>
            <h1 className="text-white font-bold text-base leading-tight">{SESSION_TOPIC.topic}</h1>
          </div>
          <span className="text-white/70 text-xs flex items-center gap-1">
            <Icon name="Zap" size={12} /> 2–3 мин
          </span>
        </div>

        {/* Прогресс-бар */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-white/60 text-xs w-7 text-right">{progressPct}%</span>
        </div>

        {/* Этапы — с подсветкой активного */}
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s.label}
              className={`flex-1 flex items-center justify-center gap-1 rounded-xl py-1.5 text-xs font-semibold transition-all duration-300 ${
                i < stepIdx
                  ? 'bg-white/30 text-white'
                  : i === stepIdx
                  ? 'bg-white text-indigo-700 shadow-sm scale-[1.03]'
                  : 'bg-white/10 text-white/35'
              }`}
            >
              {i < stepIdx ? <Icon name="Check" size={10} /> : (
                <Icon name={s.icon} size={10} />
              )}
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Контент */}
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4">

        {/* Иконка + название этапа */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Icon name={currentStep.icon} size={16} className="text-indigo-600" />
          </div>
          <span className="font-bold text-gray-800">{currentStep.label}</span>
        </div>

        {/* Лоадер ИИ */}
        {(loading || checkLoading) ? (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
              <span className="text-indigo-500 text-sm font-medium transition-all duration-500">
                {loaderPhrase}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full animate-progress" />
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-4 shadow-sm text-gray-800 text-sm leading-relaxed whitespace-pre-line animate-in fade-in duration-300">
            {isTyping ? typingText : content}
            {isTyping && <span className="inline-block w-0.5 h-4 bg-indigo-500 ml-0.5 animate-pulse align-middle" />}
          </div>
        )}

        {/* Поле ответа (только на шаге Задание) */}
        {currentStep.label === 'Задание' && !loading && content && !isTyping && (
          <div className="flex flex-col gap-3">
            <p className="text-gray-500 text-xs font-medium">Твой ответ:</p>
            <textarea
              value={userAnswer}
              onChange={e => setUserAnswer(e.target.value)}
              placeholder="Напиши решение..."
              rows={3}
              className="w-full rounded-2xl border-2 border-gray-200 focus:border-indigo-400 px-4 py-3 text-sm text-gray-800 resize-none outline-none transition-colors"
            />
            {!checkResult && (
              <Button
                onClick={checkAnswer}
                disabled={!userAnswer.trim() || checkLoading}
                className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl disabled:opacity-50"
              >
                {checkLoading ? <Icon name="Loader2" size={16} className="animate-spin" /> : 'Проверить ответ'}
              </Button>
            )}
          </div>
        )}

        {/* Результат проверки */}
        {checkResult && !isTyping && (
          <div className={`rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-line animate-in fade-in duration-300 ${
            checkResult.toLowerCase().includes('правильно') || checkResult.toLowerCase().includes('верно') || checkResult.toLowerCase().includes('молодец') || checkResult.toLowerCase().includes('отлично')
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-amber-50 border border-amber-200 text-amber-800'
          }`}>
            {checkResult}
          </div>
        )}

        {/* Типинг результата проверки */}
        {isTyping && currentStep.label === 'Задание' && content && !checkResult && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 whitespace-pre-line">
            {typingText}
            <span className="inline-block w-0.5 h-4 bg-amber-500 ml-0.5 animate-pulse align-middle" />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Кнопка Дальше */}
      {!loading && !checkLoading && content && !isTyping && (
        <div className="px-4 pb-8 pt-2 bg-gray-50">
          {currentStep.label !== 'Задание' ? (
            <Button
              onClick={goNext}
              className="w-full h-[52px] bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base rounded-2xl shadow-[0_4px_16px_rgba(99,102,241,0.35)] active:scale-[0.98] transition-all"
            >
              Дальше <Icon name="ArrowRight" size={16} className="ml-1.5" />
            </Button>
          ) : checkResult ? (
            <Button
              onClick={goNext}
              className="w-full h-[52px] bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-base rounded-2xl shadow-[0_4px_16px_rgba(34,197,94,0.35)] active:scale-[0.98] transition-all"
            >
              Завершить занятие 🎉
            </Button>
          ) : null}
        </div>
      )}

      <style>{`
        @keyframes pop-in { from { transform: scale(0); opacity:0 } to { transform: scale(1); opacity:1 } }
        @keyframes progress { 0% { width: 0%; margin-left:0 } 50% { width: 60%; margin-left: 20% } 100% { width: 0%; margin-left:100% } }
        .animate-progress { animation: progress 1.8s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
