import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import BottomNav from '@/components/BottomNav';
import { trackSession } from '@/lib/review';
import { dailyCheckin } from '@/lib/gamification';

const SCHEDULE_URL = 'https://functions.poehali.dev/7030dc26-77cd-4b59-91e6-1be52f31cf8d';
const GAMIFICATION_URL = 'https://functions.poehali.dev/0559fb04-cd62-4e50-bb12-dfd6941a7080';

// Тема дня — в будущем с бэкенда
const TODAY_TOPIC = {
  subject: 'Математика',
  topic: 'Квадратные уравнения',
  steps: ['Объяснение', 'Пример', 'Задание'],
};

// Показываем «базовую» тему если пользователь новый или тема не задана
const FALLBACK_TOPIC = {
  subject: 'Математика',
  topic: 'Начнём с базовой темы',
  steps: ['Объяснение', 'Пример', 'Задание'],
};

const QUICK_ACCESS = [
  { icon: 'BookOpen', label: 'Подготовка к ЕГЭ', path: '/exam', color: 'bg-indigo-50 text-indigo-600' },
  { icon: 'GraduationCap', label: 'ВУЗ / конспекты', path: '/assistant', color: 'bg-purple-50 text-purple-600' },
  { icon: 'Paperclip', label: 'Разобрать файл', path: '/materials', color: 'bg-pink-50 text-pink-600' },
];

const SECONDARY = [
  { icon: 'BookMarked', label: 'Зачётка', path: '/gradebook' },
  { icon: 'Timer', label: 'Помодоро', path: '/pomodoro' },
  { icon: 'Trophy', label: 'Достижения', path: '/achievements' },
];

// Прогресс с «осталось тем»
const PROGRESS_SUBJECTS = [
  { name: 'Математика', pct: 48, left: 12, color: 'bg-indigo-500' },
  { name: 'Русский язык', pct: 32, left: 18, color: 'bg-purple-500' },
  { name: 'Физика', pct: 12, left: 24, color: 'bg-pink-500' },
];

interface GamificationProfile {
  streak: { current: number; longest: number };
  level: number;
  xp_progress: number;
  xp_needed: number;
}

interface Lesson {
  id: number;
  subject: string;
  type: string;
  start_time: string;
  end_time: string;
  day_of_week: number;
  room?: string;
}

const dayNames = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

function streakWord(n: number) {
  if (n === 1) return 'день';
  if (n >= 2 && n <= 4) return 'дня';
  return 'дней';
}

export default function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState(authService.getUser());
  const [gamification, setGamification] = useState<GamificationProfile | null>(null);
  const [todayLessons, setTodayLessons] = useState<Lesson[]>([]);
  // sessionDone — пользователь уже прошёл занятие сегодня (храним в localStorage)
  const [sessionDone, setSessionDone] = useState(() => {
    const key = `session_done_${new Date().toDateString()}`;
    return localStorage.getItem(key) === '1';
  });

  useEffect(() => {
    trackSession();
    // Слушаем событие — Session.tsx бросает его при завершении
    const onDone = () => {
      localStorage.setItem(`session_done_${new Date().toDateString()}`, '1');
      setSessionDone(true);
    };
    window.addEventListener('session_completed', onDone);
    return () => window.removeEventListener('session_completed', onDone);
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!authService.isAuthenticated()) { navigate('/auth'); return; }
      const verifiedUser = await authService.verifyToken();
      if (!verifiedUser) { navigate('/auth'); return; }
      setUser(verifiedUser);
      loadGamification();
      loadTodaySchedule();
      dailyCheckin();
    };
    init();
  }, [navigate]);

  const loadGamification = async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${GAMIFICATION_URL}?action=profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setGamification(await res.json());
    } catch (e) { console.warn(e); }
  };

  const loadTodaySchedule = async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${SCHEDULE_URL}?action=lessons`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const dow = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
        setTodayLessons((data.lessons || []).filter((l: Lesson) => l.day_of_week === dow));
      }
    } catch (e) { console.warn(e); }
  };

  const firstName = user?.full_name?.split(' ')[0] || 'Студент';
  const streak = gamification?.streak?.current ?? 0;
  const todayDow = new Date().getDay();
  const todayName = dayNames[todayDow === 0 ? 6 : todayDow - 1];
  const topic = TODAY_TOPIC;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* Шапка */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 px-4 pt-12 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/70 text-sm">Привет, {firstName} 👋</p>
            <h1 className="text-white font-bold text-xl">Сегодня — {todayName}</h1>
          </div>
          <button onClick={() => navigate('/profile')} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Icon name="User" size={18} className="text-white" />
          </button>
        </div>
      </div>

      <div className="px-4 -mt-3 flex flex-col gap-4">

        {/* ===== БЛОК 1: СЕГОДНЯШНЯЯ СЕССИЯ ===== */}
        {sessionDone ? (
          /* Сессия пройдена — тихий статус */
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center text-xl">✅</div>
              <div>
                <p className="text-white font-bold text-base">Занятие пройдено!</p>
                <p className="text-white/70 text-xs">{topic.topic} · {topic.subject}</p>
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="text-gray-500 text-sm text-center mb-3">Следующее занятие — завтра 🌅</p>
              <button
                onClick={() => navigate('/assistant')}
                className="w-full text-center text-indigo-500 text-sm font-medium py-2 rounded-2xl border-2 border-indigo-100 hover:bg-indigo-50 transition-colors"
              >
                Задать дополнительный вопрос
              </button>
            </div>
          </div>
        ) : (
          /* Активная сессия */
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/80 text-xs font-medium uppercase tracking-wide">Сегодняшняя сессия</span>
                <span className="text-white/80 text-xs flex items-center gap-1 bg-white/20 rounded-lg px-2 py-0.5">
                  <Icon name="Zap" size={11} /> 2–3 мин
                </span>
              </div>
              <h2 className="text-white font-bold text-lg leading-tight">{topic.topic}</h2>
              <p className="text-white/60 text-xs mt-0.5">{topic.subject}</p>
            </div>

            <div className="px-5 py-4">
              {/* Шаги */}
              <div className="flex gap-2 mb-4">
                {topic.steps.map((step, i) => (
                  <div key={step} className={`flex-1 flex items-center justify-center gap-1 rounded-xl py-1.5 text-xs font-medium ${
                    i === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-300'
                  }`}>
                    <span>{i === 0 ? '①' : i === 1 ? '②' : '③'}</span>
                    {step}
                  </div>
                ))}
              </div>

              {/* Кнопка с пульсацией */}
              <Button
                onClick={() => navigate('/session')}
                className="w-full h-[52px] bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base rounded-2xl shadow-[0_4px_20px_rgba(99,102,241,0.45)] active:scale-[0.98] transition-all animate-pulse-soft"
                style={{ animation: 'pulse-cta 2.5s ease-in-out infinite' }}
              >
                Начать за 2 минуты <Icon name="Zap" size={16} className="ml-1.5" />
              </Button>
              <p className="text-center text-xs text-gray-400 mt-2">
                Объяснение → пример → задание → готово
              </p>

              {/* Бесплатный якорь */}
              <p className="text-center text-[11px] text-indigo-400 font-medium mt-1">
                Сегодня доступно: 1 занятие бесплатно
              </p>
            </div>
          </div>
        )}

        {/* ===== БЛОК 2: STREAK ===== */}
        <div className="bg-white rounded-3xl shadow-sm px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-100 rounded-2xl flex items-center justify-center text-xl">🔥</div>
            <div className="flex-1">
              <p className="font-bold text-gray-800 text-base leading-tight">
                {streak > 0
                  ? `${streak} ${streakWord(streak)} подряд`
                  : 'Начни серию сегодня!'}
              </p>
              <p className={`text-xs mt-0.5 font-medium ${streak > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                {streak > 0 ? 'Не прерывай серию — потеряешь прогресс 🔥' : 'Каждый день — шаг к результату'}
              </p>
            </div>
          </div>

          {/* 7 дней */}
          <div className="flex gap-1.5">
            {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((d, i) => {
              const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
              const isToday = i === todayIdx;
              const isDone = streak > 0 && i <= todayIdx && i > todayIdx - streak;
              const isFuture = i > todayIdx;
              return (
                <div key={d} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`w-full aspect-square rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                    isToday && isDone ? 'bg-orange-500 text-white shadow-[0_2px_8px_rgba(249,115,22,0.4)]' :
                    isDone ? 'bg-orange-200 text-orange-700' :
                    isToday ? 'border-2 border-dashed border-orange-300 text-orange-400' :
                    isFuture ? 'bg-gray-50 text-gray-200' :
                    'bg-gray-100 text-gray-300'
                  }`}>
                    {isDone ? '✓' : isToday ? '·' : ''}
                  </div>
                  <span className={`text-[9px] font-medium ${isToday ? 'text-orange-500' : 'text-gray-400'}`}>{d}</span>
                </div>
              );
            })}
          </div>

          {streak >= 3 && (
            <p className="text-center text-xs text-orange-500 font-semibold mt-2.5">
              🏆 Лучшая серия: {gamification?.streak?.longest ?? streak} {streakWord(gamification?.streak?.longest ?? streak)}
            </p>
          )}
        </div>

        {/* ===== БЛОК 3: ПРОГРЕСС ===== */}
        <div className="bg-white rounded-3xl shadow-sm px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">Твоя подготовка</h3>
            <button onClick={() => navigate('/analytics')} className="text-xs text-indigo-500 font-medium flex items-center gap-0.5">
              Подробнее <Icon name="ChevronRight" size={13} />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {PROGRESS_SUBJECTS.map(s => (
              <div key={s.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600 font-medium">{s.name}</span>
                  <span className="text-indigo-400 font-semibold">осталось {s.left} тем</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${s.color} rounded-full transition-all duration-700`} style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate('/exam')}
            className="mt-4 w-full flex items-center justify-center gap-2 border-2 border-dashed border-indigo-200 rounded-2xl py-2.5 text-indigo-500 text-sm font-medium hover:bg-indigo-50 transition-colors active:scale-[0.98]"
          >
            <Icon name="Target" size={15} />
            Посмотреть слабые темы
          </button>
        </div>

        {/* ===== БЛОК 4: МОНЕТИЗАЦИЯ (streak ≥ 5) ===== */}
        {streak >= 5 && (
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl px-5 py-4 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🚀</span>
              <div>
                <p className="text-white font-bold text-base">Ты занимаешься {streak} {streakWord(streak)} подряд!</p>
                <p className="text-white/70 text-xs">Хочешь готовиться быстрее?</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/pricing')}
              className="w-full bg-white text-orange-600 font-bold text-sm rounded-2xl py-2.5 active:scale-[0.98] transition-all shadow-sm"
            >
              Безлимит занятий — подробнее
            </button>
          </div>
        )}

        {/* ===== БЛОК 5: БЫСТРЫЙ ДОСТУП ===== */}
        <div>
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2 px-1">Быстрый доступ</p>
          <div className="grid grid-cols-3 gap-2.5">
            {QUICK_ACCESS.map(item => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className="bg-white rounded-2xl shadow-sm p-3.5 flex flex-col items-center gap-2 active:scale-[0.96] transition-all"
              >
                <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center`}>
                  <Icon name={item.icon} size={18} />
                </div>
                <span className="text-gray-700 text-xs font-medium text-center leading-tight">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ===== РАСПИСАНИЕ СЕГОДНЯ ===== */}
        {todayLessons.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm px-5 py-4">
            <h3 className="font-bold text-gray-800 mb-3">Пары сегодня</h3>
            <div className="flex flex-col gap-2">
              {todayLessons.slice(0, 3).map(lesson => (
                <div key={lesson.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-2.5">
                  <div className="w-1 h-10 bg-indigo-400 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">{lesson.subject}</p>
                    <p className="text-gray-400 text-xs">{lesson.start_time} – {lesson.end_time}{lesson.room ? ` · ауд. ${lesson.room}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== ВТОРОСТЕПЕННЫЕ ===== */}
        <div>
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2 px-1">Ещё</p>
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden divide-y divide-gray-50">
            {SECONDARY.map(item => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Icon name={item.icon} size={16} className="text-gray-500" />
                </div>
                <span className="text-gray-700 text-sm font-medium flex-1">{item.label}</span>
                <Icon name="ChevronRight" size={14} className="text-gray-300" />
              </button>
            ))}
          </div>
        </div>

        <div className="h-2" />
      </div>

      {/* CSS пульсация кнопки */}
      <style>{`
        @keyframes pulse-cta {
          0%, 100% { box-shadow: 0 4px 20px rgba(99,102,241,0.45); }
          50% { box-shadow: 0 4px 32px rgba(99,102,241,0.7); }
        }
      `}</style>

      <BottomNav />
    </div>
  );
}