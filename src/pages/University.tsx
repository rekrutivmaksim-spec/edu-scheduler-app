import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import BottomNav from '@/components/BottomNav';
import PaywallSheet from '@/components/PaywallSheet';
import { authService } from '@/lib/auth';

const AI_URL = 'https://functions.poehali.dev/8e8cbd4e-7731-4853-8e29-a84b3d178249';
const MATERIALS_URL = 'https://functions.poehali.dev/177e7001-b074-41cb-9553-e9c715d36f09';

type Mode = 'home' | 'file' | 'question';

interface AnalysisResult {
  summary: string;
  keyPoints: string[];
}

const QUICK_ACTIONS = [
  { icon: '🎫', text: 'Объясни билет по вопросу', placeholder: 'Вставь вопрос из билета...' },
  { icon: '📘', text: 'Объясни тему', placeholder: 'Напиши название темы...' },
  { icon: '🧮', text: 'Помоги решить задачу', placeholder: 'Опиши условие задачи...' },
  { icon: '📝', text: 'Составь план конспекта', placeholder: 'Напиши тему конспекта...' },
];

export default function University() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('home');
  const [question, setQuestion] = useState('');
  const [questionPlaceholder, setQuestionPlaceholder] = useState('Задай вопрос...');
  const [isLoading, setIsLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => {
    setMode('question');
    setQuestionPlaceholder(action.placeholder);
    setQuestion('');
    setAnswer('');
  };

  const handleSendQuestion = async () => {
    if (!question.trim() || isLoading) return;
    setIsLoading(true);
    setAnswer('');
    try {
      const token = authService.getToken();
      const res = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'demo_ask', question: question.trim() }),
      });
      const data = await res.json();
      if (res.status === 403) {
        setShowPaywall(true);
        return;
      }
      setAnswer(data.answer || data.response || 'Не удалось получить ответ');
    } catch {
      setAnswer('Ошибка соединения. Попробуй снова.');
    } finally {
      setIsLoading(false);
    }
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
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name.replace(/\.[^.]+$/, ''));

      const uploadRes = await fetch(MATERIALS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (uploadRes.status === 403) {
        setShowPaywall(true);
        setIsAnalyzing(false);
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
      }
    } catch {
      setAnalysis({ summary: 'Файл загружен. Задай вопрос по его содержимому.', keyPoints: [] });
    } finally {
      setIsAnalyzing(false);
    }
  };

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
              <button
                onClick={() => { setQuestion(''); setAnswer(''); }}
                className="mt-4 w-full text-indigo-600 text-sm font-semibold border border-indigo-200 rounded-2xl py-2.5 hover:bg-indigo-50 transition-colors"
              >
                Задать другой вопрос
              </button>
            </div>
          )}
        </div>

        {showPaywall && <PaywallSheet trigger="ai_limit" onClose={() => setShowPaywall(false)} />}
        <BottomNav />
      </div>
    );
  }

  if (mode === 'file') {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 px-4 pt-12 pb-6">
          <button onClick={() => { setMode('home'); setUploadedFile(null); setAnalysis(null); }} className="flex items-center gap-2 text-white/70 mb-3">
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
              <Icon name="Loader2" size={32} className="text-indigo-500 animate-spin mb-3" />
              <p className="text-gray-600 font-medium">Анализирую файл...</p>
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
            </>
          ) : null}
        </div>

        {showPaywall && <PaywallSheet trigger="ai_limit" onClose={() => setShowPaywall(false)} />}
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 px-4 pt-12 pb-8">
        <h1 className="text-white font-extrabold text-2xl mb-1">ВУЗ</h1>
        <p className="text-white/60 text-sm">Разбор материалов и подготовка к сессии</p>
      </div>

      <div className="px-4 -mt-4 space-y-3 max-w-xl mx-auto">

        {/* Загрузить файл */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full bg-white rounded-3xl p-5 shadow-sm border-2 border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all active:scale-[0.98] text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Icon name="Upload" size={26} className="text-indigo-600" />
            </div>
            <div>
              <p className="font-extrabold text-gray-800 text-base">Разобрать файл</p>
              <p className="text-gray-400 text-sm mt-0.5">PDF, Word, текст — конспект за секунды</p>
              <p className="text-indigo-500 text-xs mt-1.5 font-medium">Загрузить →</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            {['PDF', 'Word', 'TXT'].map(t => (
              <span key={t} className="bg-indigo-100 text-indigo-600 text-xs font-semibold px-2.5 py-1 rounded-full">{t}</span>
            ))}
            <span className="bg-gray-100 text-gray-400 text-xs px-2.5 py-1 rounded-full">1 файл/день бесплатно</span>
          </div>
        </button>
        <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleFileSelect} />

        {/* Быстрые действия */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Icon name="Zap" size={16} className="text-amber-500" />
            Быстрая подготовка
          </h3>
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
        </div>

        {/* Переход в чат */}
        <button
          onClick={() => navigate('/assistant')}
          className="w-full bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-3xl p-4 flex items-center gap-3 active:scale-[0.98] transition-all"
        >
          <div className="w-10 h-10 bg-purple-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Icon name="MessageCircle" size={18} className="text-purple-600" />
          </div>
          <div className="text-left flex-1">
            <p className="text-purple-800 font-bold text-sm">Открыть полный чат</p>
            <p className="text-purple-400 text-xs mt-0.5">История сообщений и загруженные материалы</p>
          </div>
          <Icon name="ChevronRight" size={16} className="text-purple-300" />
        </button>

      </div>

      {showPaywall && <PaywallSheet trigger="ai_limit" onClose={() => setShowPaywall(false)} />}
      <BottomNav />
    </div>
  );
}
