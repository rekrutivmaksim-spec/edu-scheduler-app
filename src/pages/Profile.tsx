import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import ProfileAvatar from '@/components/ProfileAvatar';
import BottomNav from '@/components/BottomNav';
import { COMPANIONS, getCompanion, getCompanionStage, getCompanionFromStorage, saveCompanionToStorage, type CompanionId } from '@/lib/companion';
import { useLimits } from '@/hooks/useLimits';
import { API } from '@/lib/api-urls';
import { notificationService } from '@/lib/notifications';
import PaywallSheet from '@/components/PaywallSheet';
import { TOPICS_BY_SUBJECT } from '@/lib/topics';

const SUBJECT_NAMES: Record<string, string> = {
  ru: 'Русский язык',
  math_prof: 'Математика (профиль)',
  math_base: 'Математика (база)',
  physics: 'Физика',
  chemistry: 'Химия',
  biology: 'Биология',
  history: 'История',
  social: 'Обществознание',
  informatics: 'Информатика',
  english: 'Английский язык',
  geography: 'География',
  literature: 'Литература',
};

interface GamProfile {
  streak: { current: number; longest: number; total_days: number };
  level: number;
  xp_progress: number;
  xp_needed: number;
  stats?: { total_exam_tasks?: number };
  achievements?: Array<{ code: string; title: string; icon: string; is_unlocked: boolean }>;
}

function pluralDays(n: number) {
  if (n === 1) return 'день';
  if (n >= 2 && n <= 4) return 'дня';
  return 'дней';
}

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const limits = useLimits();
  const [user, setUser] = useState(authService.getUser());
  const [gam, setGam] = useState<GamProfile | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showCompanionPicker, setShowCompanionPicker] = useState(false);
  const [companionId, setCompanionId] = useState<CompanionId | null>(getCompanionFromStorage());
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const examSubject = user?.exam_subject || 'ru';
  const subjectTopics = TOPICS_BY_SUBJECT[examSubject] || [];
  const completedTopics = (() => {
    try {
      const raw = localStorage.getItem(`completed_topics_${examSubject}`);
      return raw ? (JSON.parse(raw) as number[]).length : 0;
    } catch { return 0; }
  })();

  const companion = getCompanion(companionId);
  const companionStage = getCompanionStage(companion, gam?.level ?? 1);

  const streak = gam?.streak?.current ?? 0;
  const longestStreak = gam?.streak?.longest ?? 0;
  const level = gam?.level ?? 0;
  const totalDays = gam?.streak?.total_days ?? 0;

  const achievements = gam?.achievements ?? [];
  const unlockedCount = achievements.filter(a => a.is_unlocked).length;
  const sortedAchievements = [...achievements].sort((a, b) => {
    if (a.is_unlocked && !b.is_unlocked) return -1;
    if (!a.is_unlocked && b.is_unlocked) return 1;
    return 0;
  });
  const visibleAchievements = sortedAchievements.slice(0, 5);

  useEffect(() => {
    const init = async () => {
      if (!authService.isAuthenticated()) { navigate('/auth'); return; }
      const verified = await authService.verifyToken();
      if (!verified) { navigate('/auth'); return; }
      setUser(verified);
      fetchGamification();
      const tok = authService.getToken();
      if (tok) {
        fetch(API.PUSH_NOTIFICATIONS, {
          headers: { Authorization: `Bearer ${tok}`, 'X-Authorization': `Bearer ${tok}` },
        }).then(r => r.json()).then(d => setPushSubscribed(!!d.subscribed)).catch(() => { /* silent */ });
      }
    };
    init();
  }, [navigate]);

  const fetchGamification = async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(API.GAMIFICATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'get_profile' }),
      });
      if (res.ok) setGam(await res.json());
    } catch { /* silent */ }
  };

  const changeCompanion = async (id: CompanionId) => {
    setCompanionId(id);
    setShowCompanionPicker(false);
    saveCompanionToStorage(id);
    try {
      const token = authService.getToken();
      await fetch(API.AUTH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'update_profile', companion: id }),
      });
    } catch { /* silent */ }
  };

  const togglePush = async () => {
    setPushLoading(true);
    try {
      const token = authService.getToken() || '';
      if (pushSubscribed) {
        await notificationService.unsubscribe(token);
        setPushSubscribed(false);
        toast({ title: 'Уведомления отключены' });
      } else {
        await notificationService.subscribe(token);
        const r = await fetch(API.PUSH_NOTIFICATIONS, {
          headers: { Authorization: `Bearer ${token}`, 'X-Authorization': `Bearer ${token}` },
        });
        const d = await r.json();
        setPushSubscribed(!!d.subscribed);
        if (d.subscribed) toast({ title: 'Уведомления включены' });
        else toast({ variant: 'destructive', title: 'Не удалось', description: 'Разреши уведомления в настройках' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Ошибка' });
    } finally {
      setPushLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePassword) { toast({ title: 'Введите пароль', variant: 'destructive' }); return; }
    setIsDeleting(true);
    try {
      const token = authService.getToken();
      const res = await fetch(API.AUTH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'delete_account', password: deletePassword }),
      });
      const d = await res.json();
      if (res.ok) {
        authService.logout();
        navigate('/auth');
      } else {
        toast({ title: 'Ошибка', description: d.error || 'Не удалось удалить', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка сети', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const isPremiumPaid = limits.isPremium && !limits.isTrial;
  const isTrial = limits.isTrial;
  const trialDaysLeft = limits.data.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(limits.data.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0;
  const premiumExpiry = limits.data.subscription_expires_at
    ? new Date(limits.data.subscription_expires_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    : '';

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-20">
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 px-4 pt-11 pb-6">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate(-1)} className="text-white/70 p-1">
            <Icon name="ArrowLeft" size={20} />
          </button>
          <h1 className="text-white font-bold text-lg">Профиль</h1>
        </div>
        <div className="flex flex-col items-center text-center">
          <ProfileAvatar userName={user?.full_name} size="md" />
          <p className="text-white font-bold text-lg mt-3">{user?.full_name}</p>
          <p className="text-white/50 text-sm">{user?.email}</p>
        </div>
      </div>

      <div className="px-4 -mt-3 space-y-3 max-w-xl mx-auto">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
            <p className="text-2xl font-extrabold text-orange-500">{streak}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">🔥 серия</p>
            <p className="text-[9px] text-gray-300">рекорд {longestStreak}</p>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
            <p className="text-2xl font-extrabold text-purple-600">{level}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">⭐ уровень</p>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
            <p className="text-2xl font-extrabold text-indigo-600">{totalDays}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">📚 занятий</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">
              {SUBJECT_NAMES[examSubject] || examSubject}
            </span>
            <span className="text-xs text-gray-400">{completedTopics}/{subjectTopics.length} тем</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${subjectTopics.length > 0 ? Math.round((completedTopics / subjectTopics.length) * 100) : 0}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${companion.style} flex items-center justify-center text-2xl flex-shrink-0`}>
                {companionStage.emoji}
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">{companion.name} — {companionStage.title}</p>
                <p className="text-[11px] text-gray-400 italic">"{companionStage.phrase}"</p>
              </div>
            </div>
            <button
              onClick={() => setShowCompanionPicker(!showCompanionPicker)}
              className="text-xs text-purple-600 font-medium px-2.5 py-1.5 rounded-lg border border-purple-200 flex-shrink-0"
            >
              {showCompanionPicker ? 'Скрыть' : 'Сменить'}
            </button>
          </div>
          {showCompanionPicker && (
            <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 gap-1.5">
              {COMPANIONS.map(c => (
                <button
                  key={c.id}
                  onClick={() => changeCompanion(c.id)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                    companionId === c.id ? 'border-purple-400 bg-purple-50' : 'border-gray-100'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${c.style} flex items-center justify-center text-lg flex-shrink-0`}>
                    {c.emoji}
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">{c.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{c.description}</p>
                  </div>
                  {companionId === c.id && <span className="text-purple-500 text-sm flex-shrink-0">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {visibleAchievements.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 text-sm">Достижения</h3>
              <span className="text-xs text-gray-400">{unlockedCount}/{achievements.length}</span>
            </div>
            <div className="space-y-2">
              {visibleAchievements.map(a => (
                <div key={a.code} className="flex items-center gap-3">
                  <span className={`text-lg ${a.is_unlocked ? '' : 'grayscale opacity-40'}`}>{a.icon}</span>
                  <span className={`text-sm flex-1 ${a.is_unlocked ? 'text-gray-700' : 'text-gray-400'}`}>{a.title}</span>
                  <span className="text-xs">{a.is_unlocked ? '✅' : '🔒'}</span>
                </div>
              ))}
            </div>
            {achievements.length > 5 && (
              <button
                onClick={() => navigate('/achievements')}
                className="mt-3 text-xs text-purple-600 font-medium"
              >
                Все достижения →
              </button>
            )}
          </div>
        )}

        {isPremiumPaid ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-lg">👑</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-700">Premium активен</p>
              {premiumExpiry && <p className="text-xs text-emerald-600/70">до {premiumExpiry}</p>}
            </div>
          </div>
        ) : isTrial ? (
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-lg">🎁</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-indigo-700">Premium бесплатно</p>
              <p className="text-xs text-indigo-600/70">
                {trialDaysLeft > 0 ? `Осталось ${trialDaysLeft} ${pluralDays(trialDaysLeft)}` : 'Заканчивается сегодня'}
              </p>
            </div>
            <button onClick={() => navigate('/pricing')} className="text-xs text-indigo-600 font-semibold border border-indigo-300 rounded-lg px-2.5 py-1.5">
              Продлить
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowPaywall(true)}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl px-4 py-3.5 flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <span className="text-lg">🚀</span>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-white">Перейти на Premium</p>
              <p className="text-xs text-white/60">Безлимит на все функции</p>
            </div>
            <span className="text-white/80 text-sm font-semibold">499 ₽/мес</span>
          </button>
        )}

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button onClick={togglePush} disabled={pushLoading} className="w-full flex items-center gap-3 px-4 py-3.5">
            <Icon name={pushSubscribed ? 'BellRing' : 'Bell'} size={18} className={pushSubscribed ? 'text-purple-600' : 'text-gray-400'} />
            <span className="flex-1 text-sm text-gray-700 text-left">Уведомления</span>
            {pushLoading ? (
              <Icon name="Loader2" size={16} className="text-gray-400 animate-spin" />
            ) : (
              <div className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${pushSubscribed ? 'bg-purple-600' : 'bg-gray-200'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${pushSubscribed ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            )}
          </button>
          <div className="h-px bg-gray-100 mx-4" />
          <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-3 px-4 py-3.5">
            <Icon name="Settings" size={18} className="text-gray-400" />
            <span className="flex-1 text-sm text-gray-700 text-left">Настройки</span>
            <Icon name="ChevronRight" size={16} className="text-gray-300" />
          </button>
          <div className="h-px bg-gray-100 mx-4" />
          <button
            onClick={() => { authService.logout(); navigate('/auth'); }}
            className="w-full flex items-center gap-3 px-4 py-3.5"
          >
            <Icon name="LogOut" size={18} className="text-red-400" />
            <span className="flex-1 text-sm text-red-500 text-left font-medium">Выйти</span>
          </button>
        </div>

        <button
          onClick={() => navigate('/referral')}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-4 shadow-md active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Icon name="Gift" size={20} className="text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-white font-bold text-sm">Пригласи друга</p>
              <p className="text-white/70 text-[11px] mt-0.5">Получи +7 дней Premium бесплатно</p>
            </div>
            <Icon name="ChevronRight" size={18} className="text-white/50" />
          </div>
        </button>

        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full text-center text-xs text-red-400 py-3"
        >
          Удалить аккаунт
        </button>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Icon name="Trash2" size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Удалить аккаунт?</h3>
                <p className="text-xs text-gray-500">Это нельзя отменить</p>
              </div>
            </div>
            <Input
              type="password"
              placeholder="Пароль для подтверждения"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              className="mb-3 rounded-xl"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }}>
                Отмена
              </Button>
              <Button variant="destructive" className="flex-1 rounded-xl" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? 'Удаляем...' : 'Удалить'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showPaywall && (
        <PaywallSheet trigger="session_limit" onClose={() => setShowPaywall(false)} />
      )}

      <BottomNav />
    </div>
  );
};

export default Profile;