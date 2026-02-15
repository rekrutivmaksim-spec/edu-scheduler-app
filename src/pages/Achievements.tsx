import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

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

interface GamificationProfile {
  level: number;
  xp_total: number;
  xp_progress: number;
  xp_needed: number;
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
}

interface LeaderItem {
  rank: number;
  name: string;
  university: string | null;
  level: number;
  xp: number;
  streak: number;
  is_me: boolean;
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
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeSection, setActiveSection] = useState('achievements');

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

  const loadLeaderboard = useCallback(async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}?action=leaderboard`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(Array.isArray(data) ? data : data.leaderboard || []);
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    }
  }, []);

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

  useEffect(() => {
    const init = async () => {
      if (!authService.isAuthenticated()) {
        navigate('/login');
        return;
      }
      setLoading(true);
      await Promise.all([loadProfile(), loadLeaderboard(), performCheckin()]);
      await loadProfile();
      setLoading(false);
    };
    init();
  }, [navigate, loadProfile, loadLeaderboard, performCheckin]);

  const filteredAchievements =
    profile?.achievements.filter(
      (a) => activeCategory === 'all' || a.category === activeCategory
    ) || [];

  const xpPercent =
    profile && profile.xp_needed > 0
      ? Math.min(100, Math.round((profile.xp_progress / profile.xp_needed) * 100))
      : 0;

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
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
                <h1 className="text-2xl font-heading font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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
            </div>
          </Card>
        )}

        {/* Level & XP Progress */}
        {profile && (
          <Card className="p-6 border-2 border-purple-200/50 shadow-md hover:scale-[1.02] transition-all">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <span className="text-3xl">{getLevelEmoji(profile.level)}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-heading font-bold text-gray-800">
                    Уровень {profile.level}
                  </h2>
                  <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0">
                    {profile.xp_total} XP
                  </Badge>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {profile.xp_progress} / {profile.xp_needed} XP до следующего уровня
                </p>
              </div>
            </div>
            <div className="relative w-full h-4 rounded-full bg-purple-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-700 ease-out"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
            <p className="text-right text-xs text-purple-500 mt-1 font-medium">
              {xpPercent}%
            </p>
          </Card>
        )}

        {/* Stats Summary */}
        {profile && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <Card className="p-4 border-2 border-green-200/50 hover:scale-[1.02] transition-all">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                  <Icon name="CheckSquare" size={16} className="text-green-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {profile.stats.total_tasks}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Задач выполнено</p>
            </Card>

            <Card className="p-4 border-2 border-red-200/50 hover:scale-[1.02] transition-all">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <Icon name="Timer" size={16} className="text-red-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {profile.stats.total_pomodoro_minutes}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Минут помодоро</p>
            </Card>

            <Card className="p-4 border-2 border-blue-200/50 hover:scale-[1.02] transition-all">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Icon name="Bot" size={16} className="text-blue-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {profile.stats.total_ai_questions}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Вопросов AI</p>
            </Card>

            <Card className="p-4 border-2 border-amber-200/50 hover:scale-[1.02] transition-all">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Icon name="FileUp" size={16} className="text-amber-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {profile.stats.total_materials}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Материалов</p>
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
            <div className="mt-4 space-y-2">
              {leaderboard.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Icon name="Users" size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Рейтинг пока пуст</p>
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
                        <p className="text-xs text-gray-400">XP</p>
                        <p className="text-sm font-bold text-purple-600">
                          {formatNumber(item.xp)}
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
