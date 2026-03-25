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

function loadCompleted(subject: string): number[] {
  try {
    const raw = localStorage.getItem(`completed_topics_${subject}`);
    if (raw) return JSON.parse(raw) as number[];
  } catch { /* */ }
  return [];
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Доброе утро';
  if (h >= 12 && h < 17) return 'Добрый день';
  if (h >= 17 && h < 22) return 'Добрый вечер';
  return 'Доброй ночи';
}

const MOTIVATIONS = [
  'Каждый день — шаг к мечте!',
  'Ты уже круче, чем вчера!',
  'Знания — твоя суперсила!',
  'Сегодня отличный день для учёбы!',
  'Маленькие шаги → большие результаты',
  'Ты на правильном пути!',
];

export default function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState(authService.getUser());
  const [gam, setGam] = useState<GamificationProfile | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showDailyBonus, setShowDailyBonus] = useState(true);
  const [activeSubject, setActiveSubject] = useState(user?.exam_subject || 'ru');
  const [completed, setCompleted] = useState<number[]>(() => loadCompleted(user?.exam_subject || 'ru'));
  const hearts = useHearts();
  const limits = useLimits();
  const scrollRef = useRef<HTMLDivElement>(null);

  const examSubject = user?.exam_subject || 'ru';
  const topics = TOPICS_BY_SUBJECT[activeSubject] || [];
  const currentIdx = topics.findIndex((_, i) => !completed.includes(i));
  const doneCnt = completed.length;
  const pct = topics.length > 0 ? Math.round((doneCnt / topics.length) * 100) : 0;

  const trialDays = Math.max(0, (limits.data.free_days_total || 3) - (limits.data.days_since_registration || 999));
  const showTrial = trialDays > 0 && !limits.isPremium;

  const comp = getCompanion(getCompanionFromStorage());
  const stage = getCompanionStage(comp, gam?.level ?? 1);

  const sessLeft = limits.sessionsRemaining();
  const aiLeft = limits.aiRemaining();
  const isPrem = limits.isPremium;

  const motivation = MOTIVATIONS[new Date().getDate() % MOTIVATIONS.length];

  useEffect(() => {
    const init = async () => {
      if (!authService.isAuthenticated()) { navigate('/auth'); return; }
      const v = await authService.verifyToken();
      if (!v) { navigate('/auth'); return; }
      setUser(v);
      if (!v.onboarding_completed) { navigate('/onboarding'); return; }
      setActiveSubject(v.exam_subject || 'ru');
      setCompleted(loadCompleted(v.exam_subject || 'ru'));
      dailyCheckin();
      loadGam();
    };
    init();
  }, [navigate]);

  useEffect(() => { setCompleted(loadCompleted(activeSubject)); }, [activeSubject]);

  useEffect(() => {
    const h = () => {
      if (currentIdx === -1) return;
      const u = [...completed, currentIdx];
      setCompleted(u);
      localStorage.setItem(`completed_topics_${activeSubject}`, JSON.stringify(u));
      limits.reload(true);
      loadGam();
    };
    window.addEventListener('session_completed', h);
    return () => window.removeEventListener('session_completed', h);
  }, [currentIdx, completed, activeSubject]);

  useEffect(() => {
    if (currentIdx > 1 && scrollRef.current) {
      const el = scrollRef.current.querySelector(`[data-idx="${currentIdx}"]`);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350);
    }
  }, [currentIdx, activeSubject]);

  const loadGam = async () => {
    try {
      const t = authService.getToken();
      const r = await fetch(API.GAMIFICATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ action: 'get_profile' }),
      });
      if (r.ok) setGam(await r.json());
    } catch { /* */ }
  };

  const tapTopic = (i: number) => {
    if (i !== currentIdx) return;
    if (!isPrem && sessLeft <= 0) { setShowPaywall(true); return; }
    if (!hearts.isAlive) { setShowPaywall(true); return; }
    navigate('/session');
  };

  const streak = gam?.streak?.current ?? 0;
  const xp = gam?.xp_progress ?? 0;
  const level = gam?.level ?? 1;
  const userName = user?.name?.split(' ')[0] || 'Ученик';

  return (
    <div className="min-h-screen pb-24 bg-[#f8f7ff] relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[420px] bg-gradient-to-b from-[#6c5ce7] via-[#a29bfe] to-transparent opacity-90" />
      <div className="absolute top-20 -left-20 w-80 h-80 bg-[#fd79a8]/15 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute top-40 -right-20 w-72 h-72 bg-[#00cec9]/10 rounded-full blur-[80px] pointer-events-none" />

      {showTrial && (
        <div className="relative z-50 text-center py-1.5 text-[11px] font-bold tracking-wider bg-gradient-to-r from-amber-400 via-orange-400 to-pink-400 text-white">
          🎁 PREMIUM БЕСПЛАТНО ЕЩЁ {trialDays} {pluralDays(trialDays).toUpperCase()}
        </div>
      )}

      <div className="relative z-10 px-5 pt-4 pb-5">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${comp.style} flex items-center justify-center text-2xl shadow-lg border-2 border-white/30 index-companion-float`}>
              {stage.emoji}
            </div>
            <div>
              <p className="text-white/60 text-[12px] font-medium">{getGreeting()}</p>
              <p className="text-white text-[20px] font-bold leading-tight">{userName} 👋</p>
              <p className="text-white/50 text-[11px] mt-0.5">{motivation}</p>
            </div>
          </div>
          <button onClick={() => navigate('/profile')} className="w-10 h-10 bg-white/15 backdrop-blur-md rounded-xl flex items-center justify-center active:scale-90 transition-transform border border-white/10">
            <Icon name="Settings" size={18} className="text-white/80" />
          </button>
        </div>

        <div className="flex gap-2.5">
          <button onClick={() => navigate('/league')} className="flex-1 bg-white/15 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/10 active:scale-[0.97] transition-all">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
                <Icon name="Flame" size={18} className="text-white" />
              </div>
              <div>
                <p className="text-white text-[18px] font-black leading-none">{streak}</p>
                <p className="text-white/50 text-[10px] font-medium">серия</p>
              </div>
            </div>
          </button>
          <div className="flex-1 bg-white/15 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
                <Icon name="Star" size={18} className="text-white" />
              </div>
              <div>
                <p className="text-white text-[18px] font-black leading-none">{xp}</p>
                <p className="text-white/50 text-[10px] font-medium">опыт</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-[3px] bg-white/15 backdrop-blur-md rounded-2xl px-3 py-3 border border-white/10">
            {Array.from({ length: hearts.maxHearts }).map((_, i) => (
              <div key={i} className={`transition-all duration-300 ${i < hearts.hearts ? 'scale-100' : 'scale-75 opacity-30'}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill={i < hearts.hearts ? '#ff6b6b' : '#ffffff40'}>
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 bg-[#f8f7ff] rounded-t-[28px] -mt-2 pt-1">
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">{SUBJECT_EMOJI[activeSubject] || '📚'}</span>
              <div>
                <p className="text-[15px] font-bold text-gray-900">{SUBJECT_NAMES[activeSubject]}</p>
                <p className="text-[11px] text-gray-400 font-medium">Уровень {level} · {doneCnt} из {topics.length} тем</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-[22px] font-black bg-gradient-to-r from-[#6c5ce7] to-[#a29bfe] bg-clip-text text-transparent leading-none">{pct}%</p>
              </div>
            </div>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#6c5ce7] via-[#a29bfe] to-[#74b9ff] rounded-full transition-all duration-1000 relative" style={{ width: `${Math.max(pct, 3)}%` }}>
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)] index-shimmer" />
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-5 py-2 overflow-x-auto scrollbar-hide">
          {[examSubject, ...ALL_SUBJECT_IDS.filter(s => s !== examSubject)].map(sid => {
            const active = sid === activeSubject;
            const locked = !isPrem && sid !== examSubject;
            return (
              <button
                key={sid}
                onClick={() => { if (locked) { setShowPaywall(true); return; } setActiveSubject(sid); }}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[12px] font-bold transition-all whitespace-nowrap active:scale-95 ${
                  active ? 'bg-[#6c5ce7] text-white shadow-lg shadow-purple-300/30' :
                  locked ? 'bg-gray-50 text-gray-300 border border-gray-100' : 'bg-white text-gray-600 shadow-sm border border-gray-100'
                }`}
              >
                <span className="text-sm">{SUBJECT_EMOJI[sid] || '📚'}</span>
                {locked && <Icon name="Lock" size={10} className={active ? 'text-white/60' : 'text-gray-300'} />}
                {SUBJECT_NAMES[sid]}
              </button>
            );
          })}
        </div>

        {!isPrem && !limits.loading && (
          <div className="mx-5 mt-3 mb-1 bg-gradient-to-r from-[#ffeaa7]/60 to-[#fdcb6e]/40 rounded-2xl p-3.5 border border-amber-200/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold ${sessLeft > 0 ? 'bg-white/80 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                  <Icon name="BookOpen" size={12} />
                  {sessLeft > 0 ? `${sessLeft} ${sessLeft === 1 ? 'урок' : 'урока'}` : '0 уроков'}
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold ${aiLeft > 0 ? 'bg-white/80 text-blue-600' : 'bg-red-100 text-red-500'}`}>
                  <Icon name="Brain" size={12} />
                  {aiLeft > 0 ? `${aiLeft} ИИ` : '0 ИИ'}
                </div>
              </div>
              <button onClick={() => setShowPaywall(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#6c5ce7] to-[#a29bfe] text-white text-[11px] font-bold shadow-lg shadow-purple-300/30 active:scale-95 transition-transform">
                <Icon name="Zap" size={13} />
                Безлимит
              </button>
            </div>
          </div>
        )}

        <div className="px-5 mt-4 mb-3">
          <p className="text-[13px] font-bold text-gray-800 flex items-center gap-2">
            <span className="w-1 h-4 bg-gradient-to-b from-[#6c5ce7] to-[#a29bfe] rounded-full" />
            Путь обучения
          </p>
        </div>

        <div ref={scrollRef} className="px-4 pb-4 space-y-2.5">
          {topics.map((topic, i) => {
            const ok = completed.includes(i);
            const cur = i === currentIdx;
            const lock = !ok && !cur;

            if (i > 0 && i % 4 === 0 && (ok || cur)) {
              const phrases = ['Так держать! 💪', 'Ты молодец! 🌟', 'Не сдавайся! 🔥', 'Крутой прогресс! 🚀', 'Вперёд! ⚡', 'Огонь! 🎯'];
              const phrase = phrases[Math.floor(i / 4) % phrases.length];
              return (
                <div key={i}>
                  <div className="flex items-center gap-2.5 px-3 py-2 mb-2.5">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${comp.style} flex items-center justify-center text-lg shadow-md border-2 border-white/60 index-companion-float`}>
                      {stage.emoji}
                    </div>
                    <div className="bg-white rounded-2xl rounded-bl-md px-3.5 py-2 shadow-sm border border-gray-100">
                      <p className="text-[12px] font-bold text-gray-700">{phrase}</p>
                    </div>
                  </div>
                  <TopicCard i={i} topic={topic} ok={ok} cur={cur} lock={lock} onTap={tapTopic} />
                </div>
              );
            }

            return <TopicCard key={i} i={i} topic={topic} ok={ok} cur={cur} lock={lock} onTap={tapTopic} />;
          })}
        </div>

        <div className="px-5 mt-2 mb-3">
          <p className="text-[13px] font-bold text-gray-800 flex items-center gap-2">
            <span className="w-1 h-4 bg-gradient-to-b from-[#00cec9] to-[#55efc4] rounded-full" />
            Инструменты
          </p>
        </div>

        <div className="px-5 pb-6 grid grid-cols-2 gap-3">
          <button onClick={() => { if (!isPrem && aiLeft <= 0) { setShowPaywall(true); return; } navigate('/assistant'); }}
            className="bg-gradient-to-br from-[#6c5ce7]/8 to-[#a29bfe]/8 rounded-2xl p-4 border border-[#6c5ce7]/10 active:scale-[0.97] transition-all text-left">
            <div className="w-11 h-11 bg-gradient-to-br from-[#6c5ce7] to-[#a29bfe] rounded-xl flex items-center justify-center shadow-lg shadow-purple-200/50 mb-3">
              <Icon name="Brain" size={20} className="text-white" />
            </div>
            <p className="text-[14px] font-bold text-gray-900">ИИ помощник</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Задай любой вопрос</p>
          </button>

          <button onClick={() => navigate('/flashcards')}
            className="bg-gradient-to-br from-[#fdcb6e]/10 to-[#ffeaa7]/10 rounded-2xl p-4 border border-amber-200/30 active:scale-[0.97] transition-all text-left">
            <div className="w-11 h-11 bg-gradient-to-br from-[#fdcb6e] to-[#e17055] rounded-xl flex items-center justify-center shadow-lg shadow-amber-200/50 mb-3">
              <Icon name="Layers" size={20} className="text-white" />
            </div>
            <p className="text-[14px] font-bold text-gray-900">Карточки</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Запоминай быстрее</p>
          </button>

          <button onClick={() => navigate('/materials')}
            className="bg-gradient-to-br from-[#00cec9]/8 to-[#55efc4]/8 rounded-2xl p-4 border border-teal-200/30 active:scale-[0.97] transition-all text-left">
            <div className="w-11 h-11 bg-gradient-to-br from-[#00cec9] to-[#55efc4] rounded-xl flex items-center justify-center shadow-lg shadow-teal-200/50 mb-3">
              <Icon name="FileText" size={20} className="text-white" />
            </div>
            <p className="text-[14px] font-bold text-gray-900">Материалы</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Шпаргалки и файлы</p>
          </button>

          <button onClick={() => navigate('/pomodoro')}
            className="bg-gradient-to-br from-[#ff7675]/8 to-[#fd79a8]/8 rounded-2xl p-4 border border-pink-200/30 active:scale-[0.97] transition-all text-left">
            <div className="w-11 h-11 bg-gradient-to-br from-[#ff7675] to-[#fd79a8] rounded-xl flex items-center justify-center shadow-lg shadow-pink-200/50 mb-3">
              <Icon name="Timer" size={20} className="text-white" />
            </div>
            <p className="text-[14px] font-bold text-gray-900">Таймер</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Помодоро-метод</p>
          </button>
        </div>
      </div>

      {showDailyBonus && <DailyBonusPopup onClose={() => setShowDailyBonus(false)} />}
      {showPaywall && <PaywallSheet trigger="session_limit" onClose={() => setShowPaywall(false)} />}
      <BottomNav />

      <style>{`
        .scrollbar-hide::-webkit-scrollbar{display:none}
        .scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}
        .index-shimmer{animation:index-shimmer 2.5s infinite}
        @keyframes index-shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
        .index-companion-float{animation:index-float 3s ease-in-out infinite}
        @keyframes index-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        .index-pulse-ring{animation:index-pulse-ring 2s ease-in-out infinite}
        @keyframes index-pulse-ring{0%,100%{transform:scale(1);opacity:0.5}50%{transform:scale(1.15);opacity:0.2}}
      `}</style>
    </div>
  );
}

function TopicCard({ i, topic, ok, cur, lock, onTap }: { i: number; topic: string; ok: boolean; cur: boolean; lock: boolean; onTap: (i: number) => void }) {
  return (
    <button
      key={i}
      data-idx={i}
      onClick={() => onTap(i)}
      disabled={lock}
      className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl transition-all active:scale-[0.98] ${
        cur ? 'bg-gradient-to-r from-[#6c5ce7] to-[#a29bfe] shadow-xl shadow-purple-300/30' :
        ok ? 'bg-white shadow-sm border border-gray-100' :
        'bg-gray-50/80 border border-gray-100/50 opacity-50'
      }`}
    >
      <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
        cur ? 'bg-white/20' :
        ok ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-md shadow-emerald-200/40' :
        'bg-gray-200/80'
      }`}>
        {ok && <Icon name="Check" size={22} className="text-white" />}
        {cur && (
          <>
            <div className="absolute inset-0 rounded-xl bg-white/10 index-pulse-ring" />
            <Icon name="Play" size={22} className="text-white ml-0.5" />
          </>
        )}
        {lock && <Icon name="Lock" size={16} className="text-gray-400" />}
      </div>

      <div className="flex-1 text-left min-w-0">
        <p className={`text-[13px] font-bold leading-snug ${cur ? 'text-white' : ok ? 'text-gray-900' : 'text-gray-400'}`}>
          {topic}
        </p>
        <p className={`text-[11px] mt-0.5 ${cur ? 'text-white/60' : ok ? 'text-gray-400' : 'text-gray-300'}`}>
          {cur ? 'Нажми, чтобы начать' : ok ? 'Пройдено ✓' : `Тема ${i + 1}`}
        </p>
      </div>

      {cur && (
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <Icon name="ArrowRight" size={18} className="text-white" />
        </div>
      )}
      {ok && (
        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon name="Star" size={14} className="text-amber-400" />
        </div>
      )}
    </button>
  );
}

export { TopicCard };
