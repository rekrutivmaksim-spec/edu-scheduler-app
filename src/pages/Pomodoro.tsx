import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { trackActivity } from '@/lib/gamification';
import BottomNav from '@/components/BottomNav';

const SCHEDULE_URL = 'https://functions.poehali.dev/7030dc26-77cd-4b59-91e6-1be52f31cf8d';

interface PomodoroSession {
  id: number;
  subject: string;
  duration: number;
  completed_at: string;
  task_id?: number;
}

interface TaskItem {
  id: number;
  title: string;
  subject?: string;
  deadline?: string;
  priority: string;
  completed: boolean;
}

const Pomodoro = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState(authService.getUser());

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectMode, setSelectMode] = useState<'subject' | 'task'>('task');
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);

  const audioRef = useRef<HTMLAudioElement>(null);
  const intervalRef = useRef<number | null>(null);

  const WORK_TIME = 25 * 60;
  const BREAK_TIME = 5 * 60;

  useEffect(() => {
    const checkAuth = async () => {
      if (!authService.isAuthenticated()) {
        navigate('/auth');
        return;
      }
      const verifiedUser = await authService.verifyToken();
      if (!verifiedUser) {
        navigate('/auth');
      } else {
        setUser(verifiedUser);
        loadStats();
        loadTasks();
        loadSubjects();
      }
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = window.setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handleTimerComplete();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, timeLeft]);

  const loadStats = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${SCHEDULE_URL}?path=pomodoro-stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
        setCompletedSessions(data.total_sessions || 0);
        setTotalMinutes(data.total_minutes || 0);
      }
    } catch { /* silent */ }
  };

  const loadTasks = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${SCHEDULE_URL}?path=tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTasks((data.tasks || []).filter((t: TaskItem) => !t.completed));
      }
    } catch { /* silent */ }
  };

  const loadSubjects = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${SCHEDULE_URL}?path=schedule`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const unique = [...new Set((data.schedule || []).map((l: { subject: string }) => l.subject))] as string[];
        setSubjects(unique.length > 0 ? unique : ['Математика', 'Физика', 'Программирование', 'Английский', 'Другое']);
      }
    } catch { /* silent */ }
  };

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  const handleTimerComplete = async () => {
    setIsRunning(false);
    playNotificationSound();

    if (mode === 'work') {
      const subj = selectedTask?.subject || selectedSubject;
      if (subj || selectedTaskId) {
        await saveSession();
      }

      const result = await trackActivity('pomodoro_minutes', 25);
      if (result?.new_achievements?.length) {
        result.new_achievements.forEach((ach) => {
          toast({
            title: `🏆 Достижение!`,
            description: `${ach.title} (+${ach.xp_reward} XP)`,
          });
        });
      } else if (result?.xp_gained) {
        toast({
          title: `🍅 +${result.xp_gained} XP`,
          description: `Отличная сессия! Время отдохнуть`,
        });
      }

      toast({
        title: "🎉 Сессия завершена!",
        description: "Время отдохнуть 5 минут",
      });

      setMode('break');
      setTimeLeft(BREAK_TIME);
    } else {
      toast({
        title: "✅ Перерыв окончен",
        description: "Готов к новой сессии?",
      });
      setMode('work');
      setTimeLeft(WORK_TIME);
    }
  };

  const saveSession = async () => {
    try {
      const token = authService.getToken();
      const subj = selectedTask?.subject || selectedSubject || 'Другое';
      await fetch(`${SCHEDULE_URL}?path=pomodoro-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subject: subj,
          duration: 25,
          task_id: selectedTaskId
        })
      });
      loadStats();
    } catch { /* silent */ }
  };

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  };

  const handleStartPause = () => {
    if (!isRunning && mode === 'work') {
      if (selectMode === 'task' && !selectedTaskId) {
        toast({ title: "Выбери задачу", description: "Укажи, над чем будешь работать", variant: "destructive" });
        return;
      }
      if (selectMode === 'subject' && !selectedSubject) {
        toast({ title: "Выбери предмет", description: "Укажи, над чем будешь работать", variant: "destructive" });
        return;
      }
    }
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(mode === 'work' ? WORK_TIME : BREAK_TIME);
  };

  const handleSkip = () => {
    setIsRunning(false);
    if (mode === 'work') {
      setMode('break');
      setTimeLeft(BREAK_TIME);
    } else {
      setMode('work');
      setTimeLeft(WORK_TIME);
    }
  };

  const handleSelectTask = (taskId: string) => {
    const id = parseInt(taskId);
    setSelectedTaskId(id);
    const task = tasks.find(t => t.id === id);
    if (task?.subject) setSelectedSubject(task.subject);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgress = () => {
    const total = mode === 'work' ? WORK_TIME : BREAK_TIME;
    return ((total - timeLeft) / total) * 100;
  };

  const getPriorityColor = (p: string) => {
    if (p === 'high') return 'text-red-600';
    if (p === 'medium') return 'text-yellow-600';
    return 'text-green-600';
  };

  const todaySessions = sessions.filter(s => {
    return new Date(s.completed_at).toDateString() === new Date().toDateString();
  });
  const todayMinutes = todaySessions.reduce((sum, s) => sum + s.duration, 0);

  const subjectStats = sessions.reduce((acc, session) => {
    acc[session.subject] = (acc[session.subject] || 0) + session.duration;
    return acc;
  }, {} as { [key: string]: number });

  const topSubjects = Object.entries(subjectStats).sort(([, a], [, b]) => b - a).slice(0, 5);

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split('T')[0];
  }).reverse();

  const weeklyData = last7Days.map(date => {
    const daySessions = sessions.filter(s =>
      new Date(s.completed_at).toISOString().split('T')[0] === date
    );
    return {
      date,
      sessions: daySessions.length,
      minutes: daySessions.reduce((sum, s) => sum + s.duration, 0)
    };
  });

  const maxMinutes = Math.max(...weeklyData.map(d => d.minutes), 1);

  const hourlyStats = sessions.reduce((acc, session) => {
    const hour = new Date(session.completed_at).getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {} as { [key: number]: number });

  const timeBlocks = [
    { name: '\u0423\u0442\u0440\u043e', icon: 'Sunrise', hours: [6, 7, 8, 9, 10, 11], color: 'from-yellow-400 to-orange-500' },
    { name: '\u0414\u0435\u043d\u044c', icon: 'Sun', hours: [12, 13, 14, 15, 16, 17], color: 'from-orange-400 to-red-500' },
    { name: '\u0412\u0435\u0447\u0435\u0440', icon: 'Sunset', hours: [18, 19, 20, 21, 22], color: 'from-purple-400 to-pink-500' },
    { name: '\u041d\u043e\u0447\u044c', icon: 'Moon', hours: [23, 0, 1, 2, 3, 4, 5], color: 'from-indigo-500 to-purple-700' }
  ];

  const productivityByTime = timeBlocks.map(block => {
    const blockSessions = block.hours.reduce((sum, hour) => sum + (hourlyStats[hour] || 0), 0);
    const totalSessions = Object.values(hourlyStats).reduce((a, b) => a + b, 0);
    return {
      ...block,
      sessions: blockSessions,
      percentage: blockSessions > 0 ? Math.round((blockSessions / totalSessions) * 100) : 0
    };
  });

  const mostProductiveTime = productivityByTime.reduce((max, curr) =>
    curr.sessions > max.sessions ? curr : max, productivityByTime[0]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-rose-100 p-3 sm:p-4 pb-24">
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGnuTwum0" preload="auto" />

      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="h-9">
            <Icon name="ArrowLeft" size={18} className="mr-1.5 sm:mr-2 sm:w-5 sm:h-5" />
            <span className="hidden xs:inline">{'\u041d\u0430\u0437\u0430\u0434'}</span>
          </Button>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">{'\u{1F345} \u041f\u043e\u043c\u043e\u0434\u043e\u0440\u043e'}</h1>
          <div className="w-12 sm:w-24" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {selectedTask && isRunning && (
              <Card className="p-3 sm:p-4 bg-gradient-to-r from-red-500 to-pink-500 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Icon name="Target" size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium opacity-80">{'\u0420\u0430\u0431\u043e\u0442\u0430\u044e \u043d\u0430\u0434'}</p>
                    <p className="font-bold truncate">{selectedTask.title}</p>
                  </div>
                  {selectedTask.subject && (
                    <Badge className="bg-white/20 text-white border-0 text-xs">{selectedTask.subject}</Badge>
                  )}
                </div>
              </Card>
            )}

            <Card className="p-4 sm:p-6 lg:p-8 bg-white/80 backdrop-blur">
              <div className="text-center">
                <Badge
                  className={`mb-4 sm:mb-6 text-sm sm:text-base lg:text-lg px-4 sm:px-6 py-1.5 sm:py-2 ${
                    mode === 'work'
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-green-500 hover:bg-green-600'
                  }`}
                >
                  {mode === 'work' ? '\u{1F4BC} \u0420\u0430\u0431\u043e\u0442\u0430' : '\u2615 \u041f\u0435\u0440\u0435\u0440\u044b\u0432'}
                </Badge>

                <div className="relative mb-6 sm:mb-8">
                  <div className="text-5xl sm:text-6xl lg:text-8xl font-bold text-gray-800 mb-3 sm:mb-4">
                    {formatTime(timeLeft)}
                  </div>
                  <Progress value={getProgress()} className="h-2 sm:h-3" />
                </div>

                {mode === 'work' && !isRunning && (
                  <div className="mb-4 sm:mb-6 max-w-md mx-auto">
                    <Tabs value={selectMode} onValueChange={(v) => setSelectMode(v as 'subject' | 'task')}>
                      <TabsList className="w-full mb-3">
                        <TabsTrigger value="task" className="flex-1 text-xs sm:text-sm">
                          <Icon name="CheckSquare" size={14} className="mr-1" />
                          {'\u0417\u0430\u0434\u0430\u0447\u0430'}
                        </TabsTrigger>
                        <TabsTrigger value="subject" className="flex-1 text-xs sm:text-sm">
                          <Icon name="BookOpen" size={14} className="mr-1" />
                          {'\u041f\u0440\u0435\u0434\u043c\u0435\u0442'}
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="task">
                        {tasks.length > 0 ? (
                          <Select value={selectedTaskId?.toString() || ''} onValueChange={handleSelectTask}>
                            <SelectTrigger className="w-full text-sm sm:text-base h-10 sm:h-11">
                              <SelectValue placeholder={'\u0412\u044b\u0431\u0435\u0440\u0438 \u0437\u0430\u0434\u0430\u0447\u0443'} />
                            </SelectTrigger>
                            <SelectContent>
                              {tasks.map(task => (
                                <SelectItem key={task.id} value={task.id.toString()}>
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                                    <span className="truncate max-w-[200px]">{task.title}</span>
                                    {task.subject && <span className="text-xs text-gray-400 ml-1">({task.subject})</span>}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg text-center">
                            {'\u041d\u0435\u0442 \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u0437\u0430\u0434\u0430\u0447. '}
                            <button onClick={() => navigate('/')} className="text-red-500 underline">{'\u0421\u043e\u0437\u0434\u0430\u0442\u044c'}</button>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="subject">
                        <Select value={selectedSubject} onValueChange={(v) => { setSelectedSubject(v); setSelectedTaskId(null); }}>
                          <SelectTrigger className="w-full text-sm sm:text-base h-10 sm:h-11">
                            <SelectValue placeholder={'\u0412\u044b\u0431\u0435\u0440\u0438 \u043f\u0440\u0435\u0434\u043c\u0435\u0442'} />
                          </SelectTrigger>
                          <SelectContent>
                            {subjects.map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TabsContent>
                    </Tabs>
                  </div>
                )}

                {mode === 'work' && isRunning && (selectedSubject || selectedTask) && (
                  <div className="mb-4 sm:mb-6">
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      <Icon name={selectMode === 'task' ? 'CheckSquare' : 'BookOpen'} size={14} className="mr-1.5" />
                      {selectedTask ? selectedTask.title : selectedSubject}
                    </Badge>
                  </div>
                )}

                <div className="flex flex-col xs:flex-row gap-2 sm:gap-3 lg:gap-4 justify-center">
                  <Button
                    size="lg"
                    onClick={handleStartPause}
                    className={`w-full xs:w-32 sm:w-40 text-sm sm:text-base h-10 sm:h-11 ${
                      mode === 'work'
                        ? 'bg-red-500 hover:bg-red-600'
                        : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    <Icon name={isRunning ? "Pause" : "Play"} size={18} className="mr-1.5 sm:mr-2 sm:w-5 sm:h-5" />
                    {isRunning ? '\u041f\u0430\u0443\u0437\u0430' : '\u0421\u0442\u0430\u0440\u0442'}
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleReset}
                    className="w-full xs:w-28 sm:w-32 text-sm sm:text-base h-10 sm:h-11"
                  >
                    <Icon name="RotateCcw" size={18} className="mr-1.5 sm:mr-2 sm:w-5 sm:h-5" />
                    {'\u0421\u0431\u0440\u043e\u0441'}
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleSkip}
                    className="w-full xs:w-28 sm:w-32 text-sm sm:text-base h-10 sm:h-11"
                  >
                    <Icon name="SkipForward" size={18} className="mr-1.5 sm:mr-2 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">{'\u041f\u0440\u043e\u043f\u0443\u0441\u0442\u0438\u0442\u044c'}</span>
                    <span className="sm:hidden">{'\u0414\u0430\u043b\u0435\u0435'}</span>
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-white/80 backdrop-blur">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Icon name="TrendingUp" size={24} />
                {'\u0413\u0440\u0430\u0444\u0438\u043a \u0437\u0430 \u043d\u0435\u0434\u0435\u043b\u044e'}
              </h3>
              <div className="space-y-3">
                {weeklyData.map((day, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="w-24 text-sm text-gray-600">
                      {new Date(day.date).toLocaleDateString('ru', { weekday: 'short', day: 'numeric' })}
                    </div>
                    <div className="flex-1">
                      <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="absolute h-full bg-gradient-to-r from-red-500 to-pink-500 rounded-full transition-all"
                          style={{ width: `${(day.minutes / maxMinutes) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-20 text-right font-semibold text-gray-700">
                      {day.minutes} {'\u043c\u0438\u043d'}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6 bg-white/80 backdrop-blur">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Icon name="Calendar" size={20} />
                {'\u0421\u0435\u0433\u043e\u0434\u043d\u044f'}
              </h3>
              <div className="space-y-4">
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-4xl font-bold text-red-600">{todaySessions.length}</div>
                  <div className="text-sm text-gray-600">{'\u0421\u0435\u0441\u0441\u0438\u0439'}</div>
                </div>
                <div className="text-center p-4 bg-pink-50 rounded-lg">
                  <div className="text-4xl font-bold text-pink-600">{todayMinutes}</div>
                  <div className="text-sm text-gray-600">{'\u041c\u0438\u043d\u0443\u0442'}</div>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-white/80 backdrop-blur">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Icon name="Award" size={20} />
                {'\u0412\u0441\u0435\u0433\u043e'}
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-red-50 to-pink-50 rounded-lg">
                  <span className="text-gray-700">{'\u0421\u0435\u0441\u0441\u0438\u0439'}</span>
                  <span className="font-bold text-red-600">{completedSessions}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-pink-50 to-rose-50 rounded-lg">
                  <span className="text-gray-700">{'\u041c\u0438\u043d\u0443\u0442'}</span>
                  <span className="font-bold text-pink-600">{totalMinutes}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-rose-50 to-red-50 rounded-lg">
                  <span className="text-gray-700">{'\u0427\u0430\u0441\u043e\u0432'}</span>
                  <span className="font-bold text-rose-600">{(totalMinutes / 60).toFixed(1)}</span>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-white/80 backdrop-blur">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Icon name="Clock" size={20} />
                {'\u041a\u043e\u0433\u0434\u0430 \u0442\u044b \u043f\u0440\u043e\u0434\u0443\u043a\u0442\u0438\u0432\u043d\u0435\u0435?'}
              </h3>
              <div className="space-y-4">
                {sessions.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">{'\u041d\u0430\u0447\u043d\u0438 \u0441\u0435\u0441\u0441\u0438\u0438, \u0447\u0442\u043e\u0431\u044b \u0443\u0432\u0438\u0434\u0435\u0442\u044c \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0443'}</p>
                ) : (
                  <>
                    {productivityByTime.map((block) => (
                      <div key={block.name} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon name={block.icon} size={16} className="text-gray-600" />
                            <span className="text-sm font-semibold">{block.name}</span>
                          </div>
                          <span className="text-xs text-gray-600">{block.sessions} {'\u0441\u0435\u0441\u0441\u0438\u0439'}</span>
                        </div>
                        <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`absolute h-full bg-gradient-to-r ${block.color} rounded-full transition-all`}
                            style={{ width: `${block.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {mostProductiveTime.sessions > 0 && (
                      <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Icon name="TrendingUp" size={16} className="text-green-600" />
                          <span className="text-xs font-semibold text-green-800">
                            {'\u0422\u0432\u043e\u0439 \u043f\u0438\u043a: '}{mostProductiveTime.name}!
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>

            <Card className="p-6 bg-white/80 backdrop-blur">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Icon name="BookOpen" size={20} />
                {'\u0422\u043e\u043f \u043f\u0440\u0435\u0434\u043c\u0435\u0442\u043e\u0432'}
              </h3>
              <div className="space-y-3">
                {topSubjects.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">{'\u041d\u0430\u0447\u043d\u0438 \u043f\u0435\u0440\u0432\u0443\u044e \u0441\u0435\u0441\u0441\u0438\u044e'}</p>
                ) : (
                  topSubjects.map(([subject, minutes], idx) => (
                    <div key={subject} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white font-bold">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{subject}</div>
                        <div className="text-xs text-gray-500">{minutes} {'\u043c\u0438\u043d\u0443\u0442'}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Pomodoro;