import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState = ({ icon, title, description, actionLabel, onAction }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 animate-[fadeIn_0.4s_ease-out]">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20 mb-5">
        <Icon name={icon} size={40} className="text-white" strokeWidth={1.5} />
      </div>

      <h3 className="text-lg font-bold text-gray-800 text-center mb-1.5">
        {title}
      </h3>

      <p className="text-sm text-gray-500 text-center max-w-xs mb-5">
        {description}
      </p>

      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl px-6 h-10 shadow-md shadow-purple-500/20"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
