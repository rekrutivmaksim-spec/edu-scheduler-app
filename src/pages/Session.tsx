import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { authService } from '@/lib/auth';

const AI_API_URL = 'https://functions.poehali.dev/8e8cbd4e-7731-4853-8e29-a84b3d178249';

// Тема дня (в будущем — с бэкенда)
const SESSION_TOPIC = {
  subject: 'Математика',
  topic: 'Квадратные уравнения',
};

type Step = 'explain' | 'example' | 'task' | 'check' | 'done';

interface StepContent {
  step: Step;
  label: string;
  icon: string;
  prompt: string;
}

const STEPS: StepContent[] = [
  {
    step: 'explain',
    label: 'Объяснение',
    icon: 'Lightbulb',
    prompt: `Объясни тему "${SESSION_TOPIC.topic}" (${SESSION_TOPIC.subject}) очень коротко — 2–3 предложения простыми словами, без формул и терминов. Как для человека, который первый раз слышит.`,
  },
  {
    step: 'example',
    label: 'Пример',
    icon: 'BookOpen',
    prompt: `Дай один конкретный пример по теме "${SESSION_TOPIC.topic}" — покажи как это работает на простом числе или ситуации. Только пример, без длинных объяснений.`,
  },
  {
    step: 'task',
    label: 'Задание',
    icon: 'PenLine',
    prompt: `Дай одно короткое задание по теме "${SESSION_TOPIC.topic}" уровня базового ЕГЭ. Только условие задачи, без решения.`,
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

export default function Session() {
  const navigate = useNavigate();
  const [stepIdx, setStepIdx] = useState(0);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [typingText, setTypingText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [checkResult, setCheckResult] = useState('');
  const [checkLoading, setCheckLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const [startTime] = useState(Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentStep = STEPS[stepIdx];
  const isLastStep = stepIdx === STEPS.length - 1;

  useEffect(() => {
    loadStep(0);
    timerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [typingText, checkResult]);

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

    try {
      const token = authService.getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(AI_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'demo_ask',
          question: step.prompt,
        }),
      });
      const data = await res.json();
      const raw = sanitize(data.answer || data.response || '');
      setContent(raw);
      setLoading(false);
      typeText(raw);
    } catch {
      const fallback = 'Не удалось загрузить. Попробуй ещё раз.';
      setContent(fallback);
      setLoading(false);
      typeText(fallback);
    }
  };

  const checkAnswer = async () => {
    if (!userAnswer.trim()) return;
    setCheckLoading(true);
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
      setCheckLoading(false);
      typeText(raw, () => setCheckResult(raw));
    } catch {
      setCheckResult('Не удалось проверить. Попробуй ещё раз.');
      setCheckLoading(false);
    }
  };

  const goNext = () => {
    if (isLastStep && checkResult) {
      if (timerRef.current) clearInterval(timerRef.current);
      window.dispatchEvent(new Event('session_completed'));
      // Вибрация (если поддерживается)
      if (navigator.vibrate) navigator.vibrate([80, 40, 120]);
      // Анимация галочки перед переходом
      setShowCheck(true);
      setTimeout(() => setIsDone(true), 900);
      return;
    }
    if (stepIdx < STEPS.length - 1) {
      const next = stepIdx + 1;
      setStepIdx(next);
      loadStep(next);
    }
  };

  const progressPct = isDone ? 100 : Math.round(((stepIdx + (checkResult ? 1 : 0)) / STEPS.length) * 100);

  const elapsedMin = Math.max(1, Math.round(elapsedSec / 60));

  // Промежуточная анимация галочки
  if (showCheck && !isDone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl" style={{ animation: 'pop-in 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <Icon name="Check" size={48} className="text-green-500" />
          </div>
          <p className="text-white font-bold text-2xl">Отлично!</p>
        </div>
        <style>{`@keyframes pop-in { from { transform: scale(0); opacity:0 } to { transform: scale(1); opacity:1 } }`}</style>
      </div>
    );
  }

  if (isDone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col px-5 pt-16 pb-10">

        {/* Заголовок */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">🎉</div>
          <h1 className="text-white font-extrabold text-3xl mb-1">Занятие завершено!</h1>
          <p className="text-white/60 text-sm">{SESSION_TOPIC.topic} · {SESSION_TOPIC.subject}</p>
        </div>

        {/* Блок: серия */}
        <div className="bg-white/15 backdrop-blur rounded-3xl px-5 py-4 mb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔥</span>
            <div className="flex-1">
              <p className="text-white font-bold text-base">Серия продолжается!</p>
              <p className="text-white/60 text-xs">Не прерывай — придёт завтра и станет больше</p>
            </div>
          </div>
          {/* Мини-визуализация дней */}
          <div className="flex gap-1.5 mt-3">
            {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((d, i) => {
              const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
              const isToday = i === todayIdx;
              const isDoneDay = i <= todayIdx;
              return (
                <div key={d} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`w-full h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                    isToday ? 'bg-white text-purple-700 shadow-md' :
                    isDoneDay ? 'bg-white/40 text-white' :
                    'bg-white/10 text-white/20'
                  }`}>
                    {isDoneDay ? '✓' : ''}
                  </div>
                  <span className="text-[9px] text-white/50">{d}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Блок: прогресс вырос */}
        <div className="bg-white/15 backdrop-blur rounded-3xl px-5 py-4 mb-3">
          <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-2">Прогресс вырос</p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-white/70 mb-1">
                <span>{SESSION_TOPIC.subject}</span>
                <span>было 48% → стало 50%</span>
              </div>
              <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full" style={{ width: '50%', transition: 'width 1s ease' }} />
              </div>
            </div>
            <span className="text-green-300 text-sm font-bold">+2%</span>
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
            <p className="text-white/50 text-xs">времени</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="text-white font-bold text-xl">+1</p>
            <p className="text-white/50 text-xs">к серии</p>
          </div>
        </div>

        {/* CTA */}
        <Button
          onClick={() => navigate('/')}
          className="w-full h-14 bg-white text-purple-700 font-bold text-base rounded-2xl shadow-xl mb-3 active:scale-[0.98] transition-all"
        >
          Продолжим завтра 📅
        </Button>
        <button
          onClick={() => navigate('/assistant')}
          className="text-white/50 text-sm text-center w-full py-2"
        >
          Задать дополнительный вопрос
        </button>

        <style>{`@keyframes pop-in { from { transform: scale(0); opacity:0 } to { transform: scale(1); opacity:1 } }`}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Шапка */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate('/')} className="text-white/70 hover:text-white p-1">
            <Icon name="ArrowLeft" size={20} />
          </button>
          <div className="flex-1">
            <p className="text-white/70 text-xs">{SESSION_TOPIC.subject}</p>
            <h1 className="text-white font-bold text-base leading-tight">{SESSION_TOPIC.topic}</h1>
          </div>
          <span className="text-white/70 text-xs flex items-center gap-1">
            <Icon name="Zap" size={12} /> 2–3 мин
          </span>
        </div>

        {/* Прогресс */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-white/70 text-xs w-8 text-right">{progressPct}%</span>
        </div>

        {/* Шаги */}
        <div className="flex gap-2 mt-3">
          {STEPS.map((s, i) => (
            <div
              key={s.step}
              className={`flex-1 flex items-center justify-center gap-1 rounded-xl py-1 text-xs font-medium transition-all ${
                i < stepIdx ? 'bg-white/30 text-white' :
                i === stepIdx ? 'bg-white text-indigo-700 shadow-sm' :
                'bg-white/10 text-white/40'
              }`}
            >
              {i < stepIdx ? <Icon name="Check" size={10} /> : null}
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Контент */}
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4">

        {/* Иконка + шаг */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Icon name={currentStep.icon} size={16} className="text-indigo-600" />
          </div>
          <span className="font-bold text-gray-800">{currentStep.label}</span>
        </div>

        {/* Текст ИИ */}
        {loading ? (
          <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
            <span className="text-gray-400 text-sm">Готовлю...</span>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-4 shadow-sm text-gray-800 text-sm leading-relaxed whitespace-pre-line">
            {isTyping ? typingText : content}
            {isTyping && <span className="inline-block w-0.5 h-4 bg-indigo-500 ml-0.5 animate-pulse align-middle" />}
          </div>
        )}

        {/* Блок задания: поле ответа */}
        {currentStep.step === 'task' && !loading && content && !isTyping && (
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
                className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl shadow-[0_4px_16px_rgba(99,102,241,0.35)] disabled:opacity-50"
              >
                {checkLoading ? (
                  <><Icon name="Loader2" size={16} className="animate-spin mr-2" /> Проверяю...</>
                ) : 'Проверить ответ'}
              </Button>
            )}
          </div>
        )}

        {/* Результат проверки */}
        {(checkResult || (isTyping && currentStep.step === 'task' && content)) && (
          <div className={`rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-line ${
            checkResult.includes('правильно') || checkResult.includes('верно') || checkResult.includes('молодец')
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-amber-50 border border-amber-200 text-amber-800'
          }`}>
            {isTyping && !checkResult ? typingText : checkResult}
            {isTyping && !checkResult && <span className="inline-block w-0.5 h-4 bg-amber-500 ml-0.5 animate-pulse align-middle" />}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Кнопка Дальше */}
      {!loading && content && !isTyping && (
        <div className="px-4 pb-8 pt-2 bg-gray-50">
          {currentStep.step !== 'task' ? (
            <Button
              onClick={goNext}
              className="w-full h-13 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base rounded-2xl shadow-[0_4px_16px_rgba(99,102,241,0.35)] active:scale-[0.98] transition-all"
            >
              {isLastStep ? 'Завершить' : 'Дальше'} <Icon name="ArrowRight" size={16} className="ml-1.5" />
            </Button>
          ) : checkResult && !isTyping ? (
            <Button
              onClick={goNext}
              className="w-full h-13 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-base rounded-2xl shadow-[0_4px_16px_rgba(34,197,94,0.35)] active:scale-[0.98] transition-all"
            >
              Завершить занятие 🎉
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}