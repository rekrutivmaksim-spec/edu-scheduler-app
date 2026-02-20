import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const AI_URL = 'https://functions.poehali.dev/8e8cbd4e-7731-4853-8e29-a84b3d178249';

const EXAM_TYPES = [
  { id: 'ege', label: 'ЕГЭ', description: '11 класс', color: 'from-violet-500 to-purple-600' },
  { id: 'oge', label: 'ОГЭ', description: '9 класс', color: 'from-blue-500 to-indigo-600' },
];

const SUBJECTS: Record<string, { id: string; label: string; icon: string }[]> = {
  ege: [
    { id: 'math_base', label: 'Математика (база)', icon: '📐' },
    { id: 'math_profile', label: 'Математика (профиль)', icon: '📊' },
    { id: 'russian', label: 'Русский язык', icon: '📝' },
    { id: 'physics', label: 'Физика', icon: '⚡' },
    { id: 'chemistry', label: 'Химия', icon: '🧪' },
    { id: 'biology', label: 'Биология', icon: '🧬' },
    { id: 'history', label: 'История', icon: '🏛️' },
    { id: 'social', label: 'Обществознание', icon: '⚖️' },
    { id: 'english', label: 'Английский язык', icon: '🇬🇧' },
    { id: 'informatics', label: 'Информатика', icon: '💻' },
    { id: 'geography', label: 'География', icon: '🌍' },
    { id: 'literature', label: 'Литература', icon: '📚' },
  ],
  oge: [
    { id: 'math', label: 'Математика', icon: '📐' },
    { id: 'russian', label: 'Русский язык', icon: '📝' },
    { id: 'physics', label: 'Физика', icon: '⚡' },
    { id: 'chemistry', label: 'Химия', icon: '🧪' },
    { id: 'biology', label: 'Биология', icon: '🧬' },
    { id: 'history', label: 'История', icon: '🏛️' },
    { id: 'social', label: 'Обществознание', icon: '⚖️' },
    { id: 'english', label: 'Английский язык', icon: '🇬🇧' },
    { id: 'informatics', label: 'Информатика', icon: '💻' },
    { id: 'geography', label: 'География', icon: '🌍' },
  ],
};

const MODES = [
  {
    id: 'explain',
    icon: 'BookOpen',
    label: 'Объяснение темы',
    description: 'Введи тему или номер задания — объясню теорию и покажу примеры',
    color: 'border-purple-200 bg-purple-50 text-purple-700',
    activeColor: 'border-purple-500 bg-purple-600 text-white',
  },
  {
    id: 'practice',
    icon: 'Target',
    label: 'Тренировка заданий',
    description: 'ИИ даёт задание в стиле экзамена, ты отвечаешь, он проверяет',
    color: 'border-green-200 bg-green-50 text-green-700',
    activeColor: 'border-green-500 bg-green-600 text-white',
  },
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const buildSystemPrompt = (examType: string, subjectId: string, subjectLabel: string, mode: string): string => {
  const examLabel = examType === 'ege' ? 'ЕГЭ' : 'ОГЭ';

  const base = `Ты Studyfay — опытный репетитор по подготовке к ${examLabel} по предмету «${subjectLabel}». 
СТРОГО отвечай ТОЛЬКО на русском языке. Никаких иероглифов и LaTeX-разметки.
Формулы пиши обычным текстом: например, a² + b² = c², E = mc².
Ты хорошо знаешь структуру ${examLabel}, типичные задания, критерии оценивания и частые ошибки учеников.`;

  if (mode === 'explain') {
    return `${base}

РЕЖИМ: Объяснение темы.
Когда ученик называет тему или номер задания ${examLabel}:
1. Кратко объясни теорию простым языком
2. Покажи 1–2 типичных примера из ${examLabel}
3. Выдели главные правила и частые ошибки
4. В конце предложи проверить себя: "Хочешь потренироваться на задании?"
Отвечай чётко, структурированно, используй **жирный** для ключевых понятий.`;
  }

  if (mode === 'practice') {
    return `${base}

РЕЖИМ: Тренировка заданий.
Твой алгоритм:
1. Сгенерируй одно задание в стиле ${examLabel} по предмету «${subjectLabel}» — реалистичное, как в настоящем варианте
2. Чётко напиши: "**Задание:**" и текст задания
3. Жди ответа ученика
4. Когда ученик ответит — проверь ответ, напиши правильный ответ и подробный разбор
5. Спроси: "Следующее задание?" или "Хочешь разобрать другую тему?"
Начни сразу с задания, без лишних предисловий.`;
  }

  return base;
};

const Exam = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [step, setStep] = useState<'type' | 'subject' | 'mode' | 'chat'>('type');
  const [examType, setExamType] = useState('');
  const [subject, setSubject] = useState<{ id: string; label: string } | null>(null);
  const [mode, setMode] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const startChat = useCallback(async (selectedMode: string) => {
    setMode(selectedMode);
    setStep('chat');
    setMessages([]);
    setIsLoading(true);

    const systemPrompt = buildSystemPrompt(examType, subject!.id, subject!.label, selectedMode);
    const initMessage = selectedMode === 'practice'
      ? `Начинаем тренировку по ${examType === 'ege' ? 'ЕГЭ' : 'ОГЭ'} — ${subject!.label}. Дай первое задание.`
      : `Привет! Я готовлюсь к ${examType === 'ege' ? 'ЕГЭ' : 'ОГЭ'} по ${subject!.label}. С чего начать?`;

    try {
      const token = authService.getToken();
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 35000);
      const resp = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          question: initMessage,
          material_ids: [],
          exam_system_prompt: systemPrompt,
        }),
        signal: controller.signal,
      });
      clearTimeout(tid);
      if (resp.ok) {
        const data = await resp.json();
        if (data.remaining !== undefined) setRemaining(data.remaining);
        setMessages([{ role: 'assistant', content: data.answer, timestamp: new Date() }]);
      }
    } catch (e) {
      setMessages([{ role: 'assistant', content: 'Не удалось подключиться. Попробуй ещё раз.', timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [examType, subject]);

  const sendMessage = useCallback(async (text?: string) => {
    const q = (text || question).trim();
    if (!q || isLoading) return;

    const systemPrompt = buildSystemPrompt(examType, subject!.id, subject!.label, mode);
    const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));

    const userMsg: Message = { role: 'user', content: q, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setQuestion('');
    setIsLoading(true);

    try {
      const token = authService.getToken();
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 35000);
      const resp = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          question: q,
          material_ids: [],
          exam_system_prompt: systemPrompt,
          history,
        }),
        signal: controller.signal,
      });
      clearTimeout(tid);
      if (resp.ok) {
        const data = await resp.json();
        if (data.remaining !== undefined) setRemaining(data.remaining);
        setMessages(prev => [...prev, { role: 'assistant', content: data.answer, timestamp: new Date() }]);
      } else if (resp.status === 403) {
        const data = await resp.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.message || 'Лимит вопросов исчерпан. Оформи подписку!', timestamp: new Date() }]);
        setRemaining(0);
      } else {
        throw new Error('server_error');
      }
    } catch (_) {
      toast({ title: 'Ошибка', description: 'Попробуй отправить ещё раз', variant: 'destructive' });
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [question, isLoading, examType, subject, mode, messages, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const reset = () => {
    setStep('type');
    setExamType('');
    setSubject(null);
    setMode('');
    setMessages([]);
  };

  const examLabel = examType === 'ege' ? 'ЕГЭ' : 'ОГЭ';
  const modeLabel = MODES.find(m => m.id === mode)?.label || '';

  // ── Выбор типа экзамена ──
  if (step === 'type') {
    return (
      <div className="flex flex-col h-[100dvh] bg-white">
        <header className="flex-shrink-0 px-4 py-4 safe-top border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100 transition-colors">
              <Icon name="ArrowLeft" size={22} className="text-gray-700" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Подготовка к экзамену</h1>
              <p className="text-xs text-gray-500">ИИ-репетитор • ЕГЭ и ОГЭ</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-8">
          <div className="max-w-sm mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-200">
                <Icon name="GraduationCap" size={32} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Какой экзамен сдаёшь?</h2>
              <p className="text-sm text-gray-500">Выбери тип — настроим репетитора под твой формат</p>
            </div>

            <div className="space-y-3">
              {EXAM_TYPES.map(et => (
                <button
                  key={et.id}
                  onClick={() => { setExamType(et.id); setStep('subject'); }}
                  className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-100 hover:border-purple-300 hover:bg-purple-50/50 transition-all text-left"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${et.color} flex items-center justify-center flex-shrink-0 shadow-md`}>
                    <span className="text-white font-bold text-lg">{et.label}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-base">{et.label}</p>
                    <p className="text-sm text-gray-500">{et.description}</p>
                  </div>
                  <Icon name="ChevronRight" size={20} className="text-gray-400 ml-auto" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Выбор предмета ──
  if (step === 'subject') {
    const subjects = SUBJECTS[examType] || [];
    return (
      <div className="flex flex-col h-[100dvh] bg-white">
        <header className="flex-shrink-0 px-4 py-4 safe-top border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep('type')} className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100 transition-colors">
              <Icon name="ArrowLeft" size={22} className="text-gray-700" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{examLabel} — выбор предмета</h1>
              <p className="text-xs text-gray-500">Шаг 2 из 3</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 pb-8">
          <div className="max-w-sm mx-auto">
            <p className="text-sm text-gray-500 mb-4 text-center">По какому предмету готовишься?</p>
            <div className="grid grid-cols-2 gap-2.5">
              {subjects.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSubject({ id: s.id, label: s.label }); setStep('mode'); }}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-gray-100 hover:border-purple-300 hover:bg-purple-50/50 transition-all text-center"
                >
                  <span className="text-2xl">{s.icon}</span>
                  <span className="text-xs font-medium text-gray-700 leading-tight">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Выбор режима ──
  if (step === 'mode') {
    return (
      <div className="flex flex-col h-[100dvh] bg-white">
        <header className="flex-shrink-0 px-4 py-4 safe-top border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep('subject')} className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100 transition-colors">
              <Icon name="ArrowLeft" size={22} className="text-gray-700" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{subject?.label}</h1>
              <p className="text-xs text-gray-500">{examLabel} • Шаг 3 из 3</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-8">
          <div className="max-w-sm mx-auto">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Что будем делать?</h2>
              <p className="text-sm text-gray-500">Выбери формат занятия</p>
            </div>
            <div className="space-y-3">
              {MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => startChat(m.id)}
                  className="w-full flex items-start gap-4 p-5 rounded-2xl border-2 border-gray-100 hover:border-purple-300 hover:bg-purple-50/50 transition-all text-left"
                >
                  <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon name={m.icon as 'BookOpen' | 'Target'} size={22} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 mb-0.5">{m.label}</p>
                    <p className="text-sm text-gray-500 leading-snug">{m.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Чат ──
  return (
    <div className="flex flex-col h-[100dvh] bg-white">
      <header className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-3 safe-top">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={reset} className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <Icon name="ArrowLeft" size={22} className="text-gray-700" />
            </button>
            <div>
              <h1 className="text-base font-bold text-gray-900">{examLabel} · {subject?.label}</h1>
              <p className="text-xs text-gray-500">
                {isLoading ? (
                  <span className="text-purple-600 font-medium flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
                    Думаю...
                  </span>
                ) : remaining !== null ? `Осталось ${remaining} вопросов` : modeLabel}
              </p>
            </div>
          </div>
          <button
            onClick={() => setStep('mode')}
            className="text-xs text-purple-600 hover:text-purple-800 font-medium px-3 py-1.5 rounded-lg hover:bg-purple-50 transition-colors"
          >
            Сменить режим
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Бейдж режима */}
          <div className="flex justify-center">
            <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
              {mode === 'practice' ? '🎯 Режим тренировки' : '📖 Режим объяснения'}
            </span>
          </div>

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                  <Icon name="GraduationCap" size={15} className="text-white" />
                </div>
              )}
              <div className="max-w-[85%]">
                <div className={`px-4 py-3 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-purple-600 text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-p:leading-relaxed prose-headings:mt-3 prose-headings:mb-1.5 prose-headings:text-gray-900 prose-strong:text-gray-900 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-code:text-purple-700 prose-code:bg-purple-50 prose-code:px-1 prose-code:rounded text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
                <p className={`text-[11px] mt-1 px-1 text-gray-400 ${msg.role === 'user' ? 'text-right' : ''}`}>
                  {msg.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2.5 justify-start">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Icon name="GraduationCap" size={15} className="text-white" />
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Быстрые подсказки для режима объяснения */}
      {mode === 'explain' && messages.length === 1 && !isLoading && (
        <div className="flex-shrink-0 px-4 pb-2">
          <div className="max-w-2xl mx-auto flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {['Задание 1', 'Задание 9', 'Задание 19', 'Объясни тему'].map(hint => (
              <button
                key={hint}
                onClick={() => sendMessage(hint)}
                className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors"
              >
                {hint}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 py-3 safe-bottom">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={mode === 'practice' ? 'Введи ответ...' : 'Спроси или введи номер задания...'}
              rows={1}
              disabled={isLoading}
              className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:outline-none focus:border-purple-400 focus:bg-white transition-colors disabled:opacity-50 max-h-32"
              style={{ minHeight: '44px' }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 128) + 'px';
              }}
            />
          </div>
          <button
            onClick={() => sendMessage()}
            disabled={!question.trim() || isLoading}
            className="w-11 h-11 rounded-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
          >
            {isLoading
              ? <Icon name="Loader2" size={20} className="text-white animate-spin" />
              : <Icon name="ArrowUp" size={20} className={question.trim() ? 'text-white' : 'text-gray-400'} />
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default Exam;
