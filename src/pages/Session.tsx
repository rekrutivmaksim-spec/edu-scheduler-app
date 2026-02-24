import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { authService } from '@/lib/auth';
import PaywallSheet from '@/components/PaywallSheet';

const AI_API_URL = 'https://functions.poehali.dev/8e8cbd4e-7731-4853-8e29-a84b3d178249';
const GAMIFICATION_URL = 'https://functions.poehali.dev/0559fb04-cd62-4e50-bb12-dfd6941a7080';
const DAYS_TO_EXAM = 87;

const TOPICS_BY_SUBJECT: Record<string, string[]> = {
  'Математика (профиль)': [
    'Квадратные уравнения', 'Производная функции', 'Интегралы',
    'Логарифмы', 'Тригонометрия', 'Пределы', 'Матрицы и определители',
    'Комбинаторика', 'Теория вероятностей', 'Геометрия: тела вращения',
  ],
  'Математика (база)': [
    'Квадратные уравнения', 'Дроби и проценты', 'Линейные функции',
    'Геометрия: площади', 'Степени и корни', 'Уравнения и неравенства',
  ],
  'Математика': [
    'Квадратные уравнения', 'Производная функции', 'Логарифмы',
    'Тригонометрия', 'Комбинаторика', 'Геометрия',
  ],
  'Физика': [
    'Законы Ньютона', 'Электрическое поле', 'Магнетизм',
    'Оптика', 'Термодинамика', 'Механические колебания', 'Ядерная физика',
  ],
  'Химия': [
    'Реакции окисления-восстановления', 'Органические соединения',
    'Периодическая система', 'Кислоты и основания', 'Электролиз',
  ],
  'Биология': [
    'Клеточное строение', 'Генетика и наследственность',
    'Эволюция', 'Экология', 'Обмен веществ', 'Размножение организмов',
  ],
  'Информатика': [
    'Алгоритмы сортировки', 'Рекурсия', 'Логические операции',
    'Базы данных', 'Сети и протоколы', 'Системы счисления',
  ],
  'История': [
    'Петровские реформы', 'Вторая мировая война', 'Революция 1917 года',
    'Эпоха Ивана Грозного', 'Отечественная война 1812 года', 'СССР в 1930-е годы',
  ],
  'Русский язык': [
    'Причастие и деепричастие', 'Сложноподчинённые предложения',
    'Орфография: корни с чередованием', 'Пунктуация', 'ЕГЭ: задание 27 (сочинение)',
  ],
  'Обществознание': [
    'Конституция РФ', 'Рыночная экономика', 'Права человека',
    'Политические системы', 'Социальные институты',
  ],
  'Литература': [
    'Война и мир: образы', 'Мастер и Маргарита',
    'Лирика Пушкина', 'Преступление и наказание', 'Мёртвые души',
  ],
  'Английский язык': [
    'Present Perfect vs Past Simple', 'Условные предложения',
    'Пассивный залог', 'Артикли', 'Модальные глаголы',
  ],
  'География': [
    'Климатические пояса', 'Природные зоны России',
    'Экономические районы', 'Демография', 'Гидросфера',
  ],
};

const DEFAULT_TOPICS = [
  { subject: 'Математика', topic: 'Квадратные уравнения' },
  { subject: 'Русский язык', topic: 'Причастие и деепричастие' },
  { subject: 'Физика', topic: 'Законы Ньютона' },
  { subject: 'Химия', topic: 'Реакции окисления-восстановления' },
  { subject: 'История', topic: 'Петровские реформы' },
  { subject: 'Обществознание', topic: 'Конституция РФ' },
];

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getTodayTopic(examSubject?: string | null): { subject: string; topic: string; number: number; total: number } {
  const today = new Date().toISOString().slice(0, 10);
  const hash = simpleHash(today);
  if (examSubject && TOPICS_BY_SUBJECT[examSubject]) {
    const topics = TOPICS_BY_SUBJECT[examSubject];
    const idx = hash % topics.length;
    return { subject: examSubject, topic: topics[idx], number: idx + 1, total: topics.length };
  }
  const idx = hash % DEFAULT_TOPICS.length;
  const fallback = DEFAULT_TOPICS[idx];
  return { ...fallback, number: idx + 1, total: DEFAULT_TOPICS.length };
}

const SESSION_TOPIC = getTodayTopic(authService.getUser()?.exam_subject);

const SUBSCRIPTION_URL = 'https://functions.poehali.dev/7fe183c2-49af-4817-95f3-6ab4912778c4';

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
    loaderPhrases: ['Разбираю тему…', 'Подбираю слова…', 'Готовлю объяснение…', 'Почти готово…'],
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

function isCorrect(text: string) {
  const t = text.toLowerCase();
  return (
    t.startsWith('правильно') ||
    t.includes('верно!') ||
    t.includes('молодец') ||
    t.includes('отлично!') ||
    t.includes('правильно!')
  );
}

type Screen = 'ready' | 'session' | 'correct_anim' | 'done';

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
  const [answerCorrect, setAnswerCorrect] = useState<boolean | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [streak, setStreak] = useState(0);
  const [progressAnim, setProgressAnim] = useState(false);
  const [checkTypingText, setCheckTypingText] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallTrigger, setPaywallTrigger] = useState<'session_limit' | 'ai_limit' | 'after_session'>('after_session');
  const [sessionAllowed, setSessionAllowed] = useState<boolean | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loaderRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const currentStep = STEPS[stepIdx];
  const progressPct = Math.round(((stepIdx + (checkResult ? 1 : 0)) / STEPS.length) * 100);
  const elapsedMin = Math.max(1, Math.round(elapsedSec / 60));

  useEffect(() => {
    const token = authService.getToken();
    if (!token || token === 'guest_token') return;
    fetch(GAMIFICATION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'get_profile' }),
    })
      .then(r => r.json())
      .then(d => { if (d?.streak?.current_streak) setStreak(d.streak.current_streak); })
      .catch(() => {});

    fetch(`${SUBSCRIPTION_URL}?action=limits`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        const sub = d.subscription_type;
        const isTrial = !!d.is_trial;
        if (sub === 'premium' || isTrial) {
          setIsPremium(true);
          setSessionAllowed(true);
          return;
        }
        const sessions = d.limits?.sessions;
        if (sessions) {
          setSessionAllowed((sessions.used ?? 0) < (sessions.max ?? 1));
        } else {
          setSessionAllowed(true);
        }
      })
      .catch(() => setSessionAllowed(true));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [typingText, checkTypingText, checkResult]);

  useEffect(() => {
    return () => {
      if (typingRef.current) clearInterval(typingRef.current);
      if (loaderRef.current) clearInterval(loaderRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startSession = () => {
    if (sessionAllowed === false) {
      setPaywallTrigger('session_limit');
      setShowPaywall(true);
      return;
    }
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
    if (loaderRef.current) clearInterval(loaderRef.current);
    loaderRef.current = setInterval(() => {
      i = (i + 1) % phrases.length;
      setLoaderPhrase(phrases[i]);
    }, 2200);
  };

  const stopLoaderPhrases = () => {
    if (loaderRef.current) clearInterval(loaderRef.current);
    setLoaderPhrase('');
  };

  const typeText = (full: string, setter: (v: string) => void, onDone?: () => void) => {
    if (typingRef.current) clearInterval(typingRef.current);
    setIsTyping(true);
    setter('');
    let i = 0;
    typingRef.current = setInterval(() => {
      i++;
      setter(full.slice(0, i));
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
    setCheckTypingText('');
    setUserAnswer('');
    setCheckResult('');
    setAnswerCorrect(null);
    setRetryCount(0);
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
      if (res.status === 403) {
        stopLoaderPhrases();
        setLoading(false);
        if (timerRef.current) clearInterval(timerRef.current);
        setPaywallTrigger('session_limit');
        setShowPaywall(true);
        setScreen('ready');
        return;
      }
      if (!res.ok) throw new Error('server_error');
      const data = await res.json();
      const raw = sanitize(data.answer || data.response || '');
      stopLoaderPhrases();
      setLoading(false);
      setContent(raw);
      typeText(raw, setTypingText);
    } catch {
      stopLoaderPhrases();
      const fallback = 'Не удалось загрузить. Попробуй ещё раз.';
      setLoading(false);
      setContent(fallback);
      typeText(fallback, setTypingText);
    }
  };

  const checkAnswer = async (answerOverride?: string) => {
    const answer = answerOverride ?? userAnswer;
    if (!answer.trim()) return;
    setCheckLoading(true);
    setCheckResult('');
    setCheckTypingText('');
    setAnswerCorrect(null);
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
          question: `Задание: ${content}\n\nОтвет ученика: ${answer}\n\nПроверь ответ. Если правильно — начни ответ строго со слова "Правильно!" и похвали. Если неправильно — начни строго со слова "Неверно." и объясни ошибку. 2–3 предложения.`,
          history: [{ role: 'assistant', content }],
        }),
      });
      const data = await res.json();
      const raw = sanitize(data.answer || data.response || '');
      const correct = isCorrect(raw);
      stopLoaderPhrases();
      setCheckLoading(false);
      setAnswerCorrect(correct);

      if (correct) {
        if (navigator.vibrate) navigator.vibrate([60, 30, 100]);
        setProgressAnim(true);
        setTimeout(() => setProgressAnim(false), 1200);
      }

      typeText(raw, setCheckTypingText, () => setCheckResult(raw));
    } catch {
      stopLoaderPhrases();
      setCheckResult('Не удалось проверить. Попробуй ещё раз.');
      setCheckLoading(false);
    }
  };

  const handleRetry = () => {
    setUserAnswer('');
    setCheckResult('');
    setCheckTypingText('');
    setAnswerCorrect(null);
    setRetryCount(r => r + 1);
  };

  const goNext = () => {
    if (stepIdx === STEPS.length - 1 && checkResult && answerCorrect) {
      if (timerRef.current) clearInterval(timerRef.current);
      window.dispatchEvent(new Event('session_completed'));
      if (navigator.vibrate) navigator.vibrate([80, 40, 120]);
      setScreen('correct_anim');
      setTimeout(() => {
        setScreen('done');
        // Показываем paywall через 2 сек на экране завершения (только не-Premium)
        if (isPremium) return;
        const token = authService.getToken();
        if (token && token !== 'guest_token') {
          setTimeout(() => {
            setPaywallTrigger('after_session');
            setShowPaywall(true);
          }, 2000);
        }
      }, 950);
      return;
    }
    if (stepIdx < STEPS.length - 1) {
      const next = stepIdx + 1;
      setStepIdx(next);
      loadStep(next);
    }
  };

  // ─── Экран: Готов? ──────────────────────────────────────────────────────────
  if (screen === 'ready') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mb-6 shadow-xl">
          <Icon name="GraduationCap" size={36} className="text-white" />
        </div>
        <p className="text-white/60 text-sm mb-1 uppercase tracking-wide font-medium">{SESSION_TOPIC.subject}</p>
        <h1 className="text-white font-extrabold text-2xl mb-3 leading-tight">{SESSION_TOPIC.topic}</h1>

        {streak >= 2 && (
          <div className="flex items-center gap-1.5 bg-orange-400/20 border border-orange-400/30 rounded-full px-3 py-1 mb-4">
            <span>🔥</span>
            <span className="text-orange-200 text-sm font-semibold">Серия {streak} дней</span>
          </div>
        )}

        <div className="bg-white/15 rounded-2xl px-5 py-4 mb-6 w-full max-w-xs">
          <div className="flex items-center justify-center gap-5 mb-3">
            <div className="text-center">
              <p className="text-white font-bold text-xl">3</p>
              <p className="text-white/60 text-xs">шага</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center">
              <p className="text-white font-bold text-xl">2 мин</p>
              <p className="text-white/60 text-xs">всего</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center">
              <p className="text-white font-bold text-xl">{SESSION_TOPIC.number}/{SESSION_TOPIC.total}</p>
              <p className="text-white/60 text-xs">тема</p>
            </div>
          </div>
          <div className="border-t border-white/15 pt-3 flex flex-col gap-1.5">
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
          className="w-full max-w-xs h-14 bg-white text-purple-700 font-extrabold text-lg rounded-2xl shadow-2xl active:scale-[0.97] transition-all mb-3"
        >
          Начать <Icon name="ArrowRight" size={20} className="ml-1.5" />
        </Button>

        {streak >= 3 && (
          <div className="bg-white/10 border border-white/20 rounded-2xl px-4 py-3 w-full max-w-xs text-center mb-3">
            <p className="text-white font-bold text-sm mb-1">🔥 Ты занимаешься {streak} дней подряд!</p>
            <p className="text-white/60 text-xs mb-3">Убери ограничения — занимайся без лимита</p>
            <button onClick={() => navigate('/pricing')} className="bg-white text-purple-700 font-bold text-sm px-5 py-2 rounded-xl w-full">
              Безлимит 399₽ →
            </button>
          </div>
        )}

        <button onClick={() => navigate('/')} className="text-white/40 text-sm mt-1">
          Вернуться
        </button>
      </div>
    );
  }

  // ─── Экран: Анимация галочки ────────────────────────────────────────────────
  if (screen === 'correct_anim') {
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

  // ─── Экран: Завершено ───────────────────────────────────────────────────────
  if (screen === 'done') {
    const newStreak = streak + 1;
    return (
      <>
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col px-5 pt-14 pb-10 overflow-y-auto">
        <div className="text-center mb-5">
          <div className="text-5xl mb-2">🎉</div>
          <h1 className="text-white font-extrabold text-3xl mb-1">Занятие завершено!</h1>
          <p className="text-white/50 text-sm">{SESSION_TOPIC.topic} · {SESSION_TOPIC.subject}</p>
        </div>

        {/* Крючок: до экзамена */}
        <div className="bg-white/15 backdrop-blur rounded-3xl px-5 py-4 mb-3">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">📅</span>
            <div>
              <p className="text-white font-bold text-base">До экзамена {DAYS_TO_EXAM} дней</p>
              <p className="text-white/60 text-xs">Ты прошёл {SESSION_TOPIC.number} из {SESSION_TOPIC.total} тем</p>
            </div>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-1000"
              style={{ width: `${Math.round((SESSION_TOPIC.number / SESSION_TOPIC.total) * 100)}%` }}
            />
          </div>
        </div>

        {/* Серия */}
        <div className="bg-white/15 backdrop-blur rounded-3xl px-5 py-4 mb-3">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🔥</span>
            <div>
              <p className="text-white font-bold text-base">
                Серия {newStreak} {newStreak === 1 ? 'день' : newStreak < 5 ? 'дня' : 'дней'}!
              </p>
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
                    {(isToday || past) ? '✓' : ''}
                  </div>
                  <span className="text-[9px] text-white/40">{d}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Пейволл: 3+ дней */}
        {newStreak >= 3 && (
          <div className="bg-white rounded-3xl px-5 py-4 mb-3 shadow-xl">
            <p className="text-purple-700 font-extrabold text-lg mb-1">🔥 Ты занимаешься {newStreak} дней подряд</p>
            <p className="text-gray-500 text-sm mb-3">Хочешь заниматься без ограничений?</p>
            <Button
              onClick={() => navigate('/pricing')}
              className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl"
            >
              Безлимит 399₽
            </Button>
          </div>
        )}

        {/* Статистика */}
        <div className="bg-white/10 rounded-3xl px-5 py-3 mb-4 flex items-center justify-around">
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

      {showPaywall && (
        <PaywallSheet
          trigger={paywallTrigger}
          streak={newStreak}
          daysToExam={DAYS_TO_EXAM}
          onClose={() => setShowPaywall(false)}
        />
      )}
      </>
    );
  }

  // ─── Экран: Само занятие ─────────────────────────────────────────────────────
  const isTaskStep = currentStep.label === 'Задание';
  const showAnswerForm = isTaskStep && !loading && content && !isTyping && !checkResult && !checkTypingText && !checkLoading;
  const showCheckTyping = isTaskStep && !checkResult && checkTypingText && isTyping;
  const showCheckResult = !!checkResult && !isTyping;

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
          {streak >= 1 && (
            <div className="flex items-center gap-1 text-orange-200 text-xs font-semibold">
              <span>🔥</span>{streak}
            </div>
          )}
        </div>

        {/* Прогресс-бар */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className={`h-full bg-white rounded-full transition-all duration-700 ${progressAnim ? 'shadow-[0_0_8px_rgba(255,255,255,0.8)]' : ''}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-white/60 text-xs w-7 text-right">{progressPct}%</span>
        </div>

        {/* Этапы */}
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s.label}
              className={`flex-1 flex items-center justify-center gap-1 rounded-xl py-1.5 text-xs font-semibold transition-all duration-300 ${
                i < stepIdx ? 'bg-white/30 text-white' :
                i === stepIdx ? 'bg-white text-indigo-700 shadow-sm scale-[1.03]' :
                'bg-white/10 text-white/35'
              }`}
            >
              {i < stepIdx
                ? <Icon name="Check" size={10} />
                : <Icon name={s.icon} size={10} />
              }
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Контент */}
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4">

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Icon name={currentStep.icon} size={16} className="text-indigo-600" />
          </div>
          <span className="font-bold text-gray-800">{currentStep.label}</span>
          {retryCount > 0 && (
            <span className="ml-auto text-xs text-amber-500 font-semibold">Попытка {retryCount + 1}</span>
          )}
        </div>

        {/* Лоадер */}
        {(loading || checkLoading) && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
              <span className="text-indigo-500 text-sm font-medium">{loaderPhrase}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full animate-progress" />
            </div>
          </div>
        )}

        {/* Текст контента */}
        {!loading && !checkLoading && (
          <div className="bg-white rounded-2xl p-4 shadow-sm text-gray-800 text-sm leading-relaxed whitespace-pre-line">
            {isTyping && !checkTypingText ? typingText : content}
            {isTyping && !checkTypingText && <span className="inline-block w-0.5 h-4 bg-indigo-500 ml-0.5 animate-pulse align-middle" />}
          </div>
        )}

        {/* Поле ответа */}
        {showAnswerForm && (
          <div className="flex flex-col gap-3">
            <p className="text-gray-500 text-xs font-medium">Твой ответ:</p>
            <textarea
              key={`answer-${retryCount}`}
              value={userAnswer}
              onChange={e => setUserAnswer(e.target.value)}
              placeholder="Напиши решение..."
              rows={3}
              className="w-full rounded-2xl border-2 border-gray-200 focus:border-indigo-400 px-4 py-3 text-sm text-gray-800 resize-none outline-none transition-colors"
            />
            <Button
              onClick={() => checkAnswer()}
              disabled={!userAnswer.trim()}
              className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl disabled:opacity-50"
            >
              Проверить ответ
            </Button>
          </div>
        )}

        {/* Типинг результата проверки */}
        {showCheckTyping && (
          <div className={`rounded-2xl p-4 text-sm text-gray-800 whitespace-pre-line border ${
            answerCorrect === true ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
          }`}>
            {checkTypingText}
            <span className="inline-block w-0.5 h-4 bg-gray-400 ml-0.5 animate-pulse align-middle" />
          </div>
        )}

        {/* Результат проверки */}
        {showCheckResult && (
          <div className={`rounded-2xl p-4 shadow-sm text-sm leading-relaxed whitespace-pre-line animate-in fade-in duration-300 ${
            answerCorrect ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-amber-50 border border-amber-200 text-amber-800'
          }`}>
            <div className="flex items-start gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${answerCorrect ? 'bg-green-500' : 'bg-amber-500'}`}>
                <Icon name={answerCorrect ? 'Check' : 'X'} size={12} className="text-white" />
              </div>
              <p>{checkResult}</p>
            </div>

            {/* Попробовать ещё раз — только при неверном */}
            {!answerCorrect && (
              <button
                onClick={handleRetry}
                className="mt-3 w-full bg-amber-100 hover:bg-amber-200 text-amber-700 font-semibold text-sm rounded-xl py-2.5 transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="RotateCcw" size={14} />
                Попробовать ещё раз
              </button>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Кнопка Дальше */}
      {!loading && !checkLoading && content && !isTyping && !checkTypingText && (
        <div className="px-4 pb-8 pt-2 bg-gray-50">
          {!isTaskStep ? (
            <Button
              onClick={goNext}
              className="w-full h-[52px] bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base rounded-2xl shadow-[0_4px_16px_rgba(99,102,241,0.35)] active:scale-[0.98] transition-all"
            >
              Дальше <Icon name="ArrowRight" size={16} className="ml-1.5" />
            </Button>
          ) : (answerCorrect === true && showCheckResult) ? (
            <Button
              onClick={goNext}
              className="w-full h-[52px] bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-base rounded-2xl shadow-[0_4px_16px_rgba(34,197,94,0.35)] active:scale-[0.98] transition-all animate-in fade-in duration-300"
            >
              Завершить занятие 🎉
            </Button>
          ) : null}
        </div>
      )}

      <style>{`
        @keyframes pop-in { from { transform: scale(0); opacity:0 } to { transform: scale(1); opacity:1 } }
        @keyframes progress { 0% { width: 0%; margin-left:0 } 50% { width: 60%; margin-left:20% } 100% { width: 0%; margin-left:100% } }
        .animate-progress { animation: progress 1.8s ease-in-out infinite; }
      `}</style>

      {showPaywall && (
        <PaywallSheet
          trigger={paywallTrigger}
          streak={streak}
          daysToExam={DAYS_TO_EXAM}
          onClose={() => setShowPaywall(false)}
        />
      )}
    </div>
  );
}