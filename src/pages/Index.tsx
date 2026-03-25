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
  ru: 'Русский', math_prof: 'Профиль', math_base: 'База',
  physics: 'Физика', chemistry: 'Химия', biology: 'Биология', history: 'История',
  social: 'Общество', informatics: 'Информатика', english: 'English',
  geography: 'Гео', literature: 'Литература',
};

const SUBJECT_FULL: Record<string, string> = {
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

function Index() {
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
    <div className="min-h-screen pb-24 bg-[#f0f4ff] relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[380px] bg-gradient-to-b from-[#4f46e5] via-[#7c3aed] to-[#f0f4ff]" />
      <div className="absolute top-16 -left-10 w-48 h-48 bg-yellow-300/25 rounded-full blur-[60px] pointer-events-none" />
      <div className="absolute top-32 -right-10 w-52 h-52 bg-pink-400/20 rounded-full blur-[70px] pointer-events-none" />

      {showTrial && (
        <div className="relative z-50 text-center py-2 text-[11px] font-extrabold tracking-widest bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-500 text-white shadow-md">
          🎁 PREMIUM БЕСПЛАТНО ЕЩЁ {trialDays} {pluralDays(trialDays).toUpperCase()}
        </div>
      )}

      <div className="relative z-10 px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${comp.style} flex items-center justify-center text-[28px] shadow-xl border-[3px] border-white/40 idx-float`}>
              {stage.emoji}
            </div>
            <div>
              <p className="text-white/70 text-[11px] font-bold uppercase tracking-wider">{getGreeting()}</p>
              <p className="text-white text-[22px] font-black leading-tight">{userName} 👋</p>
            </div>
          </div>
          <button onClick={() => navigate('/profile')} className="w-11 h-11 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center active:scale-90 transition-transform">
            <Icon name="User" size={20} className="text-white" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <button onClick={() => navigate('/league')} className="bg-white rounded-2xl p-3 shadow-lg shadow-indigo-200/50 active:scale-[0.96] transition-all">
            <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center shadow-md shadow-orange-300/40 mb-2">
              <Icon name="Flame" size={17} className="text-white" />
            </div>
            <p className="text-[20px] font-black text-gray-900 leading-none">{streak}</p>
            <p className="text-[10px] font-bold text-gray-400 mt-0.5">серия</p>
          </button>
          <div className="bg-white rounded-2xl p-3 shadow-lg shadow-indigo-200/50">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-md shadow-amber-300/40 mb-2">
              <Icon name="Star" size={17} className="text-white" />
            </div>
            <p className="text-[20px] font-black text-gray-900 leading-none">{xp}</p>
            <p className="text-[10px] font-bold text-gray-400 mt-0.5">опыт</p>
          </div>
          <div className="bg-white rounded-2xl p-3 shadow-lg shadow-indigo-200/50">
            <div className="w-9 h-9 bg-gradient-to-br from-rose-400 to-pink-500 rounded-xl flex items-center justify-center shadow-md shadow-rose-300/40 mb-2">
              <Icon name="Heart" size={17} className="text-white" />
            </div>
            <div className="flex items-center gap-[2px] mt-0.5">
              {Array.from({ length: hearts.maxHearts }).map((_, i) => (
                <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill={i < hearts.hearts ? '#f43f5e' : '#e5e7eb'}>
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              ))}
            </div>
            <p className="text-[10px] font-bold text-gray-400 mt-1">жизни</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 px-5 mb-4">
        {currentIdx >= 0 && (
          <button
            onClick={() => tapTopic(currentIdx)}
            className="w-full bg-gradient-to-r from-[#10b981] to-[#059669] rounded-2xl p-4 shadow-xl shadow-emerald-400/30 active:scale-[0.97] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Icon name="Play" size={24} className="text-white ml-0.5" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-white/80 text-[10px] font-extrabold uppercase tracking-wider">Следующая тема</p>
                <p className="text-white text-[15px] font-bold leading-snug mt-0.5">{topics[currentIdx]}</p>
              </div>
              <Icon name="ArrowRight" size={20} className="text-white/70" />
            </div>
          </button>
        )}
      </div>

      <div className="relative z-10">
        <div className="px-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-[26px]">{SUBJECT_EMOJI[activeSubject] || '📚'}</span>
              <div>
                <p className="text-[16px] font-extrabold text-gray-900">{SUBJECT_FULL[activeSubject]}</p>
                <p className="text-[11px] text-gray-500 font-semibold">Уровень {level} · {doneCnt} из {topics.length}</p>
              </div>
            </div>
            <p className="text-[26px] font-black text-indigo-600">{pct}%</p>
          </div>
          <div className="h-3 bg-indigo-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-1000 relative"
              style={{ width: `${Math.max(pct, 3)}%` }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent)] idx-shimmer" />
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
                  active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-300/40' :
                  locked ? 'bg-gray-100 text-gray-300' : 'bg-white text-gray-600 shadow-md shadow-gray-200/50'
                }`}
              >
                <span className="text-sm">{SUBJECT_EMOJI[sid] || '📚'}</span>
                {locked && <Icon name="Lock" size={10} className="text-gray-300" />}
                {SUBJECT_NAMES[sid]}
              </button>
            );
          })}
        </div>

        {!isPrem && !limits.loading && (
          <div className="mx-5 mt-3 mb-1 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-3.5 border border-amber-200/60 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold ${sessLeft > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                  <Icon name="BookOpen" size={12} />
                  {sessLeft > 0 ? `${sessLeft} ${sessLeft === 1 ? 'урок' : 'урока'}` : '0 уроков'}
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold ${aiLeft > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-600'}`}>
                  <Icon name="Brain" size={12} />
                  {aiLeft > 0 ? `${aiLeft} ИИ` : '0 ИИ'}
                </div>
              </div>
              <button onClick={() => setShowPaywall(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[11px] font-bold shadow-lg shadow-indigo-300/30 active:scale-95 transition-transform">
                <Icon name="Zap" size={13} />
                Безлимит
              </button>
            </div>
          </div>
        )}

        <div className="px-5 mt-5 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full" />
          <p className="text-[14px] font-extrabold text-gray-800">Путь обучения</p>
        </div>

        <div ref={scrollRef} className="px-4 pb-4 space-y-2">
          {topics.map((topic, i) => {
            const ok = completed.includes(i);
            const cur = i === currentIdx;
            const lock = !ok && !cur;

            if (i > 0 && i % 4 === 0 && (ok || cur)) {
              const phrases = ['Так держать! 💪', 'Ты молодец! 🌟', 'Не сдавайся! 🔥', 'Крутой прогресс! 🚀', 'Вперёд! ⚡', 'Огонь! 🎯'];
              const phrase = phrases[Math.floor(i / 4) % phrases.length];
              return (
                <div key={i}>
                  <div className="flex items-center gap-2.5 px-2 py-2 mb-2">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${comp.style} flex items-center justify-center text-lg shadow-lg idx-float`}>
                      {stage.emoji}
                    </div>
                    <div className="bg-white rounded-2xl rounded-bl-md px-3.5 py-2 shadow-md border border-gray-100">
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

        <div className="px-5 mt-3 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-full" />
          <p className="text-[14px] font-extrabold text-gray-800">Инструменты</p>
        </div>

        <div className="px-5 pb-8 grid grid-cols-2 gap-3">
          <button onClick={() => { if (!isPrem && aiLeft <= 0) { setShowPaywall(true); return; } navigate('/assistant'); }}
            className="bg-white rounded-2xl p-4 shadow-lg shadow-indigo-200/40 active:scale-[0.96] transition-all text-left border border-indigo-100/50">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-300/40 mb-3">
              <Icon name="Brain" size={22} className="text-white" />
            </div>
            <p className="text-[14px] font-extrabold text-gray-900">ИИ помощник</p>
            <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Задай любой вопрос</p>
          </button>

          <button onClick={() => navigate('/flashcards')}
            className="bg-white rounded-2xl p-4 shadow-lg shadow-orange-200/40 active:scale-[0.96] transition-all text-left border border-orange-100/50">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-300/40 mb-3">
              <Icon name="Layers" size={22} className="text-white" />
            </div>
            <p className="text-[14px] font-extrabold text-gray-900">Карточки</p>
            <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Запоминай быстрее</p>
          </button>

          <button onClick={() => navigate('/materials')}
            className="bg-white rounded-2xl p-4 shadow-lg shadow-emerald-200/40 active:scale-[0.96] transition-all text-left border border-emerald-100/50">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-300/40 mb-3">
              <Icon name="FileText" size={22} className="text-white" />
            </div>
            <p className="text-[14px] font-extrabold text-gray-900">Материалы</p>
            <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Шпаргалки и файлы</p>
          </button>

          <button onClick={() => navigate('/pomodoro')}
            className="bg-white rounded-2xl p-4 shadow-lg shadow-blue-200/40 active:scale-[0.96] transition-all text-left border border-blue-100/50">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-300/40 mb-3">
              <Icon name="Timer" size={22} className="text-white" />
            </div>
            <p className="text-[14px] font-extrabold text-gray-900">Таймер</p>
            <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Помодоро-метод</p>
          </button>
        </div>
      </div>

      {showDailyBonus && <DailyBonusPopup onClose={() => setShowDailyBonus(false)} />}
      {showPaywall && <PaywallSheet trigger="session_limit" onClose={() => setShowPaywall(false)} />}
      <BottomNav />

      <style>{`
        .scrollbar-hide::-webkit-scrollbar{display:none}
        .scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}
        .idx-shimmer{animation:idx-sh 2.5s infinite}
        @keyframes idx-sh{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
        .idx-float{animation:idx-fl 3s ease-in-out infinite}
        @keyframes idx-fl{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        .idx-pulse{animation:idx-ps 2s ease-in-out infinite}
        @keyframes idx-ps{0%,100%{box-shadow:0 4px 20px rgba(79,70,229,0.25)}50%{box-shadow:0 4px 30px rgba(79,70,229,0.45)}}
      `}</style>
    </div>
  );
}

function TopicCard({ i, topic, ok, cur, lock, onTap }: { i: number; topic: string; ok: boolean; cur: boolean; lock: boolean; onTap: (i: number) => void }) {
  return (
    <button
      data-idx={i}
      onClick={() => onTap(i)}
      disabled={lock}
      className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl transition-all active:scale-[0.98] ${
        cur ? 'bg-gradient-to-r from-indigo-500 to-purple-600 shadow-xl shadow-indigo-300/30 idx-pulse' :
        ok ? 'bg-white shadow-md shadow-gray-200/50 border border-gray-100' :
        'bg-gray-100/80 opacity-50'
      }`}
    >
      <div className={`relative w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
        cur ? 'bg-white/25' :
        ok ? 'bg-gradient-to-br from-emerald-400 to-green-500 shadow-md shadow-emerald-300/30' :
        'bg-gray-200'
      }`}>
        {ok && <Icon name="Check" size={20} className="text-white" />}
        {cur && <Icon name="Play" size={20} className="text-white ml-0.5" />}
        {lock && <span className="text-gray-400 text-[12px] font-bold">{i + 1}</span>}
      </div>

      <div className="flex-1 text-left min-w-0">
        <p className={`text-[13px] font-bold leading-snug ${cur ? 'text-white' : ok ? 'text-gray-900' : 'text-gray-400'}`}>
          {topic}
        </p>
        <p className={`text-[11px] mt-0.5 font-semibold ${cur ? 'text-white/60' : ok ? 'text-gray-400' : 'text-gray-300'}`}>
          {cur ? 'Начать урок →' : ok ? 'Пройдено ✓' : `Тема ${i + 1}`}
        </p>
      </div>

      {cur && (
        <div className="w-10 h-10 bg-white/25 rounded-xl flex items-center justify-center flex-shrink-0">
          <Icon name="ArrowRight" size={18} className="text-white" />
        </div>
      )}
      {ok && (
        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon name="Star" size={14} className="text-amber-500" />
        </div>
      )}
    </button>
  );
}

export default Index;
