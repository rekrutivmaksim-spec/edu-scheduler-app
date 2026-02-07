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

const SCHEDULE_URL = 'https://functions.poehali.dev/7030dc26-77cd-4b59-91e6-1be52f31cf8d';

interface PomodoroSession {
  id: number;
  subject: string;
  duration: number;
  completed_at: string;
}

interface DailyStats {
  date: string;
  total_sessions: number;
  total_minutes: number;
  subjects: { [key: string]: number };
}

const Pomodoro = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState(authService.getUser());
  
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const intervalRef = useRef<number | null>(null);
  
  const WORK_TIME = 25 * 60;
  const BREAK_TIME = 5 * 60;

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
        loadStats();
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
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
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
        setDailyStats(data.daily_stats || []);
        setCompletedSessions(data.total_sessions || 0);
        setTotalMinutes(data.total_minutes || 0);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleTimerComplete = async () => {
    setIsRunning(false);
    playNotificationSound();

    if (mode === 'work') {
      if (selectedSubject) {
        await saveSession();
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
      await fetch(`${SCHEDULE_URL}?path=pomodoro-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subject: selectedSubject,
          duration: 25
        })
      });
      
      loadStats();
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  };

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
  };

  const handleStartPause = () => {
    if (!isRunning && mode === 'work' && !selectedSubject) {
      toast({
        title: "Выбери предмет",
        description: "Укажи, над чем будешь работать",
        variant: "destructive"
      });
      return;
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgress = () => {
    const total = mode === 'work' ? WORK_TIME : BREAK_TIME;
    return ((total - timeLeft) / total) * 100;
  };

  const todaySessions = sessions.filter(s => {
    const sessionDate = new Date(s.completed_at).toDateString();
    const today = new Date().toDateString();
    return sessionDate === today;
  });

  const todayMinutes = todaySessions.reduce((sum, s) => sum + s.duration, 0);

  const subjectStats = sessions.reduce((acc, session) => {
    acc[session.subject] = (acc[session.subject] || 0) + session.duration;
    return acc;
  }, {} as { [key: string]: number });

  const topSubjects = Object.entries(subjectStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-rose-100 p-4">
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGnuTwum0" preload="auto" />
      
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <Icon name="ArrowLeft" size={20} className="mr-2" />
            Назад
          </Button>
          <h1 className="text-3xl font-bold text-gray-800">🍅 Помодоро</h1>
          <div className="w-24" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-8 bg-white/80 backdrop-blur">
              <div className="text-center">
                <Badge 
                  className={`mb-6 text-lg px-6 py-2 ${
                    mode === 'work' 
                      ? 'bg-red-500 hover:bg-red-600' 
                      : 'bg-green-500 hover:bg-green-600'
                  }`}
                >
                  {mode === 'work' ? '💼 Работа' : '☕ Перерыв'}
                </Badge>

                <div className="relative mb-8">
                  <div className="text-8xl font-bold text-gray-800 mb-4">
                    {formatTime(timeLeft)}
                  </div>
                  <Progress value={getProgress()} className="h-3" />
                </div>

                {mode === 'work' && (
                  <div className="mb-6">
                    <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                      <SelectTrigger className="w-full max-w-md mx-auto">
                        <SelectValue placeholder="Выбери предмет" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Математика">Математика</SelectItem>
                        <SelectItem value="Физика">Физика</SelectItem>
                        <SelectItem value="Программирование">Программирование</SelectItem>
                        <SelectItem value="Английский">Английский</SelectItem>
                        <SelectItem value="История">История</SelectItem>
                        <SelectItem value="Другое">Другое</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex gap-4 justify-center">
                  <Button 
                    size="lg"
                    onClick={handleStartPause}
                    className={`w-40 ${
                      mode === 'work'
                        ? 'bg-red-500 hover:bg-red-600'
                        : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    <Icon name={isRunning ? "Pause" : "Play"} size={20} className="mr-2" />
                    {isRunning ? 'Пауза' : 'Старт'}
                  </Button>
                  
                  <Button 
                    size="lg"
                    variant="outline"
                    onClick={handleReset}
                    className="w-32"
                  >
                    <Icon name="RotateCcw" size={20} className="mr-2" />
                    Сброс
                  </Button>

                  <Button 
                    size="lg"
                    variant="outline"
                    onClick={handleSkip}
                    className="w-32"
                  >
                    <Icon name="SkipForward" size={20} className="mr-2" />
                    Пропустить
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-white/80 backdrop-blur">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Icon name="TrendingUp" size={24} />
                График за неделю
              </h3>
              
              <div className="space-y-3">
                {weeklyData.map((day, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="w-24 text-sm text-gray-600">
                      {new Date(day.date).toLocaleDateString('ru', { 
                        weekday: 'short', 
                        day: 'numeric' 
                      })}
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
                      {day.minutes} мин
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
                Сегодня
              </h3>
              <div className="space-y-4">
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-4xl font-bold text-red-600">
                    {todaySessions.length}
                  </div>
                  <div className="text-sm text-gray-600">Сессий</div>
                </div>
                <div className="text-center p-4 bg-pink-50 rounded-lg">
                  <div className="text-4xl font-bold text-pink-600">
                    {todayMinutes}
                  </div>
                  <div className="text-sm text-gray-600">Минут</div>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-white/80 backdrop-blur">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Icon name="Award" size={20} />
                Всего
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-red-50 to-pink-50 rounded-lg">
                  <span className="text-gray-700">Сессий</span>
                  <span className="font-bold text-red-600">{completedSessions}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-pink-50 to-rose-50 rounded-lg">
                  <span className="text-gray-700">Минут</span>
                  <span className="font-bold text-pink-600">{totalMinutes}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-rose-50 to-red-50 rounded-lg">
                  <span className="text-gray-700">Часов</span>
                  <span className="font-bold text-rose-600">
                    {(totalMinutes / 60).toFixed(1)}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-white/80 backdrop-blur">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Icon name="BookOpen" size={20} />
                Топ предметов
              </h3>
              <div className="space-y-3">
                {topSubjects.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Начни первую сессию
                  </p>
                ) : (
                  topSubjects.map(([subject, minutes], idx) => (
                    <div key={subject} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white font-bold">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{subject}</div>
                        <div className="text-xs text-gray-500">{minutes} минут</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>

        <Card className="mt-6 p-6 bg-white/80 backdrop-blur">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Icon name="Info" size={20} />
            Что такое Помодоро?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-700">
            <div className="p-4 bg-red-50 rounded-lg">
              <div className="text-2xl mb-2">1️⃣</div>
              <div className="font-semibold mb-1">Выбери задачу</div>
              <div className="text-xs text-gray-600">Определи, над чем будешь работать</div>
            </div>
            <div className="p-4 bg-pink-50 rounded-lg">
              <div className="text-2xl mb-2">2️⃣</div>
              <div className="font-semibold mb-1">Работай 25 минут</div>
              <div className="text-xs text-gray-600">Полная концентрация на задаче</div>
            </div>
            <div className="p-4 bg-rose-50 rounded-lg">
              <div className="text-2xl mb-2">3️⃣</div>
              <div className="font-semibold mb-1">Отдохни 5 минут</div>
              <div className="text-xs text-gray-600">Короткий перерыв для восстановления</div>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <div className="text-2xl mb-2">4️⃣</div>
              <div className="font-semibold mb-1">Повтори 4 раза</div>
              <div className="text-xs text-gray-600">После 4 циклов — большой перерыв</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Pomodoro;
