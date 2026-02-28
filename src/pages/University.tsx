import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import BottomNav from '@/components/BottomNav';
import PaywallSheet from '@/components/PaywallSheet';
import RewardModal from '@/components/RewardModal';
import { authService } from '@/lib/auth';

const AI_URL = 'https://functions.poehali.dev/8e8cbd4e-7731-4853-8e29-a84b3d178249';
const MATERIALS_URL = 'https://functions.poehali.dev/177e7001-b074-41cb-9553-e9c715d36f09';
const SUBSCRIPTION_URL = 'https://functions.poehali.dev/7fe183c2-49af-4817-95f3-6ab4912778c4';

type Mode = 'home' | 'file' | 'question';

interface AnalysisResult {
  summary: string;
  keyPoints: string[];
}

const QUICK_ACTIONS = [
  { icon: '🎫', text: 'Разбери экзаменационный билет', placeholder: 'Вставь вопрос из билета...' },
  { icon: '📘', text: 'Объясни тему простыми словами', placeholder: 'Напиши название темы...' },
  { icon: '🧮', text: 'Помоги решить задачу по предмету', placeholder: 'Опиши условие задачи...' },
  { icon: '📝', text: 'Составь краткий конспект лекции', placeholder: 'Напиши тему конспекта...' },
];

export default function University() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('home');
  const [question, setQuestion] = useState('');
  const [questionPlaceholder, setQuestionPlaceholder] = useState('Задай вопрос...');
  const [isLoading, setIsLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [showPaywall, setShowPaywall] = useState<'ai_limit' | null>(null);
  const [showFileRewardModal, setShowFileRewardModal] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fileUsedToday, setFileUsedToday] = useState(false);
  const [aiRemaining, setAiRemaining] = useState<number | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [filesUsed, setFilesUsed] = useState(0);
  const [filesMax, setFilesMax] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate('/auth');
      return;
    }
  }, [navigate]);

  useEffect(() => {
    const loadLimits = async () => {
      try {
        const token = authService.getToken();
        const res = await fetch(`${SUBSCRIPTION_URL}?action=limits`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const premium = data.subscription_type === 'premium' || !!data.is_trial;
          setIsPremium(premium);
          const ai = data.limits?.ai_questions;
          if (ai) {
            if (ai.unlimited) {
              setAiRemaining(null);
            } else {
              setAiRemaining(Math.max(0, (ai.max ?? 5) - (ai.used ?? 0)));
            }
          }
          const materials = data.limits?.materials;
          const maxFiles = premium ? 3 : 1;
          setFilesMax(maxFiles);
          if (materials) {
            const used = materials.used ?? 0;
            setFilesUsed(used);
            setFileUsedToday(used >= maxFiles);
          } else if (premium) {
            setFileUsedToday(false);
          }
        }
      } catch { /* silent */ }
    };
    loadLimits();
  }, []);

  // fail-safe: при ошибке API считаем файловый лимит исчерпанным
  const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => {
    if (aiRemaining !== null && aiRemaining <= 0 && !isPremium) {
      setShowPaywall('ai_limit');
      return;
    }
    setMode('question');
    setQuestionPlaceholder(action.placeholder);
    setQuestion('');
    setAnswer('');
  };

  const handleSendQuestion = async () => {
    if (!question.trim() || isLoading) return;
    if (aiRemaining !== null && aiRemaining <= 0 && !isPremium) {
      setShowPaywall('ai_limit');
      return;
    }
    setIsLoading(true);
    setAnswer('');
    try {
      const token = authService.getToken();
      const res = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: question.trim() }),
      });
      const data = await res.json();
      if (res.status === 403) {
        setShowPaywall('ai_limit');
        return;
      }
      if (data.remaining !== undefined) setAiRemaining(data.remaining);
      setAnswer(data.answer || data.response || 'Не удалось получить ответ');
    } catch {
      setAnswer('Ошибка соединения. Попробуй снова.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUploadClick = () => {
    if (!isPremium && fileUsedToday) {
      setShowFileRewardModal(true);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    setMode('file');
    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const token = authService.getToken();
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const uploadRes = await fetch(MATERIALS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              action: 'upload_direct',
              filename: file.name,
              fileType: file.type || 'application/octet-stream',
              fileData: base64,
            }),
          });

          if (uploadRes.status === 403) {
            setShowFileRewardModal(true);
            setIsAnalyzing(false);
            setMode('home');
            return;
          }

          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            const summary = uploadData.material?.summary || '';
            setAnalysis({
              summary: summary || 'Файл загружен. Задавай вопросы по его содержимому.',
              keyPoints: summary
                ? summary.split('.').filter((s: string) => s.trim().length > 20).slice(0, 4)
                : [],
            });
            setFileUsedToday(true);
          }
        } catch {
          setAnalysis({ summary: 'Файл загружен. Задай вопрос по его содержимому.', keyPoints: [] });
        } finally {
          setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setAnalysis({ summary: 'Файл загружен. Задай вопрос.', keyPoints: [] });
      setIsAnalyzing(false);
    }
  };

  // === Режим: вопрос ===
  if (mode === 'question') {
    return (
      <div className="min-h-screen bg-gray-50 pb-24 flex flex-col">
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 px-4 pt-12 pb-6">
          <button onClick={() => { setMode('home'); setAnswer(''); }} className="flex items-center gap-2 text-white/70 mb-3">
            <Icon name="ArrowLeft" size={18} />
            <span className="text-sm">Назад</span>
          </button>
          <h1 className="text-white font-extrabold text-xl">Быстрая помощь</h1>
          <p className="text-white/60 text-sm mt-1">Задай вопрос — отвечу за секунды</p>
          {!isPremium && aiRemaining !== null && (
            <div className="mt-2 inline-block bg-white/15 rounded-full px-3 py-1">
              <span className="text-white/80 text-xs">Осталось: {aiRemaining} {aiRemaining === 1 ? 'вопрос' : aiRemaining && aiRemaining < 5 ? 'вопроса' : 'вопросов'}</span>
            </div>
          )}
        </div>

        <div className="flex-1 px-4 py-4 max-w-xl mx-auto w-full space-y-3">
          <div className="bg-white rounded-3xl p-4 shadow-sm">
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder={questionPlaceholder}
              rows={4}
              className="w-full resize-none rounded-2xl border-2 border-gray-100 focus:border-indigo-400 px-4 py-3 text-sm text-gray-800 outline-none transition-colors"
            />
            <Button
              onClick={handleSendQuestion}
              disabled={!question.trim() || isLoading}
              className="w-full h-12 mt-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl disabled:opacity-50"
            >
              {isLoading
                ? <><Icon name="Loader2" size={16} className="animate-spin mr-2" />Думаю...</>
                : <>Получить ответ <Icon name="ArrowRight" size={16} className="ml-1.5" /></>
              }
            </Button>
          </div>

          {answer && (
            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Icon name="Sparkles" size={14} className="text-indigo-600" />
                </div>
                <span className="font-bold text-gray-800 text-sm">Ответ</span>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{answer}</p>

              {/* Плашка после ответа */}
              <div className="mt-4 pt-4 border-t border-gray-50 space-y-2">
                <button
                  onClick={() => { setQuestion(''); setAnswer(''); setTimeout(() => document.querySelector<HTMLTextAreaElement>('textarea')?.focus(), 50); }}
                  className="w-full text-indigo-600 text-sm font-semibold border border-indigo-200 rounded-2xl py-2.5 hover:bg-indigo-50 transition-colors"
                >
                  Задать другой вопрос
                </button>
                {!isPremium && (
                  <button
                    onClick={() => navigate('/pricing')}
                    className="w-full text-purple-600 text-xs py-2 hover:text-purple-800 transition-colors"
                  >
                    Подключить Premium — безлимит ответов
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {showPaywall && <PaywallSheet trigger={showPaywall} onClose={() => setShowPaywall(null)} />}
        <BottomNav />
      </div>
    );
  }

  // === Режим: файл ===
  if (mode === 'file') {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 px-4 pt-12 pb-6">
          <button onClick={() => { setMode('home'); setUploadedFile(null); setAnalysis(null); setQuestion(''); setAnswer(''); }} className="flex items-center gap-2 text-white/70 mb-3">
            <Icon name="ArrowLeft" size={18} />
            <span className="text-sm">Назад</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
              <Icon name="FileText" size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-extrabold text-lg leading-tight">{uploadedFile?.name}</h1>
              <p className="text-white/60 text-xs mt-0.5">
                {uploadedFile ? (uploadedFile.size / 1024).toFixed(0) + ' КБ' : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 py-4 space-y-3 max-w-xl mx-auto">
          {isAnalyzing ? (
            <div className="bg-white rounded-3xl p-8 shadow-sm flex flex-col items-center">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin mb-4" />
              <p className="text-gray-700 font-bold">Анализирую файл...</p>
              <p className="text-gray-400 text-sm mt-1">Выделяю главное и ключевые тезисы</p>
            </div>
          ) : analysis ? (
            <>
              <div className="bg-white rounded-3xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">📋</span>
                  <h3 className="font-bold text-gray-800">Краткий конспект</h3>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">{analysis.summary}</p>
                {analysis.keyPoints.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {analysis.keyPoints.map((p, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-2 flex-shrink-0" />
                        <p className="text-gray-600 text-sm">{p.trim()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-3xl p-5 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-3">Задай вопрос по файлу</h3>
                <textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="Что такое... Объясни... Почему..."
                  rows={3}
                  className="w-full resize-none rounded-2xl border-2 border-gray-100 focus:border-indigo-400 px-4 py-3 text-sm text-gray-800 outline-none transition-colors"
                />
                <Button
                  onClick={handleSendQuestion}
                  disabled={!question.trim() || isLoading}
                  className="w-full h-12 mt-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl disabled:opacity-50"
                >
                  {isLoading
                    ? <><Icon name="Loader2" size={16} className="animate-spin mr-2" />Думаю...</>
                    : 'Спросить'
                  }
                </Button>
              </div>

              {answer && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-5">
                  <p className="text-indigo-800 text-sm leading-relaxed whitespace-pre-line">{answer}</p>
                </div>
              )}

              {/* Плашка после анализа файла */}
              <div className="bg-white rounded-3xl p-4 shadow-sm flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-gray-800 text-sm">Хочешь разобрать ещё лекции?</p>
                  <p className="text-gray-400 text-xs mt-0.5">Безлимит файлов — в Premium</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      if (!isPremium && fileUsedToday) {
                        setShowFileRewardModal(true);
                      } else {
                        fileInputRef.current?.click();
                      }
                    }}
                    className="text-xs bg-gray-100 text-gray-700 px-3 py-2 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    Загрузить ещё
                  </button>
                  {!isPremium && (
                    <button
                      onClick={() => navigate('/pricing')}
                      className="text-xs bg-purple-600 text-white px-3 py-2 rounded-xl font-medium"
                    >
                      Premium
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleFileSelect} />
        {showPaywall && <PaywallSheet trigger={showPaywall} onClose={() => setShowPaywall(null)} />}
        {showFileRewardModal && (
          <RewardModal type="file_limit" onClose={() => setShowFileRewardModal(false)} />
        )}
        <BottomNav />
      </div>
    );
  }

  // === Главный экран ===
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 px-4 pt-12 pb-8">
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-white/70 mb-3 hover:text-white transition-colors">
          <Icon name="ArrowLeft" size={18} />
          <span className="text-sm">Главная</span>
        </button>
        <h1 className="text-white font-extrabold text-2xl mb-1">Помощь с учёбой</h1>
        <p className="text-white/60 text-sm">ИИ-репетитор для вуза, колледжа и экзаменов</p>
        {!isPremium && aiRemaining !== null && (
          <div className="mt-3 inline-block bg-white/15 rounded-full px-3 py-1">
            <span className="text-white/80 text-xs">Осталось вопросов: {aiRemaining}</span>
          </div>
        )}
      </div>

      <div className="px-4 -mt-4 space-y-3 max-w-xl mx-auto">

        {/* Блок: Разобрать файл */}
        <button
          onClick={handleFileUploadClick}
          className={`w-full bg-white rounded-3xl p-5 shadow-sm border-2 transition-all active:scale-[0.98] text-left ${
            !isPremium && fileUsedToday
              ? 'border-gray-200 opacity-80'
              : 'border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${!isPremium && fileUsedToday ? 'bg-gray-100' : 'bg-indigo-50'}`}>
              {!isPremium && fileUsedToday
                ? <Icon name="Lock" size={24} className="text-gray-400" />
                : <Icon name="Upload" size={26} className="text-indigo-600" />
              }
            </div>
            <div>
              <p className="font-extrabold text-gray-800 text-base">Разобрать файл</p>
              <p className="text-gray-500 text-sm mt-0.5">PDF, Word, TXT — ИИ сделает конспект за минуту</p>
              {fileUsedToday ? (
                <p className="text-red-400 text-xs mt-1.5 font-medium">
                  Лимит на сегодня исчерпан ({filesUsed}/{filesMax}) → Premium 3/день
                </p>
              ) : (
                <p className="text-indigo-500 text-xs mt-1.5 font-medium">
                  {isPremium
                    ? `Загружено сегодня: ${filesUsed} из ${filesMax} файлов`
                    : `Бесплатно: 1 файл в день · Загружено: ${filesUsed}/1`}
                </p>
              )}
            </div>
          </div>
          {!(!isPremium && fileUsedToday) && (
            <div className="mt-3 flex gap-2">
              {['PDF', 'Word', 'TXT'].map(t => (
                <span key={t} className="bg-indigo-100 text-indigo-600 text-xs font-semibold px-2.5 py-1 rounded-full">{t}</span>
              ))}
            </div>
          )}
        </button>
        <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleFileSelect} />

        {/* Быстрые действия */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
            <Icon name="Zap" size={16} className="text-amber-500" />
            Задай вопрос ИИ
          </h3>
          <p className="text-gray-400 text-xs mb-3">Получи подробный ответ за секунды</p>
          <div className="space-y-2">
            {QUICK_ACTIONS.map((qa, i) => (
              <button
                key={i}
                onClick={() => handleQuickAction(qa)}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl hover:bg-gray-50 border border-gray-100 transition-all active:scale-[0.98] text-left"
              >
                <span className="text-xl flex-shrink-0">{qa.icon}</span>
                <span className="text-gray-700 text-sm font-medium flex-1">{qa.text}</span>
                <Icon name="ChevronRight" size={14} className="text-gray-300" />
              </button>
            ))}
          </div>
          {!isPremium && aiRemaining !== null && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-gray-400 text-xs">
                Осталось сегодня: <span className="font-medium text-gray-600">{aiRemaining} из 5 вопросов</span>
              </p>
              {aiRemaining <= 0 && (
                <button onClick={() => navigate('/pricing')} className="text-xs text-purple-600 font-medium">
                  Купить +20 →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Premium блок */}
        {!isPremium && (
          <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 rounded-3xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🎓</span>
              <h3 className="font-bold text-white">Premium для учёбы</h3>
            </div>
            <p className="text-white/60 text-xs mb-3">Всё для подготовки без ограничений:</p>
            <div className="space-y-2 mb-4">
              {[
                '20 вопросов к ИИ в день (вместо 5)',
                '3 загрузки файлов в день (вместо 1)',
                'Разбор экзаменационных билетов',
                'История всех конспектов и вопросов',
                'Подготовка к сессии, зачётам и ЕГЭ',
              ].map(f => (
                <div key={f} className="flex items-center gap-2 text-white/85 text-sm">
                  <span className="text-white/50">✓</span>
                  {f}
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate('/pricing')}
              className="w-full py-3 bg-white text-purple-700 font-extrabold rounded-2xl text-sm active:scale-[0.98] transition-all shadow-lg"
            >
              Подключить Premium — от 299 ₽/мес
            </button>
          </div>
        )}

        {/* Полный чат */}
        <button
          onClick={() => {
            if (aiRemaining !== null && aiRemaining <= 0 && !isPremium) {
              setShowPaywall('ai_limit');
              return;
            }
            navigate('/assistant');
          }}
          className="w-full bg-white border border-purple-100 rounded-3xl p-4 flex items-center gap-3 active:scale-[0.98] transition-all shadow-sm"
        >
          <div className="w-10 h-10 bg-purple-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Icon name="MessageCircle" size={18} className="text-purple-600" />
          </div>
          <div className="text-left flex-1">
            <p className="text-purple-800 font-bold text-sm">Открыть полный чат с ИИ</p>
            <p className="text-purple-400 text-xs mt-0.5">История, загруженные материалы, любые вопросы</p>
          </div>
          {aiRemaining !== null && aiRemaining <= 0 && !isPremium
            ? <Icon name="Lock" size={16} className="text-gray-300" />
            : <Icon name="ChevronRight" size={16} className="text-purple-300" />
          }
        </button>

      </div>

      {showPaywall && <PaywallSheet trigger={showPaywall} onClose={() => setShowPaywall(null)} />}
      <BottomNav />
    </div>
  );
}