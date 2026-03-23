import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';

interface Props {
  hearts: number;
  maxHearts: number;
  isPremium: boolean;
  nextRefillIn: number;
}

export default function HeartsDisplay({ hearts, maxHearts, isPremium, nextRefillIn }: Props) {
  const navigate = useNavigate();
  const mins = Math.ceil(nextRefillIn / 60000);

  if (isPremium) {
    return (
      <div className="flex items-center gap-1">
        <Icon name="Heart" size={16} className="text-red-500 fill-red-500" />
        <span className="text-xs font-bold text-red-500">∞</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => hearts === 0 ? navigate('/pricing') : undefined}
      className="flex items-center gap-1"
    >
      {Array.from({ length: maxHearts }).map((_, i) => (
        <Icon
          key={i}
          name="Heart"
          size={14}
          className={i < hearts ? 'text-red-500 fill-red-500' : 'text-gray-300'}
        />
      ))}
      {hearts < maxHearts && mins > 0 && (
        <span className="text-[10px] text-gray-400 ml-1">{mins}м</span>
      )}
    </button>
  );
}
