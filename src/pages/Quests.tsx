import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import PaywallSheet from '@/components/PaywallSheet';
import { useLimits } from '@/hooks/useLimits';
import { API } from '@/lib/api-urls';

interface Quest {
  id: number;
  type: string;
  title: string;
  target: number;
  current: number;
  xp_reward: number;
  is_completed: boolean;
  is_premium_only: boolean;
}

const QUEST_ICONS: Record<string, string> = {
  session: '🚀',
  ai_question: '🧠',
  flashcard: '🃏',
  material: '📎',
  streak: '🔥',
  pomodoro: '⏱️',
};

export default function Quests() {
  const navigate = useNavigate();
  const limits = useLimits();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  const [totalXp, setTotalXp] = useState(0);

  const fetchQuests = useCallback(async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${API.GAMIFICATION}?action=profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const dailyQuests: Quest[] = data.daily_quests || [];
        setQuests(dailyQuests);
        setTotalXp(dailyQuests.reduce((s: number, q: Quest) => s + q.xp_reward, 0));
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!authService.isAuthenticated()) { navigate('/auth'); return; }
    fetchQuests();
  }, [navigate, fetchQuests]);

  const completedCount = quests.filter(q => q.is_completed).length;
  const allDone = quests.length > 0 && completedCount === quests.length;
  const earnedXp = quests.filter(q => q.is_completed).reduce((s, q) => s + q.xp_reward, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-orange-50 pb-20">
      <div className="px-5 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">⚡</span>
          <h1 className="text-xl font-extrabold text-gray-900">Задания на сегодня</h1>
        </div>
        <p className="text-sm text-gray-400 ml-12">
          Выполняй задания — получай XP
        </p>
      </div>

      <div className="px-5 mb-4">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold">Прогресс</span>
            <span className="text-sm font-extrabold">{completedCount}/{quests.length}</span>
          </div>
          <div className="h-2.5 bg-white/25 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: quests.length > 0 ? `${(completedCount / quests.length) * 100}%` : '0%' }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/80">Заработано: {earnedXp} XP</span>
            {allDone ? (
              <span className="bg-white/25 rounded-lg px-2 py-0.5 font-bold">Все выполнены!</span>
            ) : (
              <span className="text-white/70">Всего: {totalXp} XP</span>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 space-y-2.5">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : quests.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-4xl block mb-3">⚡</span>
            <p className="text-gray-500 font-medium">Задания скоро появятся</p>
            <p className="text-gray-400 text-sm mt-1">Начни заниматься — и задания откроются</p>
          </div>
        ) : (
          quests.map((quest) => {
            const locked = quest.is_premium_only && !limits.isPremium;
            const pct = quest.target > 0 ? Math.min(100, Math.round((quest.current / quest.target) * 100)) : 0;
            const icon = QUEST_ICONS[quest.type] || '📌';

            return (
              <div
                key={quest.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border transition-all ${
                  quest.is_completed
                    ? 'border-green-200 bg-green-50/30'
                    : locked
                    ? 'border-gray-100 opacity-60'
                    : 'border-gray-100'
                }`}
                onClick={() => {
                  if (locked) setShowPaywall(true);
                }}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                    quest.is_completed ? 'bg-green-100' : locked ? 'bg-gray-100' : 'bg-amber-50'
                  }`}>
                    {quest.is_completed ? '✅' : locked ? '🔒' : icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-bold ${quest.is_completed ? 'text-green-700 line-through' : 'text-gray-800'}`}>
                        {quest.title}
                      </p>
                      {quest.is_premium_only && !limits.isPremium && (
                        <span className="text-[9px] bg-purple-100 text-purple-600 font-bold px-1.5 py-0.5 rounded-full">PRO</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            quest.is_completed ? 'bg-green-400' : 'bg-amber-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-gray-400 font-medium flex-shrink-0">
                        {quest.current}/{quest.target}
                      </span>
                    </div>
                  </div>
                  <div className={`flex-shrink-0 text-center px-2 py-1 rounded-lg ${
                    quest.is_completed ? 'bg-green-100' : 'bg-amber-50'
                  }`}>
                    <span className={`text-xs font-extrabold ${quest.is_completed ? 'text-green-600' : 'text-amber-600'}`}>
                      +{quest.xp_reward}
                    </span>
                    <p className="text-[9px] text-gray-400">XP</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {allDone && quests.length > 0 && (
        <div className="px-5 mt-6">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-5 text-center text-white">
            <span className="text-3xl block mb-2">🎉</span>
            <p className="font-extrabold text-lg">Все задания выполнены!</p>
            <p className="text-white/80 text-sm mt-1">+{totalXp} XP заработано сегодня</p>
          </div>
        </div>
      )}

      {showPaywall && (
        <PaywallSheet trigger="session_limit" onClose={() => setShowPaywall(false)} />
      )}

      <BottomNav />
    </div>
  );
}
