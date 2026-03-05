import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { dailyCheckin } from '@/lib/gamification';
import BottomNav from '@/components/BottomNav';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import DashboardSuggestions from '@/components/dashboard/DashboardSuggestions';
import DashboardCards from '@/components/dashboard/DashboardCards';
import DashboardQuickLinks from '@/components/dashboard/DashboardQuickLinks';

const SCHEDULE_URL = 'https://functions.poehali.dev/7030dc26-77cd-4b59-91e6-1be52f31cf8d';
const GAMIFICATION_URL = 'https://functions.poehali.dev/0559fb04-cd62-4e50-bb12-dfd6941a7080';

interface DashboardData {
  user: {
    name: string;
    level: number;
    xp_total: number;
    xp_progress: number;
    xp_needed: number;
    is_premium: boolean;
  };
  gpa: number | null;
  scholarship_forecast: string | null;
  streak: { current: number; longest: number };
  tasks: {
    total: number;
    completed: number;
    today_done: number;
    upcoming: Array<{ id: number; title: string; subject: string; deadline: string; priority: string }>;
  };
  pomodoro: {
    today_sessions: number;
    today_minutes: number;
    total_minutes: number;
    total_sessions: number;
    week_chart: Array<{ day: string; minutes: number }>;
  };
  achievements: {
    unlocked: number;
    recent: Array<{ code: string; title: string; icon: string; xp_reward: number }>;
  };
  today_schedule: Array<{ subject: string; type: string; start_time: string; end_time: string; room: string; teacher: string }>;
  subject_grades: Array<{ subject: string; avg: number }>;
}

interface Suggestion {
  type: string;
  title: string;
  description: string;
  action: string;
  action_data: Record<string, string | number>;
  priority: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedIn, setCheckedIn] = useState(false);
  const [tutorSavings, setTutorSavings] = useState<number>(0);

  useEffect(() => {
    const init = async () => {
      if (!authService.isAuthenticated()) {
        navigate('/auth');
        return;
      }
      const user = await authService.verifyToken();
      if (!user) {
        navigate('/auth');
        return;
      }
      await Promise.all([loadDashboard(), loadSuggestions(), doCheckin(), loadTutorSavings()]);
      setLoading(false);
    };
    init();
  }, [navigate]);

  const loadTutorSavings = async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${GAMIFICATION_URL}?action=profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setTutorSavings(d.stats?.tutor_savings || 0);
      }
    } catch { /* silent */ }
  };

  const loadDashboard = async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${SCHEDULE_URL}?path=dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch { /* silent */ }
  };

  const loadSuggestions = async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${SCHEDULE_URL}?path=suggestions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setSuggestions(d.suggestions || []);
      }
    } catch { /* silent */ }
  };

  const doCheckin = async () => {
    if (checkedIn) return;
    const result = await dailyCheckin();
    if (result?.xp_gained && result.xp_gained > 0) {
      toast({ title: `✨ +${result.xp_gained} XP`, description: 'Ежедневный чекин!' });
    }
    setCheckedIn(true);
  };

  const generateAutoTasks = async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${SCHEDULE_URL}?path=auto-tasks`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        if (d.count > 0) {
          toast({ title: `✅ Создано ${d.count} задач`, description: 'Подготовительные задачи добавлены' });
          loadDashboard();
        } else {
          toast({ title: 'Нет новых задач', description: 'Все подготовительные задачи уже созданы' });
        }
      }
    } catch { /* silent */ }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex flex-col items-center justify-center gap-4 p-4">
        <Icon name="AlertCircle" size={48} className="text-gray-400" />
        <p className="text-gray-600 text-center">{'Не удалось загрузить данные'}</p>
        <Button onClick={() => window.location.reload()}>{'Попробовать снова'}</Button>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 pb-nav">
      <DashboardHeader
        user={data.user}
        gpa={data.gpa}
        scholarship_forecast={data.scholarship_forecast}
        streak={data.streak}
        achievements={{ unlocked: data.achievements.unlocked }}
        tutorSavings={tutorSavings}
      />

      <div className="max-w-4xl mx-auto px-4 -mt-4 space-y-4">
        <DashboardSuggestions
          suggestions={suggestions}
          today_schedule={data.today_schedule}
        />

        <DashboardCards
          tasks={data.tasks}
          pomodoro={data.pomodoro}
          subject_grades={data.subject_grades}
          achievements={data.achievements}
          onGenerateAutoTasks={generateAutoTasks}
        />

        <DashboardQuickLinks />
      </div>
      <BottomNav />
    </div>
  );
};

export default Dashboard;
