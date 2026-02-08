import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { authService } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';

const SUBSCRIPTION_URL = 'https://functions.poehali.dev/7fe183c2-49af-4817-95f3-6ab4912778c4';

interface Limits {
  schedule: { used: number; max: number | null; unlimited: boolean };
  tasks: { used: number; max: number | null; unlimited: boolean };
  materials: { used: number; max: number | null; unlimited: boolean };
  ai_questions?: { used: number; max: number | null; unlimited: boolean };
}

interface LimitsIndicatorProps {
  compact?: boolean;
}

const LimitsIndicator = ({ compact = false }: LimitsIndicatorProps) => {
  const navigate = useNavigate();
  const [limits, setLimits] = useState<Limits | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLimits();
  }, []);

  const loadLimits = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${SUBSCRIPTION_URL}?action=limits`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLimits(data.limits);
        setIsPremium(data.is_premium || data.is_trial);
      }
    } catch (error) {
      console.error('Failed to load limits:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !limits) return null;
  if (isPremium) return null; // Не показываем для Premium

  const getPercentage = (used: number, max: number | null) => {
    if (!max) return 0;
    return Math.min((used / max) * 100, 100);
  };

  const getColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-orange-600';
    return 'text-green-600';
  };

  if (compact) {
    const items = [
      { icon: 'Calendar', used: limits.schedule.used, max: limits.schedule.max, label: 'Занятия' },
      { icon: 'CheckSquare', used: limits.tasks.used, max: limits.tasks.max, label: 'Задачи' },
      { icon: 'FileText', used: limits.materials.used, max: limits.materials.max, label: 'Материалы' }
    ];

    if (limits.ai_questions && limits.ai_questions.max) {
      items.push({ icon: 'Bot', used: limits.ai_questions.used, max: limits.ai_questions.max, label: 'AI' });
    }

    return (
      <div className="flex items-center gap-3 px-3 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
        {items.map((item, idx) => {
          const percentage = getPercentage(item.used, item.max);
          const isNearLimit = percentage >= 70;
          
          return (
            <div key={idx} className="flex items-center gap-2">
              <Icon name={item.icon as any} size={16} className={isNearLimit ? getColor(percentage) : 'text-gray-600'} />
              <span className={`text-sm font-medium ${isNearLimit ? getColor(percentage) : 'text-gray-700'}`}>
                {item.used}/{item.max}
              </span>
            </div>
          );
        })}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate('/pricing')}
          className="ml-auto text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-100"
        >
          <Icon name="Zap" size={14} className="mr-1" />
          Premium
        </Button>
      </div>
    );
  }

  return (
    <Card className="p-4 bg-gradient-to-br from-purple-50 via-indigo-50 to-pink-50 border-2 border-purple-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Icon name="BarChart3" size={18} className="text-purple-600" />
          Ваши лимиты
        </h3>
        <Badge variant="outline" className="bg-white">
          Free Plan
        </Badge>
      </div>

      <div className="space-y-3">
        {/* Расписание */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-700 flex items-center gap-1">
              <Icon name="Calendar" size={14} />
              Занятия
            </span>
            <span className={`text-sm font-medium ${getColor(getPercentage(limits.schedule.used, limits.schedule.max))}`}>
              {limits.schedule.used} / {limits.schedule.max}
            </span>
          </div>
          <Progress value={getPercentage(limits.schedule.used, limits.schedule.max)} className="h-2" />
        </div>

        {/* Задачи */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-700 flex items-center gap-1">
              <Icon name="CheckSquare" size={14} />
              Активные задачи
            </span>
            <span className={`text-sm font-medium ${getColor(getPercentage(limits.tasks.used, limits.tasks.max))}`}>
              {limits.tasks.used} / {limits.tasks.max}
            </span>
          </div>
          <Progress value={getPercentage(limits.tasks.used, limits.tasks.max)} className="h-2" />
        </div>

        {/* Материалы */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-700 flex items-center gap-1">
              <Icon name="FileText" size={14} />
              Материалы (в месяц)
            </span>
            <span className={`text-sm font-medium ${getColor(getPercentage(limits.materials.used, limits.materials.max))}`}>
              {limits.materials.used} / {limits.materials.max}
            </span>
          </div>
          <Progress value={getPercentage(limits.materials.used, limits.materials.max)} className="h-2" />
        </div>

        {/* AI вопросы */}
        {limits.ai_questions && limits.ai_questions.max && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-700 flex items-center gap-1">
                <Icon name="Bot" size={14} />
                AI-вопросы (в месяц)
              </span>
              <span className={`text-sm font-medium ${getColor(getPercentage(limits.ai_questions.used, limits.ai_questions.max))}`}>
                {limits.ai_questions.used} / {limits.ai_questions.max}
              </span>
            </div>
            <Progress value={getPercentage(limits.ai_questions.used, limits.ai_questions.max)} className="h-2" />
          </div>
        )}
      </div>

      <Button
        onClick={() => navigate('/pricing')}
        className="w-full mt-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg"
        size="sm"
      >
        <Icon name="Zap" size={16} className="mr-2" />
        Перейти на Premium
      </Button>
    </Card>
  );
};

export default LimitsIndicator;
