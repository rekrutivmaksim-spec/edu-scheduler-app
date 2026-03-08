import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface Props {
  trigger?: 'session_limit' | 'ai_limit' | 'after_session' | 'after_session_3rd';
  streak?: number;
  daysToExam?: number;
  onClose: () => void;
}

const TRIGGER_COPY = {
  session_limit: {
    emoji: '🚫',
    title: 'Занятие на сегодня закончилось',
    subtitle: 'Бесплатно — 1 занятие в день. Premium даёт 5 занятий.',
    urgency: 'Без Premium придётся ждать до завтра',
    showPack: false,
  },
  ai_limit: {
    emoji: '⏸️',
    title: 'Лимит вопросов исчерпан',
    subtitle: 'Вопросы на сегодня закончились. Купи +20 вопросов или подключи Premium.',
    urgency: 'Продолжить можно прямо сейчас',
    showPack: true,
  },
  after_session: {
    emoji: '🎉',
    title: 'Занятие завершено!',
    subtitle: 'Хочешь заниматься каждый день без ограничений?',
    urgency: null,
    showPack: false,
  },
  after_session_3rd: {
    emoji: '🏆',
    title: 'Ты прошёл уже 3 занятия!',
    subtitle: 'Ты явно настроен серьёзно. С Premium ты будешь готовиться в 2 раза быстрее.',
    urgency: 'Первый месяц со скидкой 40% — 299 ₽ вместо 499 ₽',
    showPack: false,
  },
};

const FEATURES = [
  { icon: 'Infinity', text: 'Безлимит занятий каждый день' },
  { icon: 'Zap', text: 'Задавай вопросы ИИ без лимита' },
  { icon: 'Target', text: 'Слабые темы — автоматически' },
  { icon: 'TrendingUp', text: 'Подготовка в 2 раза быстрее' },
];

export default function PaywallSheet({ trigger, streak = 0, daysToExam = 87, onClose }: Props) {
  const navigate = useNavigate();
  const copy = TRIGGER_COPY[trigger] ?? TRIGGER_COPY['ai_limit'];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slide-up 0.3s cubic-bezier(0.32,0.72,0,1)' }}
      >
        {/* Ручка */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Шапка */}
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 px-5 py-5 mx-4 rounded-2xl mb-5 mt-2">
          <div className="flex items-start justify-between mb-2">
            <div>
              <span className="text-3xl">{copy.emoji}</span>
              <h2 className="text-white font-extrabold text-xl mt-1 leading-tight">{copy.title}</h2>
              <p className="text-white/70 text-sm mt-1">{copy.subtitle}</p>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white/70 p-1">
              <Icon name="X" size={18} />
            </button>
          </div>

          {/* Срочность */}
          {copy.urgency && (
            <div className="bg-white/15 rounded-xl px-3 py-2 mt-3 flex items-center gap-2">
              <span className="text-yellow-300 text-sm">⚠️</span>
              <p className="text-white/80 text-xs">{copy.urgency}</p>
            </div>
          )}

          {/* Стрик + дни */}
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
                  <span className="text-white text-xs font-semibold">До экзамена {daysToExam} дней</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Фичи */}
        <div className="px-5 space-y-2.5 mb-5">
          {FEATURES.map(f => (
            <div key={f.text} className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon name={f.icon} size={15} className="text-indigo-600" />
              </div>
              <span className="text-gray-700 text-sm">{f.text}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-5 pb-8 space-y-2">
          {copy.showPack && (
            <Button
              onClick={() => { onClose(); navigate('/pricing'); }}
              className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-base rounded-2xl active:scale-[0.98] transition-all"
            >
              ⚡ Купить +20 вопросов — 149 ₽
            </Button>
          )}
          <Button
            onClick={() => { onClose(); navigate('/pricing'); }}
            className={`w-full ${copy.showPack ? 'h-11' : 'h-14'} bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-extrabold ${copy.showPack ? 'text-base' : 'text-lg'} rounded-2xl shadow-[0_4px_20px_rgba(99,102,241,0.4)] active:scale-[0.98] transition-all`}
          >
            Подключить Premium — 499 ₽/мес
          </Button>
          <p className="text-gray-400 text-xs text-center mt-1">🔓 Отмена в любой момент</p>
          <button
            onClick={() => { onClose(); navigate('/referral'); }}
            className="w-full flex items-center justify-center gap-1.5 text-emerald-600 text-sm font-semibold mt-2 py-2 active:opacity-70"
          >
            <Icon name="Users" size={14} />
            Или получи Premium бесплатно — приведи друга
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