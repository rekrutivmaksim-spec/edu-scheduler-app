import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

const RUSTORE_URL = 'https://apps.rustore.ru/app/dev.studyfay.app';
const FEEDBACK_BOT = 'https://t.me/studyfay_support';

type Stage = 'idle' | 'ask' | 'happy' | 'sad';

interface ReviewPromptProps {
  trigger: 'streak_7' | 'streak_30' | 'first_material' | 'first_flashcard' | null;
  onClose: () => void;
}

const TRIGGER_MESSAGES: Record<string, { emoji: string; text: string }> = {
  streak_7: { emoji: '🔥', text: '7 дней подряд в приложении — это серьёзно!' },
  streak_30: { emoji: '🏆', text: 'Месяц без пропусков — ты настоящий студент года!' },
  first_material: { emoji: '📚', text: 'Первый конспект загружен — отличное начало!' },
  first_flashcard: { emoji: '🃏', text: 'Первые карточки готовы к повторению!' },
};

const ReviewPrompt = ({ trigger, onClose }: ReviewPromptProps) => {
  const [stage, setStage] = useState<Stage>('idle');
  const [feedbackText, setFeedbackText] = useState('');

  useEffect(() => {
    if (trigger) {
      const shown = localStorage.getItem(`review_shown_${trigger}`);
      if (!shown) {
        setTimeout(() => setStage('ask'), 800);
      }
    }
  }, [trigger]);

  const handleHappy = () => {
    setStage('happy');
    localStorage.setItem(`review_shown_${trigger}`, '1');
    setTimeout(() => {
      window.open(RUSTORE_URL, '_blank');
      onClose();
    }, 1200);
  };

  const handleSad = () => {
    setStage('sad');
    localStorage.setItem(`review_shown_${trigger}`, '1');
  };

  const handleSendFeedback = () => {
    const text = encodeURIComponent(`Обратная связь: ${feedbackText}`);
    window.open(`${FEEDBACK_BOT}?start=${text}`, '_blank');
    onClose();
  };

  if (stage === 'idle' || !trigger) return null;

  const msg = TRIGGER_MESSAGES[trigger];

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 animate-in slide-in-from-bottom-4 duration-300">

        {stage === 'ask' && (
          <div className="text-center space-y-4">
            <div className="text-4xl">{msg.emoji}</div>
            <div>
              <p className="font-bold text-gray-900 text-lg">{msg.text}</p>
              <p className="text-gray-500 text-sm mt-1">Всё нравится в приложении?</p>
            </div>
            <div className="flex gap-3 mt-2">
              <Button
                variant="outline"
                className="flex-1 border-gray-200 text-gray-600"
                onClick={handleSad}
              >
                Есть замечания
              </Button>
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleHappy}
              >
                Да, всё отлично! ⭐
              </Button>
            </div>
            <button onClick={onClose} className="text-xs text-gray-400 mt-1">
              Пропустить
            </button>
          </div>
        )}

        {stage === 'happy' && (
          <div className="text-center space-y-3">
            <div className="text-4xl">🎉</div>
            <p className="font-bold text-gray-900">Спасибо! Открываю RuStore...</p>
            <p className="text-gray-500 text-sm">Твой отзыв очень помогает!</p>
          </div>
        )}

        {stage === 'sad' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Icon name="MessageCircle" size={20} className="text-purple-600" />
              <p className="font-bold text-gray-900">Что можно улучшить?</p>
            </div>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder="Напиши что не понравилось — мы это исправим..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
            />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Отмена
              </Button>
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleSendFeedback}
                disabled={!feedbackText.trim()}
              >
                Отправить
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewPrompt;
