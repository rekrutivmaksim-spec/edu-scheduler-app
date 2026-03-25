import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import { API } from '@/lib/api-urls';

interface LeaderEntry {
  rank: number;
  full_name: string;
  name?: string;
  xp_period: number;
  xp?: number;
  level: number;
  streak?: number;
  is_me?: boolean;
  subscription_type?: string;
}

interface FeedItem {
  id: string;
  user_name: string;
  event_type: string;
  description: string;
  created_at: string;
  emoji: string;
}

const MEDAL = ['🥇', '🥈', '🥉'];

export default function League() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'league' | 'feed'>('league');
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [myEntry, setMyEntry] = useState<LeaderEntry | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLeaderboard = useCallback(async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${API.GAMIFICATION}?action=leaderboard&period=week`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const list: LeaderEntry[] = (data.leaderboard || []).slice(0, 10).map((l: LeaderEntry) => ({
          ...l,
          full_name: l.full_name || l.name || 'Ученик',
          xp_period: l.xp_period ?? l.xp ?? 0,
        }));
        setLeaders(list);
        if (data.my_entry) {
          setMyEntry({ ...data.my_entry, full_name: data.my_entry.full_name || data.my_entry.name || 'Ты', xp_period: data.my_entry.xp_period ?? data.my_entry.xp ?? 0 });
        }
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  const loadFeed = useCallback(async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${API.GAMIFICATION}?action=activity_feed`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFeed(data.feed || data.events || []);
      }
    } catch {
      setFeed([
        { id: '1', user_name: 'Система', event_type: 'info', description: 'Лента скоро заработает! Заходи позже.', created_at: new Date().toISOString(), emoji: '📰' },
      ]);
    }
  }, []);

  useEffect(() => {
    if (!authService.isAuthenticated()) { navigate('/auth'); return; }
    loadLeaderboard();
    loadFeed();
  }, [navigate, loadLeaderboard, loadFeed]);

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'только что';
    if (mins < 60) return `${mins} мин назад`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ч назад`;
    const days = Math.floor(hrs / 24);
    return `${days} дн назад`;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 via-white to-orange-50 pb-20">
      <div className="px-5 pt-12 pb-3">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">🔥</span>
          <h1 className="text-xl font-extrabold text-gray-900">Лига</h1>
        </div>

        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => setTab('league')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              tab === 'league' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
            }`}
          >
            🏆 Топ-10
          </button>
          <button
            onClick={() => setTab('feed')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              tab === 'feed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
            }`}
          >
            📰 Лента
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-red-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === 'league' ? (
        <div className="px-5 space-y-2">
          {leaders.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-4xl block mb-3">🏆</span>
              <p className="text-gray-500 font-medium">Пока тут пусто</p>
              <p className="text-gray-400 text-sm mt-1">Занимайся — и попади в топ!</p>
            </div>
          ) : (
            <>
              {leaders.map((entry) => {
                const isMe = entry.is_me;
                const firstName = (entry.full_name || '').split(' ')[0] || 'Ученик';
                return (
                  <div
                    key={`${entry.rank}-${entry.full_name}`}
                    className={`rounded-2xl p-3.5 flex items-center gap-3 transition-all ${
                      isMe
                        ? 'bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 shadow-md'
                        : 'bg-white border border-gray-100 shadow-sm'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-extrabold ${
                      entry.rank <= 3
                        ? 'bg-amber-50'
                        : isMe
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {entry.rank <= 3 ? MEDAL[entry.rank - 1] : `#${entry.rank}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`font-bold text-sm truncate ${isMe ? 'text-purple-700' : 'text-gray-800'}`}>
                          {isMe ? 'Ты' : firstName}
                        </p>
                        {entry.subscription_type === 'premium' && (
                          <span className="text-[9px] bg-amber-100 text-amber-600 font-bold px-1.5 rounded-full">PRO</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">Ур.{entry.level} · {entry.xp_period} XP</p>
                    </div>
                    {entry.streak && entry.streak > 0 && (
                      <div className="flex items-center gap-1 bg-orange-50 rounded-lg px-2 py-1 flex-shrink-0">
                        <span className="text-xs">🔥</span>
                        <span className="text-xs font-bold text-orange-600">{entry.streak}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {myEntry && !leaders.find(l => l.is_me) && (
                <>
                  <div className="text-center text-gray-300 text-xs py-1">· · ·</div>
                  <div className="rounded-2xl p-3.5 flex items-center gap-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 shadow-md">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center bg-purple-100 text-purple-700 font-extrabold text-sm flex-shrink-0">
                      #{myEntry.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-purple-700">Ты</p>
                      <p className="text-xs text-gray-400 mt-0.5">Ур.{myEntry.level} · {myEntry.xp_period} XP</p>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="px-5 space-y-2.5">
          {feed.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-4xl block mb-3">📰</span>
              <p className="text-gray-500 font-medium">Пока тут тихо</p>
              <p className="text-gray-400 text-sm mt-1">Скоро тут появятся новости</p>
            </div>
          ) : (
            feed.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0 mt-0.5">{item.emoji || '📌'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">
                      <span className="font-bold">{item.user_name}</span>{' '}
                      {item.description}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(item.created_at)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
