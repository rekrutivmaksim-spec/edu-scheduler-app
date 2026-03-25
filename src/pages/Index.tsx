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

function getNodeX(i: number): number {
  return [50, 78, 50, 22][i % 4];
}

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

  const userGoal = user?.goal || 'ege';
  const isExam = userGoal === 'ege' || userGoal === 'oge';
  const examLabel = userGoal === 'oge' ? 'ОГЭ' : 'ЕГЭ';
  const examDate = userGoal === 'oge' ? new Date('2026-05-19') : new Date('2026-05-25');
  const daysToExam = Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / 86400000));

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

  const goExam = (mode: string) => {
    localStorage.setItem('exam_last_choice', JSON.stringify({
      examType: userGoal, subjectId: activeSubject, mode
    }));
    navigate('/exam');
  };

  const streak = gam?.streak?.current ?? 0;
  const xp = gam?.xp_progress ?? 0;
  const level = gam?.level ?? 1;
  const NODE_GAP = 116;
  const PW = 300;

  const curve = (i: number) => {
    if (i === 0) return '';
    const x1 = (getNodeX(i - 1) / 100) * PW, y1 = (i - 1) * NODE_GAP + 34;
    const x2 = (getNodeX(i) / 100) * PW, y2 = i * NODE_GAP + 34;
    const cy = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`;
  };

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-[#ede9fe] via-[#f5f3ff] to-[#eef2ff] relative overflow-hidden">
      <div className="absolute top-32 -left-20 w-72 h-72 bg-purple-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-[55%] -right-16 w-64 h-64 bg-indigo-200/15 rounded-full blur-3xl pointer-events-none" />

      {/* ═══ HEADER ═══ */}
      <div className="sticky top-0 z-40">
        {showTrial && (
          <div className="text-center py-1.5 text-[11px] font-bold tracking-wider bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white">
            PREMIUM БЕСПЛАТНО ЕЩЁ {trialDays} {pluralDays(trialDays).toUpperCase()}
          </div>
        )}
        <div className="bg-white/80 backdrop-blur-2xl border-b border-white/40">
          <div className="flex items-center justify-between px-4 h-[52px]">
            <button onClick={() => navigate('/league')} className="flex items-center gap-2 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl px-3 py-1.5 border border-orange-100/60 active:scale-95 transition-transform">
              <div className="w-7 h-7 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center shadow-sm">
                <Icon name="Flame" size={15} className="text-white" />
              </div>
              <span className="text-[15px] font-black text-orange-600 tabular-nums">{streak}</span>
            </button>
            <div className="flex items-center gap-[3px]">
              {Array.from({ length: hearts.maxHearts }).map((_, i) => (
                <div key={i} className={`transition-all duration-300 ${i < hearts.hearts ? 'scale-100' : 'scale-75 opacity-25'}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={i < hearts.hearts ? '#ef4444' : '#d1d5db'} className={i < hearts.hearts ? 'drop-shadow-[0_2px_4px_rgba(239,68,68,0.4)]' : ''}>
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                </div>
              ))}
            </div>
            <button onClick={() => navigate('/profile')} className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl px-3 py-1.5 border border-amber-100/60 active:scale-95 transition-transform">
              <div className="w-7 h-7 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-lg flex items-center justify-center shadow-sm">
                <Icon name="Star" size={15} className="text-white" />
              </div>
              <span className="text-[15px] font-black text-amber-600 tabular-nums">{xp}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ SUBJECT + PROGRESS (compact) ═══ */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${comp.style} flex items-center justify-center text-xl shadow-md border-2 border-white/50`}>
            {stage.emoji}
          </div>
          <div>
            <p className="text-[14px] font-bold text-gray-800">{SUBJECT_NAMES[activeSubject]}</p>
            <p className="text-[11px] text-gray-400">{doneCnt}/{topics.length} тем · Ур.{level}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-purple-600">{pct}%</p>
        </div>
      </div>
      <div className="mx-4 mt-1 mb-2 h-2.5 bg-white/60 rounded-full overflow-hidden shadow-inner">
        <div className="h-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 rounded-full transition-all duration-1000 relative" style={{ width: `${Math.max(pct, 3)}%` }}>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] animate-[shimmer_2s_infinite]" />
        </div>
      </div>

      <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide">
        {[examSubject, ...ALL_SUBJECT_IDS.filter(s => s !== examSubject)].map(sid => {
          const active = sid === activeSubject;
          const locked = !isPrem && sid !== examSubject;
          return (
            <button
              key={sid}
              onClick={() => { if (locked) { setShowPaywall(true); return; } setActiveSubject(sid); }}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[12px] font-bold transition-all whitespace-nowrap active:scale-95 ${
                active ? 'bg-white text-purple-700 shadow-lg ring-2 ring-purple-300/40' :
                locked ? 'bg-white/30 text-gray-300' : 'bg-white/60 text-gray-600 shadow-sm'
              }`}
            >
              <span className="text-sm">{SUBJECT_EMOJI[sid] || '📚'}</span>
              {locked && <Icon name="Lock" size={10} className="text-gray-300" />}
              {SUBJECT_NAMES[sid]}
            </button>
          );
        })}
      </div>

      {/* ═══ LIMITS BAR (free vs premium) ═══ */}
      {!isPrem && !limits.loading && (
        <div className="mx-4 mt-2 mb-1 flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold ${sessLeft > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
            <Icon name="BookOpen" size={12} />
            {sessLeft > 0 ? `${sessLeft} ${sessLeft === 1 ? 'урок' : 'урока'}` : 'Уроки кончились'}
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold ${aiLeft > 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-500'}`}>
            <Icon name="Brain" size={12} />
            {aiLeft > 0 ? `${aiLeft} ${aiLeft === 1 ? 'вопрос' : aiLeft < 5 ? 'вопроса' : 'вопросов'} ИИ` : 'ИИ на сегодня 0'}
          </div>
          <button onClick={() => setShowPaywall(true)} className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[11px] font-bold shadow-md active:scale-95 transition-transform">
            <Icon name="Zap" size={12} />
            Безлимит
          </button>
        </div>
      )}

      {/* ═══ LEARNING PATH ═══ */}
      <div
        ref={scrollRef}
        className="relative mx-auto mt-3 px-2"
        style={{ maxWidth: PW + 40, minHeight: topics.length * NODE_GAP + 80 }}
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ height: topics.length * NODE_GAP + 80, left: 20 }} width={PW}>
          <defs>
            <linearGradient id="gDone" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa"/><stop offset="100%" stopColor="#818cf8"/></linearGradient>
            <linearGradient id="gNext" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c4b5fd"/><stop offset="100%" stopColor="#a5b4fc"/></linearGradient>
            <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          {topics.map((_, i) => {
            if (i === 0) return null;
            const d = curve(i);
            const prevOk = completed.includes(i - 1);
            const ok = completed.includes(i);
            const next = i === currentIdx;
            return (
              <g key={i}>
                {(prevOk || ok) && <path d={d} fill="none" stroke="url(#gDone)" strokeWidth={6} strokeLinecap="round" opacity={0.15} filter="url(#glow)" />}
                <path d={d} fill="none"
                  stroke={prevOk && ok ? 'url(#gDone)' : next ? 'url(#gNext)' : '#ddd6fe'}
                  strokeWidth={prevOk || ok ? 5 : 3}
                  strokeDasharray={prevOk && ok ? 'none' : next ? '10 7' : '5 7'}
                  strokeLinecap="round" className="transition-all duration-700"
                />
              </g>
            );
          })}
        </svg>

        {topics.map((topic, i) => {
          const ok = completed.includes(i);
          const cur = i === currentIdx;
          const lock = !ok && !cur;
          const x = getNodeX(i);
          const sz = cur ? 70 : ok ? 54 : 46;
          return (
            <div key={i} data-idx={i} className="absolute flex flex-col items-center"
              style={{ left: `calc(${x}% + 20px)`, top: i * NODE_GAP, transform: 'translateX(-50%)', width: 150 }}>
              <button onClick={() => tapTopic(i)} disabled={lock}
                className="relative flex items-center justify-center transition-all duration-300 active:scale-90" style={{ width: sz, height: sz }}>
                {cur && <>
                  <span className="absolute inset-[-8px] rounded-full bg-purple-400/20 animate-[pulse_2s_ease-in-out_infinite]" />
                  <span className="absolute inset-[-4px] rounded-full border-[2.5px] border-purple-300/50" />
                </>}
                <div className={`w-full h-full rounded-full flex items-center justify-center relative overflow-hidden ${
                  cur ? 'bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 shadow-[0_8px_28px_rgba(109,40,217,0.4)]' :
                  ok ? 'bg-gradient-to-br from-emerald-400 via-green-500 to-teal-500 shadow-[0_5px_18px_rgba(52,211,153,0.3)]' :
                  'bg-gradient-to-br from-gray-200 to-gray-300/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)]'
                }`}>
                  <div className={`absolute inset-0 rounded-full ${cur || ok ? 'bg-gradient-to-t from-transparent to-white/20' : ''}`} />
                  {ok && <Icon name="Check" size={22} className="text-white relative z-10 drop-shadow-md" />}
                  {cur && <div className="relative z-10 w-9 h-9 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"><Icon name="Play" size={20} className="text-white ml-0.5 drop-shadow-md" /></div>}
                  {lock && <Icon name="Lock" size={16} className="text-gray-400/70 relative z-10" />}
                </div>
                {ok && <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-lg border border-amber-100"><Icon name="Star" size={12} className="text-amber-400" /></div>}
              </button>
              {cur && (
                <div className="mt-3 relative">
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gradient-to-br from-purple-600 to-indigo-600 rotate-45 rounded-sm" />
                  <div className="relative bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl px-4 py-2 shadow-xl shadow-purple-300/25">
                    <p className="text-[12px] font-bold text-white text-center leading-snug max-w-[130px]">{topic}</p>
                  </div>
                </div>
              )}
              {ok && <p className="mt-2 text-[10px] text-gray-400 text-center max-w-[100px] truncate font-medium">{topic}</p>}
            </div>
          );
        })}
      </div>

      {/* ═══ EXAM QUICK ACCESS ═══ */}
      {isExam && (
        <div className="mx-4 mt-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wider">Подготовка к {examLabel}</p>
            <div className="flex items-center gap-1.5 bg-red-50 rounded-lg px-2.5 py-1">
              <Icon name="Clock" size={12} className="text-red-500" />
              <span className="text-[11px] font-bold text-red-500">{daysToExam} дн.</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={() => goExam('practice')}
              className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100/40 active:scale-95 transition-all text-left">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center mb-2.5 shadow-md">
                <Icon name="Target" size={20} className="text-white" />
              </div>
              <p className="text-[13px] font-bold text-gray-800">Практика</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Реальные задания</p>
            </button>
            <button onClick={() => goExam('explain')}
              className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100/40 active:scale-95 transition-all text-left">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mb-2.5 shadow-md">
                <Icon name="Lightbulb" size={20} className="text-white" />
              </div>
              <p className="text-[13px] font-bold text-gray-800">Разбор тем</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Теория и вопросы</p>
            </button>
            <button onClick={() => goExam('weak')}
              className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100/40 active:scale-95 transition-all text-left">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mb-2.5 shadow-md">
                <Icon name="Flame" size={20} className="text-white" />
              </div>
              <p className="text-[13px] font-bold text-gray-800">Слабые темы</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Работа над ошибками</p>
            </button>
            <button onClick={() => goExam('mock')}
              className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100/40 active:scale-95 transition-all text-left">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center mb-2.5 shadow-md">
                <Icon name="FileText" size={20} className="text-white" />
              </div>
              <p className="text-[13px] font-bold text-gray-800">Пробный тест</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Полная симуляция</p>
            </button>
          </div>
        </div>
      )}

      {/* ═══ QUICK TOOLS ═══ */}
      <div className="mx-4 mb-4">
        <div className="flex gap-2">
          <button onClick={() => { if (!isPrem && aiLeft <= 0) { setShowPaywall(true); return; } navigate('/assistant'); }}
            className="flex-1 bg-white rounded-2xl p-3 shadow-sm border border-purple-100/30 active:scale-95 transition-all text-center">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-1.5">
              <Icon name="Brain" size={16} className="text-blue-600" />
            </div>
            <p className="text-[11px] font-bold text-gray-700">ИИ</p>
          </button>
          <button onClick={() => navigate('/flashcards')}
            className="flex-1 bg-white rounded-2xl p-3 shadow-sm border border-purple-100/30 active:scale-95 transition-all text-center">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center mx-auto mb-1.5">
              <Icon name="Layers" size={16} className="text-amber-600" />
            </div>
            <p className="text-[11px] font-bold text-gray-700">Карточки</p>
          </button>
          <button onClick={() => navigate('/materials')}
            className="flex-1 bg-white rounded-2xl p-3 shadow-sm border border-purple-100/30 active:scale-95 transition-all text-center">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-1.5">
              <Icon name="FileText" size={16} className="text-emerald-600" />
            </div>
            <p className="text-[11px] font-bold text-gray-700">Файлы</p>
          </button>
          <button onClick={() => navigate('/pomodoro')}
            className="flex-1 bg-white rounded-2xl p-3 shadow-sm border border-purple-100/30 active:scale-95 transition-all text-center">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-1.5">
              <Icon name="Timer" size={16} className="text-red-500" />
            </div>
            <p className="text-[11px] font-bold text-gray-700">Таймер</p>
          </button>
        </div>
      </div>

      {showDailyBonus && <DailyBonusPopup onClose={() => setShowDailyBonus(false)} />}
      {showPaywall && <PaywallSheet trigger="session_limit" onClose={() => setShowPaywall(false)} />}
      <BottomNav />

      <style>{`
        .scrollbar-hide::-webkit-scrollbar{display:none}
        .scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}
        @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
      `}</style>
    </div>
  );
}