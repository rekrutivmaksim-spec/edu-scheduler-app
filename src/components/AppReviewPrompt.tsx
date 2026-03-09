import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { loadReviewState, saveReviewState } from '@/lib/review';

const AppReviewPrompt = () => {
  const [step, setStep] = useState<'hidden' | 'rating' | 'positive' | 'negative'>('hidden');
  const [rating, setRating] = useState(0);

  useEffect(() => {
    const s = loadReviewState();
    if (s.reviewed) return;
    if (s.dismissedAt && Date.now() - s.dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    if ((s.sessionsCount || 0) < 3) return;
    if (s.promptShownAt && Date.now() - s.promptShownAt < 14 * 24 * 60 * 60 * 1000) return;

    const timer = setTimeout(() => {
      setStep('rating');
      saveReviewState({ ...s, promptShownAt: Date.now() });
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  const handleRate = (r: number) => {
    setRating(r);
    if (r >= 4) setStep('positive');
    else setStep('negative');
  };

  const handlePositive = () => {
    saveReviewState({ ...loadReviewState(), reviewed: true });
    setStep('hidden');
    window.open('https://www.rustore.ru/catalog/app/ru.studyfay.app', '_blank');
  };

  const handleNegative = () => {
    saveReviewState({ ...loadReviewState(), reviewed: true });
    setStep('hidden');
    window.open('https://t.me/+QgiLIa1gFRY4Y2Iy', '_blank');
  };

  const handleDismiss = () => {
    saveReviewState({ ...loadReviewState(), dismissedAt: Date.now() });
    setStep('hidden');
  };

  if (step === 'hidden') return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom duration-300">

        {step === 'rating' && (
          <>
            <div className="flex justify-between items-start mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-200">
                <span className="text-2xl">⭐</span>
              </div>
              <button onClick={handleDismiss} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <Icon name="X" size={18} />
              </button>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Как тебе Studyfay?</h3>
            <p className="text-sm text-gray-500 mb-5">Оцени приложение — это займёт 10 секунд</p>
            <div className="flex justify-center gap-3 mb-5">
              {[1, 2, 3, 4, 5].map(r => (
                <button
                  key={r}
                  onClick={() => handleRate(r)}
                  className="text-3xl transition-transform active:scale-90 hover:scale-110"
                >
                  {r <= rating ? '⭐' : '☆'}
                </button>
              ))}
            </div>
            <button onClick={handleDismiss} className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">
              Напомнить позже
            </button>
          </>
        )}

        {step === 'positive' && (
          <>
            <div className="text-center mb-5">
              <div className="text-5xl mb-3">🎉</div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Отлично, спасибо!</h3>
              <p className="text-sm text-gray-500">Оставь отзыв в RuStore — помоги другим студентам найти Studyfay</p>
            </div>
            <button
              onClick={handlePositive}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold text-sm mb-2 hover:from-violet-700 hover:to-purple-700 transition-colors"
            >
              Оставить отзыв в RuStore
            </button>
            <button onClick={handleDismiss} className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">
              Не сейчас
            </button>
          </>
        )}

        {step === 'negative' && (
          <>
            <div className="text-center mb-5">
              <div className="text-5xl mb-3">🙏</div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Жаль, что не всё понравилось</h3>
              <p className="text-sm text-gray-500">Расскажи нам что улучшить — ответим лично и исправим</p>
            </div>
            <button
              onClick={handleNegative}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold text-sm mb-2 hover:from-indigo-700 hover:to-blue-700 transition-colors"
            >
              Написать в Telegram
            </button>
            <button onClick={handleDismiss} className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">
              Не сейчас
            </button>
          </>
        )}

      </div>
    </div>
  );
};

export default AppReviewPrompt;