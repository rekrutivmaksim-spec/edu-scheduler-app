import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  feature: string;
  description: string;
  trigger?: 'limit' | 'streak_freeze' | 'daily_quest' | 'pomodoro' | 'general';
}

const SOCIAL_PROOF = [
  '2 400+ студентов уже используют Premium',
  'Средний рост продуктивности — 47%',
  'Юзеры с Premium учатся в 2.3 раза больше',
];

const UpgradeModal = ({ open, onClose, feature, description, trigger = 'general' }: UpgradeModalProps) => {
  const navigate = useNavigate();

  const getContextMessage = () => {
    switch (trigger) {
      case 'streak_freeze':
        return 'Не потеряй свой стрик! С Premium ты можешь заморозить серию 1 раз в неделю';
      case 'daily_quest':
        return 'Premium-юзеры получают 5 квестов вместо 3 и зарабатывают в 2 раза больше XP';
      case 'pomodoro':
        return 'Помодоро + аналитика = понимание, когда ты учишься эффективнее всего';
      case 'limit':
        return 'Ты на пороге! Разблокируй безлимит и не останавливай учёбу';
      default:
        return '';
    }
  };

  const contextMsg = getContextMessage();
  const randomProof = SOCIAL_PROOF[Math.floor(Math.random() * SOCIAL_PROOF.length)];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30 animate-pulse">
            <Icon name="Crown" size={32} className="text-white" />
          </div>
          <DialogTitle className="text-center text-2xl">
            {feature}
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {contextMsg && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 text-center">
              {contextMsg}
            </div>
          )}

          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border-2 border-indigo-200">
            <h4 className="font-semibold text-gray-800 mb-3">Premium включает:</h4>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm text-gray-700">
                <Icon name="Infinity" size={16} className="text-purple-600" />
                Безлимитное расписание, задачи, материалы
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-700">
                <Icon name="Bot" size={16} className="text-purple-600" />
                Безлимитные AI-вопросы
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-700">
                <Icon name="Timer" size={16} className="text-purple-600" />
                Помодоро-таймер с аналитикой
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-700">
                <Icon name="Shield" size={16} className="text-purple-600" />
                Заморозка стрика (1 раз/неделя)
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-700">
                <Icon name="Sparkles" size={16} className="text-purple-600" />
                5 ежедневных квестов + бонусный XP
              </li>
            </ul>
            <div className="mt-4 pt-4 border-t border-indigo-200 flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-indigo-600">199 &#8381;/мес</p>
                <p className="text-xs text-gray-600">7 дней бесплатно</p>
              </div>
              <p className="text-xs text-gray-500 line-through">7 &#8381;/день</p>
            </div>
          </div>

          <p className="text-xs text-center text-gray-500 italic">
            {randomProof}
          </p>

          <Button
            onClick={() => {
              onClose();
              navigate('/pricing');
            }}
            className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:via-orange-600 hover:to-red-600 text-white shadow-lg shadow-orange-500/30 text-base py-6"
          >
            <Icon name="Crown" size={20} className="mr-2" />
            Попробовать бесплатно 7 дней
          </Button>

          <Button
            onClick={onClose}
            variant="ghost"
            className="w-full text-gray-400 text-sm"
          >
            Не сейчас
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeModal;