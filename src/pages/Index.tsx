import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
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
  ru: 'Русский язык',
  math_prof: 'Математика (профиль)',
  math_base: 'Математика (база)',
  physics: 'Физика',
  chemistry: 'Химия',
  biology: 'Биология',
  history: 'История',
  social: 'Обществознание',
  informatics: 'Информатика',
  english: 'Английский язык',
  geography: 'География',
  literature: 'Литература',
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
  } catch { /* corrupted */ }
  return [];
}

function getNodeX(index: number): number {
  const cycle = index % 4;
  if (cycle === 0) return 50;
  if (cycle === 1) return 78;
  if (cycle === 2) return 50;
  return 22;
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
    } catch { /* silent */ }
  };

  const handleTopicTap = (index: number) => {
    if (index !== currentIndex) return;
    if (!limits.isPremium && limits.sessionsRemaining() <= 0) { setShowPaywall(true); return; }
    if (!hearts.isAlive) { setShowPaywall(true); return; }
    navigate('/session');
  };

  const streak = gamification?.streak?.current ?? 0;
  const xp = gamification?.xp_progress ?? 0;

  const NODE_GAP = 96;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-purple-50 pb-20">
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-sm">
        {showTrialBanner && (
          <div className="text-center py-1 text-[11px] text-purple-600 font-medium bg-purple-50/60 tracking-wide">
            Premium бесплатно ещё {daysLeft} {pluralDays(daysLeft)}
          </div>
        )}
        <div className="flex items-center justify-between px-5 h-11">
          <button onClick={() => navigate('/league')} className="flex items-center gap-1.5 min-w-[52px]">
            <span className="text-lg leading-none">🔥</span>
            <span className="text-sm font-extrabold text-orange-500">{streak}</span>
          </button>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: hearts.maxHearts }).map((_, i) => (
              <span
                key={i}
                className={`text-[15px] transition-opacity ${i < hearts.hearts ? 'opacity-100' : 'opacity-20'}`}
              >
                ❤️
              </span>
            ))}
          </div>
          <button onClick={() => navigate('/profile')} className="flex items-center gap-1.5 min-w-[52px] justify-end">
            <span className="text-lg leading-none">⭐</span>
            <span className="text-sm font-extrabold text-amber-500">{xp}</span>
          </button>
        </div>
      </div>

      <div className="flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-hide">
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
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                active
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-200'
                  : locked
                  ? 'bg-gray-100 text-gray-300'
                  : 'bg-gray-100 text-gray-600 active:bg-gray-200'
              }`}
            >
              {locked ? '🔒 ' : ''}{SUBJECT_NAMES[sid]}
            </button>
          );
        })}
      </div>

      <div className="px-5 pt-1 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{companionStage.emoji}</span>
            <span className="text-[13px] font-bold text-gray-700">
              {SUBJECT_NAMES[activeSubject]}
            </span>
          </div>
          <span className="text-xs font-semibold text-gray-400">{completedCount}/{topics.length}</span>
        </div>
        <div className="h-2.5 bg-gray-200/70 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div
        ref={scrollRef}
        className="relative mx-auto"
        style={{ maxWidth: 340, minHeight: topics.length * NODE_GAP + 40 }}
      >
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ height: topics.length * NODE_GAP + 40 }}
        >
          {topics.map((_, i) => {
            if (i === 0) return null;
            const x1 = (getNodeX(i - 1) / 100) * 340;
            const y1 = (i - 1) * NODE_GAP + 28;
            const x2 = (getNodeX(i) / 100) * 340;
            const y2 = i * NODE_GAP + 28;
            const done = completedTopics.includes(i);
            const active = i === currentIndex || completedTopics.includes(i);
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={active ? '#c4b5fd' : '#e5e7eb'}
                strokeWidth={done ? 3 : 2}
                strokeDasharray={done ? 'none' : '6 4'}
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {topics.map((topic, i) => {
          const done = completedTopics.includes(i);
          const isCurrent = i === currentIndex;
          const locked = !done && !isCurrent;
          const x = getNodeX(i);
          const size = isCurrent ? 60 : 48;

          return (
            <div
              key={i}
              data-idx={i}
              className="absolute flex flex-col items-center"
              style={{
                left: `${x}%`,
                top: i * NODE_GAP,
                transform: 'translateX(-50%)',
                width: 120,
              }}
            >
              <button
                onClick={() => handleTopicTap(i)}
                disabled={locked}
                className={`relative flex items-center justify-center rounded-full transition-all duration-300 ${
                  isCurrent
                    ? 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-xl shadow-purple-300/40'
                    : done
                    ? 'bg-gradient-to-br from-emerald-400 to-green-500 shadow-md shadow-green-200/40'
                    : 'bg-gray-200 shadow-sm'
                }`}
                style={{ width: size, height: size }}
              >
                {isCurrent && (
                  <span className="absolute inset-0 rounded-full bg-purple-400/30 animate-ping" />
                )}
                {done && <span className="text-white text-lg font-bold relative z-10">✓</span>}
                {isCurrent && <span className="text-white text-2xl relative z-10">▶</span>}
                {locked && <span className="text-gray-400 text-sm">🔒</span>}
              </button>

              {isCurrent && (
                <span className="mt-2 px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-[11px] font-bold text-center leading-tight max-w-[120px] truncate">
                  {topic}
                </span>
              )}
              {done && (
                <span className="mt-1 text-[10px] text-gray-400 text-center max-w-[100px] truncate">
                  {topic}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {showDailyBonus && (
        <DailyBonusPopup onClose={() => setShowDailyBonus(false)} />
      )}

      {showPaywall && (
        <PaywallSheet trigger="session_limit" onClose={() => setShowPaywall(false)} />
      )}

      <BottomNav />
    </div>
  );
}
