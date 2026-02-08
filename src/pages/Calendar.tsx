import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

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

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  lessons: Lesson[];
  tasks: Task[];
}

const Calendar = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedule, setSchedule] = useState<Lesson[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      if (!authService.isAuthenticated()) {
        navigate('/login');
        return;
      }
      await loadSchedule();
      await loadTasks();
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

  const generateCalendarDays = (): CalendarDay[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const daysInMonth = lastDay.getDate();
    
    const days: CalendarDay[] = [];
    
    for (let i = 0; i < startDay; i++) {
      const date = new Date(year, month, -startDay + i + 1);
      days.push({
        date,
        isCurrentMonth: false,
        lessons: getLessonsForDate(date),
        tasks: getTasksForDate(date)
      });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({
        date,
        isCurrentMonth: true,
        lessons: getLessonsForDate(date),
        tasks: getTasksForDate(date)
      });
    }
    
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      days.push({
        date,
        isCurrentMonth: false,
        lessons: getLessonsForDate(date),
        tasks: getTasksForDate(date)
      });
    }
    
    return days;
  };

  const getLessonsForDate = (date: Date): Lesson[] => {
    const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
    return schedule.filter(l => l.day_of_week === dayOfWeek);
  };

  const getTasksForDate = (date: Date): Task[] => {
    return tasks.filter(t => {
      if (!t.deadline) return false;
      const taskDate = new Date(t.deadline);
      return taskDate.toDateString() === date.toDateString();
    });
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const calendarDays = generateCalendarDays();

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
                <Icon name="ArrowLeft" size={20} className="text-purple-600 dark:text-purple-400 sm:w-6 sm:h-6" />
              </Button>
              <div className="overflow-hidden">
                <h1 className="text-lg sm:text-2xl font-heading font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent truncate">
                  Календарь
                </h1>
                <p className="text-[10px] sm:text-xs text-purple-600/70 font-medium truncate">Расписание и дедлайны</p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button onClick={previousMonth} variant="ghost" size="icon" className="rounded-xl h-8 w-8 sm:h-10 sm:w-10">
                <Icon name="ChevronLeft" size={18} className="sm:w-5 sm:h-5" />
              </Button>
              <div className="px-2 sm:px-4 py-1.5 sm:py-2 bg-white dark:bg-gray-800 rounded-xl border-2 border-purple-200 dark:border-purple-700 font-bold text-gray-800 dark:text-gray-100 text-xs sm:text-base whitespace-nowrap">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </div>
              <Button onClick={nextMonth} variant="ghost" size="icon" className="rounded-xl h-8 w-8 sm:h-10 sm:w-10">
                <Icon name="ChevronRight" size={18} className="sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="p-6 bg-white">
              <div className="grid grid-cols-7 gap-2 mb-4">
                {weekDays.map(day => (
                  <div key={day} className="text-center font-bold text-gray-600 dark:text-gray-300 text-sm py-2">
                    {day}
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, index) => {
                  const hasEvents = day.lessons.length > 0 || day.tasks.length > 0;
                  const hasDeadlines = day.tasks.some(t => !t.completed);
                  
                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedDay(day)}
                      className={`
                        aspect-square p-2 rounded-xl border-2 transition-all duration-200
                        ${!day.isCurrentMonth ? 'opacity-30' : ''}
                        ${isToday(day.date) ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white border-indigo-700' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20'}
                        ${selectedDay?.date.toDateString() === day.date.toDateString() ? 'ring-2 ring-purple-500' : ''}
                      `}
                    >
                      <div className="text-sm font-semibold mb-1">
                        {day.date.getDate()}
                      </div>
                      {hasEvents && (
                        <div className="flex flex-col gap-1">
                          {day.lessons.length > 0 && (
                            <div className={`h-1 w-full rounded-full ${isToday(day.date) ? 'bg-white/50' : 'bg-indigo-400'}`}></div>
                          )}
                          {hasDeadlines && (
                            <div className={`h-1 w-full rounded-full ${isToday(day.date) ? 'bg-yellow-300' : 'bg-red-400'}`}></div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-1">
            {selectedDay ? (
              <Card className="p-6 bg-white dark:bg-gray-800">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 dark:text-gray-100">
                  <Icon name="CalendarDays" size={20} className="text-purple-600 dark:text-purple-400" />
                  {selectedDay.date.toLocaleDateString('ru-RU', { 
                    day: 'numeric', 
                    month: 'long',
                    weekday: 'long'
                  })}
                </h3>

                {selectedDay.lessons.length === 0 && selectedDay.tasks.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                    <Icon name="Calendar" size={48} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Нет событий</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedDay.lessons.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-2">
                          <Icon name="BookOpen" size={16} />
                          Занятия ({selectedDay.lessons.length})
                        </h4>
                        <div className="space-y-2">
                          {selectedDay.lessons.map(lesson => (
                            <Card key={lesson.id} className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800">
                              <div className="flex items-start gap-2">
                                <Badge className="bg-indigo-600 text-xs">{lesson.start_time}</Badge>
                                <div className="flex-1">
                                  <p className="font-semibold text-sm dark:text-gray-100">{lesson.subject}</p>
                                  <p className="text-xs text-gray-600 dark:text-gray-300">{lesson.type}</p>
                                  {lesson.room && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      <Icon name="MapPin" size={12} className="inline mr-1" />
                                      {lesson.room}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedDay.tasks.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-2">
                          <Icon name="CheckSquare" size={16} />
                          Задачи ({selectedDay.tasks.length})
                        </h4>
                        <div className="space-y-2">
                          {selectedDay.tasks.map(task => (
                            <Card 
                              key={task.id} 
                              className={`p-3 ${
                                task.completed 
                                  ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' 
                                  : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                {task.completed ? (
                                  <Icon name="CheckCircle2" size={16} className="text-green-600 mt-1" />
                                ) : (
                                  <Icon name="AlertCircle" size={16} className="text-red-600 mt-1" />
                                )}
                                <div className="flex-1">
                                  <p className={`font-semibold text-sm ${task.completed ? 'line-through text-gray-500 dark:text-gray-400' : 'dark:text-gray-100'}`}>
                                    {task.title}
                                  </p>
                                  {task.subject && (
                                    <Badge variant="secondary" className="text-xs mt-1">
                                      {task.subject}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ) : (
              <Card className="p-6 bg-white text-center">
                <Icon name="MousePointerClick" size={48} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 text-sm">
                  Выберите день в календаре, чтобы увидеть детали
                </p>
              </Card>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 border-2 border-indigo-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
                <Icon name="BookOpen" size={20} className="text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo-800">{schedule.length}</p>
                <p className="text-xs text-indigo-600">Занятий в неделю</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center">
                <Icon name="AlertCircle" size={20} className="text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-800">
                  {tasks.filter(t => !t.completed && t.deadline).length}
                </p>
                <p className="text-xs text-red-600">Активных дедлайнов</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center">
                <Icon name="CheckCircle2" size={20} className="text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-800">
                  {tasks.filter(t => t.completed).length}
                </p>
                <p className="text-xs text-green-600">Выполнено задач</p>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Calendar;