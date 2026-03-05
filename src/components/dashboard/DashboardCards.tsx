import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';

interface TasksData {
  total: number;
  completed: number;
  today_done: number;
  upcoming: Array<{ id: number; title: string; subject: string; deadline: string; priority: string }>;
}

interface PomodoroData {
  today_sessions: number;
  today_minutes: number;
  total_minutes: number;
  total_sessions: number;
  week_chart: Array<{ day: string; minutes: number }>;
}

interface DashboardCardsProps {
  tasks: TasksData;
  pomodoro: PomodoroData;
  subject_grades: Array<{ subject: string; avg: number }>;
  achievements: {
    unlocked: number;
    recent: Array<{ code: string; title: string; icon: string; xp_reward: number }>;
  };
  onGenerateAutoTasks: () => void;
}

const DashboardCards = ({ tasks, pomodoro, subject_grades, achievements, onGenerateAutoTasks }: DashboardCardsProps) => {
  const navigate = useNavigate();
  const taskCompletionRate = tasks.total > 0 ? Math.round((tasks.completed / tasks.total) * 100) : 0;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-4 bg-white/90 backdrop-blur border-0 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Icon name="CheckSquare" size={16} className="text-green-500" />
              {'Задачи'}
            </h3>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={onGenerateAutoTasks}>
                <Icon name="Wand2" size={14} className="mr-1" />
                {'Авто'}
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
              <div className="text-lg font-bold text-green-600">{tasks.today_done}</div>
              <div className="text-[10px] text-gray-500">{'Сегодня'}</div>
            </div>
            <div className="text-center p-2 bg-blue-50 rounded-lg">
              <div className="text-lg font-bold text-blue-600">{tasks.total - tasks.completed}</div>
              <div className="text-[10px] text-gray-500">{'Активных'}</div>
            </div>
            <div className="text-center p-2 bg-purple-50 rounded-lg">
              <div className="text-lg font-bold text-purple-600">{tasks.completed}</div>
              <div className="text-[10px] text-gray-500">{'Готово'}</div>
            </div>
          </div>

          {tasks.upcoming.length > 0 && (
            <div className="space-y-1.5">
              {tasks.upcoming.slice(0, 3).map(task => (
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
              {'Фокус'}
            </h3>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate('/pomodoro')}>
              <Icon name="Play" size={14} className="mr-1" />
              {'Запустить'}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="text-center p-2 bg-red-50 rounded-lg">
              <div className="text-lg font-bold text-red-600">{pomodoro.today_minutes}</div>
              <div className="text-[10px] text-gray-500">{'мин сегодня'}</div>
            </div>
            <div className="text-center p-2 bg-pink-50 rounded-lg">
              <div className="text-lg font-bold text-pink-600">{Math.round(pomodoro.total_minutes / 60)}</div>
              <div className="text-[10px] text-gray-500">{'часов всего'}</div>
            </div>
          </div>

          {pomodoro.week_chart.length > 0 && (
            <div className="flex items-end gap-1 h-16">
              {pomodoro.week_chart.map((d, i) => {
                const maxM = Math.max(...pomodoro.week_chart.map(x => x.minutes), 1);
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

      {subject_grades.length > 0 && (
        <Card className="p-4 bg-white/90 backdrop-blur border-0 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Icon name="BarChart3" size={16} className="text-blue-500" />
              {'Оценки по предметам'}
            </h3>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate('/profile')}>
              <Icon name="ChevronRight" size={14} />
            </Button>
          </div>
          <div className="space-y-2">
            {subject_grades.map((g, i) => (
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

      {achievements.recent.length > 0 && (
        <Card className="p-4 bg-white/90 backdrop-blur border-0 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Icon name="Trophy" size={16} className="text-yellow-500" />
              {'Последние достижения'}
            </h3>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate('/achievements')}>
              {'Все'}
              <Icon name="ChevronRight" size={14} className="ml-1" />
            </Button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {achievements.recent.map((a, i) => (
              <div key={i} className="flex-shrink-0 w-24 text-center p-3 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl">
                <div className="text-2xl mb-1">{a.icon}</div>
                <p className="text-[10px] font-medium text-gray-700 leading-tight">{a.title}</p>
                <p className="text-[10px] text-yellow-600">+{a.xp_reward} XP</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
};

export default DashboardCards;
