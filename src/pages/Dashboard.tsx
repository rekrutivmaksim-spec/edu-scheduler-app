import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { dailyCheckin } from '@/lib/gamification';
import BottomNav from '@/components/BottomNav';

const SCHEDULE_URL = 'https://functions.poehali.dev/7030dc26-77cd-4b59-91e6-1be52f31cf8d';

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
      await Promise.all([loadDashboard(), loadSuggestions(), doCheckin()]);
      setLoading(false);
    };
    init();
  }, [navigate]);

  const loadDashboard = async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${SCHEDULE_URL}?path=dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error('Dashboard load failed:', e);
    }
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
    } catch (e) {
      console.error('Suggestions load failed:', e);
    }
  };

  const doCheckin = async () => {
    if (checkedIn) return;
    const result = await dailyCheckin();
    if (result?.xp_gained && result.xp_gained > 0) {
      toast({ title: `\u2728 +${result.xp_gained} XP`, description: '\u0415\u0436\u0435\u0434\u043d\u0435\u0432\u043d\u044b\u0439 \u0447\u0435\u043a\u0438\u043d!' });
    }
    setCheckedIn(true);
  };

  const handleSuggestionAction = (suggestion: Suggestion) => {
    if (suggestion.action === 'start_pomodoro') {
      navigate('/pomodoro');
    } else if (suggestion.action === 'focus_task') {
      navigate('/');
    } else if (suggestion.action === 'generate_summary') {
      navigate('/assistant');
    }
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
          toast({ title: `\u2705 \u0421\u043e\u0437\u0434\u0430\u043d\u043e ${d.count} \u0437\u0430\u0434\u0430\u0447`, description: '\u041f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u044b' });
          loadDashboard();
        } else {
          toast({ title: '\u041d\u0435\u0442 \u043d\u043e\u0432\u044b\u0445 \u0437\u0430\u0434\u0430\u0447', description: '\u0412\u0441\u0435 \u043f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 \u0443\u0436\u0435 \u0441\u043e\u0437\u0434\u0430\u043d\u044b' });
        }
      }
    } catch (e) {
      console.error('Auto-tasks failed:', e);
    }
  };

  const getLevelEmoji = (level: number) => {
    if (level <= 10) return '\u{1F331}';
    if (level <= 20) return '\u{1F33F}';
    if (level <= 30) return '\u{1F333}';
    if (level <= 50) return '\u2B50';
    if (level <= 70) return '\u{1F48E}';
    return '\u{1F680}';
  };

  const getSuggestionIcon = (type: string) => {
    const map: Record<string, string> = {
      neglected_subject: 'BookX',
      urgent_deadline: 'AlertTriangle',
      exam_tomorrow: 'GraduationCap',
      low_grade: 'TrendingDown'
    };
    return map[type] || 'Lightbulb';
  };

  const getSuggestionColor = (type: string) => {
    const map: Record<string, string> = {
      neglected_subject: 'from-blue-500 to-indigo-500',
      urgent_deadline: 'from-red-500 to-orange-500',
      exam_tomorrow: 'from-purple-500 to-pink-500',
      low_grade: 'from-yellow-500 to-orange-500'
    };
    return map[type] || 'from-gray-500 to-gray-600';
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const taskCompletionRate = data.tasks.total > 0 ? Math.round((data.tasks.completed / data.tasks.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 pb-24">
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white px-4 pt-6 pb-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-purple-200 text-sm">{'\u041f\u0440\u0438\u0432\u0435\u0442, '}{data.user.name.split(' ')[0]}!</p>
              <h1 className="text-2xl font-bold">{'\u0422\u0432\u043e\u044f \u0441\u0432\u043e\u0434\u043a\u0430'}</h1>
            </div>
            <div className="flex items-center gap-2">
              {data.user.is_premium && (
                <Badge className="bg-yellow-400/20 text-yellow-200 border-yellow-400/30 text-xs">Premium</Badge>
              )}
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => navigate('/settings')}>
                <Icon name="Settings" size={20} />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center cursor-pointer hover:bg-white/15 transition-colors" onClick={() => navigate('/achievements')}>
              <div className="text-2xl font-bold">{getLevelEmoji(data.user.level)} {data.user.level}</div>
              <div className="text-xs text-purple-200">{'\u0423\u0440\u043e\u0432\u0435\u043d\u044c'}</div>
              <Progress value={data.user.xp_needed > 0 ? (data.user.xp_progress / data.user.xp_needed) * 100 : 0} className="h-1 mt-1.5 bg-white/20" />
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center cursor-pointer hover:bg-white/15 transition-colors" onClick={() => navigate('/achievements')}>
              <div className="text-2xl font-bold">{'\u{1F525}'} {data.streak.current}</div>
              <div className="text-xs text-purple-200">{'\u0421\u0442\u0440\u0438\u043a \u0434\u043d\u0435\u0439'}</div>
            </div>
            {data.gpa !== null && data.gpa > 0 ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center cursor-pointer hover:bg-white/15 transition-colors" onClick={() => navigate('/gradebook')}>
                <div className="text-2xl font-bold">{data.gpa.toFixed(1)}</div>
                <div className="text-xs text-purple-200">GPA</div>
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center cursor-pointer hover:bg-white/15 transition-colors" onClick={() => navigate('/gradebook')}>
                <div className="text-2xl font-bold">{'\u{1F4DA}'}</div>
                <div className="text-xs text-purple-200">{'\u041e\u0446\u0435\u043d\u043a\u0438'}</div>
              </div>
            )}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center cursor-pointer hover:bg-white/15 transition-colors" onClick={() => navigate('/achievements')}>
              <div className="text-2xl font-bold">{'\u{1F3C6}'} {data.achievements.unlocked}</div>
              <div className="text-xs text-purple-200">{'\u0410\u0447\u0438\u0432\u043a\u0438'}</div>
            </div>
          </div>

          {data.scholarship_forecast && (
            <div className="mt-3 bg-white/10 backdrop-blur-sm rounded-xl p-3 flex items-center gap-2">
              <Icon name="GraduationCap" size={18} />
              <span className="text-sm">{'\u041f\u0440\u043e\u0433\u043d\u043e\u0437: '}<strong>{data.scholarship_forecast}</strong></span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-4 space-y-4">
        {suggestions.length > 0 && (
          <Card className="p-4 bg-white/90 backdrop-blur border-0 shadow-lg">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Icon name="Sparkles" size={16} className="text-purple-500" />
              {'\u0423\u043c\u043d\u044b\u0435 \u043f\u043e\u0434\u0441\u043a\u0430\u0437\u043a\u0438'}
            </h3>
            <div className="space-y-2">
              {suggestions.slice(0, 3).map((s, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSuggestionAction(s)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-gray-50 to-purple-50 hover:from-purple-50 hover:to-pink-50 cursor-pointer transition-colors"
                >
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${getSuggestionColor(s.type)} flex items-center justify-center flex-shrink-0`}>
                    <Icon name={getSuggestionIcon(s.type)} size={16} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{s.title}</p>
                    <p className="text-xs text-gray-500">{s.description}</p>
                  </div>
                  <Icon name="ChevronRight" size={16} className="text-gray-400 flex-shrink-0" />
                </div>
              ))}
            </div>
          </Card>
        )}

        {data.today_schedule.length > 0 && (
          <Card className="p-4 bg-white/90 backdrop-blur border-0 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Icon name="Calendar" size={16} className="text-indigo-500" />
                {'\u0421\u0435\u0433\u043e\u0434\u043d\u044f \u0432 \u0440\u0430\u0441\u043f\u0438\u0441\u0430\u043d\u0438\u0438'}
              </h3>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate('/')}>
                {'\u0412\u0441\u0451 \u0440\u0430\u0441\u043f\u0438\u0441\u0430\u043d\u0438\u0435'}
                <Icon name="ChevronRight" size={14} className="ml-1" />
              </Button>
            </div>
            <div className="space-y-2">
              {data.today_schedule.map((lesson, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg bg-indigo-50/50">
                  <div className="text-xs font-mono text-indigo-600 w-[80px] flex-shrink-0">
                    {String(lesson.start_time).slice(0, 5)}{' - '}{String(lesson.end_time).slice(0, 5)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{lesson.subject}</p>
                    <p className="text-xs text-gray-500">
                      {lesson.type}{lesson.room ? ` \u00b7 ${lesson.room}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-4 bg-white/90 backdrop-blur border-0 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Icon name="CheckSquare" size={16} className="text-green-500" />
                {'\u0417\u0430\u0434\u0430\u0447\u0438'}
              </h3>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={generateAutoTasks}>
                  <Icon name="Wand2" size={14} className="mr-1" />
                  {'\u0410\u0432\u0442\u043e'}
                </Button>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate('/')}>
                  <Icon name="ChevronRight" size={14} />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1">
                <Progress value={taskCompletionRate} className="h-2" />
              </div>
              <span className="text-xs font-bold text-gray-600">{taskCompletionRate}%</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center p-2 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-600">{data.tasks.today_done}</div>
                <div className="text-[10px] text-gray-500">{'\u0421\u0435\u0433\u043e\u0434\u043d\u044f'}</div>
              </div>
              <div className="text-center p-2 bg-blue-50 rounded-lg">
                <div className="text-lg font-bold text-blue-600">{data.tasks.total - data.tasks.completed}</div>
                <div className="text-[10px] text-gray-500">{'\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0445'}</div>
              </div>
              <div className="text-center p-2 bg-purple-50 rounded-lg">
                <div className="text-lg font-bold text-purple-600">{data.tasks.completed}</div>
                <div className="text-[10px] text-gray-500">{'\u0413\u043e\u0442\u043e\u0432\u043e'}</div>
              </div>
            </div>

            {data.tasks.upcoming.length > 0 && (
              <div className="space-y-1.5">
                {data.tasks.upcoming.slice(0, 3).map(task => (
                  <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer" onClick={() => navigate('/')}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                    <span className="text-xs text-gray-700 truncate flex-1">{task.title}</span>
                    {task.deadline && (
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {new Date(task.deadline).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4 bg-white/90 backdrop-blur border-0 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Icon name="Timer" size={16} className="text-red-500" />
                {'\u0424\u043e\u043a\u0443\u0441'}
              </h3>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate('/pomodoro')}>
                <Icon name="Play" size={14} className="mr-1" />
                {'\u0417\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c'}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="text-center p-2 bg-red-50 rounded-lg">
                <div className="text-lg font-bold text-red-600">{data.pomodoro.today_minutes}</div>
                <div className="text-[10px] text-gray-500">{'\u043c\u0438\u043d \u0441\u0435\u0433\u043e\u0434\u043d\u044f'}</div>
              </div>
              <div className="text-center p-2 bg-pink-50 rounded-lg">
                <div className="text-lg font-bold text-pink-600">{Math.round(data.pomodoro.total_minutes / 60)}</div>
                <div className="text-[10px] text-gray-500">{'\u0447\u0430\u0441\u043e\u0432 \u0432\u0441\u0435\u0433\u043e'}</div>
              </div>
            </div>

            {data.pomodoro.week_chart.length > 0 && (
              <div className="flex items-end gap-1 h-16">
                {data.pomodoro.week_chart.map((d, i) => {
                  const maxM = Math.max(...data.pomodoro.week_chart.map(x => x.minutes), 1);
                  const h = Math.max((d.minutes / maxM) * 100, 4);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-gradient-to-t from-red-500 to-pink-400 rounded-t"
                        style={{ height: `${h}%` }}
                      />
                      <span className="text-[8px] text-gray-400 mt-0.5">
                        {new Date(d.day).toLocaleDateString('ru', { weekday: 'narrow' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {data.subject_grades.length > 0 && (
          <Card className="p-4 bg-white/90 backdrop-blur border-0 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Icon name="BarChart3" size={16} className="text-blue-500" />
                {'\u041e\u0446\u0435\u043d\u043a\u0438 \u043f\u043e \u043f\u0440\u0435\u0434\u043c\u0435\u0442\u0430\u043c'}
              </h3>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate('/gradebook')}>
                <Icon name="ChevronRight" size={14} />
              </Button>
            </div>
            <div className="space-y-2">
              {data.subject_grades.map((g, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-[120px] truncate">{g.subject}</span>
                  <div className="flex-1">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          g.avg >= 4.5 ? 'bg-green-500' : g.avg >= 3.5 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${(g.avg / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className={`text-xs font-bold w-8 text-right ${
                    g.avg >= 4.5 ? 'text-green-600' : g.avg >= 3.5 ? 'text-yellow-600' : 'text-red-600'
                  }`}>{g.avg}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {data.achievements.recent.length > 0 && (
          <Card className="p-4 bg-white/90 backdrop-blur border-0 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Icon name="Trophy" size={16} className="text-yellow-500" />
                {'\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 \u0434\u043e\u0441\u0442\u0438\u0436\u0435\u043d\u0438\u044f'}
              </h3>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate('/achievements')}>
                {'\u0412\u0441\u0435'}
                <Icon name="ChevronRight" size={14} className="ml-1" />
              </Button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {data.achievements.recent.map((a, i) => (
                <div key={i} className="flex-shrink-0 w-24 text-center p-3 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl">
                  <div className="text-2xl mb-1">{a.icon}</div>
                  <p className="text-[10px] font-medium text-gray-700 leading-tight">{a.title}</p>
                  <p className="text-[10px] text-yellow-600">+{a.xp_reward} XP</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4 bg-white/90 backdrop-blur border-0 shadow-lg text-center cursor-pointer hover:shadow-xl transition-shadow" onClick={() => navigate('/pomodoro')}>
            <div className="text-2xl mb-1">{'\u{1F345}'}</div>
            <div className="text-xs font-medium text-gray-600">{'\u041f\u043e\u043c\u043e\u0434\u043e\u0440\u043e'}</div>
          </Card>
          <Card className="p-4 bg-white/90 backdrop-blur border-0 shadow-lg text-center cursor-pointer hover:shadow-xl transition-shadow" onClick={() => navigate('/assistant')}>
            <div className="text-2xl mb-1">{'\u{1F916}'}</div>
            <div className="text-xs font-medium text-gray-600">{'\u0418\u0418-\u0440\u0435\u043f\u0435\u0442\u0438\u0442\u043e\u0440'}</div>
          </Card>
          <Card className="p-4 bg-white/90 backdrop-blur border-0 shadow-lg text-center cursor-pointer hover:shadow-xl transition-shadow" onClick={() => navigate('/materials')}>
            <div className="text-2xl mb-1">{'\u{1F4DA}'}</div>
            <div className="text-xs font-medium text-gray-600">{'\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b'}</div>
          </Card>
          <Card className="p-4 bg-white/90 backdrop-blur border-0 shadow-lg text-center cursor-pointer hover:shadow-xl transition-shadow" onClick={() => navigate('/referral')}>
            <div className="text-2xl mb-1">{'\u{1F91D}'}</div>
            <div className="text-xs font-medium text-gray-600">{'\u041f\u0440\u0438\u0433\u043b\u0430\u0441\u0438\u0442\u044c'}</div>
          </Card>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Dashboard;
