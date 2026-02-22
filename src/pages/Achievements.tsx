import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import UpgradeModal from '@/components/UpgradeModal';
import BottomNav from '@/components/BottomNav';

const API_URL = 'https://functions.poehali.dev/0559fb04-cd62-4e50-bb12-dfd6941a7080';

interface Achievement {
  code: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  xp_reward: number;
  requirement_value: number;
  current_progress: number;
  is_unlocked: boolean;
  unlocked_at: string | null;
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
  completed_at: string | null;
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
  streak: {
    current: number;
    longest: number;
    last_activity: string | null;
    total_days: number;
    freeze_available: number;
  };
  stats: {
    total_tasks: number;
    total_pomodoro_minutes: number;
    total_ai_questions: number;
    total_materials: number;
  };
  achievements: Achievement[];
  achievements_unlocked: number;
  achievements_total: number;
  recent_activity: { date: string; xp: number; tasks: number; pomodoro: number }[];
  daily_quests: DailyQuest[];
  streak_rewards: StreakReward[];
}

interface LeaderItem {
  rank: number;
  name: string;
  university: string | null;
  level: number;
  xp: number;
  streak: number;
  is_me: boolean;
  subscription_type: string;
}

interface CheckinResponse {
  success: boolean;
  streak: { current: number; longest: number };
  xp_gained: number;
  level: number;
  new_achievements: Achievement[];
}

function getLevelEmoji(level: number): string {
  if (level <= 10) return '\u{1F331}';
  if (level <= 20) return '\u{1F33F}';
  if (level <= 30) return '\u{1F333}';
  if (level <= 40) return '\u2B50';
  if (level <= 50) return '\u{1F31F}';
  if (level <= 60) return '\u{1F48E}';
  if (level <= 70) return '\u{1F451}';
  if (level <= 80) return '\u{1F3C6}';
  if (level <= 90) return '\u{1F525}';
  return '\u{1F680}';
}

function getRankIcon(rank: number): string {
  if (rank === 1) return '\u{1F947}';
  if (rank === 2) return '\u{1F948}';
  if (rank === 3) return '\u{1F949}';
  return '';
}

function getRankBg(rank: number): string {
  if (rank === 1) return 'bg-gradient-to-r from-yellow-100 to-amber-100 border-yellow-300';
  if (rank === 2) return 'bg-gradient-to-r from-gray-100 to-slate-200 border-gray-300';
  if (rank === 3) return 'bg-gradient-to-r from-orange-100 to-amber-100 border-orange-300';
  return 'bg-white/60 border-purple-100';
}

function getQuestEmoji(questType: string): string {
  const map: Record<string, string> = {
    complete_tasks: '\u2705',
    pomodoro_session: '\u{1F345}',
    ask_ai: '\u{1F916}',
    upload_material: '\u{1F4DA}',
    daily_checkin: '\u{1F44B}',
    complete_all_quests: '\u2B50',
  };
  return map[questType] || '\u{1F3AF}';
}

const CATEGORY_LABELS: Record<string, string> = {
  all: 'Все',
  streak: 'Серия',
  tasks: 'Задачи',
  study: 'Учёба',
  ai: 'AI',
  materials: 'Материалы',
  social: 'Соц.',
  special: 'Особые',
};

const Achievements = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderItem[]>([]);
  const [leaderPeriod, setLeaderPeriod] = useState<'today' | 'week' | 'all'>('today');
  const [leaderLoading, setLeaderLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const prevLeaderboardRef = useRef<LeaderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeSection, setActiveSection] = useState('achievements');
  const [claimingReward, setClaimingReward] = useState<number | null>(null);
  const [freezingStreak, setFreezingStreak] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeModalTrigger, setUpgradeModalTrigger] = useState<'streak_freeze' | 'daily_quest' | 'general'>('general');

  const loadProfile = useCallback(async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}?action=profile`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data: GamificationProfile = await res.json();
        setProfile(data);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  }, []);

  const loadLeaderboard = useCallback(async (period: 'today' | 'week' | 'all' = 'today', silent = false) => {
    if (!silent) setLeaderLoading(true);
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}?action=leaderboard&period=${period}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const newBoard: LeaderItem[] = Array.isArray(data) ? data : data.leaderboard || [];

        // Проверяем: обогнал ли кто-то текущего пользователя
        if (silent && prevLeaderboardRef.current.length > 0) {
          const myPrev = prevLeaderboardRef.current.find(l => l.is_me);
          const myNew = newBoard.find(l => l.is_me);
          if (myPrev && myNew && myNew.rank > myPrev.rank) {
            // Кто обогнал — тот, кто сейчас на позицию выше
            const overtaker = newBoard.find(l => l.rank === myNew.rank - 1);
            if (overtaker) {
              toast({
                title: '⚡ Тебя обогнали!',
                description: `${overtaker.name} обошёл тебя в рейтинге — займи своё место!`,
              });
            }
          }
          // Вышел в топ-3
          if (myNew && myNew.rank <= 3 && myPrev && myPrev.rank > 3) {
            toast({
              title: '🏆 Ты в топ-3!',
              description: 'Отличная работа — держись!',
            });
          }
        }

        prevLeaderboardRef.current = newBoard;
        setLeaderboard(newBoard);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      if (!silent) setLeaderLoading(false);
    }
  }, [toast]);

  const performCheckin = useCallback(async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'checkin' }),
      });
      if (res.ok) {
        const data: CheckinResponse = await res.json();
        if (data.new_achievements && data.new_achievements.length > 0) {
          data.new_achievements.forEach((ach) => {
            toast({
              title: `\u{1F3C6} Новое достижение!`,
              description: `${ach.title} (+${ach.xp_reward} XP)`,
            });
          });
        }
        if (data.xp_gained > 0) {
          toast({
            title: `\u2728 Ежедневный чекин`,
            description: `+${data.xp_gained} XP за вход`,
          });
        }
      }
    } catch (error) {
      console.error('Checkin failed:', error);
    }
  }, [toast]);

  const claimStreakReward = useCallback(async (streakDays: number) => {
    setClaimingReward(streakDays);
    try {
      const token = authService.getToken();
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'claim_streak_reward', streak_days: streakDays }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: '\u{1F381} Награда получена!',
          description: `${data.reward.title}: ${data.reward.description}`,
        });
        await loadProfile();
      } else {
        toast({
          title: 'Ошибка',
          description: data.error || 'Не удалось получить награду',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Claim reward failed:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось получить награду',
        variant: 'destructive',
      });
    } finally {
      setClaimingReward(null);
    }
  }, [toast, loadProfile]);

  const useStreakFreeze = useCallback(async () => {
    setFreezingStreak(true);
    try {
      const token = authService.getToken();
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'use_freeze' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: '\u{2744}\uFE0F Стрик заморожен!',
          description: 'Твоя серия в безопасности на сегодня',
        });
        await loadProfile();
      } else if (res.status === 403) {
        setUpgradeModalTrigger('streak_freeze');
        setUpgradeModalOpen(true);
      } else {
        toast({
          title: 'Ошибка',
          description: data.error || 'Не удалось заморозить стрик',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Freeze failed:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось заморозить стрик',
        variant: 'destructive',
      });
    } finally {
      setFreezingStreak(false);
    }
  }, [toast, loadProfile]);

  const shareStreak = useCallback(async () => {
    if (!profile) return;
    const text = `\u{1F525} Мой стрик в Studyfay: ${profile.streak.current} дней подряд! Уровень ${profile.level} (${profile.xp_total} XP). Присоединяйся: studyfay.ru`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // user cancelled
      }
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        toast({
          title: '\u{1F4CB} Скопировано!',
          description: 'Текст скопирован в буфер обмена',
        });
      } catch {
        toast({
          title: 'Ошибка',
          description: 'Не удалось скопировать',
          variant: 'destructive',
        });
      }
    }
  }, [profile, toast]);

  useEffect(() => {
    const init = async () => {
      if (!authService.isAuthenticated()) {
        navigate('/login');
        return;
      }
      setLoading(true);
      await Promise.all([loadProfile(), loadLeaderboard('today'), performCheckin()]);
      await loadProfile();
      setLoading(false);
    };
    init();
  }, [navigate, loadProfile, loadLeaderboard, performCheckin]);

  // Авто-обновление рейтинга каждые 30 сек когда открыт таб
  useEffect(() => {
    if (activeSection !== 'leaderboard') return;
    const interval = setInterval(() => {
      loadLeaderboard(leaderPeriod, true);
    }, 30000);
    return () => clearInterval(interval);
  }, [activeSection, leaderPeriod, loadLeaderboard]);

  // При смене периода — перезагружаем
  useEffect(() => {
    if (activeSection === 'leaderboard') {
      loadLeaderboard(leaderPeriod);
    }
  }, [leaderPeriod, activeSection, loadLeaderboard]);

  const filteredAchievements =
    profile?.achievements.filter(
      (a) => activeCategory === 'all' || a.category === activeCategory
    ) || [];

  const xpPercent =
    profile && profile.xp_needed > 0
      ? Math.min(100, Math.round((profile.xp_progress / profile.xp_needed) * 100))
      : 0;

  const completedQuestsCount = profile?.daily_quests?.filter((q) => q.is_completed).length || 0;
  const totalQuestsCount = profile?.daily_quests?.length || 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Icon name="Loader2" size={48} className="animate-spin text-purple-600" />
          <p className="text-purple-600 font-medium">Загрузка достижений...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-purple-200/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                className="rounded-xl hover:bg-purple-100/50 h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
              >
                <Icon name="ArrowLeft" size={24} className="text-purple-600" />
              </Button>
              <div>
                <h1 className="text-lg sm:text-2xl font-heading font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Достижения
                </h1>
                <p className="text-xs text-purple-600/70 font-medium">
                  Твой игровой прогресс
                </p>
              </div>
            </div>
            {profile && (
              <Badge className="bg-purple-600 text-white text-sm px-3 py-1">
                {profile.achievements_unlocked}/{profile.achievements_total}
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-20 md:pb-0">
        {/* Streak Widget */}
        {profile && (
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-5xl sm:text-6xl animate-pulse">
                    {profile.streak.current > 0 ? '\u{1F525}' : '\u{2744}\uFE0F'}
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl sm:text-5xl font-bold font-heading">
                        {profile.streak.current}
                      </span>
                      <span className="text-lg text-purple-200">
                        {getDaysWord(profile.streak.current)} подряд
                      </span>
                    </div>
                    <p className="text-purple-200 text-sm mt-1">
                      Лучшая серия: {profile.streak.longest}{' '}
                      {getDaysWord(profile.streak.longest)}
                    </p>
                  </div>
                </div>
                <div className="hidden sm:flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2 bg-white/15 rounded-xl px-4 py-2">
                    <Icon name="Calendar" size={16} className="text-purple-200" />
                    <span className="text-sm font-medium">
                      {profile.streak.total_days} дней всего
                    </span>
                  </div>
                  {profile.streak.freeze_available > 0 && (
                    <div className="flex items-center gap-2 bg-white/15 rounded-xl px-4 py-2">
                      <span className="text-base">{'\u{2744}\uFE0F'}</span>
                      <span className="text-sm font-medium">
                        {profile.streak.freeze_available} заморозк
                        {profile.streak.freeze_available === 1 ? 'а' : 'и'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {/* Mobile streak details */}
              <div className="flex sm:hidden items-center gap-3 mt-4">
                <div className="flex items-center gap-2 bg-white/15 rounded-xl px-3 py-1.5">
                  <Icon name="Calendar" size={14} className="text-purple-200" />
                  <span className="text-xs font-medium">
                    {profile.streak.total_days} дней
                  </span>
                </div>
                {profile.streak.freeze_available > 0 && (
                  <div className="flex items-center gap-2 bg-white/15 rounded-xl px-3 py-1.5">
                    <span className="text-sm">{'\u{2744}\uFE0F'}</span>
                    <span className="text-xs font-medium">
                      {profile.streak.freeze_available} заморозк
                      {profile.streak.freeze_available === 1 ? 'а' : 'и'}
                    </span>
                  </div>
                )}
              </div>
              {/* Streak Action Buttons */}
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                {profile.streak.current > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={useStreakFreeze}
                    disabled={freezingStreak}
                    className="bg-white/15 hover:bg-white/25 text-white border-0 rounded-xl text-xs h-8 px-3"
                  >
                    {freezingStreak ? (
                      <Icon name="Loader2" size={14} className="animate-spin mr-1.5" />
                    ) : (
                      <Icon name="Lock" size={14} className="mr-1.5" />
                    )}
                    Заморозка (Premium)
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={shareStreak}
                  className="bg-white/15 hover:bg-white/25 text-white border-0 rounded-xl text-xs h-8 px-3"
                >
                  <Icon name="Share2" size={14} className="mr-1.5" />
                  Поделиться
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Streak Rewards */}
        {profile && profile.streak_rewards && profile.streak_rewards.length > 0 && (
          <div>
            <h2 className="text-lg font-heading font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span>{'\u{1F381}'}</span> Награды за стрик
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4">
              {profile.streak_rewards.map((reward) => (
                <Card
                  key={reward.streak_days}
                  className={`flex-shrink-0 w-40 sm:w-48 p-4 border-2 transition-all ${
                    reward.is_claimed
                      ? 'border-green-300 bg-green-50/80'
                      : reward.is_available
                        ? 'border-amber-300 bg-gradient-to-b from-amber-50 to-orange-50 shadow-md hover:scale-[1.03]'
                        : 'border-gray-200 bg-gray-50/60 opacity-70'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1">
                      {reward.is_claimed ? '\u2705' : reward.is_available ? '\u{1F525}' : '\u{1F512}'}
                    </div>
                    <p className="text-lg font-bold text-gray-800">
                      {reward.streak_days} {getDaysWord(reward.streak_days)}
                    </p>
                    <p className="text-xs font-semibold text-gray-700 mt-1 line-clamp-1">
                      {reward.title}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 min-h-[28px]">
                      {reward.description}
                    </p>
                    <div className="mt-3">
                      {reward.is_claimed ? (
                        <div className="flex items-center justify-center gap-1 text-green-600 text-xs font-medium">
                          <Icon name="CheckCircle" size={14} />
                          <span>Получено</span>
                        </div>
                      ) : reward.is_available ? (
                        <Button
                          size="sm"
                          onClick={() => claimStreakReward(reward.streak_days)}
                          disabled={claimingReward === reward.streak_days}
                          className="w-full h-7 text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 rounded-lg"
                        >
                          {claimingReward === reward.streak_days ? (
                            <Icon name="Loader2" size={12} className="animate-spin" />
                          ) : (
                            'Получить'
                          )}
                        </Button>
                      ) : (
                        <div className="flex items-center justify-center gap-1 text-gray-400 text-xs">
                          <Icon name="Lock" size={12} />
                          <span>Недоступно</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Daily Quests */}
        {profile && profile.daily_quests && profile.daily_quests.length > 0 && (
          <Card className="border-2 border-amber-300/60 shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-b border-amber-200/60 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
                    <Icon name="Scroll" size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-heading font-bold text-gray-800">
                      Ежедневные квесты
                    </h2>
                    <p className="text-xs text-gray-500">
                      Выполнено {completedQuestsCount} из {totalQuestsCount}
                    </p>
                  </div>
                </div>
                <Badge
                  className={`text-xs px-2.5 py-1 ${
                    completedQuestsCount === totalQuestsCount && totalQuestsCount > 0
                      ? 'bg-green-100 text-green-700 border-green-300'
                      : 'bg-amber-100 text-amber-700 border-amber-300'
                  }`}
                >
                  {completedQuestsCount}/{totalQuestsCount}
                </Badge>
              </div>
              {/* quest completion bar */}
              {totalQuestsCount > 0 && (
                <div className="mt-3 relative w-full h-2 rounded-full bg-amber-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                    style={{ width: `${Math.round((completedQuestsCount / totalQuestsCount) * 100)}%` }}
                  />
                </div>
              )}
            </div>
            <div className="divide-y divide-gray-100">
              {profile.daily_quests.map((quest) => {
                const questProgress = quest.target > 0
                  ? Math.min(100, Math.round((quest.current / quest.target) * 100))
                  : 0;
                const isPremiumQuest = quest.is_premium_only;
                return (
                  <div
                    key={quest.id}
                    className={`px-5 py-3.5 flex items-center gap-3 transition-colors ${
                      quest.is_completed ? 'bg-green-50/50' : 'hover:bg-amber-50/30'
                    }`}
                  >
                    {/* Status icon */}
                    <div className="flex-shrink-0">
                      {quest.is_completed ? (
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <Icon name="Check" size={16} className="text-green-600" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                          <span className="text-base leading-none">{getQuestEmoji(quest.type)}</span>
                        </div>
                      )}
                    </div>
                    {/* Quest info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p
                          className={`text-sm font-medium truncate ${
                            quest.is_completed ? 'text-green-700 line-through' : 'text-gray-800'
                          }`}
                        >
                          {quest.title}
                        </p>
                        {isPremiumQuest && (
                          <Icon name="Crown" size={12} className="text-amber-500 flex-shrink-0" />
                        )}
                      </div>
                      {!quest.is_completed && (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 relative h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300"
                              style={{ width: `${questProgress}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-gray-400 font-medium flex-shrink-0">
                            {quest.current}/{quest.target}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* XP badge */}
                    <Badge
                      variant="secondary"
                      className={`text-[11px] px-2 py-0.5 flex-shrink-0 ${
                        quest.is_completed
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      +{quest.xp_reward} XP
                    </Badge>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Level & XP Progress */}
        {profile && (
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-5 text-white">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shadow-lg flex-shrink-0 text-3xl">
                  {getLevelEmoji(profile.level)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold">Уровень {profile.level}</h2>
                    <span className="text-sm bg-white/20 rounded-full px-2.5 py-0.5 font-medium">{profile.xp_total} XP</span>
                    {profile.is_premium && (
                      <span className="text-[11px] bg-amber-400/30 border border-amber-300/50 rounded-full px-2 py-0.5 flex items-center gap-1">
                        <Icon name="Crown" size={10} /> Premium
                      </span>
                    )}
                  </div>
                  <p className="text-purple-200 text-sm mt-0.5">
                    Ещё <strong className="text-white">{profile.xp_needed - profile.xp_progress} XP</strong> до уровня {profile.level + 1}
                  </p>
                </div>
              </div>
              <div className="relative w-full h-3 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-white transition-all duration-700 ease-out"
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-xs text-purple-200">
                <span>{profile.xp_progress} / {profile.xp_needed} XP</span>
                <span>{xpPercent}% до следующего уровня</span>
              </div>
            </div>
            <div className="bg-white px-5 py-3 flex items-start gap-2">
              <Icon name="Zap" size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-600 leading-relaxed">
                <strong className="text-gray-800">Как быстрее расти:</strong> выполняй задачи (+5 XP), запускай помодоро (+10 XP), задавай вопросы ИИ (+3 XP), загружай конспекты (+15 XP)
              </p>
            </div>
          </Card>
        )}

        {/* Stats Summary */}
        {profile && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card
              className="p-4 border-0 shadow-md bg-white cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all"
              onClick={() => navigate('/')}
            >
              <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center mb-3">
                <Icon name="CheckSquare" size={18} className="text-green-600" />
              </div>
              <p className="text-2xl font-bold text-gray-800">{profile.stats.total_tasks}</p>
              <p className="text-xs text-gray-500 mt-0.5">Задач выполнено</p>
              <p className="text-[10px] text-green-600 font-medium mt-1">+5 XP каждая</p>
            </Card>

            <Card
              className="p-4 border-0 shadow-md bg-white cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all"
              onClick={() => navigate('/pomodoro')}
            >
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center mb-3">
                <Icon name="Timer" size={18} className="text-red-600" />
              </div>
              <p className="text-2xl font-bold text-gray-800">{profile.stats.total_pomodoro_minutes}</p>
              <p className="text-xs text-gray-500 mt-0.5">Минут помодоро</p>
              <p className="text-[10px] text-red-600 font-medium mt-1">+10 XP/сессия</p>
            </Card>

            <Card
              className="p-4 border-0 shadow-md bg-white cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all"
              onClick={() => navigate('/assistant')}
            >
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                <Icon name="Bot" size={18} className="text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-800">{profile.stats.total_ai_questions}</p>
              <p className="text-xs text-gray-500 mt-0.5">Вопросов ИИ</p>
              <p className="text-[10px] text-blue-600 font-medium mt-1">+3 XP каждый</p>
            </Card>

            <Card
              className="p-4 border-0 shadow-md bg-white cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all"
              onClick={() => navigate('/materials')}
            >
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
                <Icon name="FileUp" size={18} className="text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-gray-800">{profile.stats.total_materials}</p>
              <p className="text-xs text-gray-500 mt-0.5">Материалов</p>
              <p className="text-[10px] text-amber-600 font-medium mt-1">+15 XP каждый</p>
            </Card>
          </div>
        )}

        {/* Section Tabs: Achievements / Leaderboard */}
        <Tabs value={activeSection} onValueChange={setActiveSection}>
          <TabsList className="w-full bg-white/70 backdrop-blur-sm border border-purple-200/50 h-12">
            <TabsTrigger value="achievements" className="flex-1 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <Icon name="Trophy" size={16} className="mr-2" />
              Достижения
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex-1 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <Icon name="Crown" size={16} className="mr-2" />
              Рейтинг
            </TabsTrigger>
          </TabsList>

          {/* Achievements Tab */}
          <TabsContent value="achievements">
            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 mt-4 scrollbar-hide">
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <Button
                  key={key}
                  variant={activeCategory === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveCategory(key)}
                  className={
                    activeCategory === key
                      ? 'bg-purple-600 hover:bg-purple-700 text-white flex-shrink-0'
                      : 'border-purple-200 text-purple-700 hover:bg-purple-50 flex-shrink-0'
                  }
                >
                  {label}
                </Button>
              ))}
            </div>

            {/* Achievements Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {filteredAchievements.map((achievement) => {
                const progressPercent =
                  achievement.requirement_value > 0
                    ? Math.min(
                        100,
                        Math.round(
                          (achievement.current_progress /
                            achievement.requirement_value) *
                            100
                        )
                      )
                    : 0;

                return (
                  <Card
                    key={achievement.code}
                    className={`p-4 border-2 hover:scale-[1.02] transition-all relative overflow-hidden ${
                      achievement.is_unlocked
                        ? 'border-purple-300/70 bg-white shadow-md'
                        : 'border-gray-200/50 bg-gray-50/50'
                    }`}
                  >
                    {achievement.is_unlocked && (
                      <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
                        <div className="absolute top-2 right-[-20px] w-[80px] bg-gradient-to-r from-green-400 to-emerald-500 text-white text-[10px] font-bold text-center transform rotate-45 shadow-sm">
                          <Icon name="Check" size={10} className="inline" />
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          achievement.is_unlocked
                            ? 'bg-gradient-to-br from-purple-100 to-indigo-100'
                            : 'bg-gray-100'
                        }`}
                      >
                        <span
                          className={`text-2xl ${
                            achievement.is_unlocked ? '' : 'grayscale opacity-40'
                          }`}
                        >
                          <Icon
                            name={achievement.icon}
                            size={24}
                            className={
                              achievement.is_unlocked
                                ? 'text-purple-600'
                                : 'text-gray-400'
                            }
                          />
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3
                            className={`text-sm font-semibold truncate ${
                              achievement.is_unlocked
                                ? 'text-gray-800'
                                : 'text-gray-400'
                            }`}
                          >
                            {achievement.title}
                          </h3>
                        </div>
                        <p
                          className={`text-xs mt-0.5 line-clamp-2 ${
                            achievement.is_unlocked
                              ? 'text-gray-500'
                              : 'text-gray-400'
                          }`}
                        >
                          {achievement.description}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span
                          className={
                            achievement.is_unlocked
                              ? 'text-purple-600 font-medium'
                              : 'text-gray-400'
                          }
                        >
                          {achievement.current_progress} /{' '}
                          {achievement.requirement_value}
                        </span>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0 ${
                            achievement.is_unlocked
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          +{achievement.xp_reward} XP
                        </Badge>
                      </div>
                      <div className="relative w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            achievement.is_unlocked
                              ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                              : 'bg-gradient-to-r from-purple-300 to-indigo-400'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {achievement.is_unlocked && achievement.unlocked_at && (
                      <p className="text-[10px] text-green-600 mt-2 flex items-center gap-1">
                        <Icon name="CheckCircle" size={10} />
                        Получено{' '}
                        {new Date(achievement.unlocked_at).toLocaleDateString(
                          'ru-RU',
                          { day: 'numeric', month: 'short' }
                        )}
                      </p>
                    )}
                  </Card>
                );
              })}
              {filteredAchievements.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-400">
                  <Icon name="Search" size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Нет достижений в этой категории</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard">
            {/* Период + индикатор обновления */}
            <div className="mt-4 mb-3 flex items-center justify-between gap-2">
              <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                {([
                  { key: 'today', label: '📅 Сегодня' },
                  { key: 'week', label: '📆 Неделя' },
                  { key: 'all', label: '🏆 Всё время' },
                ] as { key: 'today' | 'week' | 'all'; label: string }[]).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setLeaderPeriod(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      leaderPeriod === key
                        ? 'bg-white shadow text-purple-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                {leaderLoading ? (
                  <Icon name="Loader2" size={12} className="animate-spin text-purple-400" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse" />
                )}
                {lastUpdated && !leaderLoading && (
                  <span>{lastUpdated.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                )}
              </div>
            </div>

            {/* Описание периода */}
            <div className="mb-3 px-1">
              <p className="text-xs text-gray-500">
                {leaderPeriod === 'today' && '⚡ XP, заработанные сегодня. Обновляется каждые 30 сек'}
                {leaderPeriod === 'week' && '📆 XP за текущую неделю (с понедельника)'}
                {leaderPeriod === 'all' && '🏆 Общий рейтинг за всё время'}
              </p>
            </div>

            <div className="space-y-2">
              {leaderLoading && leaderboard.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Icon name="Loader2" size={36} className="mx-auto mb-3 animate-spin opacity-40" />
                  <p className="font-medium">Загружаем рейтинг...</p>
                </div>
              )}
              {!leaderLoading && leaderboard.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Icon name="Users" size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">
                    {leaderPeriod === 'today' ? 'Пока никто не набрал XP сегодня — будь первым!' : 'Рейтинг пока пуст'}
                  </p>
                </div>
              )}
              {leaderboard.map((item) => (
                <Card
                  key={`${item.rank}-${item.name}`}
                  className={`p-3 sm:p-4 border-2 hover:scale-[1.01] transition-all ${
                    item.is_me
                      ? 'border-purple-400 bg-purple-50/80 shadow-md ring-2 ring-purple-300/50'
                      : getRankBg(item.rank)
                  }`}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    {/* Rank */}
                    <div className="w-10 sm:w-12 flex-shrink-0 text-center">
                      {item.rank <= 3 ? (
                        <span className="text-2xl sm:text-3xl">
                          {getRankIcon(item.rank)}
                        </span>
                      ) : (
                        <span className="text-lg sm:text-xl font-bold text-gray-400">
                          #{item.rank}
                        </span>
                      )}
                    </div>

                    {/* Avatar + Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {getLevelEmoji(item.level)}
                        </span>
                        <h3
                          className={`text-sm sm:text-base font-semibold truncate ${
                            item.is_me ? 'text-purple-700' : 'text-gray-800'
                          }`}
                        >
                          {item.name}
                          {item.subscription_type === 'premium' && (
                            <span className="ml-1" title="Premium">{'\u{1F451}'}</span>
                          )}
                          {item.is_me && (
                            <span className="text-xs text-purple-500 ml-1">
                              (вы)
                            </span>
                          )}
                        </h3>
                      </div>
                      {item.university && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {item.university}
                        </p>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                      <div className="text-center hidden sm:block">
                        <p className="text-xs text-gray-400">Уровень</p>
                        <p className="text-sm font-bold text-indigo-600">
                          {item.level}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-400">
                          {leaderPeriod === 'today' ? 'XP сег.' : leaderPeriod === 'week' ? 'XP нед.' : 'XP'}
                        </p>
                        <p className="text-sm font-bold text-purple-600">
                          +{formatNumber(item.xp)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-400 flex items-center gap-0.5">
                          <span>{'\u{1F525}'}</span>
                          <span className="hidden sm:inline">Серия</span>
                        </p>
                        <p className="text-sm font-bold text-orange-500">
                          {item.streak}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Upgrade Modal */}
      <UpgradeModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        feature="Заморозка стрика"
        description="С Premium подпиской ты можешь заморозить свой стрик 1 раз в неделю и не потерять прогресс"
        trigger={upgradeModalTrigger}
      />

      <BottomNav />
    </div>
  );
};

function getDaysWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const lastDigit = abs % 10;
  if (abs >= 11 && abs <= 14) return 'дней';
  if (lastDigit === 1) return 'день';
  if (lastDigit >= 2 && lastDigit <= 4) return 'дня';
  return 'дней';
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export default Achievements;