import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';

interface DashboardHeaderProps {
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
  achievements: { unlocked: number };
  tutorSavings: number;
}

const getLevelEmoji = (level: number) => {
  if (level <= 10) return '🌱';
  if (level <= 20) return '🌿';
  if (level <= 30) return '🌳';
  if (level <= 50) return '⭐';
  if (level <= 70) return '💎';
  return '🚀';
};

const DashboardHeader = ({ user, gpa, scholarship_forecast, streak, achievements, tutorSavings }: DashboardHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white px-4 pt-6 pb-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-purple-200 text-sm">{'Привет, '}{user.name.split(' ')[0]}!</p>
            <h1 className="text-2xl font-bold">{'Твоя сводка'}</h1>
          </div>
          <div className="flex items-center gap-2">
            {user.is_premium && (
              <Badge className="bg-yellow-400/20 text-yellow-200 border-yellow-400/30 text-xs">Premium</Badge>
            )}
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => navigate('/settings')}>
              <Icon name="Settings" size={20} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center cursor-pointer hover:bg-white/15 transition-colors" onClick={() => navigate('/achievements')}>
            <div className="text-2xl font-bold">{getLevelEmoji(user.level)} {user.level}</div>
            <div className="text-xs text-purple-200">{'Уровень'}</div>
            <Progress value={user.xp_needed > 0 ? (user.xp_progress / user.xp_needed) * 100 : 0} className="h-1 mt-1.5 bg-white/20" />
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center cursor-pointer hover:bg-white/15 transition-colors" onClick={() => navigate('/achievements')}>
            <div className="text-2xl font-bold">{'🔥'} {streak.current}</div>
            <div className="text-xs text-purple-200">{'Стрик дней'}</div>
          </div>
          {gpa !== null && gpa > 0 ? (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center cursor-pointer hover:bg-white/15 transition-colors" onClick={() => navigate('/profile')}>
              <div className="text-2xl font-bold">{gpa.toFixed(1)}</div>
              <div className="text-xs text-purple-200">GPA</div>
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center cursor-pointer hover:bg-white/15 transition-colors" onClick={() => navigate('/profile')}>
              <div className="text-2xl font-bold">{'📚'}</div>
              <div className="text-xs text-purple-200">{'Оценки'}</div>
            </div>
          )}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center cursor-pointer hover:bg-white/15 transition-colors" onClick={() => navigate('/achievements')}>
            <div className="text-2xl font-bold">{'🏆'} {achievements.unlocked}</div>
            <div className="text-xs text-purple-200">{'Ачивки'}</div>
          </div>
        </div>

        {scholarship_forecast && (
          <div className="mt-3 bg-white/10 backdrop-blur-sm rounded-xl p-3 flex items-center gap-2">
            <Icon name="GraduationCap" size={18} />
            <span className="text-sm">{'Прогноз: '}<strong>{scholarship_forecast}</strong></span>
          </div>
        )}

        {tutorSavings > 0 && (
          <div
            className="mt-3 bg-white/10 backdrop-blur-sm rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-white/15 transition-colors"
            onClick={() => navigate('/achievements')}
          >
            <div className="text-2xl">💰</div>
            <div className="flex-1">
              <div className="text-xs text-purple-200">Сэкономлено на репетиторах</div>
              <div className="text-lg font-bold">{tutorSavings.toLocaleString('ru-RU')} ₽</div>
            </div>
            <Icon name="ChevronRight" size={16} className="text-purple-300" />
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardHeader;
