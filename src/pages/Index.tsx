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
  const positions = [50, 75, 50, 25];
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
  const NODE_GAP = 110;
  const PATH_WIDTH = 320;

  function buildCurvePath(i: number): string {
    if (i === 0) return '';
    const x1 = (getNodeX(i - 1) / 100) * PATH_WIDTH;
    const y1 = (i - 1) * NODE_GAP + 30;
    const x2 = (getNodeX(i) / 100) * PATH_WIDTH;
    const y2 = i * NODE_GAP + 30;
    const cy = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`;
  }

  return (
    <div className="min-h-screen bg-[#f0f0ff] pb-20">
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-2xl shadow-[0_1px_12px_rgba(100,80,200,0.08)]">
        {showTrialBanner && (
          <div className="text-center py-1 text-[11px] font-semibold tracking-wide bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
            Premium бесплатно ещё {daysLeft} {pluralDays(daysLeft)}
          </div>
        )}
        <div className="flex items-center justify-between px-4 h-12">
          <button onClick={() => navigate('/league')} className="flex items-center gap-1.5 bg-orange-50 rounded-xl px-3 py-1.5">
            <Icon name="Flame" size={18} className="text-orange-500" />
            <span className="text-sm font-extrabold text-orange-600">{streak}</span>
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: hearts.maxHearts }).map((_, i) => (
              <Icon
                key={i}
                name="Heart"
                size={18}
                className={`transition-all duration-300 ${
                  i < hearts.hearts
                    ? 'text-red-500 drop-shadow-[0_1px_2px_rgba(239,68,68,0.4)]'
                    : 'text-gray-200'
                }`}
              />
            ))}
          </div>
          <button onClick={() => navigate('/profile')} className="flex items-center gap-1.5 bg-amber-50 rounded-xl px-3 py-1.5">
            <Icon name="Star" size={18} className="text-amber-500" />
            <span className="text-sm font-extrabold text-amber-600">{xp}</span>
          </button>
        </div>
      </div>

      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
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
              className={`flex-shrink-0 px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
                active
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-200/50'
                  : locked
                  ? 'bg-white/60 text-gray-300 border border-gray-200/50'
                  : 'bg-white text-gray-600 shadow-sm border border-gray-200/50 active:bg-gray-50'
              }`}
            >
              {locked && <Icon name="Lock" size={10} className="inline mr-1 -mt-0.5" />}
              {SUBJECT_NAMES[sid]}
            </button>
          );
        })}
      </div>

      <div className="mx-4 bg-white rounded-2xl p-4 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${companion.style} flex items-center justify-center text-lg shadow-sm`}>
              {companionStage.emoji}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">{SUBJECT_NAMES[activeSubject]}</p>
              <p className="text-[11px] text-gray-400">Тема {currentIndex >= 0 ? currentIndex + 1 : completedCount} из {topics.length}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-extrabold text-purple-600">{progressPct}%</p>
          </div>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div
        ref={scrollRef}
        className="relative mx-auto"
        style={{ maxWidth: PATH_WIDTH, minHeight: topics.length * NODE_GAP + 60 }}
      >
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ height: topics.length * NODE_GAP + 60 }}
        >
          {topics.map((_, i) => {
            if (i === 0) return null;
            const d = buildCurvePath(i);
            const done = completedTopics.includes(i) || completedTopics.includes(i - 1);
            const isNext = i === currentIndex;
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={done ? '#a78bfa' : isNext ? '#c4b5fd' : '#e2e0ea'}
                strokeWidth={done ? 4 : 3}
                strokeDasharray={done ? 'none' : isNext ? '8 6' : '4 6'}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            );
          })}
        </svg>

        {topics.map((topic, i) => {
          const done = completedTopics.includes(i);
          const isCurrent = i === currentIndex;
          const locked = !done && !isCurrent;
          const x = getNodeX(i);
          const size = isCurrent ? 64 : done ? 52 : 44;

          return (
            <div
              key={i}
              data-idx={i}
              className="absolute flex flex-col items-center"
              style={{
                left: `${x}%`,
                top: i * NODE_GAP,
                transform: 'translateX(-50%)',
                width: 140,
              }}
            >
              <button
                onClick={() => handleTopicTap(i)}
                disabled={locked}
                className="relative flex items-center justify-center rounded-full transition-all duration-300"
                style={{ width: size, height: size }}
              >
                {isCurrent && (
                  <span className="absolute inset-[-6px] rounded-full border-[3px] border-purple-300 animate-[ping_2s_ease-in-out_infinite] opacity-40" />
                )}
                {isCurrent && (
                  <span className="absolute inset-[-4px] rounded-full border-2 border-purple-200" />
                )}

                <div className={`w-full h-full rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCurrent
                    ? 'bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-600 shadow-[0_6px_24px_rgba(109,40,217,0.4)]'
                    : done
                    ? 'bg-gradient-to-br from-emerald-400 to-green-500 shadow-[0_4px_14px_rgba(52,211,153,0.35)]'
                    : 'bg-gray-200/80 shadow-inner'
                }`}>
                  {done && <Icon name="Check" size={22} className="text-white drop-shadow-sm" />}
                  {isCurrent && <Icon name="Play" size={24} className="text-white drop-shadow-sm ml-0.5" />}
                  {locked && <Icon name="Lock" size={16} className="text-gray-400" />}
                </div>

                {done && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md">
                    <Icon name="Star" size={12} className="text-amber-400" />
                  </div>
                )}
              </button>

              {isCurrent && (
                <div className="mt-3 px-3 py-1.5 rounded-xl bg-purple-600 shadow-lg shadow-purple-200/50">
                  <p className="text-[11px] font-bold text-white text-center leading-tight max-w-[120px] truncate">
                    {topic}
                  </p>
                </div>
              )}
              {done && (
                <p className="mt-1.5 text-[10px] text-gray-400 text-center max-w-[100px] truncate font-medium">
                  {topic}
                </p>
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

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
