import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { authService } from '@/lib/auth';
import { API } from '@/lib/api-urls';

const GAMIFICATION_URL = API.GAMIFICATION;
const STORAGE_KEY = 'studyfay_last_visit';
const BONUS_CLAIMED_KEY = 'studyfay_wb_claimed';

function getDaysAway(): number {
  const last = localStorage.getItem(STORAGE_KEY);
  if (!last) return 0;
  const diff = Date.now() - parseInt(last, 10);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function markVisit() {
  localStorage.setItem(STORAGE_KEY, String(Date.now()));
}

function wasBonusClaimed(): boolean {
  const raw = localStorage.getItem(BONUS_CLAIMED_KEY);
  if (!raw) return false;
  const d = new Date(parseInt(raw, 10)).toDateString();
  return d === new Date().toDateString();
}

export default function WelcomeBack() {
  const [visible, setVisible] = useState(false);
  const [daysAway, setDaysAway] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(0);

  useEffect(() => {
    const days = getDaysAway();
    if (days >= 2 && !wasBonusClaimed()) {
      setDaysAway(days);
      setBonusAmount(days >= 7 ? 5 : 3);
      setVisible(true);
    }
    markVisit();
  }, []);

  const claimBonus = async () => {
    setClaiming(true);
    try {
      const token = authService.getToken();
      if (!token) return;
      const res = await fetch(GAMIFICATION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'welcome_back', days_away: daysAway }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.bonus) setBonusAmount(data.bonus);
      }
      localStorage.setItem(BONUS_CLAIMED_KEY, String(Date.now()));
      setClaimed(true);
      setTimeout(() => setVisible(false), 2500);
    } catch { /* silent */ }
    setClaiming(false);
  };

  const dismiss = () => {
    markVisit();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        {!claimed ? (
          <>
            <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 px-6 pt-8 pb-6 text-center">
              <div className="text-5xl mb-3">👋</div>
              <h3 className="text-white font-extrabold text-xl mb-1">
                {daysAway >= 7 ? 'Давно не виделись!' : 'С возвращением!'}
              </h3>
              <p className="text-white/70 text-sm">
                Тебя не было {daysAway} {daysAway === 1 ? 'день' : daysAway < 5 ? 'дня' : 'дней'} — самое время продолжить подготовку
              </p>
            </div>
            <div className="px-6 py-5">
              <div className="bg-indigo-50 rounded-2xl p-4 flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Icon name="Gift" size={20} className="text-indigo-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">Бонус за возвращение</p>
                  <p className="text-indigo-600 text-xs font-semibold">+{bonusAmount} вопросов ИИ бесплатно</p>
                </div>
              </div>

              <button
                onClick={claimBonus}
                disabled={claiming}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm mb-2 disabled:opacity-60 active:scale-[0.98] transition-all"
              >
                {claiming ? 'Забираем...' : 'Забрать бонус и продолжить'}
              </button>
              <button onClick={dismiss} className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">
                Пропустить
              </button>
            </div>
          </>
        ) : (
          <div className="px-6 py-10 text-center">
            <div className="text-5xl mb-3">🎉</div>
            <h3 className="font-extrabold text-xl text-gray-900 mb-1">+{bonusAmount} вопросов добавлено!</h3>
            <p className="text-gray-500 text-sm">Рады, что ты вернулся. Удачи в подготовке!</p>
          </div>
        )}
      </div>
    </div>
  );
}