import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import BottomNav from '@/components/BottomNav';
import { trackSession } from '@/lib/review';
import { dailyCheckin } from '@/lib/gamification';
import { am } from '@/lib/appmetrica';
import AppReviewPrompt from '@/components/AppReviewPrompt';
import WelcomeBack from '@/components/WelcomeBack';
import DailyBonusPopup from '@/components/DailyBonusPopup';
import PaywallSheet from '@/components/PaywallSheet';
import { getCompanion, getCompanionStage, getCompanionFromStorage } from '@/lib/companion';
import { getTodayTopic } from '@/lib/topics';
import { useLimits } from '@/hooks/useLimits';
import { API } from '@/lib/api-urls';

const QUICK_ACCESS_EGE = [
  { icon: 'BookOpen', label: 'Подготовка к ЕГЭ', path: '/exam', color: 'bg-indigo-50 text-indigo-600' },
  { icon: 'MessageCircle', label: 'ИИ-помощник (фото+аудио)', path: '/assistant', color: 'bg-purple-50 text-purple-600' },
  { icon: 'Paperclip', label: 'Разобрать файл', path: '/materials', color: 'bg-pink-50 text-pink-600' },
];

const QUICK_ACCESS_UNI = [
  { icon: 'GraduationCap', label: 'Учёба и конспекты', path: '/university', color: 'bg-indigo-50 text-indigo-600' },
  { icon: 'MessageCircle', label: 'ИИ-помощник (фото+аудио)', path: '/assistant', color: 'bg-purple-50 text-purple-600' },
  { icon: 'Paperclip', label: 'Разобрать файл', path: '/materials', color: 'bg-pink-50 text-pink-600' },
];

const QUICK_ACCESS_OTHER = [
  { icon: 'MessageCircle', label: 'ИИ-помощник (фото+аудио)', path: '/assistant', color: 'bg-purple-50 text-purple-600' },
  { icon: 'Paperclip', label: 'Разобрать файл', path: '/materials', color: 'bg-pink-50 text-pink-600' },
  { icon: 'Trophy', label: 'Достижения', path: '/achievements', color: 'bg-amber-50 text-amber-600' },
];

const SECONDARY_EGE = [
  { icon: 'FileText', label: 'Пробный тест', path: '/mock-exam' },
  { icon: 'Calculator', label: 'Баллы ЕГЭ', path: '/calculator' },
  { icon: 'Building2', label: 'Подбор вузов', path: '/universities' },
  { icon: 'Timer', label: 'Помодоро', path: '/pomodoro' },
];

const SECONDARY = [
  { icon: 'Timer', label: 'Помодоро', path: '/pomodoro' },
  { icon: 'Trophy', label: 'Достижения', path: '/achievements' },
];

interface GamificationProfile {
  streak: { current: number; longest: number };
  level: number;
  xp_progress: number;
  xp_needed: number;
}

interface LeaderEntry {
  rank: number;
  full_name: string;
  xp_period: number;
  level: number;
  is_me?: boolean;
}

function useTrialTimer(freeDays: number, daysReg: number) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    const daysLeft = Math.max(0, freeDays - daysReg);
    if (daysLeft <= 0) return;
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const totalSecondsLeft = daysLeft > 1
      ? daysLeft * 86400
      : Math.floor((endOfDay.getTime() - Date.now()) / 1000);

    let secs = totalSecondsLeft;
    const tick = () => {
      if (secs <= 0) { setTimeLeft('00:00:00'); return; }
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      setTimeLeft(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
      secs--;
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [freeDays, daysReg]);
  return timeLeft;
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
  const [todayLessons] = useState<Lesson[]>([]);
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const limits = useLimits();
  const sessionsDoneToday = useRef(parseInt(localStorage.getItem(`sessions_done_count_${new Date().toDateString()}`) || '0'));
  const [sessionDone, setSessionDone] = useState(() => {
    const key = `session_done_${new Date().toDateString()}`;
    return localStorage.getItem(key) === '1';
  });
  const [showDailyBonus, setShowDailyBonus] = useState(true);

  useEffect(() => {
    trackSession();
    const onDone = () => {
      localStorage.setItem(`session_done_${new Date().toDateString()}`, '1');
      setSessionDone(true);
      const countKey = `sessions_done_count_${new Date().toDateString()}`;
      const count = parseInt(localStorage.getItem(countKey) || '0') + 1;
      localStorage.setItem(countKey, String(count));
      sessionsDoneToday.current = count;
      // Показываем paywall после 3-й сессии, или после каждой если не Premium
      setTimeout(() => setShowPaywall(true), 1500);
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
      if (!verifiedUser.onboarding_completed) { navigate('/onboarding'); return; }
      loadGamification();
      loadLeaders();
      dailyCheckin();
    };
    init();
  }, [navigate]);

  const loadGamification = async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(API.GAMIFICATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'get_profile' }),
      });
      if (res.ok) setGamification(await res.json());
    } catch { /* silent */ }
  };

  const loadLeaders = async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${API.GAMIFICATION}?action=leaderboard&period=week`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const list: LeaderEntry[] = (data.leaderboard || []).slice(0, 5);
        const me = data.current_user;
        if (me && !list.find(l => l.is_me)) list.push({ ...me, is_me: true });
        setLeaders(list);
      }
    } catch { /* silent */ }
  };


  const firstName = user?.full_name?.split(' ')[0] || 'Студент';
  const streak = gamification?.streak?.current ?? 0;
  const isNewUser = !sessionDone && streak === 0 && !localStorage.getItem('first_session_shown');
  const hideWelcomeBack = streak === 0 && (!gamification || gamification.streak.longest === 0);
  const todayDow = new Date().getDay();
  const todayName = dayNames[todayDow === 0 ? 6 : todayDow - 1];
  const topicData = getTodayTopic(user?.exam_subject || undefined);
  const topic = { ...topicData, steps: ['Объяснение', 'Пример', 'Задание'] };
  const userGoal = user?.goal || 'ege';
  const isExamGoal = userGoal === 'ege' || userGoal === 'oge';
  const isUniGoal = userGoal === 'university';
  const quickAccess = isExamGoal ? QUICK_ACCESS_EGE : isUniGoal ? QUICK_ACCESS_UNI : QUICK_ACCESS_OTHER;

  // Данные для таймера пробного периода
  const daysReg = limits.data?.days_since_registration ?? 999;
  const freeDays = limits.data?.free_days_total ?? 3;
  const daysLeft = Math.max(0, freeDays - daysReg);
  const trialTimer = useTrialTimer(freeDays, daysReg);

  // Стрик в опасности: серия >= 3 и сегодня ещё не было активности
  const streakInDanger = streak >= 3 && !sessionDone;

  // Отставание от плана: сколько тем пропущено
  const topicsBehind = Math.max(0, (topic.number ?? 1) - 1);
  const isExamSoon = isExamGoal && topicsBehind === 0 && !sessionDone;

  // Paywall trigger
  const paywallTrigger = sessionsDoneToday.current >= 3 ? 'after_session_3rd' : 'after_session';

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-nav">

      {/* Шапка */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 px-4 pt-12 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/70 text-sm">Привет, {firstName} 👋</p>
            <h1 className="text-white font-bold text-xl">Сегодня — {todayName}</h1>
          </div>
          {(() => {
            const companionId = getCompanionFromStorage();
            const comp = getCompanion(companionId);
            const lvl = gamification?.level ?? 1;
            const stage = getCompanionStage(comp, lvl);
            return (
              <button
                onClick={() => navigate('/profile')}
                className="relative flex-shrink-0"
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${comp.style} flex items-center justify-center text-xl shadow-lg border-2 border-white/30`}>
                  {stage.emoji}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full px-1.5 py-0.5 shadow text-[9px] font-extrabold text-purple-700 leading-none">
                  {lvl}
                </div>
              </button>
            );
          })()}
        </div>
      </div>

      <div className="px-4 -mt-3 flex flex-col gap-4">

        {/* ===== КОМПАНЬОН + XP ===== */}
        {(() => {
          const companionId = getCompanionFromStorage();
          const comp = getCompanion(companionId);
          const lvl = gamification?.level ?? 1;
          const stage = getCompanionStage(comp, lvl);
          const xpPct = gamification && gamification.xp_needed > 0
            ? Math.round((gamification.xp_progress / gamification.xp_needed) * 100) : 0;
          return (
            <button
              onClick={() => navigate('/achievements')}
              className={`bg-gradient-to-br ${comp.style} rounded-3xl shadow-lg px-4 py-3 flex items-center gap-3 active:scale-[0.98] transition-all`}
            >
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl flex-shrink-0 shadow-sm border border-white/30">
                {stage.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-white text-sm">{comp.name} · {stage.title}</p>
                <p className="text-white/70 text-xs truncate">"{stage.phrase}"</p>
                <div className="mt-1.5 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${xpPct}%` }} />
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="bg-white/25 rounded-xl px-2 py-1">
                  <p className="text-white font-extrabold text-sm leading-none">Ур.{lvl}</p>
                  <p className="text-white/70 text-[9px] mt-0.5">{gamification?.xp_progress ?? 0} XP</p>
                </div>
              </div>
            </button>
          );
        })()}

        {/* ===== 🔥 СТРИК В ОПАСНОСТИ ===== */}
        {streakInDanger && !limits.loading && (
          <button
            onClick={() => navigate('/achievements')}
            className="bg-gradient-to-r from-red-500 to-orange-500 rounded-3xl px-5 py-4 w-full text-left active:scale-[0.98] transition-all shadow-lg"
            style={{ animation: 'pulse-danger 1.5s ease-in-out infinite' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">🔥</div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-extrabold text-base leading-tight">Серия {streak} {streakWord(streak)} сгорит сегодня!</p>
                <p className="text-white/80 text-xs mt-0.5">Сделай занятие прямо сейчас — не теряй прогресс</p>
              </div>
              <div className="flex-shrink-0">
                <div className="bg-white/20 rounded-xl px-3 py-1.5 text-center">
                  <p className="text-white font-extrabold text-lg leading-none">🔥{streak}</p>
                  <p className="text-white/70 text-[10px]">дней</p>
                </div>
              </div>
            </div>
            <div className="mt-3 bg-white/15 rounded-2xl px-4 py-2 flex items-center justify-between">
              <span className="text-white/80 text-xs">Начать занятие и сохранить серию</span>
              <Icon name="ChevronRight" size={16} className="text-white" />
            </div>
          </button>
        )}

        {/* ===== ⏰ БОЛЬШОЙ ТАЙМЕР ПРОБНОГО ПЕРИОДА ===== */}
        {!limits.isPremium && !limits.loading && daysLeft > 0 && (
          <button
            onClick={() => { am.premiumClick('index_trial_timer'); navigate('/pricing'); }}
            className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-3xl px-5 py-4 w-full text-left active:scale-[0.98] transition-all shadow-lg overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">Бесплатный период</p>
                <p className="text-white font-extrabold text-lg leading-tight mt-0.5">Успей попробовать всё!</p>
              </div>
              <div className="bg-white/20 rounded-2xl px-3 py-2 text-center flex-shrink-0">
                <p className="text-white font-mono font-extrabold text-xl leading-none">{trialTimer || `${daysLeft}д`}</p>
                <p className="text-white/60 text-[10px] mt-0.5">осталось</p>
              </div>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-white rounded-full transition-all duration-1000"
                style={{ width: `${Math.round((daysLeft / freeDays) * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-white/70 text-xs">После окончания — только 3 вопроса в день</p>
              <div className="bg-white text-purple-700 font-bold text-xs rounded-xl px-3 py-1.5 flex-shrink-0">
                Купить сейчас
              </div>
            </div>
          </button>
        )}

        {/* ===== ПЛАШКА ПОСЛЕ ОКОНЧАНИЯ ПРОБНОГО ПЕРИОДА ===== */}
        {!limits.isPremium && !limits.loading && daysLeft <= 0 && !limits.data?.is_soft_landing && (
          <button
            onClick={() => { am.premiumClick('index_trial_expired'); navigate('/pricing'); }}
            className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl px-4 py-3 flex items-center gap-3 active:scale-[0.98] transition-all"
          >
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Icon name="Zap" size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">Открой безлимит — подключи Premium</p>
              <p className="text-white/70 text-xs">Безлимит вопросов, фото, аудио и занятий каждый день</p>
            </div>
            <Icon name="ChevronRight" size={16} className="text-white/60" />
          </button>
        )}

        {/* ===== ПРИВЕТСТВИЕ НОВОГО ПОЛЬЗОВАТЕЛЯ ===== */}
        {isNewUser && (
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-6 text-center">
              <div className="text-4xl mb-3">🎉</div>
              <h2 className="text-white font-extrabold text-xl mb-1">Все готово!</h2>
              <p className="text-white/70 text-sm">Начни с первого занятия — это займет всего 5 минут</p>
            </div>
            <div className="px-5 py-4">
              <Button
                onClick={() => {
                  localStorage.setItem('first_session_shown', '1');
                  navigate('/session');
                }}
                className="w-full h-14 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base rounded-2xl shadow-[0_4px_20px_rgba(99,102,241,0.45)]"
                style={{ animation: 'pulse-cta 2.5s ease-in-out infinite' }}
              >
                Начать занятие <Icon name="Zap" size={18} className="ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* ===== БЛОК 1: СЕГОДНЯШНЯЯ СЕССИЯ ===== */}
        {sessionDone ? (
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-5 py-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center text-xl">✅</div>
                <div>
                  <p className="text-white font-bold text-base">Сегодня — сделано!</p>
                  <p className="text-white/70 text-xs">{topic.topic} · {topic.subject}</p>
                </div>
              </div>
              <div className="bg-white/15 rounded-2xl px-4 py-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-white/80 text-xs">Твой прогресс</span>
                  <span className="text-white font-bold text-xs">{topic.number} из {topic.total} тем</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all" style={{ width: `${Math.round(((topic.number ?? 1) / (topic.total ?? 30)) * 100)}%` }} />
                </div>
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="text-gray-700 text-sm font-medium text-center mb-1">Завтра — {topic.nextTopic || 'следующая тема'}</p>
              <p className="text-gray-400 text-xs text-center mb-3">Не пропускай, чтобы не потерять серию</p>
              <button
                onClick={() => { am.assistantOpen('index_session_done'); navigate('/assistant'); }}
                className="w-full text-center text-indigo-500 text-sm font-medium py-2 rounded-2xl border-2 border-indigo-100 hover:bg-indigo-50 transition-colors"
              >
                Задать дополнительный вопрос
              </button>
            </div>
          </div>
        ) : isUniGoal ? (
          /* Вузовец — не нужны занятия по ЕГЭ */
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4">
              <span className="text-white/80 text-xs font-medium uppercase tracking-wide">Готов к учёбе?</span>
              <h2 className="text-white font-bold text-lg leading-tight mt-1">Задай вопрос ИИ или разбери конспект</h2>
              <p className="text-white/60 text-xs mt-0.5">Загрузи лекцию — получи краткое изложение</p>
            </div>
            <div className="px-5 py-4 flex flex-col gap-2">
              <Button
                onClick={() => navigate('/university')}
                className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl"
              >
                Разобрать конспект <Icon name="ArrowRight" size={16} className="ml-1.5" />
              </Button>
              <button onClick={() => { am.assistantOpen('index_university'); navigate('/assistant'); }} className="w-full py-2 text-indigo-500 text-sm font-medium text-center">
                Или задать вопрос ИИ
              </button>
            </div>
          </div>
        ) : !isExamGoal ? (
          /* "Другое" */
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-4">
              <span className="text-white/80 text-xs font-medium uppercase tracking-wide">Сегодня</span>
              <h2 className="text-white font-bold text-lg leading-tight mt-1">Задай любой вопрос ИИ</h2>
              <p className="text-white/60 text-xs mt-0.5">Объясняю темы, решаю задачи, помогаю с учёбой</p>
            </div>
            <div className="px-5 py-4">
              <Button
                onClick={() => navigate('/assistant')}
                className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-2xl"
              >
                Открыть ИИ-помощник <Icon name="Sparkles" size={16} className="ml-1.5" />
              </Button>
            </div>
          </div>
        ) : (
          /* Активная сессия ЕГЭ/ОГЭ */
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/80 text-xs font-medium uppercase tracking-wide">Сегодняшняя сессия</span>
                <span className="text-white/80 text-xs flex items-center gap-1 bg-white/20 rounded-lg px-2 py-0.5">
                  <Icon name="Zap" size={11} /> ~5 мин
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
                className="w-full h-[52px] bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base rounded-2xl shadow-[0_4px_20px_rgba(99,102,241,0.45)] active:scale-[0.98] transition-all"
                style={{ animation: 'pulse-cta 2.5s ease-in-out infinite' }}
              >
                Начать занятие <Icon name="Zap" size={16} className="ml-1.5" />
              </Button>
              <p className="text-center text-xs text-gray-400 mt-2">
                Объяснение → пример → задание → готово
              </p>
              <p className="text-center text-[11px] text-indigo-400 font-medium mt-1">
                {limits.isPremium || limits.isTrial
                  ? 'Безлимит занятий — Premium активен'
                  : `Сегодня доступно: ${limits.sessionsRemaining()} из 3 занятий бесплатно`}
              </p>
            </div>
          </div>
        )}

        {/* ===== БЛОК 2: STREAK ===== */}
        <button onClick={() => navigate('/achievements')} className="bg-white rounded-3xl shadow-sm px-5 py-4 w-full text-left active:scale-[0.98] transition-all">
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
        </button>

        {/* ===== 🏆 МИНИ-ЛИДЕРБОРД ===== */}
        {leaders.length > 0 && (
          <button
            onClick={() => navigate('/achievements')}
            className="bg-white rounded-3xl shadow-sm px-5 py-4 w-full text-left active:scale-[0.98] transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center text-base">🏆</div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">Рейтинг недели</p>
                  <p className="text-gray-400 text-xs">Топ учеников по XP</p>
                </div>
              </div>
              <span className="text-indigo-500 text-xs font-semibold">Все →</span>
            </div>
            <div className="flex flex-col gap-2">
              {leaders.slice(0, 5).map((l, i) => (
                <div key={i} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${l.is_me ? 'bg-indigo-50 border border-indigo-100' : 'bg-gray-50'}`}>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-extrabold flex-shrink-0 ${
                    l.rank === 1 ? 'bg-amber-400 text-white' :
                    l.rank === 2 ? 'bg-gray-400 text-white' :
                    l.rank === 3 ? 'bg-orange-400 text-white' :
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {l.rank === 1 ? '🥇' : l.rank === 2 ? '🥈' : l.rank === 3 ? '🥉' : l.rank}
                  </div>
                  <p className={`flex-1 text-sm font-medium truncate ${l.is_me ? 'text-indigo-700 font-bold' : 'text-gray-700'}`}>
                    {l.is_me ? 'Ты' : (l.full_name?.split(' ')[0] || 'Ученик')}
                  </p>
                  <p className={`text-xs font-bold ${l.is_me ? 'text-indigo-600' : 'text-gray-500'}`}>{l.xp_period} XP</p>
                </div>
              ))}
            </div>
          </button>
        )}

        {/* ===== БЛОК 3: ПРОГРЕСС ===== */}
        <div className="bg-white rounded-3xl shadow-sm px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">Твоя подготовка</h3>
          </div>

          {/* Тема дня */}
          <div className="bg-indigo-50 rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-xl">📚</span>
            <div className="flex-1 min-w-0">
              <p className="text-indigo-700 font-bold text-sm truncate">{topic.topic}</p>
              <p className="text-indigo-400 text-xs">{topic.subject} · тема сегодня</p>
            </div>
          </div>

          {/* Строка лимитов */}
          {!limits.loading && (
            <>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className={`rounded-2xl px-2 py-2 ${limits.aiRemaining() <= 0 && !limits.isPremium ? 'bg-red-50' : limits.aiRemaining() <= 2 && !limits.isPremium ? 'bg-amber-50' : 'bg-purple-50'}`}>
                  <p className={`font-bold text-sm ${limits.aiRemaining() <= 0 && !limits.isPremium ? 'text-red-600' : limits.aiRemaining() <= 2 && !limits.isPremium ? 'text-amber-700' : 'text-purple-700'}`}>{limits.aiRemaining() >= 999 ? '∞' : limits.aiRemaining()}</p>
                  <p className={`text-[10px] ${limits.aiRemaining() <= 0 && !limits.isPremium ? 'text-red-400' : limits.aiRemaining() <= 2 && !limits.isPremium ? 'text-amber-400' : 'text-purple-400'}`}>вопросов ИИ</p>
                </div>
                <div className="bg-indigo-50 rounded-2xl px-2 py-2">
                  <p className="text-indigo-700 font-bold text-sm">{limits.sessionsRemaining() >= 999 ? '∞' : limits.sessionsRemaining()}</p>
                  <p className="text-indigo-400 text-[10px]">занятий</p>
                </div>
                <div className="bg-pink-50 rounded-2xl px-2 py-2">
                  <p className="text-pink-700 font-bold text-sm">{limits.materialsRemaining() >= 999 ? '∞' : limits.materialsRemaining()}</p>
                  <p className="text-pink-400 text-[10px]">загрузок</p>
                </div>
              </div>
              {!limits.isPremium && !limits.isTrial && limits.aiRemaining() <= 2 && limits.aiRemaining() > 0 && (
                <button onClick={() => navigate('/pricing')} className="mt-2 w-full bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 flex items-center gap-2 active:scale-[0.98] transition-all">
                  <span className="text-base">⚠️</span>
                  <div className="flex-1 text-left">
                    <p className="text-amber-700 font-bold text-xs">Осталось {limits.aiRemaining()} {limits.aiRemaining() === 1 ? 'вопрос' : 'вопроса'} ИИ</p>
                    <p className="text-amber-500 text-[10px]">Подключи Premium — безлимит вопросов</p>
                  </div>
                  <Icon name="ChevronRight" size={14} className="text-amber-400" />
                </button>
              )}
              {!limits.isPremium && !limits.isTrial && limits.aiRemaining() <= 0 && (
                <button onClick={() => navigate('/pricing')} className="mt-2 w-full bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5 flex items-center gap-2 active:scale-[0.98] transition-all">
                  <span className="text-base">🔒</span>
                  <div className="flex-1 text-left">
                    <p className="text-red-700 font-bold text-xs">Вопросы ИИ закончились</p>
                    <p className="text-red-500 text-[10px]">Подключи Premium или подожди до завтра</p>
                  </div>
                  <Icon name="ChevronRight" size={14} className="text-red-400" />
                </button>
              )}
            </>
          )}

          <button
            onClick={() => navigate('/exam')}
            className="mt-3 w-full flex items-center justify-center gap-2 border-2 border-dashed border-indigo-200 rounded-2xl py-2.5 text-indigo-500 text-sm font-medium hover:bg-indigo-50 transition-colors active:scale-[0.98]"
          >
            <Icon name="Target" size={15} />
            Открыть подготовку к экзамену
          </button>
        </div>

        {/* ===== БЛОК АПГРЕЙДА (free, лимиты кончаются) ===== */}
        {!limits.loading && !limits.isPremium && !limits.isTrial && (limits.aiRemaining() <= 0 || limits.sessionsRemaining() <= 0) && (
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl px-5 py-4 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">⚡</span>
              <div>
                <p className="text-white font-bold text-base">Вопросы на сегодня закончились</p>
                <p className="text-white/70 text-xs">С Premium — безлимит вопросов, фото, аудио и занятий</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/pricing')}
              className="w-full bg-white text-indigo-600 font-bold text-sm rounded-2xl py-2.5 active:scale-[0.98] transition-all shadow-sm"
            >
              Подключить Premium — от 200 ₽/мес
            </button>
          </div>
        )}

        {/* ===== БЛОК 4: МОТИВАЦИЯ (streak ≥ 5) ===== */}
        {streak >= 5 && (
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl px-5 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚀</span>
              <div>
                <p className="text-white font-bold text-base">Ты занимаешься {streak} {streakWord(streak)} подряд!</p>
                <p className="text-white/70 text-xs">
                  {isExamGoal ? 'Продолжай готовиться — результат уже близко!' : 'Так держать — прогресс налицо!'}
                </p>
              </div>
            </div>
            {!limits.isPremium && !limits.isTrial && (
              <button
                onClick={() => navigate('/pricing')}
                className="w-full mt-3 bg-white text-orange-600 font-bold text-sm rounded-2xl py-2.5 active:scale-[0.98] transition-all shadow-sm"
              >
                Полный доступ — от 200 ₽/мес
              </button>
            )}
          </div>
        )}

        {/* ===== БЛОК 5: БЫСТРЫЙ ДОСТУП ===== */}
        <div>
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2 px-1">Быстрый доступ</p>
          <div className="grid grid-cols-3 gap-2.5">
            {quickAccess.map(item => (
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

        {(user?.goal === 'ege' || user?.goal === 'oge') && (
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2 px-1">Инструменты ЕГЭ</p>
            <div className="grid grid-cols-3 gap-2.5">
              {SECONDARY_EGE.map(item => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  className="bg-white rounded-2xl shadow-sm p-3.5 flex flex-col items-center gap-2 active:scale-[0.96] transition-all"
                >
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Icon name={item.icon} size={18} />
                  </div>
                  <span className="text-gray-700 text-xs font-medium text-center leading-tight">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ===== РЕФЕРАЛЬНАЯ ПРОГРАММА ===== */}
        <button
          onClick={() => navigate('/referral')}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl px-5 py-4 w-full text-left active:scale-[0.98] transition-all shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center text-xl flex-shrink-0">
              <Icon name="Users" size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-base">Приведи друга — получи Premium</p>
              <p className="text-white/70 text-xs">+7 дней Premium за каждого друга</p>
            </div>
            <Icon name="ChevronRight" size={16} className="text-white/50 flex-shrink-0" />
          </div>
        </button>

        {/* ===== ПОМОДОРО + ДОСТИЖЕНИЯ — яркие карточки ===== */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/pomodoro')}
            className="bg-gradient-to-br from-red-500 to-orange-500 rounded-3xl p-4 flex flex-col items-start gap-2 shadow-lg active:scale-[0.97] transition-all"
          >
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center text-xl">🍅</div>
            <div>
              <p className="text-white font-extrabold text-sm">Помодоро</p>
              <p className="text-white/70 text-xs">фокус 25 мин</p>
            </div>
            <div className="bg-white/20 rounded-xl px-2 py-0.5 mt-0.5">
              <p className="text-white text-[10px] font-bold">+10 XP за сессию</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/achievements')}
            className="bg-gradient-to-br from-amber-400 to-yellow-500 rounded-3xl p-4 flex flex-col items-start gap-2 shadow-lg active:scale-[0.97] transition-all"
          >
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center text-xl">🏆</div>
            <div>
              <p className="text-white font-extrabold text-sm">Достижения</p>
              <p className="text-white/70 text-xs">прогресс и рейтинг</p>
            </div>
            <div className="bg-white/20 rounded-xl px-2 py-0.5 mt-0.5">
              <p className="text-white text-[10px] font-bold">{streak > 0 ? `🔥 Серия ${streak} дн.` : 'Начни серию!'}</p>
            </div>
          </button>
        </div>

        <div className="h-2" />
      </div>

      {/* CSS */}
      <style>{`
        @keyframes pulse-cta {
          0%, 100% { box-shadow: 0 4px 20px rgba(99,102,241,0.45); }
          50% { box-shadow: 0 4px 32px rgba(99,102,241,0.7); }
        }
        @keyframes pulse-danger {
          0%, 100% { box-shadow: 0 4px 20px rgba(239,68,68,0.4); }
          50% { box-shadow: 0 4px 32px rgba(239,68,68,0.7); }
        }
      `}</style>

      <WelcomeBack hide={hideWelcomeBack} />
      <AppReviewPrompt />
      {showDailyBonus && <DailyBonusPopup onClose={() => setShowDailyBonus(false)} />}
      {showPaywall && !limits.isPremium && (
        <PaywallSheet
          trigger={paywallTrigger}
          streak={streak}
          onClose={() => setShowPaywall(false)}
        />
      )}
      <BottomNav />
    </div>
  );
}