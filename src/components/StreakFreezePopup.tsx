import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { authService } from '@/lib/auth';
import { API } from '@/lib/api-urls';

interface Props {
  streak: number;
  isPremium: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StreakFreezePopup({ streak, isPremium, onClose, onSuccess }: Props) {
  const navigate = useNavigate();
  const [buying, setBuying] = useState(false);
  const [result, setResult] = useState<'success' | 'no_funds' | null>(null);

  const price = isPremium ? 0 : 99;

  const handleFreeze = async () => {
    setBuying(true);
    try {
      const token = authService.getToken();
      const res = await fetch(API.GAMIFICATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'buy_freeze' }),
      });
      const data = await res.json();
      if (data.success) {
        setResult('success');
        setTimeout(() => { onSuccess(); onClose(); }, 2000);
      } else if (data.suggested_action === 'topup') {
        setResult('no_funds');
      }
    } catch {
      /* silent */
    } finally {
      setBuying(false);
    }
  };

  const dw = streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней';

  if (result === 'success') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onClose}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div className="relative bg-white rounded-3xl p-8 text-center max-w-sm w-full" onClick={e => e.stopPropagation()}>
          <div className="text-5xl mb-4">❄️</div>
          <h2 className="font-extrabold text-xl text-gray-800 mb-2">Стрик заморожен!</h2>
          <p className="text-gray-500 text-sm">Серия {streak} {dw} сохранена. Продолжай завтра!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slide-up 0.3s cubic-bezier(0.32,0.72,0,1)' }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="bg-gradient-to-br from-red-500 via-orange-500 to-amber-500 px-5 py-5 mx-4 rounded-2xl mb-4 mt-2 text-center">
          <div className="text-5xl mb-2">🔥</div>
          <h2 className="text-white font-extrabold text-xl leading-tight">
            Серия {streak} {dw} сгорит!
          </h2>
          <p className="text-white/70 text-sm mt-1">
            Ты не занимался сегодня. Заморозь стрик чтобы не потерять прогресс.
          </p>
        </div>

        <div className="px-5 mb-4">
          <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-4">
            <div className="text-3xl">❄️</div>
            <div className="flex-1">
              <p className="font-bold text-gray-800">Заморозка стрика</p>
              <p className="text-gray-500 text-xs">Сохраняет серию на 1 день</p>
            </div>
            <div className="text-right">
              {isPremium ? (
                <p className="font-extrabold text-green-600">Бесплатно</p>
              ) : (
                <p className="font-extrabold text-gray-800">{price} ₽</p>
              )}
            </div>
          </div>
        </div>

        {result === 'no_funds' && (
          <div className="px-5 mb-3">
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
              <p className="text-red-700 font-bold text-sm">Недостаточно средств</p>
              <p className="text-red-500 text-xs">Пополни баланс чтобы заморозить стрик</p>
            </div>
          </div>
        )}

        <div className="px-5 pb-8 space-y-2.5">
          <Button
            onClick={handleFreeze}
            disabled={buying}
            className="w-full h-14 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-extrabold text-base rounded-2xl shadow-lg active:scale-[0.98] transition-all"
          >
            {buying ? (
              <Icon name="Loader2" size={18} className="animate-spin" />
            ) : (
              <>❄️ Заморозить {isPremium ? '(бесплатно)' : `за ${price} ₽`}</>
            )}
          </Button>

          {!isPremium && (
            <Button
              onClick={() => { onClose(); navigate('/pricing'); }}
              className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm rounded-2xl"
            >
              Premium — безлимит заморозок бесплатно
            </Button>
          )}

          <button onClick={onClose} className="w-full text-center text-gray-400 text-sm py-2">
            Пропустить (серия сбросится)
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
