import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

const SCHEDULE_URL = 'https://functions.poehali.dev/7030dc26-77cd-4b59-91e6-1be52f31cf8d';
const MATERIALS_URL = 'https://functions.poehali.dev/177e7001-b074-41cb-9553-e9c715d36f09';

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

const Analytics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [schedule, setSchedule] = useState<Lesson[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (!authService.isAuthenticated()) {
        navigate('/login');
        return;
      }
      await loadData();
    };
    checkAuth();
  }, [navigate]);

  const loadData = async () => {
    try {
      const token = authService.getToken();
      
      const [scheduleRes, tasksRes, materialsRes] = await Promise.all([
        fetch(`${SCHEDULE_URL}?path=schedule`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${SCHEDULE_URL}?path=tasks`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(MATERIALS_URL, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (scheduleRes.ok) {
        const data = await scheduleRes.json();
        setSchedule(data.schedule);
      }

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks);
      }

      if (materialsRes.ok) {
        const data = await materialsRes.json();
        setMaterials(data.materials);
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to load data:', error);
      setLoading(false);
    }
  };

  const calculateWeeklyHours = () => {
    return schedule.reduce((total, lesson) => {
      const start = new Date(`2000-01-01 ${lesson.start_time}`);
      const end = new Date(`2000-01-01 ${lesson.end_time}`);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return total + hours;
    }, 0);
  };

  const getSubjectStats = () => {
    const stats: Record<string, { lessons: number; tasks: number; materials: number }> = {};
    
    schedule.forEach(lesson => {
      if (!stats[lesson.subject]) {
        stats[lesson.subject] = { lessons: 0, tasks: 0, materials: 0 };
      }
      stats[lesson.subject].lessons++;
    });

    tasks.forEach(task => {
      if (task.subject) {
        if (!stats[task.subject]) {
          stats[task.subject] = { lessons: 0, tasks: 0, materials: 0 };
        }
        stats[task.subject].tasks++;
      }
    });

    materials.forEach(material => {
      if (material.subject) {
        if (!stats[material.subject]) {
          stats[material.subject] = { lessons: 0, tasks: 0, materials: 0 };
        }
        stats[material.subject].materials++;
      }
    });

    return Object.entries(stats)
      .map(([subject, data]) => ({
        subject,
        ...data,
        total: data.lessons + data.tasks + data.materials
      }))
      .sort((a, b) => b.total - a.total);
  };

  const getTaskCompletionByPriority = () => {
    const priorities = ['high', 'medium', 'low'];
    return priorities.map(priority => {
      const filtered = tasks.filter(t => t.priority === priority);
      const completed = filtered.filter(t => t.completed).length;
      const total = filtered.length;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      return {
        priority,
        completed,
        total,
        rate
      };
    });
  };

  const getTasksByDay = () => {
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const counts = Array(7).fill(0);
    
    schedule.forEach(lesson => {
      const dayIndex = lesson.day_of_week === 7 ? 6 : lesson.day_of_week - 1;
      counts[dayIndex]++;
    });

    return days.map((day, index) => ({
      day,
      count: counts[index]
    }));
  };

  const getRecentActivity = () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const recentMaterials = materials.filter(m => 
      new Date(m.created_at) >= sevenDaysAgo
    ).length;
    
    const recentTasks = tasks.filter(t => 
      t.created_at && new Date(t.created_at) >= sevenDaysAgo
    ).length;

    return {
      materials: recentMaterials,
      tasks: recentTasks,
      total: recentMaterials + recentTasks
    };
  };

  const weeklyHours = calculateWeeklyHours();
  const subjectStats = getSubjectStats();
  const priorityStats = getTaskCompletionByPriority();
  const dayStats = getTasksByDay();
  const recentActivity = getRecentActivity();
  
  const completedTasks = tasks.filter(t => t.completed).length;
  const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const overdueTasks = tasks.filter(t => {
    if (!t.deadline || t.completed) return false;
    return new Date(t.deadline) < new Date();
  }).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-purple-950/20 dark:to-pink-950/20 flex items-center justify-center">
        <Icon name="Loader2" size={48} className="animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-purple-950/20 dark:to-pink-950/20">
      <header className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-b border-purple-200/50 dark:border-purple-800/30 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                className="rounded-xl hover:bg-purple-100/50 dark:hover:bg-purple-900/50 h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
              >
                <Icon name="ArrowLeft" size={24} className="text-purple-600 dark:text-purple-400" />
              </Button>
              <div>
                <h1 className="text-2xl font-heading font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Аналитика
                </h1>
                <p className="text-xs text-purple-600/70 font-medium">Статистика твоей учёбы</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/30 dark:to-indigo-950/30 border-2 border-indigo-200 dark:border-indigo-700">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center">
                <Icon name="Clock" size={24} className="text-white" />
              </div>
              <Badge className="bg-indigo-600">{Math.round(weeklyHours)} ч</Badge>
            </div>
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300">Учебных часов в неделю</h3>
            <p className="text-2xl font-bold text-indigo-800 dark:text-indigo-200 mt-2">{schedule.length} пар</p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-100 border-2 border-green-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-green-600 flex items-center justify-center">
                <Icon name="CheckCircle2" size={24} className="text-white" />
              </div>
              <Badge className="bg-green-600">{completionRate}%</Badge>
            </div>
            <h3 className="text-sm font-semibold text-gray-600">Процент выполнения</h3>
            <p className="text-2xl font-bold text-green-800 mt-2">{completedTasks}/{tasks.length}</p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-purple-50 to-fuchsia-100 border-2 border-purple-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center">
                <Icon name="BookOpen" size={24} className="text-white" />
              </div>
              <Badge className="bg-purple-600">{materials.length}</Badge>
            </div>
            <h3 className="text-sm font-semibold text-gray-600">Материалов</h3>
            <p className="text-2xl font-bold text-purple-800 mt-2">{recentActivity.materials} за неделю</p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-red-50 to-rose-100 border-2 border-red-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center">
                <Icon name="AlertCircle" size={24} className="text-white" />
              </div>
              <Badge className="bg-red-600">{overdueTasks}</Badge>
            </div>
            <h3 className="text-sm font-semibold text-gray-600">Просроченных задач</h3>
            <p className="text-2xl font-bold text-red-800 mt-2">
              {tasks.filter(t => !t.completed).length} активных
            </p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card className="p-6 bg-white">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Icon name="BarChart3" size={20} className="text-purple-600" />
              Распределение пар по дням
            </h3>
            <div className="space-y-3">
              {dayStats.map((stat, index) => {
                const maxCount = Math.max(...dayStats.map(s => s.count));
                const percentage = maxCount > 0 ? (stat.count / maxCount) * 100 : 0;
                
                return (
                  <div key={index}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-semibold">{stat.day}</span>
                      <span className="text-gray-600">{stat.count} пар</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 h-3 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-6 bg-white">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Icon name="Target" size={20} className="text-purple-600" />
              Выполнение по приоритетам
            </h3>
            <div className="space-y-4">
              {priorityStats.map((stat, index) => {
                const color = 
                  stat.priority === 'high' ? 'red' :
                  stat.priority === 'medium' ? 'yellow' : 'green';
                
                const label =
                  stat.priority === 'high' ? 'Высокий' :
                  stat.priority === 'medium' ? 'Средний' : 'Низкий';

                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full bg-${color}-500`}></div>
                        <span className="font-semibold">{label}</span>
                      </div>
                      <Badge variant="secondary">{stat.rate}%</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`bg-${color}-500 h-2 rounded-full`}
                          style={{ width: `${stat.rate}%` }}
                        ></div>
                      </div>
                      <span>{stat.completed}/{stat.total}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <Card className="p-6 bg-white">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Icon name="BookMarked" size={20} className="text-purple-600" />
            Статистика по предметам
          </h3>
          {subjectStats.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Нет данных</p>
          ) : (
            <div className="space-y-4">
              {subjectStats.slice(0, 10).map((stat, index) => (
                <div key={index} className="border-b border-gray-100 pb-4 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-gray-800">{stat.subject}</h4>
                    <Badge variant="secondary">{stat.total}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="flex items-center gap-1 text-indigo-600">
                      <Icon name="Calendar" size={14} />
                      <span>{stat.lessons} пар</span>
                    </div>
                    <div className="flex items-center gap-1 text-purple-600">
                      <Icon name="CheckSquare" size={14} />
                      <span>{stat.tasks} задач</span>
                    </div>
                    <div className="flex items-center gap-1 text-pink-600">
                      <Icon name="FileText" size={14} />
                      <span>{stat.materials} материал(ов)</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default Analytics;