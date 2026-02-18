import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

const SCHEDULE_URL = 'https://functions.poehali.dev/7030dc26-77cd-4b59-91e6-1be52f31cf8d';

interface Suggestion {
  type: string;
  title: string;
  description: string;
  action: string;
  action_data: Record<string, string | number>;
  priority: number;
}

const SmartSuggestions = () => {
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      const token = authService.getToken();
      if (!token) return;
      const res = await fetch(`${SCHEDULE_URL}?path=suggestions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (e) {
      console.error('Suggestions failed:', e);
    }
  };

  const handleAction = (s: Suggestion) => {
    if (s.action === 'start_pomodoro') navigate('/pomodoro');
    else if (s.action === 'focus_task') navigate('/');
    else if (s.action === 'generate_summary') navigate('/assistant');
    else navigate('/dashboard');
  };

  const handleDismiss = (idx: number) => {
    setDismissed(prev => new Set([...prev, idx]));
  };

  const getIcon = (type: string) => {
    const map: Record<string, string> = {
      neglected_subject: 'BookX',
      urgent_deadline: 'AlertTriangle',
      exam_tomorrow: 'GraduationCap',
      low_grade: 'TrendingDown'
    };
    return map[type] || 'Lightbulb';
  };

  const getColor = (type: string) => {
    const map: Record<string, string> = {
      neglected_subject: 'bg-blue-500',
      urgent_deadline: 'bg-red-500',
      exam_tomorrow: 'bg-purple-500',
      low_grade: 'bg-yellow-500'
    };
    return map[type] || 'bg-gray-500';
  };

  const visible = suggestions.filter((_, i) => !dismissed.has(i)).slice(0, 2);
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visible.map((s, idx) => {
        const realIdx = suggestions.indexOf(s);
        return (
          <Card
            key={realIdx}
            className="p-3 bg-white/70 backdrop-blur border-purple-100 cursor-pointer hover:bg-white/90 transition-colors"
            onClick={() => handleAction(s)}
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${getColor(s.type)} flex items-center justify-center flex-shrink-0`}>
                <Icon name={getIcon(s.type)} size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{s.title}</p>
                <p className="text-xs text-gray-500">{s.description}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDismiss(realIdx); }}
                className="p-1 hover:bg-gray-100 rounded flex-shrink-0"
              >
                <Icon name="X" size={14} className="text-gray-400" />
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default SmartSuggestions;
