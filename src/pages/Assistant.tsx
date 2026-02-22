import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { trackActivity } from '@/lib/gamification';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import BottomNav from '@/components/BottomNav';

const AI_URL = 'https://functions.poehali.dev/8e8cbd4e-7731-4853-8e29-a84b3d178249';
const MATERIALS_URL = 'https://functions.poehali.dev/177e7001-b074-41cb-9553-e9c715d36f09';
const SUBSCRIPTION_URL = 'https://functions.poehali.dev/7fe183c2-49af-4817-95f3-6ab4912778c4';

interface Material { id: number; title: string; subject?: string; }
interface Message { role: 'user' | 'assistant'; content: string; timestamp: Date; }
interface Session { id: number; title: string; updated_at: string; message_count: number; }

const THINKING_STAGES = [
  { text: 'Анализирую вопрос...', duration: 2000 },
  { text: 'Ищу в материалах...', duration: 3000 },
  { text: 'Формулирую ответ...', duration: 4000 },
  { text: 'Проверяю точность...', duration: 5000 },
  { text: 'Дополняю примерами...', duration: 8000 },
];
const THINKING_STAGES_NO_MATERIALS = [
  { text: 'Анализирую вопрос...', duration: 2000 },
  { text: 'Подбираю информацию...', duration: 3000 },
  { text: 'Формулирую ответ...', duration: 4000 },
  { text: 'Проверяю точность...', duration: 6000 },
  { text: 'Финальная проверка...', duration: 8000 },
];

const ThinkingIndicator = ({ hasMaterials, elapsed }: { hasMaterials: boolean; elapsed: number }) => {
  const stages = hasMaterials ? THINKING_STAGES : THINKING_STAGES_NO_MATERIALS;
  let cumulative = 0;
  let currentStage = stages[0];
  for (const stage of stages) {
    cumulative += stage.duration;
    if (elapsed < cumulative) { currentStage = stage; break; }
    currentStage = stage;
  }
  const dot = 'w-2 h-2 rounded-full bg-purple-400';
  return (
    <div className="flex gap-2.5 justify-start">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
        <Icon name="Sparkles" size={15} className="text-white" />
      </div>
      <div className="bg-white border border-purple-100 shadow-sm rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%]">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex gap-1 items-end">
            <div className={`${dot} animate-bounce`} style={{ animationDelay: '0ms' }} />
            <div className={`${dot} animate-bounce`} style={{ animationDelay: '150ms' }} />
            <div className={`${dot} animate-bounce`} style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-sm text-purple-700 font-medium">{currentStage.text}</span>
        </div>
        <div className="h-1.5 w-36 bg-purple-50 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full ai-shimmer-bar transition-all duration-1000 ease-out"
            style={{ width: `${Math.min(90, (elapsed / 30000) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

const Assistant = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<number[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [aiUsed, setAiUsed] = useState<number | null>(null);
  const [aiMax, setAiMax] = useState<number | null>(null);
  const [isTrial, setIsTrial] = useState(false);
  const [isSoftLanding, setIsSoftLanding] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  const [thinkingElapsed, setThinkingElapsed] = useState(0);
  const thinkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // История чатов
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);

  useEffect(() => {
    if (!authService.isAuthenticated()) { navigate('/login'); return; }
    loadMaterials();
    loadAiLimits();
    loadSessions();
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const loadSessions = async () => {
    try {
      const token = authService.getToken();
      const resp = await fetch(`${AI_URL}?action=sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setSessions(data.sessions || []);
      }
    } catch (e) { console.warn('Sessions load:', e); }
  };

  const loadSessionMessages = async (sessionId: number) => {
    setLoadingSession(true);
    try {
      const token = authService.getToken();
      const resp = await fetch(`${AI_URL}?action=messages&session_id=${sessionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        const msgs: Message[] = (data.messages || []).map((m: { role: 'user' | 'assistant'; content: string; timestamp: string }) => ({
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp)
        }));
        setMessages(msgs);
        setCurrentSessionId(sessionId);
        setShowSidebar(false);
      }
    } catch (e) { console.warn('Session messages load:', e); }
    finally { setLoadingSession(false); }
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setShowSidebar(false);
    setQuestion('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const loadMaterials = async () => {
    try {
      const token = authService.getToken();
      const resp = await fetch(MATERIALS_URL, { headers: { 'Authorization': `Bearer ${token}` } });
      if (resp.ok) { const data = await resp.json(); setMaterials(data.materials || []); }
    } catch (e) { console.warn('Materials load:', e); }
  };

  const loadAiLimits = async () => {
    try {
      const token = authService.getToken();
      const resp = await fetch(`${SUBSCRIPTION_URL}?action=limits`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (resp.ok) {
        const data = await resp.json();
        const ai = data.limits?.ai_questions;
        const sub = data.subscription_type;
        const trial = data.is_trial;
        const softLanding = data.is_soft_landing;
        setIsPremium(sub === 'premium');
        setIsTrial(!!trial);
        setIsSoftLanding(!!softLanding);
        if (ai) {
          if (ai.max && ai.max < 999) { setAiUsed(ai.used ?? 0); setAiMax(ai.max); }
          else if (trial || sub === 'premium') { setAiUsed(ai.used ?? 0); setAiMax(ai.max ?? null); }
        }
      }
    } catch (e) { console.warn('AI limits load:', e); }
  };

  const startThinking = () => {
    setThinkingElapsed(0);
    if (thinkingTimerRef.current) clearInterval(thinkingTimerRef.current);
    const start = Date.now();
    thinkingTimerRef.current = setInterval(() => setThinkingElapsed(Date.now() - start), 200);
  };
  const stopThinking = () => {
    if (thinkingTimerRef.current) { clearInterval(thinkingTimerRef.current); thinkingTimerRef.current = null; }
    setThinkingElapsed(0);
  };

  const toggleMaterial = (id: number) => {
    setSelectedMaterials(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const quickActions = [
    { icon: '📚', text: 'Объясни производную простыми словами' },
    { icon: '✍️', text: 'Помоги написать план эссе' },
    { icon: '🔬', text: 'Что такое фотосинтез?' },
    { icon: '📐', text: 'Реши задачу по физике' },
  ];

  const handleOk = useCallback(async (resp: Response) => {
    const data = await resp.json();
    if (data.remaining !== undefined) setRemaining(data.remaining);
    if (data.remaining !== undefined && aiMax !== null) setAiUsed(aiMax - data.remaining);
    setMessages(prev => [...prev, { role: 'assistant', content: data.answer || '', timestamp: new Date() }]);
    // Обновляем список сессий
    loadSessions();
    try { await trackActivity('ai_question', 3); } catch (e) { console.warn('Gamification:', e); }
  }, [aiMax]);

  const sendMessage = useCallback(async (overrideText?: string) => {
    const q = (overrideText ?? question).trim();
    if (!q || isLoading) return;
    setQuestion('');
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: q, timestamp: new Date() }]);
    startThinking();

    const doFetch = async (): Promise<Response> => {
      const token = authService.getToken();
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 110000);
      const resp = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ question: q, material_ids: selectedMaterials }),
        signal: controller.signal
      });
      clearTimeout(tid);
      return resp;
    };

    const tryFetch = async (attempt: number): Promise<void> => {
      try {
        const resp = await doFetch();
        if (resp.ok) {
          await handleOk(resp);
        } else if (resp.status === 403) {
          const data = await resp.json();
          setMessages(prev => [...prev, { role: 'assistant', content: data.message || 'Лимит исчерпан. Оформи подписку или подожди до завтра!', timestamp: new Date() }]);
          setRemaining(0);
        } else if ((resp.status === 504 || resp.status >= 500) && attempt < 2) {
          await tryFetch(attempt + 1);
        } else {
          throw new Error('server_error');
        }
      } catch (e: unknown) {
        const name = (e instanceof Error) ? e.name : '';
        if ((name === 'AbortError' || name === 'TypeError') && attempt < 2) {
          await tryFetch(attempt + 1);
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: 'Произошла временная ошибка сети. Попробуй задать вопрос ещё раз.', timestamp: new Date() }]);
        }
      }
    };

    try { await tryFetch(0); }
    finally { stopThinking(); setIsLoading(false); setTimeout(() => inputRef.current?.focus(), 100); }
  }, [question, isLoading, selectedMaterials, handleOk]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const hasMessages = messages.length > 0;

  const formatSessionDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return d.toLocaleDateString('ru-RU', { weekday: 'short' });
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-white relative">

      {/* Сайдбар с историей */}
      {showSidebar && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-72 bg-white h-full flex flex-col shadow-2xl border-r border-gray-100">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">История чатов</h2>
              <button onClick={() => setShowSidebar(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <Icon name="X" size={18} className="text-gray-600" />
              </button>
            </div>
            <button
              onClick={startNewChat}
              className="mx-3 mt-3 mb-2 flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Icon name="Plus" size={16} />
              Новый чат
            </button>
            <div className="flex-1 overflow-y-auto px-3 pb-4">
              {sessions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center mt-8">Чатов пока нет</p>
              ) : (
                <div className="space-y-1">
                  {sessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => loadSessionMessages(s.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${currentSessionId === s.id ? 'bg-purple-50 border border-purple-200' : 'hover:bg-gray-50'}`}
                    >
                      <p className="text-sm font-medium text-gray-800 truncate">{s.title || 'Новый чат'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-gray-400">{formatSessionDate(s.updated_at)}</span>
                        <span className="text-[11px] text-gray-300">·</span>
                        <span className="text-[11px] text-gray-400">{s.message_count} сообщ.</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setShowSidebar(false)} />
        </div>
      )}

      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-3 safe-top">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <Icon name="ArrowLeft" size={22} className="text-gray-700" />
            </button>
            <button onClick={() => setShowSidebar(true)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">Studyfay</h1>
                <p className="text-xs text-gray-500">
                  {isLoading ? (
                    <span className="text-purple-600 font-medium flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
                      Думаю...
                    </span>
                  ) : 'ИИ-ассистент'}
                </p>
              </div>
              <Icon name="ChevronDown" size={14} className="text-gray-400 mt-0.5" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowMaterialPicker(!showMaterialPicker)}
              className={`p-2 rounded-lg transition-colors relative ${showMaterialPicker ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-100 text-gray-600'}`}
            >
              <Icon name="Paperclip" size={20} />
              {selectedMaterials.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-purple-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {selectedMaterials.length}
                </span>
              )}
            </button>
            <button
              onClick={startNewChat}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <Icon name="Plus" size={20} />
            </button>
            <button
              onClick={() => { setShowSidebar(true); loadSessions(); }}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <Icon name="Clock" size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Статус подписки */}
      <div className="flex-shrink-0 px-4 py-2 bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          {isTrial ? (
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <Icon name="Zap" size={12} className="text-emerald-500" />Пробный период — безлимит
            </span>
          ) : isPremium ? (
            <span className="text-xs text-purple-600 font-medium flex items-center gap-1">
              <Icon name="Crown" size={12} className="text-purple-500" />Premium
            </span>
          ) : isSoftLanding ? (
            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <Icon name="Clock" size={12} className="text-amber-500" />Расширенный доступ
            </span>
          ) : (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Icon name="Bot" size={12} className="text-gray-400" />Бесплатный план
            </span>
          )}
          {aiMax !== null && aiUsed !== null && !isTrial && (
            <div className="flex items-center gap-2 flex-1 max-w-[180px]">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${aiUsed / aiMax >= 0.9 ? 'bg-red-500' : aiUsed / aiMax >= 0.7 ? 'bg-orange-400' : 'bg-purple-500'}`}
                  style={{ width: `${Math.min((aiUsed / aiMax) * 100, 100)}%` }}
                />
              </div>
              <span className={`text-xs flex-shrink-0 font-medium ${aiUsed / aiMax >= 0.9 ? 'text-red-500' : 'text-gray-500'}`}>
                {aiMax - aiUsed} / {aiMax}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Material picker */}
      {showMaterialPicker && (
        <div className="flex-shrink-0 border-b border-gray-100 bg-gray-50 px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Контекст из материалов</p>
              {selectedMaterials.length > 0 && (
                <button onClick={() => setSelectedMaterials([])} className="text-xs text-purple-600 hover:text-purple-800">Сбросить</button>
              )}
            </div>
            {materials.length === 0 ? (
              <p className="text-sm text-gray-500">Загрузи конспекты в разделе «Материалы»</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {materials.map(m => (
                  <button
                    key={m.id}
                    onClick={() => toggleMaterial(m.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedMaterials.includes(m.id) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'}`}
                  >
                    {m.title.length > 30 ? m.title.slice(0, 30) + '...' : m.title}
                    {m.subject && <span className="ml-1 opacity-70">· {m.subject}</span>}
                  </button>
                ))}
              </div>
            )}
            {selectedMaterials.length === 0 && materials.length > 0 && (
              <p className="text-xs text-gray-400 mt-1.5">Не выбрано — используются все материалы</p>
            )}
          </div>
        </div>
      )}

      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4">
          {loadingSession ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <div className="text-center">
                <Icon name="Loader2" size={32} className="text-purple-400 animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-400">Загружаю историю чата...</p>
              </div>
            </div>
          ) : !hasMessages ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-5 shadow-lg shadow-purple-200">
                <Icon name="Sparkles" size={32} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Привет! Я Studyfay ✨</h2>
              <p className="text-gray-500 text-center mb-8 max-w-sm text-sm leading-relaxed">
                Задай любой вопрос — помогу разобраться с учёбой, объясню тему или составлю конспект
              </p>
              <div className="w-full space-y-2">
                {quickActions.map((qa, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(qa.text)}
                    className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-purple-50 rounded-xl border border-gray-100 hover:border-purple-200 transition-all text-sm text-gray-700 hover:text-purple-700 flex items-center gap-3"
                  >
                    <span className="text-lg">{qa.icon}</span>
                    <span>{qa.text}</span>
                  </button>
                ))}
              </div>
              {sessions.length > 0 && (
                <button
                  onClick={() => setShowSidebar(true)}
                  className="mt-5 text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1.5 border border-purple-200 rounded-full px-4 py-2 hover:bg-purple-50 transition-colors"
                >
                  <Icon name="Clock" size={13} />
                  Открыть историю чатов ({sessions.length})
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => {
                const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1 && !isLoading;
                const assistantCount = messages.filter((m, idx) => m.role === 'assistant' && idx <= i).length;
                return (
                  <div key={i}>
                    <div className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Icon name="Sparkles" size={16} className="text-white" />
                        </div>
                      )}
                      <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                        <div className={`px-4 py-3 rounded-2xl ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-br-md' : 'bg-gray-50 border border-gray-100 text-gray-800 rounded-bl-md'}`}>
                          {msg.role === 'assistant' ? (
                            <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-p:leading-relaxed prose-headings:mt-3 prose-headings:mb-1.5 prose-headings:text-gray-900 prose-strong:text-gray-900 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-code:text-purple-700 prose-code:bg-purple-50 prose-code:px-1 prose-code:rounded text-sm">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                        <p className={`text-[11px] mt-1 px-1 ${msg.role === 'user' ? 'text-right text-gray-400' : 'text-gray-400'}`}>
                          {msg.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    {isLastAssistant && assistantCount > 0 && assistantCount % 7 === 0 && (
                      <div className="flex gap-2 mt-2 ml-10">
                        <div className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                          <span>🔥</span>
                          <span className="font-medium">{assistantCount} вопросов — отличный прогресс!</span>
                        </div>
                      </div>
                    )}
                    {isLastAssistant && !isPremium && remaining !== null && remaining <= 1 && (
                      <div className="flex gap-2 mt-2 ml-10">
                        <div className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl px-3 py-2 text-xs">
                          <span>💎</span>
                          <span className="text-gray-700">Заканчиваются вопросы — </span>
                          <button onClick={() => window.location.href = '/subscription'} className="text-purple-600 font-semibold hover:text-purple-800 whitespace-nowrap">оформи Premium →</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {isLoading && <ThinkingIndicator hasMaterials={selectedMaterials.length > 0} elapsed={thinkingElapsed} />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 py-3 pb-[calc(0.75rem+4rem+env(safe-area-inset-bottom,0px))] md:pb-3">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Задай вопрос..."
              rows={1}
              disabled={isLoading}
              className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-sm focus:outline-none focus:border-purple-400 focus:bg-white transition-colors disabled:opacity-50 max-h-32"
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
        <p className="max-w-2xl mx-auto mt-2 text-center text-[11px] text-gray-400 leading-tight">
          ИИ готовит качественный ответ — иногда до&nbsp;2&nbsp;минут. Не закрывай страницу
        </p>
      </div>
      <BottomNav />
    </div>
  );
};

export default Assistant;