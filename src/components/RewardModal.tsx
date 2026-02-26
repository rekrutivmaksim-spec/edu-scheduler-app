import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export type RewardType =
  | 'level_up'
  | 'streak_reward'
  | 'streak_lost'
  | 'ai_limit'
  | 'file_limit'
  | 'achievement'
  | 'premium_day'
  | 'streak_freeze';

interface RewardModalProps {
  type: RewardType;
  onClose: () => void;
  onAction?: () => void;
  data?: {
    level?: number;
    reward?: string;
    streakDays?: number;
    nextReward?: string;
    freezesLeft?: number;
    achievementTitle?: string;
    xp?: number;
    bonusQuestions?: number;
  };
}

export default function RewardModal({ type, onClose, onAction, data = {} }: RewardModalProps) {
  const navigate = useNavigate();

  const goToPricing = () => { onClose(); navigate('/pricing'); };
  const goToStudy = () => { onClose(); navigate('/'); };
  const goToQuests = () => { onClose(); navigate('/achievements'); };

  const SCREENS = {
    level_up: {
      emoji: '🎉',
      gradient: 'from-indigo-600 via-purple-600 to-pink-600',
      title: 'Уровень повышен!',
      subtitle: `Ты достиг уровня ${data.level || 2}`,
      reward: data.reward || null,
      note: 'Продолжай в том же духе — следующий уровень откроет ещё больше возможностей.',
      hint: 'Premium ускоряет рост в 2 раза',
      primaryLabel: 'Продолжить обучение',
      primaryAction: goToStudy,
      secondaryLabel: 'Перейти к заданиям',
      secondaryAction: goToQuests,
    },
    streak_reward: {
      emoji: '🔥',
      gradient: 'from-orange-500 to-amber-500',
      title: 'Серия продолжается!',
      subtitle: `${data.streakDays || 3} дня подряд`,
      reward: data.reward || '+5 бонус-вопросов ИИ',
      note: data.nextReward ? `Не останавливайся — на ${data.nextReward} тебя ждёт награда.` : 'Не останавливайся — впереди ещё больше наград.',
      hint: 'С Premium серия не сгорает',
      primaryLabel: 'Продолжить занятие',
      primaryAction: goToStudy,
      secondaryLabel: 'Посмотреть награды',
      secondaryAction: goToQuests,
    },
    streak_lost: {
      emoji: '⚠️',
      gradient: 'from-red-500 to-rose-600',
      title: 'Серия прервалась',
      subtitle: 'Ты пропустил день и потерял прогресс.',
      reward: 'Текущая серия: 0 дней',
      note: 'Заходи каждый день, используй заморозку или подключи Premium.',
      hint: 'В Premium — безлимитная заморозка серии',
      primaryLabel: 'Начать заново',
      primaryAction: goToStudy,
      secondaryLabel: 'Подключить Premium',
      secondaryAction: goToPricing,
    },
    ai_limit: {
      emoji: '⏸️',
      gradient: 'from-indigo-600 to-purple-700',
      title: 'Вопросы закончились',
      subtitle: 'Ты использовал все бесплатные вопросы на сегодня.',
      reward: null,
      note: null,
      hint: null,
      features: [
        'Безлимит вопросов ИИ',
        'Разбор сложных тем',
        'Анализ файлов',
        'Подготовка к экзаменам',
      ],
      primaryLabel: 'Подключить Premium — 449 ₽ в месяц',
      primaryAction: goToPricing,
      secondaryLabel: 'Вернуться завтра',
      secondaryAction: onClose,
    },
    file_limit: {
      emoji: '📎',
      gradient: 'from-emerald-500 to-teal-600',
      title: 'Лимит файлов исчерпан',
      subtitle: 'Ты использовал бесплатный анализ файла на сегодня.',
      reward: null,
      note: null,
      hint: null,
      features: [
        'До 3 анализов файлов в день',
        'Разбор лекций и конспектов',
        'Ответы по билетам',
        'Помощь по задачам',
      ],
      primaryLabel: 'Подключить Premium',
      primaryAction: goToPricing,
      secondaryLabel: 'Закрыть',
      secondaryAction: onClose,
    },
    achievement: {
      emoji: '🏆',
      gradient: 'from-yellow-500 to-amber-500',
      title: 'Достижение открыто!',
      subtitle: data.achievementTitle || 'Первая неделя подряд',
      reward: data.xp ? `+${data.xp} XP` : (data.bonusQuestions ? `+${data.bonusQuestions} бонус-вопросов` : null),
      note: 'Продолжай — впереди ещё больше достижений и наград.',
      hint: null,
      primaryLabel: 'Продолжить обучение',
      primaryAction: goToStudy,
      secondaryLabel: null,
      secondaryAction: null,
    },
    premium_day: {
      emoji: '🎁',
      gradient: 'from-violet-600 to-purple-700',
      title: 'Бонус получен!',
      subtitle: 'Ты получил 1 день Premium',
      reward: null,
      note: 'Используй его с пользой.',
      hint: null,
      features: [
        'Безлимит вопросов',
        'Безлимит файлов',
        'Ускоренный рост XP',
      ],
      primaryLabel: 'Начать занятие',
      primaryAction: goToStudy,
      secondaryLabel: null,
      secondaryAction: null,
    },
    streak_freeze: {
      emoji: '🧊',
      gradient: 'from-sky-500 to-blue-600',
      title: 'Серия сохранена',
      subtitle: 'Ты использовал заморозку.',
      reward: `Осталось заморозок: ${data.freezesLeft ?? 0}`,
      note: 'В Premium — заморозка без ограничений.',
      hint: null,
      primaryLabel: 'Продолжить обучение',
      primaryAction: goToStudy,
      secondaryLabel: 'Подключить Premium',
      secondaryAction: goToPricing,
    },
  };

  const s = SCREENS[type];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
      style={{ animation: 'fade-in 0.2s ease' }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl overflow-hidden pb-safe"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slide-up 0.35s cubic-bezier(0.32,0.72,0,1)' }}
      >
        {/* Ручка */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Шапка с градиентом */}
        <div className={`bg-gradient-to-br ${s.gradient} mx-4 rounded-2xl p-5 mb-4 mt-2 relative overflow-hidden`}>
          {/* Декоративные круги */}
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />
          <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white/10 rounded-full" />

          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white/40 hover:text-white/80 transition-colors z-10"
          >
            ✕
          </button>

          <div className="relative z-10">
            <span
              className="text-5xl block mb-3"
              style={{ animation: 'bounce-in 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}
            >
              {s.emoji}
            </span>
            <h2 className="text-white font-extrabold text-2xl leading-tight mb-1">{s.title}</h2>
            <p className="text-white/80 text-sm">{s.subtitle}</p>

            {s.reward && (
              <div className="mt-3 bg-white/20 rounded-xl px-4 py-2.5 inline-block">
                <p className="text-white font-bold text-base">{s.reward}</p>
              </div>
            )}

            {'features' in s && s.features && (
              <div className="mt-3 space-y-1.5">
                {s.features.map(f => (
                  <div key={f} className="flex items-center gap-2 text-white/90 text-sm">
                    <span className="text-white/60">✓</span>
                    {f}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Текст + кнопки */}
        <div className="px-5 pb-8 space-y-3">
          {s.note && (
            <p className="text-gray-500 text-sm leading-relaxed text-center">{s.note}</p>
          )}

          <Button
            onClick={s.primaryAction}
            className={`w-full h-12 bg-gradient-to-r ${s.gradient} text-white font-bold rounded-2xl text-base shadow-lg active:scale-[0.98] transition-all`}
          >
            {s.primaryLabel}
          </Button>

          {s.secondaryLabel && s.secondaryAction && (
            <button
              onClick={s.secondaryAction}
              className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors font-medium"
            >
              {s.secondaryLabel}
            </button>
          )}

          {s.hint && (
            <p className="text-center text-xs text-gray-400">{s.hint}</p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes bounce-in {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}