import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { authService } from '@/lib/auth';
import { openPaymentUrl } from '@/lib/payment-utils';
import { API } from '@/lib/api-urls';

const PAYMENTS_URL = API.PAYMENTS;

interface Props {
  trigger?: 'session_limit' | 'ai_limit' | 'after_session' | 'after_session_3rd';
  streak?: number;
  daysToExam?: number;
  onClose: () => void;
}

const TRIGGER_COPY = {
  session_limit: {
    emoji: '🚫',
    title: 'Лимит исчерпан',
    subtitle: 'Бесплатно — ограниченный доступ. Premium — безлимит ко всему.',
    urgency: 'Не теряй время — подключи Premium и продолжай прямо сейчас',
    showPack: false,
  },
  ai_limit: {
    emoji: '⏸️',
    title: 'Вопросы закончились',
    subtitle: 'Бесплатно — 3 вопроса/день. С Premium — безлимит без ограничений!',
    urgency: 'Каждый день без Premium — это упущенная подготовка к экзамену',
    showPack: true,
  },
  after_session: {
    emoji: '🎉',
    title: 'Занятие завершено!',
    subtitle: 'Хочешь безлимитный доступ ко всем функциям? Учись без ограничений!',
    urgency: null,
    showPack: false,
  },
  after_session_3rd: {
    emoji: '🏆',
    title: 'Ты прошёл уже 3 занятия!',
    subtitle: 'С Premium — безлимит на всё: вопросы, фото, аудио, занятия и материалы.',
    urgency: 'Первый месяц — 299 ₽ вместо 499 ₽. Не упусти скидку!',
    showPack: false,
  },
};

const FEATURES = [
  { icon: 'Zap', text: 'Безлимитные вопросы к ИИ' },
  { icon: 'Camera', text: 'Безлимитные фото и аудио' },
  { icon: 'Target', text: 'Подготовка к ЕГЭ/ОГЭ по всем предметам' },
  { icon: 'TrendingUp', text: 'Полный доступ ко всем функциям' },
];

export default function PaywallSheet({ trigger, streak = 0, daysToExam = 0, onClose }: Props) {
  const navigate = useNavigate();
  const copy = TRIGGER_COPY[trigger ?? 'ai_limit'];
  const [buying, setBuying] = useState<string | null>(null);

  const handleQuickBuy = async (planType: string) => {
    setBuying(planType);
    try {
      const token = authService.getToken();
      if (!token) { onClose(); navigate('/pricing'); return; }

      const returnUrl = `${window.location.origin}/pricing?payment=success`;
      const response = await fetch(PAYMENTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'create_payment', plan_type: planType, return_url: returnUrl }),
      });
      const data = await response.json();

      if (data.success && data.confirmation_url) {
        if (data.payment_id) localStorage.setItem('pending_payment_id', String(data.payment_id));
        await openPaymentUrl(data.confirmation_url);
      } else {
        onClose();
        navigate('/pricing');
      }
    } catch {
      onClose();
      navigate('/pricing');
    } finally {
      setBuying(null);
    }
  };

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

        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 px-5 py-5 mx-4 rounded-2xl mb-4 mt-2">
          <div className="flex items-start justify-between mb-1">
            <div>
              <span className="text-3xl">{copy.emoji}</span>
              <h2 className="text-white font-extrabold text-xl mt-1 leading-tight">{copy.title}</h2>
              <p className="text-white/70 text-sm mt-1">{copy.subtitle}</p>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white/70 p-1">
              <Icon name="X" size={18} />
            </button>
          </div>

          {copy.urgency && (
            <div className="bg-white/15 rounded-xl px-3 py-2 mt-3 flex items-center gap-2">
              <span className="text-yellow-300 text-sm">⚠️</span>
              <p className="text-white/80 text-xs">{copy.urgency}</p>
            </div>
          )}

          {(streak > 0 || daysToExam > 0) && (
            <div className="flex gap-2 mt-3">
              {streak > 0 && (
                <div className="bg-white/15 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
                  <span className="text-sm">🔥</span>
                  <span className="text-white text-xs font-semibold">Серия {streak} {streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'}</span>
                </div>
              )}
              {daysToExam > 0 && (
                <div className="bg-white/15 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
                  <span className="text-sm">🎯</span>
                  <span className="text-white text-xs font-semibold">До экзамена {daysToExam} дн.</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 space-y-2 mb-4">
          {FEATURES.map(f => (
            <div key={f.text} className="flex items-center gap-3">
              <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon name={f.icon} size={14} className="text-indigo-600" />
              </div>
              <span className="text-gray-700 text-sm">{f.text}</span>
            </div>
          ))}
        </div>

        <div className="px-5 pb-8 space-y-2.5">
          {copy.showPack && (
            <Button
              onClick={() => handleQuickBuy('questions_20')}
              disabled={!!buying}
              className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-base rounded-2xl active:scale-[0.98] transition-all"
            >
              {buying === 'questions_20' ? (
                <Icon name="Loader2" size={18} className="animate-spin" />
              ) : (
                '⚡ +20 вопросов — 149 ₽'
              )}
            </Button>
          )}
          <Button
            onClick={() => handleQuickBuy('1month')}
            disabled={!!buying}
            className={`w-full ${copy.showPack ? 'h-11' : 'h-14'} bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-extrabold ${copy.showPack ? 'text-base' : 'text-lg'} rounded-2xl shadow-[0_4px_20px_rgba(99,102,241,0.4)] active:scale-[0.98] transition-all`}
          >
            {buying === '1month' ? (
              <Icon name="Loader2" size={18} className="animate-spin" />
            ) : (
              '🚀 Premium — 499 ₽/мес'
            )}
          </Button>
          <button
            onClick={() => { onClose(); navigate('/pricing'); }}
            className="w-full text-center text-indigo-600 text-sm font-medium py-2 active:opacity-70"
          >
            Все тарифы и скидки →
          </button>
          <p className="text-gray-400 text-[11px] text-center">Отмена в любой момент · Возврат 14 дней</p>
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