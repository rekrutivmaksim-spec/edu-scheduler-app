import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Link } from 'react-router-dom';

interface TryOnHeaderProps {
  activeFittingRoom: 'replicate' | 'seedream' | 'nanobananapro';
  onFittingRoomChange: (room: 'replicate' | 'seedream' | 'nanobananapro') => void;
  balance: number;
  isGenerating: boolean;
}

export default function TryOnHeader({ 
  activeFittingRoom, 
  onFittingRoomChange, 
  balance,
  isGenerating 
}: TryOnHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/virtualfitting">
          <Button variant="ghost" size="sm">
            <Icon name="ArrowLeft" size={16} className="mr-2" />
            Назад
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Виртуальная примерочная</h1>
      </div>
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <Button
            variant={activeFittingRoom === 'replicate' ? 'default' : 'outline'}
            onClick={() => onFittingRoomChange('replicate')}
            disabled={isGenerating}
            size="sm"
          >
            Replicate
          </Button>
          <Button
            variant={activeFittingRoom === 'seedream' ? 'default' : 'outline'}
            onClick={() => onFittingRoomChange('seedream')}
            disabled={isGenerating}
            size="sm"
          >
            Seedream
          </Button>
          <Button
            variant={activeFittingRoom === 'nanobananapro' ? 'default' : 'outline'}
            onClick={() => onFittingRoomChange('nanobananapro')}
            disabled={isGenerating}
            size="sm"
          >
            NanoBananaPro
          </Button>
        </div>
        
        <div className="flex items-center gap-2 bg-secondary px-4 py-2 rounded-lg">
          <Icon name="Coins" size={20} className="text-primary" />
          <span className="font-semibold">{balance} кредитов</span>
        </div>
      </div>
    </div>
  );
}
