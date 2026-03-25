import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import Icon from '@/components/ui/icon';
import BottomNav from '@/components/BottomNav';
import { useHearts } from '@/hooks/useHearts';
import { useLimits } from '@/hooks/useLimits';
import { getCompanion, getCompanionStage, getCompanionFromStorage } from '@/lib/companion';
import { TOPICS_BY_SUBJECT } from '@/lib/topics';
import { dailyCheckin } from '@/lib/gamification';
import { API } from '@/lib/api-urls';
import PaywallSheet from '@/components/PaywallSheet';
import DailyBonusPopup from '@/components/DailyBonusPopup';

const SUBJECT_NAMES: Record<string, string> = {
  ru: 'Русский язык', math_prof: 'Математика (профиль)', math_base: 'Математика (база)',
  physics: 'Физика', chemistry: 'Химия', biology: 'Биология', history: 'История',
  social: 'Обществознание', informatics: 'Информатика', english: 'Английский язык',
  geography: 'География', literature: 'Литература',
};

const SUBJECT_EMOJI: Record<string, string> = {
  ru: '📝', math_prof: '📐', math_base: '🔢', physics: '⚛️', chemistry: '🧪',
  biology: '🌿', history: '🏛️', social: '🌍', informatics: '💻', english: '🇬🇧',
  geography: '🗺️', literature: '📖',
};

const ALL_SUBJECT_IDS = Object.keys(SUBJECT_NAMES);

interface GamificationProfile {
  streak: { current: number; longest: number };
  level: number;
  xp_progress: number;
  xp_needed: number;
}

function pluralDays(n: number) {
  if (n === 1) return 'день';
  if (n >= 2 && n <= 4) return 'дня';
  return 'дней';
}

function loadCompletedFromStorage(subject: string): number[] {
  try {
    const raw = localStorage.getItem(`completed_topics_${subject}`);
    if (raw) return JSON.parse(raw) as number[];
  } catch { /* */ }
  return [];
}

function getNodeX(index: number): number {
  const positions = [50, 78, 50, 22];
  return positions[index % 4];
}

export default function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState(authService.getUser());
  const [gamification, setGamification] = useState<GamificationProfile | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showDailyBonus, setShowDailyBonus] = useState(true);
  const [activeSubject, setActiveSubject] = useState(user?.exam_subject || 'ru');
  const [completedTopics, setCompletedTopics] = useState<number[]>(() =>
    loadCompletedFromStorage(user?.exam_subject || 'ru')
  );
  const hearts = useHearts();
  const limits = useLimits();
  const scrollRef = useRef<HTMLDivElement>(null);

  const examSubject = user?.exam_subject || 'ru';
  const topics = TOPICS_BY_SUBJECT[activeSubject] || [];
  const currentIndex = topics.findIndex((_, i) => !completedTopics.includes(i));
  const completedCount = completedTopics.length;
  const progressPct = topics.length > 0 ? Math.round((completedCount / topics.length) * 100) : 0;

  const daysLeft = Math.max(0, (limits.data.free_days_total || 3) - (limits.data.days_since_registration || 999));
  const showTrialBanner = daysLeft > 0 && !limits.isPremium;

  const companionId = getCompanionFromStorage();
  const companion = getCompanion(companionId);
  const companionStage = getCompanionStage(companion, gamification?.level ?? 1);

  useEffect(() => {
    const init = async () => {
      if (!authService.isAuthenticated()) { navigate('/auth'); return; }
      const verified = await authService.verifyToken();
      if (!verified) { navigate('/auth'); return; }
      setUser(verified);
      if (!verified.onboarding_completed) { navigate('/onboarding'); return; }
      setActiveSubject(verified.exam_subject || 'ru');
      setCompletedTopics(loadCompletedFromStorage(verified.exam_subject || 'ru'));
      dailyCheckin();
      fetchGamification();
    };
    init();
  }, [navigate]);

  useEffect(() => {
    setCompletedTopics(loadCompletedFromStorage(activeSubject));
  }, [activeSubject]);

  useEffect(() => {
    const handler = () => {
      if (currentIndex === -1) return;
      const updated = [...completedTopics, currentIndex];
      setCompletedTopics(updated);
      localStorage.setItem(`completed_topics_${activeSubject}`, JSON.stringify(updated));
      limits.reload(true);
      fetchGamification();
    };
    window.addEventListener('session_completed', handler);
    return () => window.removeEventListener('session_completed', handler);
  }, [currentIndex, completedTopics, activeSubject]);

  useEffect(() => {
    if (currentIndex > 1 && scrollRef.current) {
      const el = scrollRef.current.querySelector(`[data-idx="${currentIndex}"]`);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350);
    }
  }, [currentIndex, activeSubject]);

  const fetchGamification = async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(API.GAMIFICATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'get_profile' }),
      });
      if (res.ok) setGamification(await res.json());
    } catch { /* */ }
  };

  const handleTopicTap = (index: number) => {
    if (index !== currentIndex) return;
    if (!limits.isPremium && limits.sessionsRemaining() <= 0) { setShowPaywall(true); return; }
    if (!hearts.isAlive) { setShowPaywall(true); return; }
    navigate('/session');
  };

  const streak = gamification?.streak?.current ?? 0;
  const xp = gamification?.xp_progress ?? 0;
  const level = gamification?.level ?? 1;
  const NODE_GAP = 120;
  const PATH_WIDTH = 320;

  function buildCurvePath(i: number): string {
    if (i === 0) return '';
    const x1 = (getNodeX(i - 1) / 100) * PATH_WIDTH;
    const y1 = (i - 1) * NODE_GAP + 36;
    const x2 = (getNodeX(i) / 100) * PATH_WIDTH;
    const y2 = i * NODE_GAP + 36;
    const cy = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`;
  }

  const firstName = user?.full_name?.split(' ')[0] || 'Ученик';
  const userGoal = user?.goal || 'ege';
  const isExamGoal = userGoal === 'ege' || userGoal === 'oge';
  const examLabel = userGoal === 'oge' ? 'ОГЭ' : 'ЕГЭ';

  const EGE_DATE = new Date('2026-05-25');
  const OGE_DATE = new Date('2026-05-19');
  const examDate = userGoal === 'oge' ? OGE_DATE : EGE_DATE;
  const daysToExam = Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / 86400000));

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-[#ede9fe] via-[#f5f3ff] to-[#eef2ff] relative overflow-hidden">

      <div className="absolute top-40 -left-20 w-72 h-72 bg-purple-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-[60%] -right-16 w-64 h-64 bg-indigo-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-40 left-10 w-48 h-48 bg-pink-200/15 rounded-full blur-3xl pointer-events-none" />

      <div className="sticky top-0 z-40">
        {showTrialBanner && (
          <div className="text-center py-1.5 text-[11px] font-bold tracking-wider bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white/95">
            PREMIUM БЕСПЛАТНО ЕЩЁ {daysLeft} {pluralDays(daysLeft).toUpperCase()}
          </div>
        )}
        <div className="bg-white/80 backdrop-blur-2xl border-b border-white/40">
          <div className="flex items-center justify-between px-4 h-[52px]">
            <button onClick={() => navigate('/league')} className="flex items-center gap-2 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl px-3.5 py-2 border border-orange-100/60 active:scale-95 transition-transform">
              <div className="w-7 h-7 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center shadow-sm">
                <Icon name="Flame" size={16} className="text-white" />
              </div>
              <span className="text-[15px] font-black text-orange-600 tabular-nums">{streak}</span>
            </button>

            <div className="flex items-center gap-[3px]">
              {Array.from({ length: hearts.maxHearts }).map((_, i) => (
                <div key={i} className={`transition-all duration-300 ${i < hearts.hearts ? 'scale-100' : 'scale-75 opacity-30'}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={i < hearts.hearts ? '#ef4444' : '#d1d5db'} className={i < hearts.hearts ? 'drop-shadow-[0_2px_4px_rgba(239,68,68,0.5)]' : ''}>
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                </div>
              ))}
            </div>

            <button onClick={() => navigate('/profile')} className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl px-3.5 py-2 border border-amber-100/60 active:scale-95 transition-transform">
              <div className="w-7 h-7 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-lg flex items-center justify-center shadow-sm">
                <Icon name="Star" size={16} className="text-white" />
              </div>
              <span className="text-[15px] font-black text-amber-600 tabular-nums">{xp}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-1">
        <p className="text-[13px] text-gray-500 font-medium">Привет, {firstName}!</p>
      </div>

      <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide">
        {[examSubject, ...ALL_SUBJECT_IDS.filter(s => s !== examSubject)].map(sid => {
          const active = sid === activeSubject;
          const locked = !limits.isPremium && sid !== examSubject;
          return (
            <button
              key={sid}
              onClick={() => {
                if (locked) { setShowPaywall(true); return; }
                setActiveSubject(sid);
              }}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-[13px] font-bold transition-all whitespace-nowrap active:scale-95 ${
                active
                  ? 'bg-white text-purple-700 shadow-[0_2px_16px_rgba(139,92,246,0.2)] ring-2 ring-purple-400/30'
                  : locked
                  ? 'bg-white/40 text-gray-300'
                  : 'bg-white/70 text-gray-600 shadow-sm active:bg-white'
              }`}
            >
              <span className="text-base">{SUBJECT_EMOJI[sid] || '📚'}</span>
              {locked && <Icon name="Lock" size={11} className="text-gray-300" />}
              {!locked && SUBJECT_NAMES[sid]}
              {locked && <span className="text-gray-300">{SUBJECT_NAMES[sid]}</span>}
            </button>
          );
        })}
      </div>

      <div className="mx-4 mt-2 mb-4 bg-white rounded-3xl p-5 shadow-[0_2px_20px_rgba(139,92,246,0.08)] border border-purple-100/30">
        <div className="flex items-center gap-3 mb-3.5">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${companion.style} flex items-center justify-center text-2xl shadow-lg border-2 border-white/50`}>
            {companionStage.emoji}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="font-bold text-gray-800">{SUBJECT_NAMES[activeSubject]}</p>
              <div className="flex items-center gap-1.5 bg-purple-50 rounded-lg px-2.5 py-1">
                <span className="text-xs font-bold text-purple-500">Ур.{level}</span>
              </div>
            </div>
            <p className="text-[12px] text-gray-400 mt-0.5">Тема {currentIndex >= 0 ? currentIndex + 1 : completedCount} из {topics.length}</p>
          </div>
        </div>
        <div className="relative h-4 bg-purple-100/50 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${Math.max(progressPct, 2)}%` }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.3)_50%,transparent_100%)] animate-[shimmer_2s_infinite]" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-black text-purple-700/70">{progressPct}%</span>
          </div>
        </div>
      </div>

      {isExamGoal && (
        <button
          onClick={() => navigate('/exam')}
          className="mx-4 mb-4 bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 rounded-3xl p-5 text-left active:scale-[0.98] transition-all relative overflow-hidden shadow-[0_4px_24px_rgba(99,102,241,0.25)]"
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-8 -translate-x-8" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-white/15 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Icon name="GraduationCap" size={22} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-extrabold text-[15px]">Подготовка к {examLabel}</p>
                  <p className="text-white/60 text-[12px] mt-0.5">Практика, разбор, пробные тесты</p>
                </div>
              </div>
              <Icon name="ChevronRight" size={20} className="text-white/40" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-white/10 rounded-xl px-3 py-2 backdrop-blur-sm">
                <p className="text-white/60 text-[10px] uppercase tracking-wider">До экзамена</p>
                <p className="text-white font-black text-lg leading-none mt-0.5">{daysToExam} <span className="text-sm font-bold text-white/60">дн.</span></p>
              </div>
              <div className="flex-1 bg-white/10 rounded-xl px-3 py-2 backdrop-blur-sm">
                <p className="text-white/60 text-[10px] uppercase tracking-wider">Освоено тем</p>
                <p className="text-white font-black text-lg leading-none mt-0.5">{completedCount} <span className="text-sm font-bold text-white/60">/ {topics.length}</span></p>
              </div>
              <div className="flex-1 bg-white/10 rounded-xl px-3 py-2 backdrop-blur-sm">
                <p className="text-white/60 text-[10px] uppercase tracking-wider">Предмет</p>
                <p className="text-lg leading-none mt-0.5">{SUBJECT_EMOJI[activeSubject] || '📚'}</p>
              </div>
            </div>
          </div>
        </button>
      )}

      <div className="flex gap-2 mx-4 mb-5">
        <button
          onClick={() => navigate('/assistant')}
          className="flex-1 bg-white rounded-2xl p-3.5 shadow-sm border border-purple-100/30 active:scale-95 transition-all"
        >
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center mb-2">
            <Icon name="Brain" size={18} className="text-blue-600" />
          </div>
          <p className="text-[12px] font-bold text-gray-700">ИИ-помощник</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Фото и аудио</p>
        </button>
        <button
          onClick={() => navigate('/flashcards')}
          className="flex-1 bg-white rounded-2xl p-3.5 shadow-sm border border-purple-100/30 active:scale-95 transition-all"
        >
          <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center mb-2">
            <Icon name="Layers" size={18} className="text-amber-600" />
          </div>
          <p className="text-[12px] font-bold text-gray-700">Карточки</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Повторение</p>
        </button>
        <button
          onClick={() => navigate('/materials')}
          className="flex-1 bg-white rounded-2xl p-3.5 shadow-sm border border-purple-100/30 active:scale-95 transition-all"
        >
          <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center mb-2">
            <Icon name="FileText" size={18} className="text-emerald-600" />
          </div>
          <p className="text-[12px] font-bold text-gray-700">Материалы</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Файлы и ИИ</p>
        </button>
      </div>

      <div className="mx-4 mb-3">
        <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wider">Путь обучения</p>
      </div>

      <div
        ref={scrollRef}
        className="relative mx-auto px-2"
        style={{ maxWidth: PATH_WIDTH + 40, minHeight: topics.length * NODE_GAP + 80 }}
      >
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ height: topics.length * NODE_GAP + 80, left: 20 }}
          width={PATH_WIDTH}
        >
          <defs>
            <linearGradient id="pathDone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>
            <linearGradient id="pathActive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c4b5fd" />
              <stop offset="100%" stopColor="#a5b4fc" />
            </linearGradient>
            <filter id="pathGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {topics.map((_, i) => {
            if (i === 0) return null;
            const d = buildCurvePath(i);
            const prevDone = completedTopics.includes(i - 1);
            const isDone = completedTopics.includes(i);
            const isNext = i === currentIndex;
            return (
              <g key={i}>
                {(prevDone || isDone) && (
                  <path d={d} fill="none" stroke="url(#pathDone)" strokeWidth={6} strokeLinecap="round" opacity={0.2} filter="url(#pathGlow)" />
                )}
                <path
                  d={d}
                  fill="none"
                  stroke={prevDone && isDone ? 'url(#pathDone)' : isNext ? 'url(#pathActive)' : '#ddd6fe'}
                  strokeWidth={prevDone || isDone ? 5 : 3}
                  strokeDasharray={prevDone && isDone ? 'none' : isNext ? '10 7' : '5 7'}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
              </g>
            );
          })}
        </svg>

        {topics.map((topic, i) => {
          const done = completedTopics.includes(i);
          const isCurrent = i === currentIndex;
          const locked = !done && !isCurrent;
          const x = getNodeX(i);
          const size = isCurrent ? 72 : done ? 56 : 48;

          return (
            <div
              key={i}
              data-idx={i}
              className="absolute flex flex-col items-center"
              style={{
                left: `calc(${x}% + 20px)`,
                top: i * NODE_GAP + 4,
                transform: 'translateX(-50%)',
                width: 150,
              }}
            >
              <button
                onClick={() => handleTopicTap(i)}
                disabled={locked}
                className="relative flex items-center justify-center transition-all duration-300 active:scale-90"
                style={{ width: size, height: size }}
              >
                {isCurrent && (
                  <>
                    <span className="absolute inset-[-8px] rounded-full bg-purple-400/20 animate-[pulse_2s_ease-in-out_infinite]" />
                    <span className="absolute inset-[-4px] rounded-full border-[2.5px] border-purple-300/60" />
                  </>
                )}

                <div className={`w-full h-full rounded-full flex items-center justify-center relative overflow-hidden ${
                  isCurrent
                    ? 'bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 shadow-[0_8px_30px_rgba(109,40,217,0.45)]'
                    : done
                    ? 'bg-gradient-to-br from-emerald-400 via-green-500 to-teal-500 shadow-[0_6px_20px_rgba(52,211,153,0.35)]'
                    : 'bg-gradient-to-br from-gray-200 to-gray-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]'
                }`}>
                  <div className={`absolute inset-0 rounded-full ${
                    isCurrent ? 'bg-gradient-to-t from-transparent to-white/20' :
                    done ? 'bg-gradient-to-t from-transparent to-white/20' : ''
                  }`} />

                  {done && <Icon name="Check" size={24} className="text-white relative z-10 drop-shadow-md" />}
                  {isCurrent && (
                    <div className="relative z-10 flex items-center justify-center w-10 h-10 bg-white/20 rounded-full backdrop-blur-sm">
                      <Icon name="Play" size={22} className="text-white ml-0.5 drop-shadow-md" />
                    </div>
                  )}
                  {locked && <Icon name="Lock" size={18} className="text-gray-400/80 relative z-10" />}
                </div>

                {done && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg border border-amber-100">
                    <Icon name="Star" size={14} className="text-amber-400 drop-shadow-sm" />
                  </div>
                )}
              </button>

              {isCurrent && (
                <div className="mt-3 relative">
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gradient-to-br from-purple-600 to-indigo-600 rotate-45 rounded-sm" />
                  <div className="relative bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl px-4 py-2 shadow-xl shadow-purple-300/30">
                    <p className="text-[12px] font-bold text-white text-center leading-snug max-w-[130px]">
                      {topic}
                    </p>
                  </div>
                </div>
              )}
              {done && (
                <p className="mt-2 text-[11px] text-gray-400 text-center max-w-[110px] truncate font-medium">
                  {topic}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {showDailyBonus && <DailyBonusPopup onClose={() => setShowDailyBonus(false)} />}
      {showPaywall && <PaywallSheet trigger="session_limit" onClose={() => setShowPaywall(false)} />}
      <BottomNav />

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}