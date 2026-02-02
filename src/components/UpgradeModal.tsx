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
}

const UpgradeModal = ({ open, onClose, feature, description }: UpgradeModalProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Icon name="Sparkles" size={32} className="text-white" />
          </div>
          <DialogTitle className="text-center text-2xl">
            {feature}
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border-2 border-indigo-200">
            <h4 className="font-semibold text-gray-800 mb-3">Premium включает:</h4>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm text-gray-700">
                <Icon name="Check" size={16} className="text-green-600" />
                Безлимитное расписание и задачи
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-700">
                <Icon name="Check" size={16} className="text-green-600" />
                Безлимитные материалы
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-700">
                <Icon name="Check" size={16} className="text-green-600" />
                AI-ассистент (40 вопросов)
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-700">
                <Icon name="Check" size={16} className="text-green-600" />
                Генерация шпаргалок
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-700">
                <Icon name="Check" size={16} className="text-green-600" />
                AI-прогноз экзаменов
              </li>
            </ul>
            <div className="mt-4 pt-4 border-t border-indigo-200">
              <p className="text-2xl font-bold text-indigo-600">199₽/мес</p>
              <p className="text-xs text-gray-600">💡 7 дней бесплатного триала</p>
            </div>
          </div>

          <Button
            onClick={() => {
              onClose();
              navigate('/pricing');
            }}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-purple-500/30"
          >
            <Icon name="Zap" size={18} className="mr-2" />
            Получить Premium
          </Button>

          <Button
            onClick={onClose}
            variant="ghost"
            className="w-full"
          >
            Может позже
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeModal;