import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import Icon from '@/components/ui/icon';
import BottomNav from '@/components/BottomNav';
import RewardModal, { RewardType } from '@/components/RewardModal';

const API_URL = 'https://functions.poehali.dev/0559fb04-cd62-4e50-bb12-dfd6941a7080';
const SUBSCRIPTION_URL = 'https://functions.poehali.dev/7fe183c2-49af-4817-95f3-6ab4912778c4';

interface Achievement {
  code: string;
  title: string;
  description: string;
  icon: string;
  xp_reward: number;
  is_unlocked: boolean;
}

interface DailyQuest {
  id: number;
  type: string;
  title: string;
  target: number;
  current: number;
  xp_reward: number;
  is_completed: boolean;
  is_premium_only: boolean;
}

interface StreakReward {
  streak_days: number;
  reward_type: string;
  value: number;
  title: string;
  description: string;
  is_available: boolean;
  is_claimed: boolean;
}

interface GamificationProfile {
  level: number;
  xp_total: number;
  xp_progress: number;
  xp_needed: number;
  is_premium: boolean;
  is_trial?: boolean;
  bonus_questions?: number;
  streak: {
    current: number;
    longest: number;
    freeze_available: number;
    total_days: number;
  };
  stats: {
    total_tasks: number;
    total_ai_questions: number;
    total_materials: number;
  };
  achievements: Achievement[];
  achievements_unlocked: number;
  achievements_total: number;
  daily_quests: DailyQuest[];
  streak_rewards: StreakReward[];
}

interface LeaderItem {
  rank: number;
  name: string;
  level: number;
  xp: number;
  streak: number;
  is_me: boolean;
  subscription_type: string;
}

function getDaysWord(n: number) {
  if (n === 1) return 'день';
  if (n >= 2 && n <= 4) return 'дня';
  return 'дней';
}

function getLevelEmoji(level: number): string {
  if (level <= 5) return '🌱';
  if (level <= 10) return '🌿';
  if (level <= 20) return '🌳';
  if (level <= 30) return '⭐';
  if (level <= 50) return '🌟';
  if (level <= 70) return '💎';
  if (level <= 90) return '🔥';
  return '🚀';
}

const LEVEL_REWARDS: Record<number, string> = {
  5: 'достижение «Уровень 5»',
  10: 'достижение «Уровень 10»',
  25: 'достижение «Уровень 25»',
  50: 'достижение «Уровень 50»',
};

const STREAK_REWARDS_INFO = [
  { days: 3, reward: '+3 вопроса ИИ' },
  { days: 7, reward: '+5 вопросов ИИ' },
  { days: 14, reward: '+5 вопросов ИИ' },
  { days: 21, reward: '+5 вопросов ИИ' },
  { days: 30, reward: '+5 вопросов ИИ' },
  { days: 60, reward: '+5 вопросов ИИ' },
  { days: 90, reward: '+5 вопросов ИИ' },
];

const DEMO_ACHIEVEMENTS = [
  { code: 'first_ai', title: 'Первый вопрос ИИ', icon: '🤖', xp_reward: 10, is_unlocked: false },
  { code: 'first_session', title: 'Первое занятие', icon: '📚', xp_reward: 10, is_unlocked: false },
  { code: 'streak_3', title: 'Серия 3 дня', icon: '🔥', xp_reward: 15, is_unlocked: false },
  { code: 'streak_7', title: 'Серия 7 дней', icon: '🔥', xp_reward: 30, is_unlocked: false },
  { code: 'streak_30', title: 'Серия 30 дней', icon: '🏆', xp_reward: 100, is_unlocked: false },
  { code: 'first_file', title: 'Первый анализ файла', icon: '📎', xp_reward: 15, is_unlocked: false },
  { code: 'first_exam', title: 'Первая подготовка к экзамену', icon: '🎓', xp_reward: 20, is_unlocked: false },
];

export default function Achievements() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'progress' | 'achievements' | 'leaderboard'>('progress');
  const [claimingReward, setClaimingReward] = useState<number | null>(null);

  // RewardModal
  const [rewardModal, setRewardModal] = useState<{
    type: RewardType;
    data?: object;
  } | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'get_profile' }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch { /* silent */ }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    // Кэш 1 час
    const CACHE_KEY = 'leaderboard_cache';
    const CACHE_TTL = 3600000;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) {
          setLeaderboard(data);
          return;
        }
      }
    } catch { /* ignore */ }
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}?action=leaderboard&period=week`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.leaderboard || [];
        setLeaderboard(list);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: list, ts: Date.now() })); } catch { /* ignore */ }
      }
    } catch { /* silent */ }
  }, []);

  const performCheckin = useCallback(async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkin' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.new_achievements?.length > 0) {
          const ach = data.new_achievements[0];
          setRewardModal({ type: 'achievement', data: { achievementTitle: ach.title, xp: ach.xp_reward } });
        }
      }
    } catch { /* silent */ }
  }, []);

  const claimStreakReward = async (streakDays: number) => {
    setClaimingReward(streakDays);
    try {
      const token = authService.getToken();
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim_streak_reward', streak_days: streakDays }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await loadProfile();
        const nextReward = STREAK_REWARDS_INFO.find(r => r.days > streakDays);
        setRewardModal({
          type: 'streak_reward',
          data: {
            streakDays,
            reward: data.reward_description || `+${streakDays} бонус-вопросов ИИ`,
            nextReward: nextReward ? `через ${nextReward.days} дн.: ${nextReward.reward}` : undefined,
          },
        });
      } else if (res.status === 403) {
        navigate('/pricing');
      }
    } catch { /* silent */ }
    finally { setClaimingReward(null); }
  };

  const freezeStreak = async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'use_freeze' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await loadProfile();
        setRewardModal({
          type: 'streak_freeze',
          data: { freezesLeft: data.freeze_remaining ?? 0 },
        });
      } else if (res.status === 403) {
        navigate('/pricing');
      }
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (!authService.isAuthenticated()) { navigate('/auth'); return; }
    Promise.all([loadProfile(), loadLeaderboard(), performCheckin()])
      .finally(() => setLoading(false));
  }, [navigate, loadProfile, loadLeaderboard, performCheckin]);

  const xpPercent = profile && profile.xp_needed > 0
    ? Math.min(100, Math.round((profile.xp_progress / profile.xp_needed) * 100))
    : 0;

  const achievements = profile?.achievements?.length
    ? profile.achievements
    : DEMO_ACHIEVEMENTS;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-nav">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl hover:bg-gray-100">
          <Icon name="ArrowLeft" size={20} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900">Прогресс и награды</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-4 flex gap-1 sticky top-[52px] z-10">
        {([
          { id: 'progress', label: 'Прогресс' },
          { id: 'achievements', label: 'Достижения' },
          { id: 'leaderboard', label: 'Рейтинг' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`py-3 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeSection === tab.id
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-w-xl mx-auto px-4 py-4 space-y-4">

        {/* === ПРОГРЕСС === */}
        {activeSection === 'progress' && (
          <>
            {/* Шапка страницы */}
            <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 rounded-3xl p-5 text-white">
              <p className="text-white/70 text-xs mb-1">Учись каждый день</p>
              <p className="text-white font-bold text-sm mb-4">получай XP, открывай уровни и забирай бонусы</p>

              {/* Уровень */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-3xl">{getLevelEmoji(profile?.level || 1)}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-extrabold text-xl">Уровень {profile?.level || 1}</span>
                    <span className="text-white/60 text-xs">{profile?.xp_progress || 0} / {profile?.xp_needed || 100} XP</span>
                  </div>
                  <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-700"
                      style={{ width: `${xpPercent}%` }}
                    />
                  </div>
                  <p className="text-white/60 text-xs mt-1">до уровня {(profile?.level || 1) + 1}</p>
                </div>
              </div>
            </div>

            {/* Как расти */}
            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3">Как быстрее расти</h3>
              <div className="space-y-2">
                {[
                  { action: 'пройди занятие', xp: '+10 XP', icon: '📚' },
                  { action: 'задай вопрос ИИ', xp: '+3 XP', icon: '🤖' },
                  { action: 'запусти помодоро', xp: '+10 XP', icon: '🍅' },
                  { action: 'загрузи конспект', xp: '+15 XP', icon: '📎' },
                ].map(item => (
                  <div key={item.action} className="flex items-center gap-3 py-1">
                    <span className="text-xl">{item.icon}</span>
                    <span className="text-gray-600 text-sm flex-1">{item.action}</span>
                    <span className="text-purple-600 font-bold text-sm">{item.xp}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Что дают уровни */}
            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span className="text-xl">🎁</span>
                Что дают уровни
              </h3>
              <div className="space-y-2">
                {Object.entries(LEVEL_REWARDS).map(([lvl, reward]) => {
                  const unlocked = (profile?.level || 1) >= Number(lvl);
                  return (
                    <div key={lvl} className={`flex items-center gap-3 py-1.5 px-3 rounded-xl ${unlocked ? 'bg-purple-50' : 'bg-gray-50'}`}>
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${unlocked ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                        {lvl}
                      </span>
                      <span className={`text-sm flex-1 ${unlocked ? 'text-purple-800 font-medium' : 'text-gray-500'}`}>{reward}</span>
                      {unlocked && <span className="text-green-500 text-xs">✓</span>}
                    </div>
                  );
                })}
                <p className="text-gray-400 text-xs mt-2 pl-2">Дальше награды повторяются.</p>
              </div>
            </div>

            {/* Бонусные вопросы */}
            {(profile?.bonus_questions ?? 0) > 0 && (
              <div className="bg-green-50 border border-green-100 rounded-3xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center text-xl flex-shrink-0">⚡</div>
                <div>
                  <p className="font-bold text-green-800 text-sm">Бонусные вопросы</p>
                  <p className="text-green-600 text-xs">+{profile!.bonus_questions} дополнительных вопросов к ИИ</p>
                </div>
                <span className="ml-auto font-extrabold text-green-700 text-xl">{profile!.bonus_questions}</span>
              </div>
            )}

            {/* Серия */}
            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{(profile?.streak.current || 0) > 0 ? '🔥' : '❄️'}</span>
                <div>
                  <p className="font-extrabold text-gray-900 text-xl">{profile?.streak.current || 0} {getDaysWord(profile?.streak.current || 0)} подряд</p>
                  <p className="text-gray-400 text-xs">Не пропускай — потеряешь прогресс</p>
                </div>
              </div>

              <h4 className="font-bold text-gray-700 text-sm mb-2">Награды за серию:</h4>
              <div className="space-y-1.5 mb-4">
                {STREAK_REWARDS_INFO.map(r => {
                  const current = profile?.streak.current || 0;
                  const reached = current >= r.days;
                  const serverReward = profile?.streak_rewards?.find(sr => sr.streak_days === r.days);
                  const canClaim = serverReward?.is_available && !serverReward?.is_claimed;
                  return (
                    <div key={r.days} className={`flex items-center gap-3 py-2 px-3 rounded-xl ${reached ? 'bg-orange-50' : 'bg-gray-50'}`}>
                      <span className={`text-xs font-bold w-12 flex-shrink-0 ${reached ? 'text-orange-600' : 'text-gray-400'}`}>{r.days} дн.</span>
                      <span className={`text-sm flex-1 ${reached ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>{r.reward}</span>
                      {canClaim ? (
                        <button
                          onClick={() => claimStreakReward(r.days)}
                          disabled={claimingReward === r.days}
                          className="text-xs bg-orange-500 text-white px-2.5 py-1 rounded-full font-medium"
                        >
                          {claimingReward === r.days ? '...' : 'Забрать'}
                        </button>
                      ) : reached ? (
                        <span className="text-green-500 text-xs">✓</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* Заморозка */}
              <div className="bg-blue-50 rounded-2xl p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-blue-800 text-sm">🧊 Заморозка серии</p>
                  <p className="text-blue-600 text-xs mt-0.5">
                    {profile?.is_premium
                      ? 'Безлимит заморозки'
                      : `1 раз в месяц бесплатно · Осталось: ${profile?.streak.freeze_available ?? 0}`
                    }
                  </p>
                </div>
                {(profile?.streak.freeze_available ?? 0) > 0 ? (
                  <button
                    onClick={freezeStreak}
                    className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-full font-medium flex-shrink-0"
                  >
                    Заморозить
                  </button>
                ) : (
                  <button
                    onClick={() => navigate('/pricing')}
                    className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-full font-medium flex-shrink-0"
                  >
                    Premium
                  </button>
                )}
              </div>
            </div>

            {/* Ежедневные задания */}
            {(profile?.daily_quests?.length ?? 0) > 0 && (
              <div className="bg-white rounded-3xl p-5 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
                  <span className="text-xl">🎯</span>
                  Ежедневные задания
                </h3>
                <p className="text-gray-400 text-xs mb-3">Выполни сегодня:</p>
                <div className="space-y-2">
                  {profile!.daily_quests.map(q => (
                    <div key={q.id} className={`flex items-center gap-3 py-2.5 px-3 rounded-xl ${q.is_completed ? 'bg-green-50' : 'bg-gray-50'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${q.is_completed ? 'bg-green-500' : 'bg-gray-200'}`}>
                        {q.is_completed
                          ? <span className="text-white text-sm">✓</span>
                          : <span className="text-gray-500 text-xs font-bold">{q.current}/{q.target}</span>
                        }
                      </div>
                      <span className={`text-sm flex-1 ${q.is_completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{q.title}</span>
                      <span className="text-purple-600 font-bold text-xs">+{q.xp_reward} XP</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                  <p className="text-gray-500 text-xs">Награда за все задания:</p>
                  <div className="flex gap-2">
                    <span className="text-purple-600 text-xs font-bold">+10 XP</span>
                    <span className="text-orange-500 text-xs font-bold">+2 бонусных вопроса</span>
                  </div>
                </div>
              </div>
            )}

            {/* Бонусные вопросы */}
            <div className="bg-indigo-50 rounded-3xl p-5 border border-indigo-100">
              <h3 className="font-bold text-indigo-800 mb-2 flex items-center gap-2">
                <span>💬</span>
                Бонусные вопросы
              </h3>
              <p className="text-indigo-700 text-sm mb-3">Бонусы дают доступ к ИИ сверх бесплатного лимита.</p>
              <p className="text-indigo-600 text-xs font-medium mb-2">Получить можно:</p>
              <div className="space-y-1">
                {['за уровень', 'за серию', 'за задания', 'за достижения'].map(f => (
                  <div key={f} className="flex items-center gap-2 text-indigo-700 text-sm">
                    <span className="text-indigo-400">•</span>
                    {f}
                  </div>
                ))}
              </div>
              <p className="text-indigo-500 text-xs mt-3">Когда бонусы заканчиваются — включается обычный лимит.</p>
            </div>

            {/* Premium блок */}
            {!profile?.is_premium && (
              <div className="bg-gradient-to-br from-gray-900 to-purple-900 rounded-3xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">👑</span>
                  <h3 className="font-bold text-white">Premium ускоряет прогресс</h3>
                </div>
                <div className="space-y-2 mb-4">
                  {[
                    '×2 XP за все действия',
                    'больше заданий каждый день',
                    'безлимит вопросов к ИИ',
                    'безлимит анализ файлов',
                    'заморозка серии без ограничений',
                  ].map(f => (
                    <div key={f} className="flex items-center gap-2 text-gray-300 text-sm">
                      <span className="text-purple-400">✓</span>
                      {f}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => navigate('/pricing')}
                  className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold rounded-2xl text-sm active:scale-[0.98] transition-all"
                >
                  Подключить Premium
                </button>
              </div>
            )}

            {/* Лимиты */}
            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span>⚡</span>
                Бесплатно доступно
              </h3>
              <div className="space-y-2">
                {[
                  '3 вопроса ИИ в день',
                  '1 загрузка файла в месяц',
                  '1 занятие в день',
                ].map(f => (
                  <div key={f} className="flex items-center gap-2 text-gray-600 text-sm">
                    <Icon name="Check" size={14} className="text-gray-400 flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
              <p className="text-gray-400 text-xs mt-3">Без ограничений — в Premium.</p>
            </div>


          </>
        )}

        {/* === ДОСТИЖЕНИЯ === */}
        {activeSection === 'achievements' && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">Достижения</h2>
              {profile && (
                <span className="text-sm text-gray-400">
                  {profile.achievements_unlocked || 0} / {profile.achievements_total || achievements.length}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {achievements.map(ach => (
                <div
                  key={ach.code}
                  className={`bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4 ${!ach.is_unlocked ? 'opacity-50' : ''}`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl ${ach.is_unlocked ? 'bg-yellow-50' : 'bg-gray-100'}`}>
                    {ach.icon || '🏆'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${ach.is_unlocked ? 'text-gray-800' : 'text-gray-400'}`}>{ach.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">XP + бонусы</p>
                  </div>
                  {ach.is_unlocked
                    ? <span className="text-green-500 text-lg flex-shrink-0">✓</span>
                    : <Icon name="Lock" size={16} className="text-gray-300 flex-shrink-0" />
                  }
                </div>
              ))}
            </div>
          </>
        )}

        {/* === РЕЙТИНГ === */}
        {activeSection === 'leaderboard' && (
          <>
            {/* Баннер соревнования */}
            <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-5 text-white">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">🏆</span>
                <div>
                  <h2 className="font-extrabold text-lg">Рейтинг недели</h2>
                  <p className="text-white/70 text-xs">Обновляется каждый час</p>
                </div>
                <button
                  onClick={() => {
                    try { localStorage.removeItem('leaderboard_cache'); } catch { /* ignore */ }
                    loadLeaderboard();
                  }}
                  className="ml-auto bg-white/20 rounded-xl px-3 py-1.5 text-xs font-semibold"
                >
                  Обновить
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Твой ранг', value: leaderboard.find(l => l.is_me)?.rank ? `#${leaderboard.find(l => l.is_me)!.rank}` : '—' },
                  { label: 'Участников', value: leaderboard.length > 0 ? `${leaderboard.length}` : '—' },
                  { label: 'Твой XP', value: leaderboard.find(l => l.is_me)?.xp?.toString() ?? (profile?.xp_total?.toString() ?? '0') },
                ].map(s => (
                  <div key={s.label} className="bg-white/15 rounded-2xl py-2">
                    <p className="text-white font-extrabold text-base">{s.value}</p>
                    <p className="text-white/60 text-[10px]">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {leaderboard.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 shadow-sm text-center">
                <span className="text-4xl block mb-3">📊</span>
                <p className="font-bold text-gray-700">Рейтинг формируется</p>
                <p className="text-gray-400 text-sm mt-1">Занимайся больше — попади в топ</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Топ-3 отдельно */}
                {leaderboard.slice(0, 3).length > 0 && (
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-4 border border-amber-200">
                    <p className="text-amber-700 text-xs font-bold uppercase tracking-wide mb-3">🥇 Топ-3 недели</p>
                    <div className="flex gap-2 justify-around">
                      {leaderboard.slice(0, 3).map(item => (
                        <div key={item.rank} className={`flex flex-col items-center gap-1 flex-1 ${item.is_me ? 'scale-105' : ''}`}>
                          <div className={`text-2xl ${item.rank === 1 ? '' : 'mt-3'}`}>
                            {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : '🥉'}
                          </div>
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base font-bold border-2 ${
                            item.rank === 1 ? 'bg-yellow-400 text-white border-yellow-300' :
                            item.rank === 2 ? 'bg-gray-300 text-white border-gray-200' :
                            'bg-orange-300 text-white border-orange-200'
                          } ${item.is_me ? 'ring-2 ring-purple-400 ring-offset-1' : ''}`}>
                            {getLevelEmoji(item.level)}
                          </div>
                          <p className={`text-xs font-bold text-center truncate w-full px-1 ${item.is_me ? 'text-purple-700' : 'text-gray-700'}`}>
                            {item.is_me ? 'Ты' : item.name.split(' ')[0]}
                          </p>
                          <p className="text-[10px] text-gray-400">{item.xp} XP</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {leaderboard.map(item => (
                  <div
                    key={item.rank}
                    className={`rounded-2xl p-3.5 shadow-sm flex items-center gap-3 transition-all ${
                      item.is_me
                        ? 'bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-400 shadow-purple-100'
                        : 'bg-white border border-gray-100'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 text-sm font-extrabold ${
                      item.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow' :
                      item.rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                      item.rank === 3 ? 'bg-gradient-to-br from-orange-400 to-amber-400 text-white' :
                      item.is_me ? 'bg-purple-200 text-purple-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {item.rank <= 3 ? ['🥇','🥈','🥉'][item.rank-1] : item.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`font-bold text-sm truncate ${item.is_me ? 'text-purple-700' : 'text-gray-800'}`}>
                          {item.is_me ? 'Ты' : item.name.split(' ')[0]}
                        </p>
                        {item.subscription_type === 'premium' && (
                          <span className="text-[9px] bg-amber-100 text-amber-600 font-bold px-1.5 rounded-full flex-shrink-0">PRO</span>
                        )}
                        {item.is_me && (
                          <span className="text-[9px] bg-purple-100 text-purple-600 font-bold px-1.5 rounded-full flex-shrink-0">Вы</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-gray-400 text-xs">{getLevelEmoji(item.level)} Ур.{item.level}</p>
                        <span className="text-gray-200">·</span>
                        <p className="text-purple-500 text-xs font-bold">{item.xp} XP</p>
                      </div>
                    </div>
                    {item.streak > 0 && (
                      <div className="flex items-center gap-1 flex-shrink-0 bg-orange-50 rounded-xl px-2 py-1">
                        <span className="text-sm">🔥</span>
                        <span className="text-xs font-bold text-orange-600">{item.streak}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>

      <BottomNav />

      {rewardModal && (
        <RewardModal
          type={rewardModal.type}
          data={rewardModal.data}
          onClose={() => setRewardModal(null)}
        />
      )}
    </div>
  );
}