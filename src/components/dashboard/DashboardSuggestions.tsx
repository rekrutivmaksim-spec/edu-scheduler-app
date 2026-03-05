import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

interface Suggestion {
  type: string;
  title: string;
  description: string;
  action: string;
  action_data: Record<string, string | number>;
  priority: number;
}

interface ScheduleLesson {
  subject: string;
  type: string;
  start_time: string;
  end_time: string;
  room: string;
  teacher: string;
}

interface DashboardSuggestionsProps {
  suggestions: Suggestion[];
  today_schedule: ScheduleLesson[];
}

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

const DashboardSuggestions = ({ suggestions, today_schedule }: DashboardSuggestionsProps) => {
  const navigate = useNavigate();

  const handleSuggestionAction = (suggestion: Suggestion) => {
    if (suggestion.action === 'start_pomodoro') {
      navigate('/pomodoro');
    } else if (suggestion.action === 'focus_task') {
      navigate('/');
    } else if (suggestion.action === 'generate_summary') {
      navigate('/assistant');
    }
  };

  return (
    <>
      {suggestions.length > 0 && (
        <Card className="p-4 bg-white/90 backdrop-blur border-0 shadow-lg">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Icon name="Sparkles" size={16} className="text-purple-500" />
            {'Умные подсказки'}
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

      {today_schedule.length > 0 && (
        <Card className="p-4 bg-white/90 backdrop-blur border-0 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Icon name="Calendar" size={16} className="text-indigo-500" />
              {'Сегодня в расписании'}
            </h3>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate('/')}>
              {'Всё расписание'}
              <Icon name="ChevronRight" size={14} className="ml-1" />
            </Button>
          </div>
          <div className="space-y-2">
            {today_schedule.map((lesson, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg bg-indigo-50/50">
                <div className="text-xs font-mono text-indigo-600 w-[80px] flex-shrink-0">
                  {String(lesson.start_time).slice(0, 5)}{' - '}{String(lesson.end_time).slice(0, 5)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{lesson.subject}</p>
                  <p className="text-xs text-gray-500">
                    {lesson.type}{lesson.room ? ` · ${lesson.room}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
};

export default DashboardSuggestions;
