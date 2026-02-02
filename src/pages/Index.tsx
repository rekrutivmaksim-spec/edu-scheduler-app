import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import NotificationPrompt from '@/components/NotificationPrompt';
import ExamReminder from '@/components/ExamReminder';
import LimitsIndicator from '@/components/LimitsIndicator';

const SCHEDULE_URL = 'https://functions.poehali.dev/7030dc26-77cd-4b59-91e6-1be52f31cf8d';

interface Lesson {
  id: number;
  subject: string;
  type: string;
  start_time: string;
  end_time: string;
  day_of_week: number;
  room?: string;
  teacher?: string;
  color?: string;
}

interface Task {
  id: number;
  title: string;
  description?: string;
  subject?: string;
  deadline?: string;
  priority: string;
  completed: boolean;
}

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('schedule');
  const [user, setUser] = useState(authService.getUser());
  const [schedule, setSchedule] = useState<Lesson[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isExamReminderOpen, setIsExamReminderOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);
  const [taskFilter, setTaskFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [taskSearch, setTaskSearch] = useState('');

  const [lessonForm, setLessonForm] = useState({
    subject: '',
    type: 'lecture',
    start_time: '',
    end_time: '',
    day_of_week: 1,
    room: '',
    teacher: '',
    color: 'bg-purple-500'
  });

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    subject: '',
    deadline: '',
    priority: 'medium'
  });

  const dayNames = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

  useEffect(() => {
    const checkAuth = async () => {
      if (!authService.isAuthenticated()) {
        navigate('/login');
        return;
      }
      const verifiedUser = await authService.verifyToken();
      if (!verifiedUser) {
        navigate('/login');
      } else {
        setUser(verifiedUser);
        loadSchedule();
        loadTasks();
      }
    };
    checkAuth();
  }, [navigate]);

  const loadSchedule = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${SCHEDULE_URL}?path=schedule`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSchedule(data.schedule);
      }
    } catch (error) {
      console.error('Failed to load schedule:', error);
    }
  };

  const loadTasks = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${SCHEDULE_URL}?path=tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks);
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  const handleAddLesson = async () => {
    if (!lessonForm.subject || !lessonForm.start_time || !lessonForm.end_time) {
      toast({
        title: "Ошибка",
        description: "Заполните обязательные поля",
        variant: "destructive"
      });
      return;
    }

    try {
      const token = authService.getToken();
      const response = await fetch(`${SCHEDULE_URL}?path=schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(lessonForm)
      });

      if (response.ok) {
        toast({ title: "Занятие добавлено" });
        setIsAddingLesson(false);
        setLessonForm({
          subject: '',
          type: 'lecture',
          start_time: '',
          end_time: '',
          day_of_week: 1,
          room: '',
          teacher: '',
          color: 'bg-purple-500'
        });
        loadSchedule();
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось добавить занятие",
        variant: "destructive"
      });
    }
  };

  const handleAddTask = async () => {
    if (!taskForm.title) {
      toast({
        title: "Ошибка",
        description: "Введите название задачи",
        variant: "destructive"
      });
      return;
    }

    try {
      const token = authService.getToken();
      const response = await fetch(`${SCHEDULE_URL}?path=tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(taskForm)
      });

      if (response.ok) {
        toast({ title: "Задача добавлена" });
        setIsAddingTask(false);
        setTaskForm({
          title: '',
          description: '',
          subject: '',
          deadline: '',
          priority: 'medium'
        });
        loadTasks();
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось добавить задачу",
        variant: "destructive"
      });
    }
  };

  const handleToggleTask = async (task: Task) => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${SCHEDULE_URL}?path=tasks`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...task,
          completed: !task.completed
        })
      });

      if (response.ok) {
        loadTasks();
      }
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${SCHEDULE_URL}?path=tasks&id=${taskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast({ title: "Задача удалена" });
        loadTasks();
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить задачу",
        variant: "destructive"
      });
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const todayLessons = schedule.filter(l => l.day_of_week === selectedDay);
  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1);
  const weekTasks = tasks.filter(t => {
    if (!t.deadline) return false;
    const deadline = new Date(t.deadline);
    return deadline >= weekStart;
  });
  const weekCompleted = weekTasks.filter(t => t.completed).length;
  const weekCompletionRate = weekTasks.length > 0 ? Math.round((weekCompleted / weekTasks.length) * 100) : 0;

  const highPriorityTasks = activeTasks.filter(t => t.priority === 'high');
  const overdueTasks = activeTasks.filter(t => {
    if (!t.deadline) return false;
    return new Date(t.deadline) < now;
  });

  const subjectStats = tasks.reduce((acc, task) => {
    if (task.subject) {
      if (!acc[task.subject]) {
        acc[task.subject] = { total: 0, completed: 0 };
      }
      acc[task.subject].total++;
      if (task.completed) acc[task.subject].completed++;
    }
    return acc;
  }, {} as Record<string, { total: number; completed: number }>);

  const uniqueSubjects = [...new Set(schedule.map(l => l.subject))];
  const totalScheduleHours = schedule.reduce((acc, l) => {
    const start = new Date(`2000-01-01 ${l.start_time}`);
    const end = new Date(`2000-01-01 ${l.end_time}`);
    return acc + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  }, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <header className="bg-white/70 backdrop-blur-xl border-b border-purple-200/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <Icon name="Sparkles" size={24} className="text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-2xl font-heading font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Studyfay
                </h1>
                <p className="text-xs text-purple-600/70 font-medium">ИИ-помощник студента</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/calendar')}
                className="hover:bg-purple-100/50 rounded-xl"
              >
                <Icon name="CalendarDays" size={20} className="text-purple-600" />
              </Button>
              <Button variant="ghost" size="icon" className="relative hover:bg-purple-100/50 rounded-xl">
                <Icon name="Bell" size={20} className="text-purple-600" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full animate-pulse shadow-lg shadow-pink-500/50"></span>
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => navigate('/profile')}
                className="rounded-xl hover:bg-purple-100/50 text-gray-600"
              >
                <Icon name="User" size={20} className="mr-2" />
                Профиль
              </Button>
              <Button 
                variant="ghost" 
                onClick={handleLogout}
                className="rounded-xl hover:bg-red-100/50 text-gray-600 hover:text-red-600"
              >
                <Icon name="LogOut" size={20} className="mr-2" />
                Выйти
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NotificationPrompt />
        
        <LimitsIndicator compact />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 mb-6">
          <Card 
            onClick={() => navigate('/assistant')}
            className="p-6 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-2 border-indigo-300 cursor-pointer hover:shadow-2xl hover:shadow-indigo-500/30 transition-all duration-300 hover:scale-[1.02]"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Icon name="Bot" size={32} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-800 mb-1">ИИ-Ассистент</h3>
                <p className="text-sm text-gray-600">Задай вопрос по своим материалам</p>
              </div>
              <Icon name="ArrowRight" size={24} className="text-indigo-600" />
            </div>
          </Card>
          
          <Card 
            onClick={() => navigate('/exam-prep')}
            className="p-6 bg-gradient-to-r from-yellow-50 via-orange-50 to-red-50 border-2 border-orange-300 cursor-pointer hover:shadow-2xl hover:shadow-orange-500/30 transition-all duration-300 hover:scale-[1.02]"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-3xl">🎯</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-800 mb-1">Прогноз экзамена</h3>
                <p className="text-sm text-gray-600">ИИ предсказывает вопросы на экзамене</p>
              </div>
              <Icon name="ArrowRight" size={24} className="text-orange-600" />
            </div>
          </Card>
        </div>

        <Card
          onClick={() => navigate('/sharing')}
          className="mb-6 p-6 bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 border-2 border-green-300 cursor-pointer hover:shadow-2xl hover:shadow-green-500/30 transition-all duration-300 hover:scale-[1.02]"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Icon name="Share2" size={32} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-800 mb-1">Расшарить расписание с группой</h3>
              <p className="text-sm text-gray-600">Создай код доступа и поделись расписанием с одногруппниками</p>
            </div>
            <Icon name="ArrowRight" size={24} className="text-green-600" />
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="group relative overflow-hidden p-7 bg-white border-0 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-indigo-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 group-hover:text-white transition-colors">Занятий сегодня</p>
                <p className="text-4xl font-bold mt-3 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent group-hover:text-white transition-all">{todayLessons.length}</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-100 to-purple-100 group-hover:from-white/20 group-hover:to-white/10 rounded-2xl flex items-center justify-center transition-all shadow-lg">
                <Icon name="Calendar" size={28} className="text-indigo-600 group-hover:text-white transition-colors" />
              </div>
            </div>
          </Card>

          <Card className="group relative overflow-hidden p-7 bg-white border-0 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 group-hover:text-white transition-colors">Активных задач</p>
                <p className="text-4xl font-bold mt-3 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent group-hover:text-white transition-all">{activeTasks.length}</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-pink-100 group-hover:from-white/20 group-hover:to-white/10 rounded-2xl flex items-center justify-center transition-all shadow-lg">
                <Icon name="CheckSquare" size={28} className="text-purple-600 group-hover:text-white transition-colors" />
              </div>
            </div>
          </Card>

          <Card className="group relative overflow-hidden p-7 bg-white border-0 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-pink-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-rose-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 group-hover:text-white transition-colors">Выполнено задач</p>
                <p className="text-4xl font-bold mt-3 bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent group-hover:text-white transition-all">{completionRate}%</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-pink-100 to-rose-100 group-hover:from-white/20 group-hover:to-white/10 rounded-2xl flex items-center justify-center transition-all shadow-lg">
                <Icon name="TrendingUp" size={28} className="text-pink-600 group-hover:text-white transition-colors" />
              </div>
            </div>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 h-16 bg-white/90 backdrop-blur-xl border-2 border-purple-200/50 shadow-lg shadow-purple-500/10 rounded-2xl p-2">
            <TabsTrigger value="schedule" className="rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/30 transition-all">
              <Icon name="Calendar" size={20} className="mr-2" />
              <span className="hidden sm:inline font-semibold">Расписание</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/30 transition-all">
              <Icon name="CheckSquare" size={20} className="mr-2" />
              <span className="hidden sm:inline font-semibold">Задачи</span>
            </TabsTrigger>
            <TabsTrigger value="scanner" onClick={() => navigate('/materials')} className="rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-pink-600 data-[state=active]:to-rose-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-pink-500/30 transition-all">
              <Icon name="FileUp" size={20} className="mr-2" />
              <span className="hidden sm:inline font-semibold">Загрузка файлов</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" onClick={() => navigate('/analytics')} className="rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/30 transition-all">
              <Icon name="BarChart3" size={20} className="mr-2" />
              <span className="hidden sm:inline font-semibold">Аналитика</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/30 transition-all">
              <Icon name="User" size={20} className="mr-2" />
              <span className="hidden sm:inline font-semibold">Профиль</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-heading font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Расписание</h2>
                <p className="text-purple-600/70 text-sm mt-1">Управление занятиями</p>
              </div>
              <Button 
                onClick={() => setIsAddingLesson(true)}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-purple-500/30 rounded-xl"
              >
                <Icon name="Plus" size={18} className="mr-2" />
                Добавить занятие
              </Button>
            </div>

            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {dayNames.map((day, idx) => (
                <Button
                  key={idx}
                  variant={selectedDay === idx + 1 ? "default" : "outline"}
                  onClick={() => setSelectedDay(idx + 1)}
                  className={selectedDay === idx + 1 ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white" : ""}
                >
                  {day}
                </Button>
              ))}
            </div>

            {isAddingLesson && (
              <Card className="p-6 bg-white mb-6">
                <h3 className="text-lg font-bold mb-4">Новое занятие</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Предмет *</Label>
                    <Input
                      value={lessonForm.subject}
                      onChange={(e) => setLessonForm({...lessonForm, subject: e.target.value})}
                      placeholder="Математический анализ"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Тип</Label>
                    <Select value={lessonForm.type} onValueChange={(v) => setLessonForm({...lessonForm, type: v})}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lecture">Лекция</SelectItem>
                        <SelectItem value="practice">Практика</SelectItem>
                        <SelectItem value="lab">Лабораторная</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Начало *</Label>
                    <Input
                      type="time"
                      value={lessonForm.start_time}
                      onChange={(e) => setLessonForm({...lessonForm, start_time: e.target.value})}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Конец *</Label>
                    <Input
                      type="time"
                      value={lessonForm.end_time}
                      onChange={(e) => setLessonForm({...lessonForm, end_time: e.target.value})}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>День недели</Label>
                    <Select value={String(lessonForm.day_of_week)} onValueChange={(v) => setLessonForm({...lessonForm, day_of_week: Number(v)})}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dayNames.map((day, idx) => (
                          <SelectItem key={idx} value={String(idx + 1)}>{day}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Аудитория</Label>
                    <Input
                      value={lessonForm.room}
                      onChange={(e) => setLessonForm({...lessonForm, room: e.target.value})}
                      placeholder="ауд. 301"
                      className="mt-2"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleAddLesson} className="bg-gradient-to-r from-indigo-600 to-purple-600">
                    Сохранить
                  </Button>
                  <Button variant="outline" onClick={() => setIsAddingLesson(false)}>
                    Отмена
                  </Button>
                </div>
              </Card>
            )}

            <div className="space-y-4">
              {todayLessons.length === 0 ? (
                <Card className="p-12 text-center bg-white border-2 border-dashed border-purple-200">
                  <Icon name="CalendarOff" size={48} className="mx-auto mb-4 text-purple-300" />
                  <p className="text-gray-600">Нет занятий на этот день</p>
                </Card>
              ) : (
                todayLessons.map((lesson) => (
                  <Card key={lesson.id} className="p-6 bg-white hover:shadow-xl transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 ${lesson.color || 'bg-purple-500'} rounded-xl flex items-center justify-center text-white shadow-lg`}>
                          <Icon name="BookOpen" size={24} />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{lesson.subject}</h3>
                          <p className="text-sm text-gray-600">{lesson.start_time} - {lesson.end_time}</p>
                          <p className="text-xs text-gray-500">{lesson.room} • {lesson.type}</p>
                        </div>
                      </div>
                      <Badge>{lesson.type === 'lecture' ? 'Лекция' : lesson.type === 'practice' ? 'Практика' : 'Лаб'}</Badge>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-heading font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Задачи</h2>
                <p className="text-purple-600/70 text-sm mt-1">Управление делами</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => setIsExamReminderOpen(true)}
                  variant="outline"
                  className="border-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-xl"
                >
                  <Icon name="Bell" size={18} className="mr-2" />
                  Напоминание об экзамене
                </Button>
                <Button 
                  onClick={() => setIsAddingTask(true)}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-pink-500/30 rounded-xl"
                >
                  <Icon name="Plus" size={18} className="mr-2" />
                  Новая задача
                </Button>
              </div>
            </div>

            <div className="flex gap-4 mb-6">
              <div className="relative flex-1">
                <Icon name="Search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Поиск задачи..."
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  className="pl-10 rounded-xl border-2 border-purple-200"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={taskFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setTaskFilter('all')}
                  className="rounded-xl"
                >
                  Все
                </Button>
                <Button
                  variant={taskFilter === 'active' ? 'default' : 'outline'}
                  onClick={() => setTaskFilter('active')}
                  className="rounded-xl"
                >
                  Активные
                </Button>
                <Button
                  variant={taskFilter === 'completed' ? 'default' : 'outline'}
                  onClick={() => setTaskFilter('completed')}
                  className="rounded-xl"
                >
                  Выполненные
                </Button>
              </div>
            </div>

            {isAddingTask && (
              <Card className="p-6 bg-white mb-6">
                <h3 className="text-lg font-bold mb-4">Новая задача</h3>
                <div className="space-y-4">
                  <div>
                    <Label>Название *</Label>
                    <Input
                      value={taskForm.title}
                      onChange={(e) => setTaskForm({...taskForm, title: e.target.value})}
                      placeholder="Решить задачи по математике"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Описание</Label>
                    <Textarea
                      value={taskForm.description}
                      onChange={(e) => setTaskForm({...taskForm, description: e.target.value})}
                      placeholder="Дополнительная информация..."
                      className="mt-2"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Предмет</Label>
                      <Input
                        value={taskForm.subject}
                        onChange={(e) => setTaskForm({...taskForm, subject: e.target.value})}
                        placeholder="Математика"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>Дедлайн</Label>
                      <Input
                        type="datetime-local"
                        value={taskForm.deadline}
                        onChange={(e) => setTaskForm({...taskForm, deadline: e.target.value})}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>Приоритет</Label>
                      <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({...taskForm, priority: v})}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Низкий</SelectItem>
                          <SelectItem value="medium">Средний</SelectItem>
                          <SelectItem value="high">Высокий</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleAddTask} className="bg-gradient-to-r from-purple-600 to-pink-600">
                    Создать
                  </Button>
                  <Button variant="outline" onClick={() => setIsAddingTask(false)}>
                    Отмена
                  </Button>
                </div>
              </Card>
            )}

            <div className="space-y-4">
              {tasks.length === 0 ? (
                <Card className="p-12 text-center bg-white border-2 border-dashed border-purple-200">
                  <Icon name="ListTodo" size={48} className="mx-auto mb-4 text-purple-300" />
                  <p className="text-gray-600">Нет задач</p>
                </Card>
              ) : (
                tasks
                  .filter(task => {
                    const matchesSearch = taskSearch === '' ||
                      task.title.toLowerCase().includes(taskSearch.toLowerCase()) ||
                      task.description?.toLowerCase().includes(taskSearch.toLowerCase());
                    
                    const matchesFilter = 
                      taskFilter === 'all' ||
                      (taskFilter === 'active' && !task.completed) ||
                      (taskFilter === 'completed' && task.completed);
                    
                    return matchesSearch && matchesFilter;
                  })
                  .map((task) => (
                  <Card key={task.id} className={`p-5 bg-white hover:shadow-xl transition-all ${task.completed ? 'opacity-60' : ''}`}>
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={task.completed}
                        onCheckedChange={() => handleToggleTask(task)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <h3 className={`font-bold ${task.completed ? 'line-through text-gray-500' : ''}`}>{task.title}</h3>
                        {task.description && <p className="text-sm text-gray-600 mt-1">{task.description}</p>}
                        <div className="flex items-center gap-2 mt-2">
                          {task.subject && <Badge variant="outline">{task.subject}</Badge>}
                          {task.deadline && (
                            <Badge variant="outline">
                              <Icon name="Clock" size={12} className="mr-1" />
                              {new Date(task.deadline).toLocaleString('ru-RU', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </Badge>
                          )}
                          <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`}></div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-red-500 hover:bg-red-50"
                      >
                        <Icon name="Trash2" size={18} />
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-5">
            <div className="mb-6">
              <h2 className="text-3xl font-heading font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">Аналитика</h2>
              <p className="text-blue-600/70 text-sm mt-1">Статистика вашей учёбы</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-5 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600 font-medium">Всего задач</p>
                  <Icon name="ListTodo" size={20} className="text-indigo-500" />
                </div>
                <p className="text-3xl font-bold text-indigo-600">{tasks.length}</p>
                <p className="text-xs text-gray-500 mt-1">{activeTasks.length} активных</p>
              </Card>

              <Card className="p-5 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600 font-medium">Выполнено за неделю</p>
                  <Icon name="CheckCircle2" size={20} className="text-green-500" />
                </div>
                <p className="text-3xl font-bold text-green-600">{weekCompletionRate}%</p>
                <p className="text-xs text-gray-500 mt-1">{weekCompleted} из {weekTasks.length} задач</p>
              </Card>

              <Card className="p-5 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600 font-medium">Просрочено</p>
                  <Icon name="AlertCircle" size={20} className="text-red-500" />
                </div>
                <p className="text-3xl font-bold text-red-600">{overdueTasks.length}</p>
                <p className="text-xs text-gray-500 mt-1">Требуют внимания</p>
              </Card>

              <Card className="p-5 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600 font-medium">Высокий приоритет</p>
                  <Icon name="Flag" size={20} className="text-orange-500" />
                </div>
                <p className="text-3xl font-bold text-orange-600">{highPriorityTasks.length}</p>
                <p className="text-xs text-gray-500 mt-1">Важных задач</p>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 bg-white">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Icon name="Calendar" size={20} className="text-purple-600" />
                  Расписание
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Всего занятий в неделю</span>
                    <span className="text-xl font-bold text-purple-600">{schedule.length}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Предметов</span>
                    <span className="text-xl font-bold text-indigo-600">{uniqueSubjects.length}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Часов в неделю</span>
                    <span className="text-xl font-bold text-blue-600">{totalScheduleHours.toFixed(1)}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Icon name="TrendingUp" size={20} className="text-green-600" />
                  Прогресс по предметам
                </h3>
                <div className="space-y-3">
                  {Object.keys(subjectStats).length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">Нет данных по предметам</p>
                  ) : (
                    Object.entries(subjectStats).slice(0, 5).map(([subject, stats]) => {
                      const rate = Math.round((stats.completed / stats.total) * 100);
                      return (
                        <div key={subject}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">{subject}</span>
                            <span className="text-sm font-bold text-gray-600">{rate}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all"
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{stats.completed} из {stats.total} задач</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
            </div>

            <Card className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Icon name="Target" size={20} className="text-indigo-600" />
                Общий прогресс
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Выполнение всех задач</span>
                    <span className="text-lg font-bold text-indigo-600">{completionRate}%</span>
                  </div>
                  <div className="w-full bg-white rounded-full h-4">
                    <div 
                      className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 h-4 rounded-full transition-all"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-600">
                    <span>Выполнено: {completedTasks.length}</span>
                    <span>Активных: {activeTasks.length}</span>
                  </div>
                </div>
                {completionRate >= 80 && (
                  <div className="flex items-center gap-2 p-3 bg-green-100 border border-green-300 rounded-lg">
                    <Icon name="Trophy" size={20} className="text-green-600" />
                    <p className="text-sm text-green-800 font-medium">Отличная работа! Так держать! 🎉</p>
                  </div>
                )}
                {overdueTasks.length > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-red-100 border border-red-300 rounded-lg">
                    <Icon name="AlertTriangle" size={20} className="text-red-600" />
                    <p className="text-sm text-red-800 font-medium">У вас {overdueTasks.length} просроченных задач. Обратите внимание!</p>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-5">
            <Card className="p-8 bg-white">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg">
                  <span className="text-3xl font-bold text-white">
                    {user?.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{user?.full_name}</h2>
                  <p className="text-gray-600">{user?.email}</p>
                </div>
              </div>
              <Button onClick={() => navigate('/profile')} className="w-full">
                Редактировать профиль
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Футер с юридическими документами */}
      <footer className="bg-white/70 backdrop-blur-xl border-t border-purple-200/50 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-600">© 2026 Studyfay. Все права защищены.</p>
            <div className="flex items-center gap-4 text-sm">
              <a href="/privacy" className="text-purple-600 hover:underline">Политика конфиденциальности</a>
              <span className="text-gray-400">•</span>
              <a href="/terms" className="text-purple-600 hover:underline">Пользовательское соглашение</a>
            </div>
          </div>
        </div>
      </footer>

      <ExamReminder 
        isOpen={isExamReminderOpen} 
        onClose={() => setIsExamReminderOpen(false)} 
      />
    </div>
  );
};

export default Index;