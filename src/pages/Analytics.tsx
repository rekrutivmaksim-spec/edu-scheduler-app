import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import BottomNav from '@/components/BottomNav';

const SCHEDULE_URL = 'https://functions.poehali.dev/7030dc26-77cd-4b59-91e6-1be52f31cf8d';
const MATERIALS_URL = 'https://functions.poehali.dev/177e7001-b074-41cb-9553-e9c715d36f09';
const GAMIFICATION_URL = 'https://functions.poehali.dev/0559fb04-cd62-4e50-bb12-dfd6941a7080';

interface Lesson {
  id: number;
  subject: string;
  type: string;
  start_time: string;
  end_time: string;
  day_of_week: number;
}

interface Task {
  id: number;
  title: string;
  subject?: string;
  deadline?: string;
  priority: string;
  completed: boolean;
  created_at: string;
}

interface Material {
  id: number;
  title: string;
  subject?: string;
  created_at: string;
}

interface DailyActivity {
  date: string;
  xp: number;
  tasks: number;
  pomodoro: number;
}

interface GamProfile {
  level: number;
  xp_total: number;
  streak: { current: number; longest: number };
  stats: {
    total_tasks: number;
    total_pomodoro_minutes: number;
    total_ai_questions: number;
    total_materials: number;
  };
  recent_activity: DailyActivity[];
}

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const Analytics = () => {
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState<Lesson[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [gam, setGam] = useState<GamProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate('/auth');
      return;
    }
    loadData();
  }, [navigate]);

  const loadData = async () => {
    try {
      setError(false);
      const token = authService.getToken();
      const headers = { 'Authorization': `Bearer ${token}` };

      const [scheduleRes, tasksRes, materialsRes, gamRes] = await Promise.all([
        fetch(`${SCHEDULE_URL}?path=schedule`, { headers }),
        fetch(`${SCHEDULE_URL}?path=tasks`, { headers }),
        fetch(MATERIALS_URL, { headers }),
        fetch(`${GAMIFICATION_URL}?action=profile`, { headers }),
      ]);

      if (scheduleRes.ok) setSchedule((await scheduleRes.json()).schedule || []);
      if (tasksRes.ok) setTasks((await tasksRes.json()).tasks || []);
      if (materialsRes.ok) setMaterials((await materialsRes.json()).materials || []);
      if (gamRes.ok) setGam(await gamRes.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // --- Расчёты ---
  const weeklyHours = schedule.reduce((total, lesson) => {
    const s = new Date(`2000-01-01 ${lesson.start_time}`);
    const e = new Date(`2000-01-01 ${lesson.end_time}`);
    return total + (e.getTime() - s.getTime()) / 3600000;
  }, 0);

  const completedTasks = tasks.filter(t => t.completed).length;
  const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const overdueTasks = tasks.filter(t => !t.completed && t.deadline && new Date(t.deadline) < new Date()).length;

  const dayStats = DAY_NAMES.map((day, i) => ({
    day,
    count: schedule.filter(l => (l.day_of_week === 7 ? 6 : l.day_of_week - 1) === i).length,
  }));
  const maxDayCount = Math.max(...dayStats.map(s => s.count), 1);

  const priorityStats = ['high', 'medium', 'low'].map(p => {
    const all = tasks.filter(t => t.priority === p);
    const done = all.filter(t => t.completed).length;
    return { priority: p, completed: done, total: all.length, rate: all.length > 0 ? Math.round((done / all.length) * 100) : 0 };
  });

  const subjectStats = (() => {
    const stats: Record<string, { lessons: number; tasks: number; materials: number }> = {};
    schedule.forEach(l => { stats[l.subject] = stats[l.subject] || { lessons: 0, tasks: 0, materials: 0 }; stats[l.subject].lessons++; });
    tasks.forEach(t => { if (t.subject) { stats[t.subject] = stats[t.subject] || { lessons: 0, tasks: 0, materials: 0 }; stats[t.subject].tasks++; } });
    materials.forEach(m => { if (m.subject) { stats[m.subject] = stats[m.subject] || { lessons: 0, tasks: 0, materials: 0 }; stats[m.subject].materials++; } });
    return Object.entries(stats).map(([subject, d]) => ({ subject, ...d, total: d.lessons + d.tasks + d.materials })).sort((a, b) => b.total - a.total);
  })();

  // XP за 7 дней из recent_activity
  const xpDays: DailyActivity[] = (() => {
    const base = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { date: d.toISOString().slice(0, 10), xp: 0, tasks: 0, pomodoro: 0 };
    });
    if (gam?.recent_activity) {
      gam.recent_activity.forEach(a => {
        const idx = base.findIndex(b => b.date === a.date);
        if (idx >= 0) base[idx] = { ...base[idx], xp: a.xp, tasks: a.tasks, pomodoro: a.pomodoro };
      });
    }
    return base;
  })();
  const maxXp = Math.max(...xpDays.map(d => d.xp), 1);
  const maxPomodoro = Math.max(...xpDays.map(d => d.pomodoro), 1);

  const totalXpWeek = xpDays.reduce((s, d) => s + d.xp, 0);

  // --- Скелет загрузки ---
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
        <p className="text-purple-600 font-medium">Считаем статистику...</p>
      </div>
    );
  }

  // --- Экран ошибки ---
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-2">
          <Icon name="WifiOff" size={36} className="text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-700">Нет подключения</h2>
        <p className="text-gray-500 text-center max-w-xs">Не удалось загрузить статистику. Проверь интернет и попробуй снова.</p>
        <Button onClick={loadData} className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-6">
          <Icon name="RefreshCw" size={16} className="mr-2" />
          Обновить
        </Button>
      </div>
    );
  }

  const isEmpty = schedule.length === 0 && tasks.length === 0 && materials.length === 0 && !gam;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 pb-24">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-purple-200/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-xl hover:bg-purple-100/50 h-9 w-9">
            <Icon name="ArrowLeft" size={20} className="text-purple-600" />
          </Button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Аналитика
            </h1>
            <p className="text-xs text-purple-600/70">Статистика твоей учёбы</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Пустое состояние */}
        {isEmpty && (
          <Card className="p-10 flex flex-col items-center gap-4 text-center bg-white/80">
            <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center">
              <Icon name="BarChart3" size={36} className="text-purple-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-700">Статистика пока пуста</h2>
            <p className="text-gray-500 max-w-xs">Добавь расписание, задачи или позанимайся с ИИ — и здесь появится твоя аналитика</p>
            <Button onClick={() => navigate('/')} className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-6 mt-2">
              Начать учёбу
            </Button>
          </Card>
        )}

        {/* --- Карточки-цифры --- */}
        {!isEmpty && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-100 border-2 border-indigo-200">
                <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center mb-3">
                  <Icon name="Clock" size={18} className="text-white" />
                </div>
                <p className="text-2xl font-bold text-indigo-800">{Math.round(weeklyHours)}<span className="text-sm font-normal ml-1">ч</span></p>
                <p className="text-xs text-gray-500 mt-0.5">Пар в неделю: {schedule.length}</p>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-100 border-2 border-green-200">
                <div className="w-9 h-9 rounded-lg bg-green-600 flex items-center justify-center mb-3">
                  <Icon name="CheckCircle" size={18} className="text-white" />
                </div>
                <p className="text-2xl font-bold text-green-800">{completionRate}<span className="text-sm font-normal ml-0.5">%</span></p>
                <p className="text-xs text-gray-500 mt-0.5">Задач: {completedTasks}/{tasks.length}</p>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-purple-50 to-violet-100 border-2 border-purple-200">
                <div className="w-9 h-9 rounded-lg bg-purple-600 flex items-center justify-center mb-3">
                  <Icon name="Zap" size={18} className="text-white" />
                </div>
                <p className="text-2xl font-bold text-purple-800">{gam?.xp_total ?? 0}<span className="text-sm font-normal ml-1">XP</span></p>
                <p className="text-xs text-gray-500 mt-0.5">Ур. {gam?.level ?? 1} · +{totalXpWeek} за неделю</p>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-orange-50 to-amber-100 border-2 border-orange-200">
                <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center mb-3">
                  <Icon name="Flame" size={18} className="text-white" />
                </div>
                <p className="text-2xl font-bold text-orange-800">{gam?.streak.current ?? 0}<span className="text-sm font-normal ml-1">дн</span></p>
                <p className="text-xs text-gray-500 mt-0.5">Рекорд: {gam?.streak.longest ?? 0} дн</p>
              </Card>
            </div>

            {/* --- XP за 7 дней --- */}
            <Card className="p-5 bg-white">
              <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                <Icon name="TrendingUp" size={18} className="text-purple-600" />
                XP за последние 7 дней
              </h3>
              <div className="flex items-end gap-1.5 h-28">
                {xpDays.map((d, i) => {
                  const h = d.xp > 0 ? Math.max(8, Math.round((d.xp / maxXp) * 96)) : 4;
                  const isToday = d.date === new Date().toISOString().slice(0, 10);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-gray-400 font-medium">{d.xp > 0 ? `+${d.xp}` : ''}</span>
                      <div className="w-full relative flex items-end" style={{ height: 80 }}>
                        <div
                          className={`w-full rounded-t-lg transition-all duration-500 ${isToday ? 'bg-gradient-to-t from-purple-600 to-violet-400' : d.xp > 0 ? 'bg-gradient-to-t from-indigo-400 to-purple-300' : 'bg-gray-100'}`}
                          style={{ height: h }}
                        />
                      </div>
                      <span className={`text-[10px] font-semibold ${isToday ? 'text-purple-600' : 'text-gray-400'}`}>
                        {DAY_NAMES[new Date(d.date + 'T12:00:00').getDay() === 0 ? 6 : new Date(d.date + 'T12:00:00').getDay() - 1]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* --- Помодоро + Вопросы ИИ + Материалы --- */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="p-5 bg-white">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="Timer" size={16} className="text-red-500" />
                  <span className="text-sm font-semibold text-gray-700">Помодоро</span>
                </div>
                <p className="text-3xl font-bold text-red-600">{gam ? Math.round(gam.stats.total_pomodoro_minutes / 60) : 0}<span className="text-base font-normal ml-1">ч</span></p>
                <p className="text-xs text-gray-400 mt-1">{gam?.stats.total_pomodoro_minutes ?? 0} мин всего</p>
              </Card>
              <Card className="p-5 bg-white">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="Bot" size={16} className="text-indigo-500" />
                  <span className="text-sm font-semibold text-gray-700">Вопросы ИИ</span>
                </div>
                <p className="text-3xl font-bold text-indigo-600">{gam?.stats.total_ai_questions ?? 0}</p>
                <p className="text-xs text-gray-400 mt-1">задано всего</p>
              </Card>
              <Card className="p-5 bg-white">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="BookOpen" size={16} className="text-pink-500" />
                  <span className="text-sm font-semibold text-gray-700">Материалы</span>
                </div>
                <p className="text-3xl font-bold text-pink-600">{materials.length}</p>
                <p className="text-xs text-gray-400 mt-1">загружено файлов</p>
              </Card>
            </div>

            {/* --- График помодоро по дням --- */}
            {xpDays.some(d => d.pomodoro > 0) && (
              <Card className="p-5 bg-white">
                <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                  <Icon name="Timer" size={18} className="text-red-500" />
                  Помодоро-сессии за неделю (мин)
                </h3>
                <div className="flex items-end gap-1.5 h-24">
                  {xpDays.map((d, i) => {
                    const h = d.pomodoro > 0 ? Math.max(8, Math.round((d.pomodoro / maxPomodoro) * 80)) : 4;
                    const isToday = d.date === new Date().toISOString().slice(0, 10);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] text-gray-400">{d.pomodoro > 0 ? d.pomodoro : ''}</span>
                        <div className="w-full relative flex items-end" style={{ height: 64 }}>
                          <div
                            className={`w-full rounded-t-lg ${isToday ? 'bg-gradient-to-t from-red-500 to-orange-400' : d.pomodoro > 0 ? 'bg-gradient-to-t from-red-300 to-orange-200' : 'bg-gray-100'}`}
                            style={{ height: h }}
                          />
                        </div>
                        <span className={`text-[10px] font-semibold ${isToday ? 'text-red-500' : 'text-gray-400'}`}>
                          {DAY_NAMES[new Date(d.date + 'T12:00:00').getDay() === 0 ? 6 : new Date(d.date + 'T12:00:00').getDay() - 1]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* --- Пары по дням + Задачи по приоритетам --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="p-5 bg-white">
                <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                  <Icon name="BarChart3" size={18} className="text-purple-600" />
                  Пары по дням недели
                </h3>
                {schedule.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-gray-400">
                    <Icon name="CalendarX" size={36} className="mb-2 opacity-30" />
                    <p className="text-sm">Расписание не добавлено</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {dayStats.map((s, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium w-6 text-gray-600">{s.day}</span>
                          <span className="text-gray-500 text-xs">{s.count} пар</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                          <div
                            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full transition-all"
                            style={{ width: `${(s.count / maxDayCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-5 bg-white">
                <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                  <Icon name="Target" size={18} className="text-purple-600" />
                  Задачи по приоритетам
                </h3>
                {tasks.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-gray-400">
                    <Icon name="ClipboardList" size={36} className="mb-2 opacity-30" />
                    <p className="text-sm">Задач пока нет</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {priorityStats.map((s, i) => {
                      const cfg = [
                        { label: 'Высокий', from: 'from-red-500', to: 'to-rose-400', text: 'text-red-600' },
                        { label: 'Средний', from: 'from-yellow-500', to: 'to-amber-400', text: 'text-yellow-600' },
                        { label: 'Низкий', from: 'from-green-500', to: 'to-emerald-400', text: 'text-green-600' },
                      ][i];
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium text-gray-700">{cfg.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">{s.completed}/{s.total}</span>
                              <Badge variant="secondary" className="text-xs">{s.rate}%</Badge>
                            </div>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2.5">
                            <div
                              className={`bg-gradient-to-r ${cfg.from} ${cfg.to} h-2.5 rounded-full`}
                              style={{ width: `${s.rate}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {overdueTasks > 0 && (
                      <div className="mt-2 flex items-center gap-2 p-2.5 bg-red-50 rounded-lg">
                        <Icon name="AlertTriangle" size={14} className="text-red-500" />
                        <span className="text-sm text-red-600 font-medium">{overdueTasks} просроченных задач</span>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>

            {/* --- Статистика по предметам --- */}
            <Card className="p-5 bg-white">
              <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                <Icon name="BookMarked" size={18} className="text-purple-600" />
                По предметам
              </h3>
              {subjectStats.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-gray-400">
                  <Icon name="Book" size={36} className="mb-2 opacity-30" />
                  <p className="text-sm">Добавь расписание или задачи</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {subjectStats.slice(0, 8).map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-800 truncate">{s.subject}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                        {s.lessons > 0 && <span className="text-xs text-indigo-600 flex items-center gap-1"><Icon name="Calendar" size={11} />{s.lessons}</span>}
                        {s.tasks > 0 && <span className="text-xs text-purple-600 flex items-center gap-1"><Icon name="CheckSquare" size={11} />{s.tasks}</span>}
                        {s.materials > 0 && <span className="text-xs text-pink-600 flex items-center gap-1"><Icon name="FileText" size={11} />{s.materials}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Analytics;
