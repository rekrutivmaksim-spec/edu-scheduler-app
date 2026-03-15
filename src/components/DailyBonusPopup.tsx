import { useState, useEffect } from 'react';
import { claimDailyLoginBonus, DailyLoginBonusResult } from '@/lib/gamification';
import Icon from '@/components/ui/icon';

interface Props {
  onClose: () => void;
}

export default function DailyBonusPopup({ onClose }: Props) {
  const [result, setResult] = useState<DailyLoginBonusResult | null>(null);
  const [show, setShow] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    const key = `daily_bonus_${new Date().toDateString()}`;
    if (localStorage.getItem(key)) {
      onClose();
      return;
    }

    claimDailyLoginBonus().then(r => {
      if (!r || r.already_claimed) {
        localStorage.setItem(key, '1');
        onClose();
        return;
      }
      setResult(r);
      setTimeout(() => setShow(true), 50);
    });
  }, []);

  if (!result || result.already_claimed) return null;

  const handleClaim = () => {
    setClaimed(true);
    const key = `daily_bonus_${new Date().toDateString()}`;
    localStorage.setItem(key, '1');
    setTimeout(onClose, 400);
  };

  const streakDay = result.streak_day || 1;
  const dots = Array.from({ length: 7 }, (_, i) => i + 1);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      onClick={handleClaim}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className={`relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 ${
          show && !claimed ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 px-6 pt-6 pb-8 text-center relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/10 rounded-full" />
          <div className="text-5xl mb-2">🎁</div>
          <h2 className="text-white font-extrabold text-xl">Ежедневный бонус!</h2>
          <p className="text-white/80 text-sm mt-1">День {streakDay} подряд</p>
        </div>

        <div className="px-6 py-5">
          <div className="flex justify-center gap-1.5 mb-5">
            {dots.map(d => (
              <div
                key={d}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  d <= streakDay
                    ? 'bg-gradient-to-br from-amber-400 to-orange-500 border-orange-400 text-white shadow-sm'
                    : 'bg-gray-100 border-gray-200 text-gray-400'
                }`}
              >
                {d <= streakDay ? <Icon name="Check" size={14} /> : d}
              </div>
            ))}
          </div>

          <div className="flex gap-3 justify-center mb-5">
            <div className="bg-indigo-50 rounded-2xl px-4 py-3 text-center flex-1">
              <div className="text-2xl font-extrabold text-indigo-600">+{result.xp_earned}</div>
              <div className="text-xs text-indigo-500 mt-0.5">XP</div>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mb-4">
            {streakDay >= 7 ? 'Максимальный бонус! Продолжай заходить каждый день' : `Ещё ${7 - streakDay} дн. до максимального бонуса`}
          </p>

          <button
            onClick={handleClaim}
            className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-base rounded-2xl shadow-lg active:scale-[0.97] transition-all"
          >
            Забрать!
          </button>
        </div>
      </div>
    </div>
  );
}