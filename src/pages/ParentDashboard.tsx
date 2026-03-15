import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { API } from '@/lib/api-urls';

interface DashboardData {
  child: {
    full_name: string;
    subscription_type: string;
    subscription_expires_at: string | null;
  };
  streak: {
    current_streak: number;
    longest_streak: number;
    total_active_days: number;
    last_activity_date: string | null;
  };
  today: {
    tasks_completed: number;
    pomodoro_minutes: number;
    ai_questions_asked: number;
    exam_tasks_done: number;
    xp_earned: number;
  };
  week: Array<{
    date: string;
    tasks: number;
    pomodoro: number;
    ai: number;
    xp: number;
  }>;
  level: { level: number; xp_total: number };
  achievements: Array<{ name: string; icon: string; unlocked_at: string }>;
  grades: { gpa: number | null; total_subjects: number };
  study_plans: Array<{
    subject: string;
    total_days: number;
    completed_days: number;
    exam_date: string;
  }>;
  limits: {
    daily_questions_used: number;
    daily_questions_limit: number;
    bonus_questions: number;
  };
  parent_expires_at: string;
}

const ParentDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'grades'>('overview');
  const [activityHistory, setActivityHistory] = useState<Array<{
    date: string;
    tasks_completed: number;
    pomodoro_minutes: number;
    ai_questions_asked: number;
    exam_tasks_done: number;
    xp_earned: number;
  }>>([]);
  const [gradesData, setGradesData] = useState<Array<{
    semester: number;
    subjects: Array<{ name: string; grade: number; grade_type: string }>;
  }>>([]);

  useEffect(() => {
    const token = localStorage.getItem('parent_token');
    if (!token) { navigate('/parent/auth'); return; }
    loadDashboard(token);
  }, [navigate]);

  const loadDashboard = async (token: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API.PARENT_DASHBOARD}?action=dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.status === 403) {
        navigate('/parent/pay');
        return;
      }
      if (response.status === 401) {
        localStorage.removeItem('parent_token');
        navigate('/parent/auth');
        return;
      }

      if (response.ok) {
        const d = await response.json();
        setData(d);
      }
    } catch {
      toast({ title: 'Ошибка загрузки', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadActivity = async () => {
    const token = localStorage.getItem('parent_token');
    try {
      const response = await fetch(`${API.PARENT_DASHBOARD}?action=activity_history&days=30`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const d = await response.json();
        setActivityHistory(d.activity || []);
      }
    } catch { /* silent */ }
  };

  const loadGrades = async () => {
    const token = localStorage.getItem('parent_token');
    try {
      const response = await fetch(`${API.PARENT_DASHBOARD}?action=grades`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const d = await response.json();
        setGradesData(d.semesters || []);
      }
    } catch { /* silent */ }
  };

  const handleTabChange = (tab: 'overview' | 'activity' | 'grades') => {
    setActiveTab(tab);
    if (tab === 'activity' && activityHistory.length === 0) loadActivity();
    if (tab === 'grades' && gradesData.length === 0) loadGrades();
  };

  const handleLogout = () => {
    localStorage.removeItem('parent_token');
    localStorage.removeItem('parent_info');
    navigate('/parent/auth');
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center">
        <Icon name="Loader2" size={48} className="animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!data) return null;

  const childName = data.child.full_name || 'Ребёнок';
  const isChildPremium = data.child.subscription_type === 'premium';
  const wasActiveToday = data.today.xp_earned > 0;
  const streakEmoji = data.streak.current_streak >= 7 ? '🔥' : data.streak.current_streak >= 3 ? '⚡' : '📚';

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-4 shadow-lg">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-xs font-medium">Кабинет родителя</p>
            <h1 className="text-lg font-bold">{childName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => loadDashboard(localStorage.getItem('parent_token') || '')}
              className="text-white/80 hover:text-white hover:bg-white/10 rounded-xl"
            >
              <Icon name="RefreshCw" size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-white/80 hover:text-white hover:bg-white/10 rounded-xl"
            >
              <Icon name="LogOut" size={18} />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm">
          {[
            { id: 'overview' as const, label: 'Обзор', icon: 'LayoutDashboard' },
            { id: 'activity' as const, label: 'Активность', icon: 'Activity' },
            { id: 'grades' as const, label: 'Оценки', icon: 'GraduationCap' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon name={tab.icon} size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-4">

            <Card className={`p-4 ${wasActiveToday ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${wasActiveToday ? 'bg-green-500' : 'bg-orange-400'}`}>
                  <Icon name={wasActiveToday ? 'CheckCircle' : 'AlertCircle'} size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">
                    {wasActiveToday ? 'Сегодня занимался' : 'Сегодня пока не занимался'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {wasActiveToday
                      ? `+${data.today.xp_earned} XP · ${data.today.tasks_completed} задач · ${data.today.pomodoro_minutes} мин`
                      : 'Ребёнок ещё не открывал приложение сегодня'
                    }
                  </p>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3 text-center">
                <div className="text-2xl mb-0.5">{streakEmoji}</div>
                <div className="text-2xl font-extrabold text-gray-900">{data.streak.current_streak}</div>
                <div className="text-[10px] text-gray-500">дней подряд</div>
              </Card>
              <Card className="p-3 text-center">
                <div className="text-2xl mb-0.5">⭐</div>
                <div className="text-2xl font-extrabold text-gray-900">{data.level.level}</div>
                <div className="text-[10px] text-gray-500">уровень</div>
              </Card>
              <Card className="p-3 text-center">
                <div className="text-2xl mb-0.5">📅</div>
                <div className="text-2xl font-extrabold text-gray-900">{data.streak.total_active_days}</div>
                <div className="text-[10px] text-gray-500">дней учёбы</div>
              </Card>
            </div>

            <Card className="p-4">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Icon name="BarChart3" size={16} className="text-indigo-600" />
                Сегодня
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Задач выполнено', value: data.today.tasks_completed, icon: '📝' },
                  { label: 'Минут фокуса', value: data.today.pomodoro_minutes, icon: '⏱' },
                  { label: 'Вопросов к ИИ', value: data.today.ai_questions_asked, icon: '🤖' },
                  { label: 'Задач ЕГЭ/ОГЭ', value: data.today.exam_tasks_done, icon: '🎓' },
                ].map((stat, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3 flex items-center gap-2.5">
                    <span className="text-lg">{stat.icon}</span>
                    <div>
                      <div className="text-lg font-bold text-gray-900">{stat.value}</div>
                      <div className="text-[10px] text-gray-500">{stat.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {data.week.length > 0 && (
              <Card className="p-4">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Icon name="TrendingUp" size={16} className="text-indigo-600" />
                  Неделя
                </h3>
                <div className="flex items-end gap-1.5 h-24">
                  {data.week.map((day, i) => {
                    const maxXp = Math.max(...data.week.map(d => d.xp), 1);
                    const height = Math.max((day.xp / maxXp) * 100, 4);
                    const isToday = i === data.week.length - 1;
                    const dayLabel = new Date(day.date).toLocaleDateString('ru-RU', { weekday: 'short' });
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="text-[9px] font-bold text-gray-500">{day.xp > 0 ? day.xp : ''}</div>
                        <div
                          className={`w-full rounded-t-lg transition-all ${
                            day.xp === 0
                              ? 'bg-gray-200'
                              : isToday
                              ? 'bg-indigo-500'
                              : 'bg-indigo-300'
                          }`}
                          style={{ height: `${height}%`, minHeight: '4px' }}
                        />
                        <div className={`text-[9px] ${isToday ? 'font-bold text-indigo-600' : 'text-gray-400'}`}>
                          {dayLabel}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {data.achievements.length > 0 && (
              <Card className="p-4">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Icon name="Trophy" size={16} className="text-yellow-500" />
                  Последние достижения
                </h3>
                <div className="space-y-2">
                  {data.achievements.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 bg-yellow-50 rounded-xl px-3 py-2">
                      <span className="text-xl">{a.icon}</span>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-800">{a.name}</div>
                        <div className="text-[10px] text-gray-400">
                          {new Date(a.unlocked_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {data.study_plans.length > 0 && (
              <Card className="p-4">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Icon name="Target" size={16} className="text-green-500" />
                  Подготовка к экзаменам
                </h3>
                <div className="space-y-3">
                  {data.study_plans.map((plan, i) => {
                    const progress = plan.total_days > 0 ? Math.round((plan.completed_days / plan.total_days) * 100) : 0;
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-800">{plan.subject}</span>
                          <span className="text-xs text-gray-500">{progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Экзамен: {new Date(plan.exam_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="Crown" size={16} className={isChildPremium ? 'text-yellow-500' : 'text-gray-400'} />
                  <span className="text-sm font-medium text-gray-800">Подписка ребёнка</span>
                </div>
                <Badge className={isChildPremium ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}>
                  {isChildPremium ? 'Premium' : 'Бесплатная'}
                </Badge>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-3">
            {activityHistory.length === 0 ? (
              <Card className="p-8 text-center">
                <Icon name="Calendar" size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Пока нет данных об активности</p>
              </Card>
            ) : (
              activityHistory.map((day, i) => {
                const hasActivity = day.xp_earned > 0;
                return (
                  <Card key={i} className={`p-3.5 ${hasActivity ? '' : 'opacity-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-gray-800">
                        {new Date(day.date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                      <Badge className={hasActivity ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                        {hasActivity ? `+${day.xp_earned} XP` : 'Нет активности'}
                      </Badge>
                    </div>
                    {hasActivity && (
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <div className="text-sm font-bold text-gray-800">{day.tasks_completed}</div>
                          <div className="text-[9px] text-gray-400">задач</div>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-800">{day.pomodoro_minutes}</div>
                          <div className="text-[9px] text-gray-400">мин</div>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-800">{day.ai_questions_asked}</div>
                          <div className="text-[9px] text-gray-400">ИИ</div>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-800">{day.exam_tasks_done}</div>
                          <div className="text-[9px] text-gray-400">ЕГЭ</div>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'grades' && (
          <div className="space-y-4">
            {data.grades.gpa !== null && (
              <Card className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-indigo-600 font-medium">Средний балл</p>
                    <p className="text-3xl font-extrabold text-indigo-700">{data.grades.gpa.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Предметов</p>
                    <p className="text-2xl font-bold text-gray-700">{data.grades.total_subjects}</p>
                  </div>
                </div>
              </Card>
            )}

            {gradesData.length === 0 ? (
              <Card className="p-8 text-center">
                <Icon name="GraduationCap" size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Оценки пока не выставлены</p>
              </Card>
            ) : (
              gradesData.map((sem, i) => (
                <Card key={i} className="p-4">
                  <h3 className="font-bold text-gray-800 mb-3">{sem.semester} семестр</h3>
                  <div className="space-y-2">
                    {sem.subjects.map((subj, j) => (
                      <div key={j} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                        <span className="text-sm text-gray-700">{subj.name}</span>
                        <Badge className={
                          subj.grade >= 5 ? 'bg-green-500 text-white' :
                          subj.grade >= 4 ? 'bg-blue-500 text-white' :
                          subj.grade >= 3 ? 'bg-yellow-500 text-white' :
                          'bg-red-500 text-white'
                        }>
                          {subj.grade}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        <div className="text-center py-2">
          <p className="text-[10px] text-gray-400">
            Доступ до {data.parent_expires_at ? new Date(data.parent_expires_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;