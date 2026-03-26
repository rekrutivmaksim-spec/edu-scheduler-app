import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { authService } from '@/lib/auth';
import PaywallSheet from '@/components/PaywallSheet';
import { getCompanion, getCompanionStage, getCompanionFromStorage } from '@/lib/companion';
import { getTodayTopic as getTodayTopicBase, TOPICS_BY_SUBJECT, DEFAULT_TOPICS } from '@/lib/topics';
import { trackActivity } from '@/lib/gamification';
import { API } from '@/lib/api-urls';
import AiText from '@/components/AiText';

function getTodayTopic(examSubject?: string | null, offset = 0): { subject: string; topic: string; number: number; total: number } {
  // Используем хеш даты как базовый индекс, offset сдвигает на каждое новое занятие
  const today = new Date().toISOString().slice(0, 10);
  let h = 0;
  for (let i = 0; i < today.length; i++) h = (Math.imul(31, h) + today.charCodeAt(i)) | 0;
  const dayHash = Math.abs(h);

  if (examSubject && TOPICS_BY_SUBJECT[examSubject]) {
    const topics = TOPICS_BY_SUBJECT[examSubject];
    const idx = (dayHash + offset) % topics.length;
    return { subject: examSubject, topic: topics[idx], number: idx + 1, total: topics.length };
  }
  const idx = (dayHash + offset) % DEFAULT_TOPICS.length;
  return { subject: DEFAULT_TOPICS[idx].subject, topic: DEFAULT_TOPICS[idx].topic, number: idx + 1, total: DEFAULT_TOPICS.length };
}

// Счётчик занятий за сегодня (для подбора разных тем)
function getTodaySessionOffset(): number {
  const key = `sessions_today_${new Date().toDateString()}`;
  return parseInt(localStorage.getItem(key) || '0', 10);
}

function incrementTodaySessionOffset(): void {
  const key = `sessions_today_${new Date().toDateString()}`;
  const cur = parseInt(localStorage.getItem(key) || '0', 10);
  localStorage.setItem(key, String(cur + 1));
}

function getDaysToExam(examDate?: string | null): number {
  if (!examDate || examDate === 'custom') return 0;
  const d = new Date(examDate);
  const now = new Date();
  return Math.max(0, Math.ceil((d.getTime() - now.getTime()) / 86400000));
}



interface StepDef {
  label: string;
  icon: string;
  prompt: string;
  loaderPhrases: string[];
}

function buildSteps(topic: string, subject: string): StepDef[] {
  return [
    {
      label: 'Объяснение',
      icon: 'Lightbulb',
      prompt: `Объясни тему "${topic}" по предмету ${subject}. Используй markdown: **жирный** для ключевых терминов, нумерованные списки для шагов. Структура:\n\n## Суть\n1-2 предложения простыми словами.\n\n## Ключевое правило\nФормула или правило текстом (без LaTeX).\n\n## Почему важно\nПочему это встречается на экзамене. Максимум 5-6 предложений. Без воды.`,
      loaderPhrases: ['Разбираю тему…', 'Подбираю слова…', 'Готовлю объяснение…', 'Почти готово…'],
    },
    {
      label: 'Пример',
      icon: 'BookOpen',
      prompt: `Покажи конкретный пример по теме "${topic}" (${subject}). Используй markdown для структуры:\n\n## Задача\nУсловие с конкретными числами/фактами.\n\n## Решение\n1. Первый шаг — ...\n2. Второй шаг — ...\n3. ...\n\n**Ответ:** итог.\n\nКратко, 3-5 шагов. Выделяй **ключевые числа** жирным.`,
      loaderPhrases: ['Ищу хороший пример…', 'Подбираю числа…', 'Формирую пример…'],
    },
    {
      label: 'Задание',
      icon: 'PenLine',
      prompt: `Составь одно тренировочное задание по теме "${topic}" (${subject}) в стиле ЕГЭ/ОГЭ. Используй markdown:\n\n## Задание\nЧёткое условие с конкретными данными. Выдели **ключевые числа/данные** жирным.\n\nТолько условие — без ответа. В конце: *Жду твой ответ!*`,
      loaderPhrases: ['Составляю задание…', 'Подбираю сложность…', 'Готовлю условие…'],
    },
  ];
}

function cleanText(text: string): string {
  return text
    .replace(/[\u4e00-\u9fff]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isCorrect(text: string) {
  const t = text.toLowerCase();
  // Сначала проверяем явные маркеры неверного — они приоритетнее
  if (t.startsWith('неверно') || t.startsWith('нет,') || t.startsWith('к сожалению') || t.startsWith('ошибк')) return false;
  return (
    t.startsWith('правильно') ||
    t.startsWith('верно') ||
    t.startsWith('отлично') ||
    t.startsWith('молодец') ||
    t.startsWith('совершенно верно') ||
    t.startsWith('всё верно') ||
    t.startsWith('все верно') ||
    t.includes('правильно!') ||
    t.includes('верно!') ||
    t.includes('молодец!') ||
    t.includes('отлично!')
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
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [correctAnswerLoading, setCorrectAnswerLoading] = useState(false);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [streak, setStreak] = useState(0);
  const [progressAnim, setProgressAnim] = useState(false);
  const [checkTypingText, setCheckTypingText] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallTrigger, setPaywallTrigger] = useState<'session_limit' | 'ai_limit' | 'after_session' | 'after_session_3rd'>('after_session');
  const [sessionAllowed, setSessionAllowed] = useState<boolean | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [sessionsLeft, setSessionsLeft] = useState<number | null>(null);
  const [sessionsMax, setSessionsMax] = useState<number>(1);
  const [currentDateStr, setCurrentDateStr] = useState(() => new Date().toDateString());
  const [sessionTopic, setSessionTopic] = useState(() => getTodayTopic(authService.getUser()?.exam_subject, getTodaySessionOffset()));
  const [daysToExam, setDaysToExam] = useState(() => getDaysToExam(authService.getUser()?.exam_date));

  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loaderRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const STEPS = buildSteps(sessionTopic.topic, sessionTopic.subject);
  const currentStep = STEPS[stepIdx];
  const progressPct = Math.round(((stepIdx + (checkResult ? 1 : 0)) / STEPS.length) * 100);
  const elapsedMin = Math.max(1, Math.round(elapsedSec / 60));

  // Сброс при смене дня (если приложение оставили открытым)
  useEffect(() => {
    const checkDay = () => {
      const today = new Date().toDateString();
      if (today !== currentDateStr) {
        setCurrentDateStr(today);
        setSessionAllowed(null);
        setSessionsLeft(null);
        // Пересчитываем тему для нового дня
        const user = authService.getUser();
        setSessionTopic(getTodayTopic(user?.exam_subject, 0));
        setDaysToExam(getDaysToExam(user?.exam_date));
        // Перезагружаем лимиты
        const token = authService.getToken();
        if (token) {
          fetch(`${API.SUBSCRIPTION}?action=limits`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(d => {
            const sub = d.subscription_type;
            const trial = !!d.is_trial;
            const sessions = d.limits?.sessions;
            if (sub === 'premium' || trial) {
              setIsPremium(true);
              const max = sessions?.max ?? 100;
              const used = sessions?.used ?? 0;
              setSessionsMax(max);
              setSessionsLeft(Math.max(0, max - used));
              setSessionAllowed(true);
            } else if (sessions) {
              const max = sessions.max ?? 1;
              const used = sessions.used ?? 0;
              setSessionsMax(max);
              setSessionsLeft(Math.max(0, max - used));
              setSessionAllowed(used < max);
            } else {
              setSessionsLeft(1);
              setSessionAllowed(true);
            }
          }).catch(() => setSessionAllowed(true));
        }
      }
    };
    document.addEventListener('visibilitychange', checkDay);
    const interval = setInterval(checkDay, 60000);
    return () => {
      document.removeEventListener('visibilitychange', checkDay);
      clearInterval(interval);
    };
  }, [currentDateStr]);

  useEffect(() => {
    const token = authService.getToken();
    if (!token || token === 'guest_token') return;

    // Верифицируем токен и получаем свежие данные пользователя
    authService.verifyToken().then(user => {
      if (user) {
        const topic = getTodayTopic(user.exam_subject, getTodaySessionOffset());
        setSessionTopic(topic);
        setDaysToExam(getDaysToExam(user.exam_date));
      }
    }).catch(() => {});

    fetch(API.GAMIFICATION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'get_profile' }),
    })
      .then(r => r.json())
      .then(d => { if (d?.streak?.current != null) setStreak(d.streak.current); })
      .catch(() => {});

    fetch(`${API.SUBSCRIPTION}?action=limits`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        const sub = d.subscription_type;
        const trial = !!d.is_trial;
        const sessions = d.limits?.sessions;
        if (sub === 'premium' || trial) {
          setIsPremium(true);
          const max = sessions?.max ?? 5;
          const used = sessions?.used ?? 0;
          setSessionsMax(max);
          setSessionsLeft(Math.max(0, max - used));
          setSessionAllowed(true);
          return;
        }
        if (sessions) {
          const max = sessions.max ?? 1;
          const used = sessions.used ?? 0;
          setSessionsMax(max);
          setSessionsLeft(Math.max(0, max - used));
          setSessionAllowed(used < max);
        } else {
          setSessionsMax(1);
          setSessionsLeft(1);
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
    incrementTodaySessionOffset();

    // Записываем использование сессии
    const token = authService.getToken();
    if (token && token !== 'guest_token') {
      fetch(API.SUBSCRIPTION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'use_session' }),
      }).catch(() => {});
    }
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
    setCorrectAnswer('');
    setCorrectAnswerLoading(false);
    setShowCorrectAnswer(false);
    startLoaderPhrases(step.loaderPhrases);

    const token = authService.getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    // system_only=true — шаги сессии не тратят лимит пользователя
    const body = token
      ? JSON.stringify({ question: step.prompt, system_only: true })
      : JSON.stringify({ action: 'demo_ask', question: step.prompt });

    let raw = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(API.AI_ASSISTANT, { method: 'POST', headers, body });
        if (res.status === 403) {
          stopLoaderPhrases();
          setLoading(false);
          if (timerRef.current) clearInterval(timerRef.current);
          setPaywallTrigger('ai_limit');
          setShowPaywall(true);
          setScreen('ready');
          return;
        }
        if (res.ok) {
          const data = await res.json();
          raw = cleanText(data.answer || data.response || '');
          if (raw) break;
        }
        if (attempt < 2) await new Promise(r => setTimeout(r, 700));
      } catch {
        if (attempt < 2) await new Promise(r => setTimeout(r, 700));
      }
    }

    stopLoaderPhrases();
    setLoading(false);
    // Если всё равно пусто — даём нейтральный текст без техники
    if (!raw) raw = `Давай разберём тему "${step.label.toLowerCase()}"! Задай мне вопрос или напиши что хочешь узнать — отвечу.`;
    setContent(raw);
    typeText(raw, setTypingText);
  };

  const checkAnswer = async (answerOverride?: string) => {
    const answer = answerOverride ?? userAnswer;
    if (!answer.trim()) return;
    setCheckLoading(true);
    setCheckResult('');
    setCheckTypingText('');
    setAnswerCorrect(null);
    startLoaderPhrases(['Проверяю ответ…', 'Смотрю внимательно…', 'Анализирую…']);

    const token = authService.getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const prompt = `Задание: ${content}\n\nОтвет ученика: "${answer}"\n\nПроверь ответ. Сначала реши задание сам, потом сравни с ответом ученика. Используй markdown.\n\nЕсли правильно — начни СТРОГО: "Правильно! ✅" и кратко объясни почему верно.\nЕсли неправильно — начни СТРОГО: "Неверно ❌", затем:\n- Где **ошибка**\n- **Правильное решение** кратко\n\nНе придумывай других вступлений. Выделяй ключевые моменты **жирным**.`;
    const bodyAuth = JSON.stringify({ question: prompt, history: [{ role: 'assistant', content }] });
    const bodyDemo = JSON.stringify({ action: 'demo_ask', question: prompt, history: [{ role: 'assistant', content }] });

    let raw = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(API.AI_ASSISTANT, {
          method: 'POST',
          headers,
          body: token ? bodyAuth : bodyDemo,
        });
        if (res.ok) {
          const data = await res.json();
          raw = cleanText(data.answer || data.response || '');
          if (raw) break;
        }
        if (attempt < 2) await new Promise(r => setTimeout(r, 700));
      } catch {
        if (attempt < 2) await new Promise(r => setTimeout(r, 700));
      }
    }

    stopLoaderPhrases();
    setCheckLoading(false);
    if (!raw) raw = 'Ответ принят! Попробуй ещё раз — сформулируй иначе.';
    const correct = isCorrect(raw);
    setAnswerCorrect(correct);

    try {
      const saveToken = authService.getToken();
      if (saveToken) {
        fetch(API.WEAK_TRAINING, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${saveToken}` },
          body: JSON.stringify({
            action: 'save_answer',
            subject: sessionTopic.subject,
            topic: sessionTopic.topic,
            question: content,
            user_answer: userAnswer,
            is_correct: correct,
            ai_feedback: raw.slice(0, 500),
            source: 'session',
          }),
        }).catch(() => {});
      }
    } catch { /* */ }

    if (correct) {
      if (navigator.vibrate) navigator.vibrate([60, 30, 100]);
      setProgressAnim(true);
      setTimeout(() => setProgressAnim(false), 1200);
      trackActivity('exam_tasks_done', 1).catch(() => {});
    }

    typeText(raw, setCheckTypingText, () => setCheckResult(raw));
  };

  const handleRetry = () => {
    setUserAnswer('');
    setCheckResult('');
    setCheckTypingText('');
    setAnswerCorrect(null);
    setRetryCount(r => r + 1);
    setShowCorrectAnswer(false);
    setCorrectAnswer('');
    setCorrectAnswerLoading(false);
  };

  const handleShowCorrect = async () => {
    if (correctAnswer) { setShowCorrectAnswer(true); return; }
    setCorrectAnswerLoading(true);
    try {
      const token = authService.getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const solutionPrompt = `Задание: ${content}\n\nДай подробное правильное решение этого задания с объяснением каждого шага. Кратко и понятно.`;
      const res = await fetch(API.AI_ASSISTANT, {
        method: 'POST',
        headers,
        body: token
          ? JSON.stringify({ question: solutionPrompt, system_only: true })
          : JSON.stringify({ action: 'demo_ask', question: solutionPrompt }),
      });
      const data = await res.json();
      const raw = cleanText(data.answer || data.response || '');
      setCorrectAnswer(raw);
      setShowCorrectAnswer(true);
    } catch {
      setCorrectAnswer(`Решение: задание по теме "${sessionTopic.topic}". Разберём вместе — напиши что именно непонятно.`);
      setShowCorrectAnswer(true);
    } finally {
      setCorrectAnswerLoading(false);
    }
  };

  const goNext = () => {
    if (stepIdx === STEPS.length - 1 && checkResult && (answerCorrect || showCorrectAnswer)) {
      if (timerRef.current) clearInterval(timerRef.current);
      window.dispatchEvent(new Event('session_completed'));
      if (navigator.vibrate) navigator.vibrate([80, 40, 120]);
      setScreen('correct_anim');
      setTimeout(() => {
        setScreen('done');
        if (isPremium) return;
        if (showCorrectAnswer) return;
        const token = authService.getToken();
        if (token) {
          const countKey = 'sessions_completed_total';
          const prev = parseInt(localStorage.getItem(countKey) || '0', 10);
          const total = prev + 1;
          localStorage.setItem(countKey, total.toString());
          setTimeout(() => {
            setPaywallTrigger(total >= 3 ? 'after_session_3rd' : 'after_session');
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
    const companionId = getCompanionFromStorage();
    const companion = getCompanion(companionId);
    const stage = getCompanionStage(companion, streak > 0 ? Math.min(streak, 30) : 1);
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 flex flex-col items-center justify-center px-6 text-center">
        {/* Компаньон */}
        <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${companion.style} flex items-center justify-center mb-2 shadow-xl text-4xl`}>
          {stage.emoji}
        </div>
        <div className="bg-white/15 rounded-2xl px-4 py-2 mb-5 max-w-xs">
          <p className="text-white text-sm font-medium">"{stage.phrase}"</p>
          <p className="text-white/50 text-xs mt-0.5">{companion.name} · {stage.title}</p>
        </div>
        <p className="text-white/60 text-sm mb-1 uppercase tracking-wide font-medium">{sessionTopic.subject}</p>
        <h1 className="text-white font-extrabold text-2xl mb-3 leading-tight">{sessionTopic.topic}</h1>

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
              <p className="text-white font-bold text-xl">{sessionTopic.number}/{sessionTopic.total}</p>
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

        {sessionAllowed === false ? (
          <div className="w-full max-w-xs mb-3">
            <div className="bg-white/15 border border-white/20 rounded-2xl px-5 py-4 mb-3 text-center">
              <p className="text-2xl mb-1">🚫</p>
              <p className="text-white font-bold text-base mb-1">Занятие на сегодня использовано</p>
              <p className="text-white/60 text-sm">Бесплатно — 1 занятие в день. Приходи завтра или подключи Premium.</p>
            </div>
            <button
              onClick={() => navigate('/pricing')}
              className="w-full h-14 bg-white text-purple-700 font-extrabold text-lg rounded-2xl shadow-2xl active:scale-[0.97] transition-all"
            >
              Безлимит — 499 ₽/мес →
            </button>
          </div>
        ) : (
          <>
            <Button
              onClick={startSession}
              disabled={sessionAllowed === null}
              className="w-full max-w-xs h-14 bg-white text-purple-700 font-extrabold text-lg rounded-2xl shadow-2xl active:scale-[0.97] transition-all mb-2 disabled:opacity-60"
            >
              {sessionAllowed === null
                ? <><Icon name="Loader2" size={18} className="animate-spin mr-2 text-purple-400" />Загружаю...</>
                : <>Начать <Icon name="ArrowRight" size={20} className="ml-1.5" /></>
              }
            </Button>
            {sessionsLeft !== null && (
              <p className="text-white/50 text-xs mb-3">
                {isPremium
                  ? 'Безлимит занятий — Premium'
                  : 'Бесплатно: 1 занятие в день'}
              </p>
            )}
          </>
        )}

        {sessionAllowed !== false && streak >= 3 && (
          <div className="bg-white/10 border border-white/20 rounded-2xl px-4 py-3 w-full max-w-xs text-center mb-3">
            <p className="text-white font-bold text-sm mb-1">🔥 Ты занимаешься {streak} дней подряд!</p>
            <p className="text-white/60 text-xs mb-3">Убери ограничения — занимайся без лимита</p>
            <button onClick={() => navigate('/pricing')} className="bg-white text-purple-700 font-bold text-sm px-5 py-2 rounded-xl w-full">
              Безлимит — 499 ₽/мес →
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
          <p className="text-white/50 text-sm">{sessionTopic.topic} · {sessionTopic.subject}</p>
        </div>

        {/* Крючок: до экзамена */}
        <div className="bg-white/15 backdrop-blur rounded-3xl px-5 py-4 mb-3">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">📅</span>
            <div>
              <p className="text-white font-bold text-base">До экзамена {daysToExam} {daysToExam === 1 ? 'день' : daysToExam < 5 ? 'дня' : 'дней'}</p>
              <p className="text-white/60 text-xs">Ты прошёл {sessionTopic.number} из {sessionTopic.total} тем</p>
            </div>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-1000"
              style={{ width: `${Math.round((sessionTopic.number / sessionTopic.total) * 100)}%` }}
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

        {/* Блок для бесплатных: сколько занятий осталось */}
        {!isPremium && (
          <div className="bg-white/15 backdrop-blur rounded-3xl px-5 py-4 mb-3">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🌙</span>
              <div className="flex-1">
                <p className="text-white font-bold text-base">
                  {sessionsLeft !== null && sessionsLeft > 0
                    ? `Ещё ${sessionsLeft} ${sessionsLeft === 1 ? 'занятие' : 'занятия'} сегодня`
                    : 'Занятия на сегодня закончились'}
                </p>
                <p className="text-white/60 text-xs">
                  {sessionsLeft !== null && sessionsLeft > 0
                    ? 'Продолжай — пока есть возможность!'
                    : 'Приходи завтра или подключи Premium'}
                </p>
              </div>
            </div>
            {sessionsLeft === 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/')}
                  className="flex-1 h-11 bg-white/20 text-white font-semibold text-sm rounded-2xl border border-white/30 active:scale-[0.97] transition-all"
                >
                  Приходи завтра 👋
                </button>
                <button
                  onClick={() => navigate('/pricing')}
                  className="flex-1 h-11 bg-white text-purple-700 font-extrabold text-sm rounded-2xl shadow-lg active:scale-[0.97] transition-all"
                >
                  Premium →
                </button>
              </div>
            )}
          </div>
        )}

        {!isPremium && sessionsLeft !== null && sessionsLeft > 0 && (
          <button
            onClick={() => navigate('/pricing')}
            className="w-full h-14 bg-white text-purple-700 font-extrabold text-lg rounded-2xl shadow-2xl mb-3 active:scale-[0.97] transition-all"
          >
            ⚡ До 5 занятий в день — Premium 499 ₽/мес
          </button>
        )}

        {isPremium && (
          <div className="bg-white/15 rounded-3xl px-5 py-3 mb-3 flex items-center justify-between">
            <p className="text-white/80 text-sm">Осталось занятий сегодня:</p>
            <p className="text-white font-extrabold text-xl">{sessionsLeft ?? '...'} из {sessionsMax}</p>
          </div>
        )}

        <Button
          onClick={() => navigate(sessionsLeft !== null && sessionsLeft > 0 ? '/session' : '/')}
          className={`w-full h-14 font-bold text-base rounded-2xl shadow-xl mb-3 active:scale-[0.98] transition-all ${isPremium || (sessionsLeft !== null && sessionsLeft > 0) ? 'bg-white text-purple-700' : 'bg-white/20 text-white border border-white/30'}`}
        >
          {sessionsLeft !== null && sessionsLeft > 0 ? 'Ещё занятие 🚀' : 'На главную 🏠'}
        </Button>
        <button onClick={() => navigate('/assistant')} className="text-white/40 text-sm text-center w-full py-2">
          Задать дополнительный вопрос
        </button>
      </div>

      {showPaywall && (
        <PaywallSheet
          trigger={paywallTrigger}
          streak={newStreak}
          daysToExam={daysToExam}
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
            <p className="text-white/60 text-xs">{sessionTopic.subject}</p>
            <h1 className="text-white font-bold text-base leading-tight">{sessionTopic.topic}</h1>
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
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100/50">
            {isTyping && !checkTypingText ? (
              <p className="text-[14.5px] leading-[1.75] text-gray-700 whitespace-pre-line">
                {typingText}
                <span className="inline-block w-0.5 h-4 bg-indigo-500 ml-0.5 animate-pulse align-middle" />
              </p>
            ) : (
              <AiText text={content} />
            )}
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
          <div className={`rounded-2xl p-5 text-[15px] leading-[1.8] whitespace-pre-line border ${
            answerCorrect === true ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 text-green-800' : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 text-amber-800'
          }`}>
            {checkTypingText}
            <span className="inline-block w-0.5 h-4 bg-current opacity-50 ml-0.5 animate-pulse align-middle" />
          </div>
        )}

        {/* Результат проверки */}
        {showCheckResult && (
          <div className={`rounded-2xl p-5 shadow-sm animate-in fade-in duration-300 ${
            answerCorrect ? 'bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200' : 'bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200'
          }`}>
            <div className="flex items-start gap-3 mb-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${answerCorrect ? 'bg-green-500 shadow-md shadow-green-200' : 'bg-amber-500 shadow-md shadow-amber-200'}`}>
                <Icon name={answerCorrect ? 'Check' : 'X'} size={16} className="text-white" />
              </div>
              <p className={`text-[15px] font-bold mt-1 ${answerCorrect ? 'text-green-700' : 'text-amber-700'}`}>
                {answerCorrect ? 'Правильно!' : 'Не совсем верно'}
              </p>
            </div>
            <AiText text={checkResult} variant={answerCorrect ? 'success' : 'warning'} />

            {/* Попробовать ещё раз + Показать правильный — только при неверном */}
            {!answerCorrect && (
              <div className="mt-3 flex flex-col gap-2">
                <button
                  onClick={handleRetry}
                  className="w-full bg-amber-100 hover:bg-amber-200 text-amber-700 font-semibold text-sm rounded-xl py-2.5 transition-colors flex items-center justify-center gap-2"
                >
                  <Icon name="RotateCcw" size={14} />
                  Попробовать ещё раз
                </button>
                {!showCorrectAnswer && (
                  <button
                    onClick={handleShowCorrect}
                    disabled={correctAnswerLoading}
                    className="w-full bg-white border-2 border-amber-200 text-amber-600 font-semibold text-sm rounded-xl py-2.5 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {correctAnswerLoading
                      ? <><Icon name="Loader2" size={14} className="animate-spin" /> Загружаю решение…</>
                      : <><Icon name="Lightbulb" size={14} /> Показать правильный ответ</>
                    }
                  </button>
                )}
              </div>
            )}

            {/* Правильный ответ */}
            {showCorrectAnswer && correctAnswer && (
              <div className="mt-3 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4">
                <p className="text-xs font-bold text-indigo-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Icon name="Lightbulb" size={12} /> Правильное решение
                </p>
                <AiText text={correctAnswer} variant="info" />
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Кнопка Дальше */}
      {!loading && !checkLoading && content && !isTyping && (!checkTypingText || checkResult) && (
        <div className="px-4 pb-8 pt-2 bg-gray-50">
          {!isTaskStep ? (
            <Button
              onClick={goNext}
              className="w-full h-[52px] bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base rounded-2xl shadow-[0_4px_16px_rgba(99,102,241,0.35)] active:scale-[0.98] transition-all"
            >
              Дальше <Icon name="ArrowRight" size={16} className="ml-1.5" />
            </Button>
          ) : isTaskStep && (answerCorrect === true || showCorrectAnswer) && showCheckResult ? (
            <div className="flex flex-col gap-2 animate-in fade-in duration-300">
              <Button
                onClick={goNext}
                className={`w-full h-[52px] font-bold text-base rounded-2xl active:scale-[0.98] transition-all ${
                  answerCorrect
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-[0_4px_16px_rgba(34,197,94,0.35)]'
                    : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-[0_4px_16px_rgba(99,102,241,0.35)]'
                }`}
              >
                {answerCorrect ? 'Завершить занятие 🎉' : 'Понятно, завершить'}
              </Button>
              {!isPremium && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <span className="text-xl flex-shrink-0">🌙</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-amber-800 font-bold text-sm leading-tight">Занятие на сегодня окончено</p>
                    <p className="text-amber-600 text-xs mt-0.5">Приходи завтра — или продолжи с Premium</p>
                  </div>
                  <button
                    onClick={() => navigate('/pricing')}
                    className="bg-amber-500 text-white text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0 active:scale-95 transition-all"
                  >
                    Premium
                  </button>
                </div>
              )}
            </div>
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
          daysToExam={daysToExam}
          onClose={() => setShowPaywall(false)}
        />
      )}
    </div>
  );
}