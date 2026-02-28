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
  trigger?: 'limit' | 'daily_limit' | 'streak_freeze' | 'daily_quest' | 'pomodoro' | 'general';
}

const SOCIAL_PROOF = [
  '2 400+ студентов уже используют Premium',
  'Средний рост продуктивности — 47%',
  'Юзеры с Premium учатся в 2.3 раза больше',
];

const QUESTION_PACKS = [
  { id: 'questions_15', label: '15 вопросов', price: 150, perQ: '10₽/шт', popular: false },
  { id: 'questions_30', label: '30 вопросов', price: 300, perQ: '10₽/шт', popular: true },
  { id: 'questions_100', label: '100 вопросов', price: 600, perQ: '6₽/шт', popular: false },
];

const UpgradeModal = ({ open, onClose, feature, description, trigger = 'general' }: UpgradeModalProps) => {
  const navigate = useNavigate();

  const isDailyLimit = trigger === 'daily_limit';

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
      case 'daily_limit':
        return 'Суточный лимит 20 вопросов исчерпан. Купи пакет — он не сгорает завтра!';
      default:
        return '';
    }
  };

  const contextMsg = getContextMessage();
  const randomProof = SOCIAL_PROOF[Math.floor(Math.random() * SOCIAL_PROOF.length)];

  const handleBuyPack = (packId: string) => {
    onClose();
    navigate(`/pricing?buy=${packId}`);
  };

  if (isDailyLimit) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Icon name="Zap" size={32} className="text-white" />
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 text-center">
                {contextMsg}
              </div>
            )}

            <p className="text-sm font-medium text-gray-700 text-center">Выбери пакет вопросов:</p>

            <div className="grid grid-cols-3 gap-2">
              {QUESTION_PACKS.map((pack) => (
                <button
                  key={pack.id}
                  onClick={() => handleBuyPack(pack.id)}
                  className={`relative flex flex-col items-center p-3 rounded-xl border-2 transition-all ${
                    pack.popular
                      ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100'
                      : 'border-gray-200 bg-white hover:border-indigo-300'
                  }`}
                >
                  {pack.popular && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                      Выгоднее
                    </span>
                  )}
                  <span className="text-lg font-bold text-gray-800">{pack.label}</span>
                  <span className="text-base font-semibold text-indigo-600">{pack.price}₽</span>
                  <span className="text-[11px] text-gray-400">{pack.perQ}</span>
                </button>
              ))}
            </div>

            <p className="text-xs text-center text-gray-500">
              Вопросы не сгорают. Накапливаются сколько угодно.
            </p>

            <p className="text-xs text-center text-gray-400 italic">{randomProof}</p>

            <Button
              onClick={onClose}
              variant="ghost"
              className="w-full text-gray-400 text-sm"
            >
              Подожду до завтра
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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
                20 AI-вопросов в день (+ пакеты на допы)
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
                <p className="text-2xl font-bold text-indigo-600">499 &#8381;/мес</p>
                <p className="text-xs text-gray-600">7 дней бесплатно, далее автопродление</p>
              </div>
              <p className="text-xs text-gray-500 line-through">10 &#8381;/день</p>
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
            Попробовать 7 дней бесплатно
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