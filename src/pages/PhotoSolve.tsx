import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { authService } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import BottomNav from '@/components/BottomNav';
import PaywallSheet from '@/components/PaywallSheet';

// photo_solve action встроен в ai-assistant
const PHOTO_SOLVE_URL = 'https://functions.poehali.dev/8e8cbd4e-7731-4853-8e29-a84b3d178249';

const SUBJECT_COLORS: Record<string, string> = {
  'Математика': 'from-blue-500 to-indigo-600',
  'Физика': 'from-purple-500 to-indigo-600',
  'Химия': 'from-green-500 to-teal-600',
  'Биология': 'from-emerald-500 to-green-600',
  'История': 'from-amber-500 to-orange-600',
  'Обществознание': 'from-orange-500 to-red-500',
  'Русский язык': 'from-rose-500 to-pink-600',
  'Английский': 'from-sky-500 to-blue-600',
  'Общее': 'from-indigo-500 to-purple-600',
};

const SUBJECT_ICONS: Record<string, string> = {
  'Математика': 'Calculator',
  'Физика': 'Zap',
  'Химия': 'FlaskConical',
  'Биология': 'Leaf',
  'История': 'BookOpen',
  'Обществознание': 'Scale',
  'Русский язык': 'Type',
  'Английский': 'Globe',
  'Общее': 'Brain',
};

interface SolveResult {
  recognized_text: string;
  solution: string;
  subject: string;
  remaining: number;
  used: number;
  limit: number;
  bonus_remaining: number;
}

export default function PhotoSolve() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [hint, setHint] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [showOcr, setShowOcr] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [limitInfo, setLimitInfo] = useState<{ used: number; limit: number; bonus: number } | null>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Нужно фото', description: 'Загрузи изображение (jpg, png, heic)', variant: 'destructive' });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: 'Файл слишком большой', description: 'Максимум 15 МБ', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      const b64 = dataUrl.split(',')[1];
      setImageBase64(b64);
      setResult(null);
      setShowOcr(false);
    };
    reader.readAsDataURL(file);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleSolve = async () => {
    if (!imageBase64) return;

    if (!authService.isAuthenticated()) {
      navigate('/auth');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const token = authService.getToken();

      const resp = await fetch(PHOTO_SOLVE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'photo_solve',
          image_base64: imageBase64,
          hint: hint.trim(),
        }),
      });

      const data = await resp.json();

      if (resp.status === 403) {
        if (data.error === 'limit') {
          setLimitInfo({ used: data.used, limit: data.limit, bonus: data.bonus_remaining || 0 });
          setShowPaywall(true);
        } else {
          toast({ title: 'Доступ ограничен', description: data.message || 'Требуется подписка', variant: 'destructive' });
        }
        return;
      }

      if (!resp.ok) {
        throw new Error(data.error || 'Ошибка при решении задачи');
      }

      setResult(data);
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Попробуй ещё раз',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Скопировано!' });
  };

  const reset = () => {
    setImagePreview(null);
    setImageBase64(null);
    setResult(null);
    setHint('');
    setShowOcr(false);
  };

  const subjectColor = result ? (SUBJECT_COLORS[result.subject] || SUBJECT_COLORS['Общее']) : '';
  const subjectIcon = result ? (SUBJECT_ICONS[result.subject] || 'Brain') : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-blue-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-violet-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-violet-50 transition-colors">
          <Icon name="ArrowLeft" size={20} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-gray-900 text-lg leading-tight">Решить задачу по фото</h1>
          <p className="text-xs text-violet-500">ИИ распознаёт и решает пошагово</p>
        </div>
        <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
          <Icon name="Camera" size={18} className="text-white" />
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-5 space-y-4">

        {/* Hero badge */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-4 text-white flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">📸</span>
          </div>
          <div>
            <p className="font-bold text-sm">Сфотографируй задачу</p>
            <p className="text-white/75 text-xs leading-tight mt-0.5">ЕГЭ, ОГЭ, вузовские задания — ИИ решит и объяснит каждый шаг</p>
          </div>
        </div>

        {/* Upload zone */}
        {!imagePreview ? (
          <div
            className="border-2 border-dashed border-violet-200 bg-white rounded-2xl p-8 text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50/30 transition-all"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <div className="w-20 h-20 bg-gradient-to-br from-violet-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Icon name="Camera" size={36} className="text-violet-500" />
            </div>
            <p className="font-bold text-gray-800 text-base mb-1">Загрузи фото задачи</p>
            <p className="text-sm text-gray-400 mb-5">Перетащи файл или нажми кнопку · JPG, PNG, HEIC</p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                className="rounded-xl border-violet-200 text-violet-600 hover:bg-violet-50"
                onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
              >
                <Icon name="Camera" size={16} className="mr-2" />
                Камера
              </Button>
              <Button
                className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:opacity-90"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              >
                <Icon name="Image" size={16} className="mr-2" />
                Из галереи
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        ) : (
          <>
            {/* Image preview */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-violet-100">
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Фото задачи"
                  className="w-full max-h-72 object-contain bg-gray-50"
                />
                <button
                  onClick={reset}
                  className="absolute top-3 right-3 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 transition-colors"
                >
                  <Icon name="X" size={14} />
                </button>
                <div className="absolute bottom-3 left-3 bg-green-500/90 text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  <Icon name="Check" size={11} />
                  Фото загружено
                </div>
              </div>
            </div>

            {/* Hint input */}
            <div className="bg-white rounded-2xl p-4 border border-violet-100">
              <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Icon name="MessageSquare" size={15} className="text-violet-500" />
                Уточнение (необязательно)
              </label>
              <textarea
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder="Например: «это задание по химии, часть C» или «найди X»"
                className="w-full text-sm text-gray-700 placeholder-gray-400 bg-gray-50 rounded-xl px-3 py-2.5 resize-none border border-gray-200 focus:outline-none focus:border-violet-400 transition-colors"
                rows={2}
                maxLength={300}
              />
            </div>

            {/* Solve button */}
            <Button
              onClick={handleSolve}
              disabled={isLoading}
              className="w-full h-14 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-base rounded-2xl shadow-lg shadow-violet-200 hover:opacity-90 active:scale-[0.98] transition-all"
            >
              {isLoading ? (
                <span className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ИИ решает задачу...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Icon name="Sparkles" size={20} />
                  Решить задачу
                </span>
              )}
            </Button>
          </>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="bg-white rounded-2xl p-6 border border-violet-100">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center">
                <div className="w-8 h-8 border-3 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-800">Анализирую фото...</p>
                <p className="text-sm text-gray-500 mt-1">ИИ распознаёт задачу и готовит пошаговое решение</p>
              </div>
              <div className="w-full space-y-2">
                {['Распознаю текст задачи', 'Определяю тип задания', 'Решаю пошагово'].map((step, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-gray-500">
                    <div className="w-5 h-5 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                    </div>
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Result */}
        {result && !isLoading && (
          <div className="space-y-4">
            {/* Subject badge */}
            <div className={`bg-gradient-to-r ${subjectColor} rounded-2xl p-4 text-white flex items-center gap-3`}>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon name={subjectIcon} size={22} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white/70 text-xs">Определён предмет</p>
                <p className="font-extrabold text-xl">{result.subject}</p>
              </div>
              <div className="text-right">
                <p className="text-white/70 text-xs">Осталось фото</p>
                <p className="font-bold text-lg">{result.remaining}</p>
              </div>
            </div>

            {/* Recognized text toggle */}
            {result.recognized_text && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setShowOcr(!showOcr)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Icon name="ScanText" size={16} className="text-gray-500" />
                    <span className="text-sm font-semibold text-gray-700">Распознанный текст</span>
                  </div>
                  <Icon name={showOcr ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-gray-400" />
                </button>
                {showOcr && (
                  <div className="px-4 pb-4">
                    <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600 font-mono leading-relaxed whitespace-pre-wrap border border-gray-200">
                      {result.recognized_text}
                    </div>
                    <button
                      onClick={() => handleCopy(result.recognized_text)}
                      className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Icon name="Copy" size={12} />
                      Копировать текст
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Solution */}
            <div className="bg-white rounded-2xl border border-violet-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
                    <Icon name="Lightbulb" size={14} className="text-violet-600" />
                  </div>
                  <span className="font-bold text-gray-800">Пошаговое решение</span>
                </div>
                <button
                  onClick={() => handleCopy(result.solution)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-violet-600 transition-colors border border-gray-200 rounded-lg px-2.5 py-1.5"
                >
                  <Icon name="Copy" size={12} />
                  Копировать
                </button>
              </div>
              <div className="p-4">
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                  <ReactMarkdown>{result.solution}</ReactMarkdown>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={reset}
                variant="outline"
                className="flex-1 rounded-xl border-violet-200 text-violet-600 hover:bg-violet-50"
              >
                <Icon name="RefreshCw" size={15} className="mr-2" />
                Новое фото
              </Button>
              <Button
                onClick={() => navigate('/assistant')}
                className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90"
              >
                <Icon name="MessageSquare" size={15} className="mr-2" />
                Спросить ИИ
              </Button>
            </div>

            {/* Limit indicator */}
            <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between text-sm">
              <span className="text-gray-500">Использовано фото сегодня</span>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {Array.from({ length: result.limit }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2.5 h-2.5 rounded-full ${i < result.used ? 'bg-violet-500' : 'bg-gray-200'}`}
                    />
                  ))}
                </div>
                <span className="text-gray-600 font-semibold">{result.used}/{result.limit}</span>
              </div>
            </div>

            {result.bonus_remaining > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-sm">
                <span className="text-amber-500">⚡</span>
                <span className="text-amber-700">Бонусных фото: <strong>{result.bonus_remaining}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Tips */}
        {!result && !isLoading && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <p className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Icon name="Info" size={15} className="text-violet-500" />
              Советы для лучшего результата
            </p>
            <div className="space-y-2.5">
              {[
                { icon: '💡', text: 'Снимай при хорошем освещении — без теней и бликов' },
                { icon: '📐', text: 'Держи телефон прямо над листом, не под углом' },
                { icon: '🔍', text: 'Убедись, что текст задания полностью виден в кадре' },
                { icon: '✍️', text: 'Можно добавить уточнение — ИИ поймёт тему лучше' },
              ].map((tip) => (
                <div key={tip.icon} className="flex items-start gap-2.5">
                  <span className="text-base flex-shrink-0 mt-0.5">{tip.icon}</span>
                  <p className="text-sm text-gray-500 leading-tight">{tip.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subjects */}
        {!result && !isLoading && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <p className="text-sm font-bold text-gray-700 mb-3">Поддерживаемые предметы</p>
            <div className="flex flex-wrap gap-2">
              {Object.keys(SUBJECT_COLORS).filter(s => s !== 'Общее').map(subject => (
                <div
                  key={subject}
                  className={`bg-gradient-to-r ${SUBJECT_COLORS[subject]} text-white text-xs font-semibold px-3 py-1.5 rounded-full`}
                >
                  {subject}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {showPaywall && (
        <PaywallSheet
          trigger="ai_limit"
          onClose={() => setShowPaywall(false)}
        />
      )}

      <BottomNav />
    </div>
  );
}