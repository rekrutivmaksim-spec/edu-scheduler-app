import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import ProfileAvatar from '@/components/ProfileAvatar';
import BottomNav from '@/components/BottomNav';
import { COMPANIONS, getCompanion, getCompanionStage, getCompanionFromStorage, saveCompanionToStorage, type CompanionId } from '@/lib/companion';
import { useLimits } from '@/hooks/useLimits';

const API_URL = 'https://functions.poehali.dev/0c04829e-3c05-40bd-a560-5dcd6c554dd5';
const GAMIFICATION_URL = 'https://functions.poehali.dev/0559fb04-cd62-4e50-bb12-dfd6941a7080';
const SUBSCRIPTION_URL = 'https://functions.poehali.dev/7fe183c2-49af-4817-95f3-6ab4912778c4';

const COST_PER_SESSION = 300;

function getDaysToExam(examDate?: string | null): number {
  if (!examDate || examDate === 'custom') return 0;
  const d = new Date(examDate);
  const now = new Date();
  return Math.max(0, Math.ceil((d.getTime() - now.getTime()) / 86400000));
}



const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState(authService.getUser());
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [streak, setStreak] = useState(0);
  const [totalDays, setTotalDays] = useState(0);
  const limits = useLimits();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCompanionPicker, setShowCompanionPicker] = useState(false);
  const [companionId, setCompanionId] = useState<CompanionId | null>(getCompanionFromStorage());

  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    grade: user?.grade || '',
    goal: user?.goal || 'ege',
    exam_subject: user?.exam_subject || '',
    exam_date: user?.exam_date || '',
  });

  useEffect(() => {
    const init = async () => {
      if (!authService.isAuthenticated()) { navigate('/auth'); return; }
      const verified = await authService.verifyToken();
      if (!verified) { navigate('/auth'); return; }
      setUser(verified);
      setFormData(f => ({
        ...f,
        full_name: verified.full_name || '',
        grade: verified.grade || '',
        goal: verified.goal || 'ege',
        exam_subject: verified.exam_subject || '',
        exam_date: verified.exam_date || '',
      }));
      loadGamification();
      loadSubscription();
    };
    init();
  }, [navigate]);

  const [totalExamTasks, setTotalExamTasks] = useState(0);

  const loadGamification = async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(GAMIFICATION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'get_profile' }),
      });
      if (res.ok) {
        const d = await res.json();
        setStreak(d.streak?.current || 0);
        setTotalDays(d.streak?.total_days || 0);
        setTotalExamTasks(d.stats?.total_exam_tasks || 0);
      }
    } catch { /* silent */ }
  };

  const loadSubscription = async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${SUBSCRIPTION_URL}?action=limits`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setIsPremium(d.subscription_type === 'premium' || !!d.is_trial);
      }
    } catch { /* silent */ }
  };

  const handleSave = async () => {
    if (!formData.full_name.trim()) {
      toast({ title: 'Ошибка', description: 'Имя не может быть пустым', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const token = authService.getToken();
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'update_profile',
          full_name: formData.full_name,
          grade: formData.grade || null,
          goal: formData.goal || null,
          exam_subject: formData.exam_subject || null,
          exam_date: formData.exam_date || null,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        localStorage.setItem('user', JSON.stringify(d.user));
        setUser(d.user);
        setIsEditing(false);
        toast({ title: 'Сохранено' });
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Проблема с подключением', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) { toast({ title: 'Введите пароль', variant: 'destructive' }); return; }
    setIsDeleting(true);
    try {
      const token = authService.getToken();
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'delete_account', password: deletePassword }),
      });
      const d = await res.json();
      if (res.ok) {
        authService.logout();
        toast({ title: 'Аккаунт удалён' });
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

  const changeCompanion = async (id: CompanionId) => {
    setCompanionId(id);
    setShowCompanionPicker(false);
    saveCompanionToStorage(id);
    try {
      const token = authService.getToken();
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'update_profile', companion: id }),
      });
    } catch { /* silent — localStorage уже обновлён */ }
  };

  const daysToExam = getDaysToExam(user?.exam_date);
  const savedMoney = totalDays * COST_PER_SESSION;
  const streakLabel = streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней';
  const topicsDone = Math.min(totalDays, 24);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* Шапка */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 px-4 pt-12 pb-6">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate('/')} className="text-white/70 p-1">
            <Icon name="ArrowLeft" size={20} />
          </button>
          <h1 className="text-white font-bold text-lg flex-1">Мой профиль</h1>
        </div>
        <div className="flex items-center gap-4">
          <ProfileAvatar userName={user?.full_name} size="md" />
          <div>
            <p className="text-white font-bold text-lg leading-tight">{user?.full_name}</p>
            <p className="text-white/60 text-sm">{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3 space-y-3 max-w-xl mx-auto">

        {/* КОМПАНЬОН */}
        {(() => {
          const comp = getCompanion(companionId);
          const stage = getCompanionStage(comp, streak > 0 ? streak : 1);
          return (
            <div className="bg-white rounded-3xl shadow-sm p-4">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${comp.style} flex items-center justify-center text-3xl shadow-sm flex-shrink-0`}>
                  {stage.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800">{comp.name} — {stage.title}</p>
                  <p className="text-gray-400 text-xs mt-0.5 truncate">"{stage.phrase}"</p>
                  <p className="text-purple-500 text-xs mt-1 font-medium">Серия {streak} дн. → {stage.title}</p>
                </div>
                <button
                  onClick={() => setShowCompanionPicker(true)}
                  className="text-xs text-gray-400 hover:text-purple-600 border border-gray-200 rounded-xl px-3 py-2 flex-shrink-0"
                >
                  Сменить
                </button>
              </div>

              {showCompanionPicker && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-700 mb-3">Выбери помощника:</p>
                  <div className="grid grid-cols-1 gap-2">
                    {COMPANIONS.map(c => (
                      <button
                        key={c.id}
                        onClick={() => changeCompanion(c.id)}
                        className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${
                          companionId === c.id ? 'border-purple-400 bg-purple-50' : 'border-gray-100 hover:border-purple-200'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.style} flex items-center justify-center text-xl flex-shrink-0`}>
                          {c.emoji}
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-gray-800 text-sm">{c.name}</p>
                          <p className="text-gray-400 text-xs">{c.description}</p>
                        </div>
                        {companionId === c.id && <span className="ml-auto text-purple-500 text-sm">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* 1. PREMIUM — главный блок */}
        {!isPremium ? (
          <div
            className="rounded-3xl overflow-hidden shadow-xl cursor-pointer active:scale-[0.98] transition-all"
            onClick={() => navigate('/pricing')}
          >
            <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🔥</span>
                <h2 className="text-white font-extrabold text-xl">Premium — учись без ограничений</h2>
              </div>
              <div className="space-y-2 mb-4">
                {[
                  'Безлимит занятий',
                  'Слабые темы определяются автоматически',
                  'Подготовка к ЕГЭ быстрее в 2 раза',
                  'Задавай вопросы без ограничений',
                ].map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0">
                      <Icon name="Check" size={10} className="text-white" />
                    </div>
                    <span className="text-white/90 text-sm">{f}</span>
                  </div>
                ))}
              </div>
              {/* Срочность — только для ЕГЭ/ОГЭ */}
              {(formData.goal === 'ege' || formData.goal === 'oge') && (
                <div className="bg-white/15 rounded-2xl px-4 py-2.5 mb-4 flex items-center gap-2">
                  <span className="text-base">🔥</span>
                  <p className="text-white text-xs">
                    До {formData.goal === 'oge' ? 'ОГЭ' : 'ЕГЭ'} <span className="font-bold">{daysToExam > 0 ? `${daysToExam} дней` : 'скоро'}</span> — осталось <span className="font-bold">{Math.max(0, 24 - Math.min(totalDays, 24))} тем</span>
                  </p>
                </div>
              )}
              <div className="flex items-center gap-3 mb-1">
                <Button onClick={() => navigate('/pricing')} className="flex-1 h-12 bg-white text-purple-700 font-extrabold text-base rounded-2xl shadow-lg">
                  Подключить Premium
                </Button>
                <div className="text-right flex-shrink-0">
                  <p className="text-white font-extrabold text-xl leading-none">449 ₽</p>
                  <p className="text-white/50 text-xs">в месяц</p>
                </div>
              </div>
              <p className="text-white/60 text-xs text-center mt-1.5">🔓 Отмена в любой момент · Бесплатно: 1 занятие сегодня</p>
            </div>
            {/* Потеря */}
            <div className="bg-purple-900/90 px-5 py-3 flex items-center gap-2">
              <span className="text-yellow-400 text-sm">⚠️</span>
              <p className="text-white/70 text-xs">
                Сегодня доступно: <span className="text-white font-semibold">1 занятие.</span> Остальное откроется с Premium
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-5 shadow-xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <Icon name="Crown" size={24} className="text-yellow-300" />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-base">Premium активен ✓</p>
                {limits.data.subscription_expires_at && (
                  <p className="text-white/60 text-sm">
                    до {new Date(limits.data.subscription_expires_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/15 rounded-2xl px-2 py-2">
                <p className="text-white font-bold text-sm">{limits.aiRemaining() >= 999 ? '∞' : limits.aiRemaining()}</p>
                <p className="text-white/60 text-[10px]">вопросов ИИ</p>
              </div>
              <div className="bg-white/15 rounded-2xl px-2 py-2">
                <p className="text-white font-bold text-sm">{limits.sessionsRemaining() >= 999 ? '∞' : limits.sessionsRemaining()}</p>
                <p className="text-white/60 text-[10px]">занятий</p>
              </div>
              <div className="bg-white/15 rounded-2xl px-2 py-2">
                <p className="text-white font-bold text-sm">{limits.materialsRemaining() >= 999 ? '∞' : limits.materialsRemaining()}</p>
                <p className="text-white/60 text-[10px]">загрузки</p>
              </div>
            </div>
          </div>
        )}

        {/* Рефералка — сразу под Premium */}
        {!isPremium && (
          <div
            className="bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 rounded-3xl p-4 shadow-lg cursor-pointer active:scale-[0.98] transition-all"
            onClick={() => navigate('/referral')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Icon name="Gift" size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">Пригласи друга</h3>
                  <p className="text-white/70 text-xs">+7 дней Premium бесплатно</p>
                </div>
              </div>
              <Icon name="ChevronRight" size={18} className="text-white/50" />
            </div>
          </div>
        )}

        {/* 2. Серия обучения */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🔥</span>
            <div>
              <h3 className="font-bold text-gray-800 text-base">Серия обучения</h3>
              <p className="text-gray-400 text-xs">Не прерывай — потеряешь прогресс</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-4xl font-extrabold text-orange-500">{streak}</p>
              <p className="text-gray-500 text-xs mt-0.5">{streakLabel} подряд</p>
            </div>
            <div className="flex-1">
              <div className="flex gap-1">
                {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((d, i) => {
                  const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
                  const active = i <= todayIdx && streak > 0 && i > todayIdx - streak;
                  const isToday = i === todayIdx;
                  return (
                    <div key={d} className="flex-1 flex flex-col items-center gap-1">
                      <div className={`w-full h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${isToday ? 'bg-orange-500 text-white' : active ? 'bg-orange-100 text-orange-500' : 'bg-gray-100 text-gray-300'}`}>
                        {(active || isToday) ? '✓' : ''}
                      </div>
                      <span className="text-[9px] text-gray-400">{d}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Прогресс */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">📊</span>
            <h3 className="font-bold text-gray-800">Твой прогресс</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-indigo-50 rounded-2xl p-3 text-center">
              <p className="text-2xl font-extrabold text-indigo-600">{topicsDone}</p>
              <p className="text-gray-500 text-[11px] mt-0.5 leading-tight">тем пройдено</p>
            </div>
            <div className="bg-purple-50 rounded-2xl p-3 text-center">
              <p className="text-2xl font-extrabold text-purple-600">{totalDays}</p>
              <p className="text-gray-500 text-[11px] mt-0.5 leading-tight">занятий</p>
            </div>
            <div className="bg-pink-50 rounded-2xl p-3 text-center">
              <p className="text-2xl font-extrabold text-pink-600">{totalExamTasks}</p>
              <p className="text-gray-500 text-[11px] mt-0.5 leading-tight">заданий решено</p>
            </div>
          </div>
        </div>

        {/* 4. До экзамена */}
        {(formData.goal === 'ege' || formData.goal === 'oge') ? (
          <div className="bg-white rounded-3xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🎯</span>
            </div>
            <div className="flex-1">
              <p className="text-gray-500 text-sm">До {formData.goal === 'oge' ? 'ОГЭ' : 'ЕГЭ'} осталось</p>
              <p className="text-3xl font-extrabold text-gray-800">{daysToExam > 0 ? daysToExam : '—'} <span className="text-base font-medium text-gray-500">{daysToExam > 0 ? 'дней' : ''}</span></p>
              <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-red-400 to-orange-400 rounded-full" style={{ width: `${daysToExam > 0 ? Math.round((1 - daysToExam / 365) * 100) : 100}%` }} />
              </div>
            </div>
            <button onClick={() => navigate('/session')} className="bg-indigo-600 text-white text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0">
              Занятие →
            </button>
          </div>
        ) : formData.goal === 'university' ? (
          <div className="bg-white rounded-3xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🏛️</span>
            </div>
            <div className="flex-1">
              <p className="text-gray-500 text-sm">Подготовка к сессии</p>
              <p className="text-base font-bold text-gray-800 mt-0.5">Разбирай конспекты каждый день</p>
            </div>
            <button onClick={() => navigate('/university')} className="bg-indigo-600 text-white text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0">
              Открыть →
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🤖</span>
            </div>
            <div className="flex-1">
              <p className="text-gray-500 text-sm">ИИ-помощник</p>
              <p className="text-base font-bold text-gray-800 mt-0.5">Задай любой вопрос по учёбе</p>
            </div>
            <button onClick={() => navigate('/assistant')} className="bg-indigo-600 text-white text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0">
              Открыть →
            </button>
          </div>
        )}

        {/* 5. Сэкономлено */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-50 rounded-2xl flex items-center justify-center flex-shrink-0">
              <span className="text-xl">💰</span>
            </div>
            <h3 className="font-bold text-gray-800">Сэкономлено на репетиторах</h3>
          </div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-400 text-xs">1 занятие ≈ <span className="font-semibold text-gray-600">{COST_PER_SESSION} ₽</span> у репетитора</p>
            {totalDays > 0 && <p className="text-green-500 text-xs font-semibold bg-green-50 px-2 py-1 rounded-lg">экономия реальная</p>}
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <p className="text-gray-500 text-xs mb-0.5">Уже сэкономлено:</p>
              <p className="text-4xl font-extrabold text-green-600 leading-none">
                {savedMoney.toLocaleString('ru-RU')} <span className="text-lg font-medium text-gray-400">₽</span>
              </p>
              <p className="text-gray-400 text-xs mt-1">
                {totalDays} {totalDays === 1 ? 'занятие' : totalDays < 5 ? 'занятия' : 'занятий'} × {COST_PER_SESSION} ₽
              </p>
            </div>
            {totalDays === 0 && (
              <button onClick={() => navigate('/session')} className="bg-green-500 text-white text-xs font-bold px-3 py-2 rounded-xl mb-1">
                Начать →
              </button>
            )}
          </div>
          {totalDays > 0 && (
            <div className="mt-3 bg-green-50 rounded-2xl px-4 py-2.5">
              <p className="text-green-700 text-xs font-medium">
                🚀 При 10 занятиях сэкономишь <span className="font-bold">{(10 * COST_PER_SESSION).toLocaleString('ru-RU')} ₽</span>
              </p>
            </div>
          )}
        </div>

        {/* 6. Быстрые действия */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">⚡</span>
            <h3 className="font-bold text-gray-800">Быстрые действия</h3>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => navigate(formData.goal === 'university' ? '/university' : '/session')}
              className="w-full flex items-center gap-3 py-3 px-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 transition-colors text-left"
            >
              <span className="text-xl">📖</span>
              <span className="text-indigo-700 text-sm font-semibold">
                {formData.goal === 'university' ? 'Открыть ВУЗ-помощник' : 'Начать занятие'}
              </span>
              <Icon name="ArrowRight" size={14} className="text-indigo-400 ml-auto" />
            </button>
            <button
              onClick={() => navigate('/assistant')}
              className="w-full flex items-center gap-3 py-3 px-3 rounded-2xl bg-purple-50 hover:bg-purple-100 transition-colors text-left"
            >
              <span className="text-xl">🤖</span>
              <span className="text-purple-700 text-sm font-semibold">Задать вопрос ИИ</span>
              <Icon name="ArrowRight" size={14} className="text-purple-400 ml-auto" />
            </button>
          </div>
        </div>

        {/* 8. Данные пользователя */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">Данные профиля</h3>
            {!isEditing && (
              <button onClick={() => setIsEditing(true)} className="text-indigo-600 text-sm font-semibold flex items-center gap-1">
                <Icon name="Edit2" size={14} />
                Изменить
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-gray-500 text-xs font-medium uppercase tracking-wide">Имя</Label>
              <Input
                value={formData.full_name}
                onChange={e => setFormData(f => ({ ...f, full_name: e.target.value }))}
                disabled={!isEditing}
                className="mt-1 rounded-xl border-2 border-gray-100 focus:border-indigo-400 disabled:opacity-70 disabled:bg-gray-50"
              />
            </div>
            <div>
              <Label className="text-gray-500 text-xs font-medium uppercase tracking-wide">Класс</Label>
              <Input
                value={formData.grade}
                onChange={e => setFormData(f => ({ ...f, grade: e.target.value }))}
                disabled={!isEditing}
                placeholder="Например: 11"
                className="mt-1 rounded-xl border-2 border-gray-100 focus:border-indigo-400 disabled:opacity-70 disabled:bg-gray-50"
              />
            </div>
            <div>
              <Label className="text-gray-500 text-xs font-medium uppercase tracking-wide">Цель</Label>
              <div className="flex gap-2 mt-1">
                {(['ege', 'oge', 'university'] as const).map(g => (
                  <button
                    key={g}
                    disabled={!isEditing}
                    onClick={() => setFormData(f => ({ ...f, goal: g }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all disabled:opacity-60 ${formData.goal === g ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-100 text-gray-400'}`}
                  >
                    {g === 'ege' ? 'ЕГЭ' : g === 'oge' ? 'ОГЭ' : 'ВУЗ'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isEditing && (
            <div className="flex gap-2 mt-5">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 h-11 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl"
              >
                {isSaving ? <Icon name="Loader2" size={16} className="animate-spin" /> : 'Сохранить'}
              </Button>
              <Button
                onClick={() => {
                  setFormData({
                    full_name: user?.full_name || '',
                    grade: user?.grade || '',
                    goal: user?.goal || 'ege',
                    exam_subject: user?.exam_subject || '',
                    exam_date: user?.exam_date || '',
                  });
                  setIsEditing(false);
                }}
                variant="outline"
                className="flex-1 h-11 rounded-2xl border-2 border-gray-200"
              >
                Отмена
              </Button>
            </div>
          )}
        </div>

        {/* Действия */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <button
            onClick={() => { authService.logout(); navigate('/login'); }}
            className="w-full flex items-center gap-3 py-3 text-left hover:bg-red-50 rounded-2xl px-2 transition-colors"
          >
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
              <Icon name="LogOut" size={16} className="text-red-500" />
            </div>
            <span className="text-red-600 font-semibold text-sm">Выйти из аккаунта</span>
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full flex items-center gap-3 py-3 text-left hover:bg-red-50 rounded-2xl px-2 transition-colors mt-1"
          >
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
              <Icon name="Trash2" size={16} className="text-red-500" />
            </div>
            <span className="text-red-500 text-sm">Удалить аккаунт</span>
          </button>
        </div>
      </div>

      <BottomNav />

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Icon name="Trash2" size={22} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Удалить аккаунт?</h3>
                <p className="text-sm text-gray-500">Это действие нельзя отменить</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4 bg-red-50 rounded-2xl p-3">
              Будут удалены: профиль, расписание, задачи, история занятий.
            </p>
            <div className="mb-4">
              <Label className="text-sm font-semibold text-gray-700 mb-2 block">Пароль для подтверждения</Label>
              <Input
                type="password"
                placeholder="Ваш пароль"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                className="rounded-xl border-2 border-gray-200 focus:border-red-400"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { setShowDeleteModal(false); setDeletePassword(''); }} disabled={isDeleting}>
                Отмена
              </Button>
              <Button variant="destructive" className="flex-1 rounded-xl" onClick={handleDeleteAccount} disabled={isDeleting}>
                {isDeleting ? 'Удаляем...' : 'Удалить'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;