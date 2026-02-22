import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

interface NetworkErrorProps {
  onRetry: () => void;
  message?: string;
}

const NetworkError = ({ onRetry, message }: NetworkErrorProps) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-[fadeIn_0.3s_ease-out]">
    <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-4 shadow-inner">
      <Icon name="WifiOff" size={36} className="text-red-400" />
    </div>
    <h3 className="text-lg font-bold text-gray-700 mb-1">Нет подключения</h3>
    <p className="text-sm text-gray-500 max-w-xs mb-5">
      {message || 'Не удалось загрузить данные. Проверь интернет и попробуй снова.'}
    </p>
    <Button
      onClick={onRetry}
      className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white rounded-xl px-6"
    >
      <Icon name="RefreshCw" size={16} className="mr-2" />
      Повторить
    </Button>
  </div>
);

export default NetworkError;
