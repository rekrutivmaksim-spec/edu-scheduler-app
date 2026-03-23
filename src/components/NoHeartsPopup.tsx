import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface Props {
  nextRefillIn: number;
  onClose: () => void;
}

export default function NoHeartsPopup({ nextRefillIn, onClose }: Props) {
  const navigate = useNavigate();
  const mins = Math.ceil(nextRefillIn / 60000);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-3xl p-6 text-center max-w-sm w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'pop-in 0.3s cubic-bezier(0.32,0.72,0,1)' }}
      >
        <div className="flex justify-center gap-1.5 mb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Icon key={i} name="Heart" size={24} className="text-gray-300" />
          ))}
        </div>
        <h2 className="font-extrabold text-xl text-gray-800 mb-1">Жизни закончились!</h2>
        <p className="text-gray-500 text-sm mb-4">
          Следующая жизнь через {mins > 0 ? `${mins} мин` : 'несколько секунд'}
        </p>

        <div className="space-y-2.5">
          <Button
            onClick={() => { onClose(); navigate('/pricing'); }}
            className="w-full h-13 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-extrabold text-base rounded-2xl shadow-lg"
          >
            Premium — безлимит жизней
          </Button>

          <button onClick={onClose} className="w-full text-gray-400 text-sm py-2">
            Подождать {mins} мин
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pop-in {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
