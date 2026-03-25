import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/icon';
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

const MEDAL_EMOJI = ['🥇', '🥈', '🥉'];
const MEDAL_BG = ['from-amber-400 to-yellow-500', 'from-gray-300 to-gray-400', 'from-amber-600 to-orange-700'];
const MEDAL_SHADOW = ['shadow-amber-200/60', 'shadow-gray-200/60', 'shadow-orange-200/60'];

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

  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1035] via-[#2d1b69] to-[#1a1035] pb-24">
      <div className="px-5 pt-12 pb-2">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Лига</h1>
            <p className="text-purple-300/60 text-[12px] font-medium mt-0.5">Еженедельный рейтинг</p>
          </div>
          <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-2 border border-white/10">
            <Icon name="Trophy" size={16} className="text-amber-400" />
            <span className="text-[12px] font-bold text-amber-300">Неделя</span>
          </div>
        </div>

        <div className="flex bg-white/10 rounded-2xl p-1 gap-1 border border-white/5">
          <button
            onClick={() => setTab('league')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
              tab === 'league' ? 'bg-white text-[#1a1035] shadow-lg' : 'text-white/50'
            }`}
          >
            <Icon name="Trophy" size={14} />
            Топ-10
          </button>
          <button
            onClick={() => setTab('feed')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
              tab === 'feed' ? 'bg-white text-[#1a1035] shadow-lg' : 'text-white/50'
            }`}
          >
            <Icon name="Activity" size={14} />
            Лента
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === 'league' ? (
        <div className="px-5">
          {leaders.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-white/10">
                <Icon name="Trophy" size={36} className="text-purple-300/50" />
              </div>
              <p className="text-white/70 font-bold text-[16px]">Пока тут пусто</p>
              <p className="text-white/30 text-[13px] mt-1">Занимайся — и попади в топ!</p>
            </div>
          ) : (
            <>
              {top3.length > 0 && (
                <div className="flex items-end justify-center gap-3 mt-4 mb-6 px-2">
                  {[1, 0, 2].map(idx => {
                    const entry = top3[idx];
                    if (!entry) return <div key={idx} className="flex-1" />;
                    const isFirst = idx === 0;
                    const isMe = entry.is_me;
                    const firstName = (entry.full_name || '').split(' ')[0] || 'Ученик';
                    return (
                      <div key={idx} className={`flex flex-col items-center ${isFirst ? 'order-2' : idx === 1 ? 'order-1' : 'order-3'}`}>
                        <div className="relative mb-2">
                          <div className={`${isFirst ? 'w-20 h-20' : 'w-16 h-16'} rounded-full bg-gradient-to-br ${MEDAL_BG[idx]} flex items-center justify-center shadow-xl ${MEDAL_SHADOW[idx]} border-2 ${isMe ? 'border-purple-400' : 'border-white/20'}`}>
                            <span className={`${isFirst ? 'text-3xl' : 'text-2xl'}`}>{MEDAL_EMOJI[idx]}</span>
                          </div>
                          {isFirst && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                              <span className="text-2xl">👑</span>
                            </div>
                          )}
                        </div>
                        <p className={`font-bold text-[13px] truncate max-w-[80px] text-center ${isMe ? 'text-purple-300' : 'text-white/90'}`}>
                          {isMe ? 'Ты' : firstName}
                        </p>
                        {entry.subscription_type === 'premium' && (
                          <span className="text-[8px] bg-amber-400/20 text-amber-300 font-bold px-1.5 py-0.5 rounded-full mt-0.5">PRO</span>
                        )}
                        <p className="text-[11px] text-white/40 font-medium mt-0.5">{entry.xp_period} XP</p>
                        <div className={`${isFirst ? 'h-24' : idx === 1 ? 'h-16' : 'h-12'} w-full mt-2 rounded-t-2xl bg-gradient-to-t ${
                          idx === 0 ? 'from-amber-500/30 to-amber-400/10' : idx === 1 ? 'from-gray-400/20 to-gray-300/5' : 'from-orange-500/20 to-orange-400/5'
                        } border border-white/5 flex items-end justify-center pb-2`}>
                          <span className={`font-extrabold ${isFirst ? 'text-3xl text-amber-400' : 'text-xl text-white/50'}`}>{entry.rank}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-2">
                {rest.map((entry) => {
                  const isMe = entry.is_me;
                  const firstName = (entry.full_name || '').split(' ')[0] || 'Ученик';
                  return (
                    <div
                      key={`${entry.rank}-${entry.full_name}`}
                      className={`rounded-2xl p-3.5 flex items-center gap-3 transition-all ${
                        isMe
                          ? 'bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-400/30'
                          : 'bg-white/5 border border-white/5'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-extrabold ${
                        isMe ? 'bg-purple-500/30 text-purple-300' : 'bg-white/10 text-white/40'
                      }`}>
                        #{entry.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`font-bold text-[13px] truncate ${isMe ? 'text-purple-200' : 'text-white/80'}`}>
                            {isMe ? 'Ты' : firstName}
                          </p>
                          {entry.subscription_type === 'premium' && (
                            <span className="text-[9px] bg-amber-400/20 text-amber-300 font-bold px-1.5 rounded-full">PRO</span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/30 mt-0.5">Ур.{entry.level} · {entry.xp_period} XP</p>
                      </div>
                      {entry.streak && entry.streak > 0 && (
                        <div className="flex items-center gap-1 bg-orange-500/15 rounded-lg px-2 py-1 flex-shrink-0 border border-orange-500/20">
                          <span className="text-[11px]">🔥</span>
                          <span className="text-[11px] font-bold text-orange-300">{entry.streak}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {myEntry && !leaders.find(l => l.is_me) && (
                <>
                  <div className="text-center text-white/20 text-xs py-2">· · ·</div>
                  <div className="rounded-2xl p-3.5 flex items-center gap-3 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-400/30">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center bg-purple-500/30 text-purple-300 font-extrabold text-sm flex-shrink-0">
                      #{myEntry.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[13px] text-purple-200">Ты</p>
                      <p className="text-[11px] text-white/30 mt-0.5">Ур.{myEntry.level} · {myEntry.xp_period} XP</p>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="px-5 space-y-2.5 mt-3">
          {feed.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-white/10">
                <Icon name="Activity" size={36} className="text-purple-300/50" />
              </div>
              <p className="text-white/70 font-bold text-[16px]">Пока тут тихо</p>
              <p className="text-white/30 text-[13px] mt-1">Скоро тут появятся новости</p>
            </div>
          ) : (
            feed.map((item) => (
              <div key={item.id} className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0 mt-0.5">{item.emoji || '📌'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-white/80 leading-relaxed">{item.description}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <p className="text-[11px] text-white/30 font-medium">{item.user_name}</p>
                      <span className="text-white/15">·</span>
                      <p className="text-[11px] text-white/20">{timeAgo(item.created_at)}</p>
                    </div>
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
