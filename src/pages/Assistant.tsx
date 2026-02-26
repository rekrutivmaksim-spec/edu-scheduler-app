import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import Icon from '@/components/ui/icon';
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
            className="h-full rounded-full bg-gradient-to-r from-purple-400 to-indigo-500 transition-all duration-1000 ease-out"
            style={{ width: `${Math.min(90, (elapsed / 30000) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

// Paywall-экран при 0 вопросов
const LimitScreen = ({ onClose, navigate }: { onClose: () => void; navigate: (p: string) => void }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
    <div
      className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl overflow-hidden"
      onClick={e => e.stopPropagation()}
      style={{ animation: 'slide-up 0.35s cubic-bezier(0.32,0.72,0,1)' }}
    >
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 bg-gray-200 rounded-full" />
      </div>
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 mx-4 rounded-2xl p-5 mb-4 mt-2 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />
        <button onClick={onClose} className="absolute top-3 right-3 text-white/40 hover:text-white/70">✕</button>
        <span className="text-4xl block mb-3">⏸️</span>
        <h2 className="text-white font-extrabold text-xl mb-1">Вопросы на сегодня закончились</h2>
        <p className="text-white/75 text-sm">Продолжай обучение без ограничений:</p>
        <div className="mt-3 space-y-1.5">
          {[
            'Безлимит вопросов к ИИ',
            'Безлимит анализа файлов',
            'Подготовка к ЕГЭ и ОГЭ',
            'Помощь по вузу',
            '×2 XP за все действия',
          ].map(f => (
            <div key={f} className="flex items-center gap-2 text-white/85 text-sm">
              <span className="text-white/60">✓</span>{f}
            </div>
          ))}
        </div>
        <div className="mt-3 bg-white/20 rounded-xl px-4 py-2 inline-block">
          <span className="text-white font-bold">449 ₽ в месяц</span>
        </div>
      </div>
      <div className="px-5 pb-8 space-y-3">
        <button
          onClick={() => { onClose(); navigate('/pricing'); }}
          className="w-full h-14 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-extrabold text-base rounded-2xl shadow-lg active:scale-[0.98] transition-all"
        >
          Подключить Premium
        </button>
        <button onClick={() => { onClose(); setTimeout(() => document.querySelector<HTMLTextAreaElement>('textarea')?.focus(), 100); }} className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
          Вернуться завтра
        </button>
      </div>
    </div>
    <style>{`@keyframes slide-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
  </div>
);

const quickActions = [
  { icon: '🔥', text: 'Объясни тему', action: 'send' },
  { icon: '🎯', text: 'Дай задание', action: 'send' },
  { icon: '📄', text: 'Разбери файл', action: 'navigate', path: '/university' },
  { icon: '🎓', text: 'Подготовь к экзамену', action: 'navigate', path: '/session' },
  { icon: '🏛', text: 'Помощь по вузу', action: 'navigate', path: '/university' },
];

const Assistant = () => {
  const navigate = useNavigate();
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
  const [isPremium, setIsPremium] = useState(false);
   
  const isTrial = false;
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  const [showLimitScreen, setShowLimitScreen] = useState(false);
  const [thinkingElapsed, setThinkingElapsed] = useState(0);
  const thinkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);

  useEffect(() => {
    if (!authService.isAuthenticated()) { navigate('/auth'); return; }
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
      const resp = await fetch(`${AI_URL}?action=sessions`, { headers: { Authorization: `Bearer ${token}` } });
      if (resp.ok) { const data = await resp.json(); setSessions(data.sessions || []); }
    } catch { /* silent */ }
  };

  const loadSessionMessages = async (sessionId: number) => {
    setLoadingSession(true);
    try {
      const token = authService.getToken();
      const resp = await fetch(`${AI_URL}?action=messages&session_id=${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        const msgs: Message[] = (data.messages || []).map((m: { role: 'user' | 'assistant'; content: string; timestamp: string }) => ({
          role: m.role, content: m.content, timestamp: new Date(m.timestamp),
        }));
        setMessages(msgs);
        setCurrentSessionId(sessionId);
        setShowSidebar(false);
      }
    } catch { /* silent */ }
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
      const resp = await fetch(MATERIALS_URL, { headers: { Authorization: `Bearer ${token}` } });
      if (resp.ok) { const data = await resp.json(); setMaterials(data.materials || []); }
    } catch { /* silent */ }
  };

  const loadAiLimits = async () => {
    try {
      const token = authService.getToken();
      const resp = await fetch(`${SUBSCRIPTION_URL}?action=limits`, { headers: { Authorization: `Bearer ${token}` } });
      if (resp.ok) {
        const data = await resp.json();
        const ai = data.limits?.ai_questions;
        const sub = data.subscription_type;
        setIsPremium(sub === 'premium');
        if (sub === 'premium' || !!data.is_trial) {
          setAiUsed(ai?.used ?? 0);
          setAiMax(20);
          setRemaining(Math.max(0, 20 - (ai?.used ?? 0)));
        } else if (ai) {
          setAiUsed(ai.used ?? 0);
          setAiMax(ai.max ?? 3);
          setRemaining(Math.max(0, (ai.max ?? 3) - (ai.used ?? 0)));
        }
      }
    } catch { /* silent */ }
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

  const limitsLoaded = isPremium || remaining !== null;
  const isLimitReached = !isPremium && remaining !== null && remaining <= 0;
  const showFreeCounter = !isPremium && aiMax !== null && aiUsed !== null;
  const freeLeft = aiMax !== null && aiUsed !== null ? Math.max(0, aiMax - aiUsed) : 0;

  const handleOk = useCallback(async (resp: Response) => {
    const data = await resp.json();
    if (data.remaining !== undefined) {
      setRemaining(data.remaining);
      if (aiMax !== null) setAiUsed(aiMax - data.remaining);
    }
    setMessages(prev => [...prev, { role: 'assistant', content: data.answer || '', timestamp: new Date() }]);
    loadSessions();
    try { await trackActivity('ai_question', 3); } catch { /* silent */ }
  }, [aiMax]);

  const sendMessage = useCallback(async (overrideText?: string) => {
    const q = (overrideText ?? question).trim();
    if (!q || isLoading) return;
    if (isLimitReached) { setShowLimitScreen(true); return; }
    setQuestion('');
    if (inputRef.current) inputRef.current.style.height = '44px';
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: q, timestamp: new Date() }]);
    startThinking();

    const doFetch = async (): Promise<Response> => {
      const token = authService.getToken();
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 110000);
      const resp = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          question: q,
          material_ids: selectedMaterials,
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
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
          setRemaining(0);
          setShowLimitScreen(true);
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
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Уточни вопрос — и я отвечу подробно! 🙂',
            timestamp: new Date(),
          }]);
        }
      }
    };

    try { await tryFetch(0); }
    finally { stopThinking(); setIsLoading(false); setTimeout(() => inputRef.current?.focus(), 100); }
  }, [question, isLoading, selectedMaterials, handleOk, isLimitReached]);

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
              <Icon name="Plus" size={16} />Новый чат
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
      <header className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <Icon name="ArrowLeft" size={22} className="text-gray-700" />
            </button>
            <button onClick={() => setShowSidebar(true)} className="flex items-center gap-2 hover:opacity-80">
              <div>
                <h1 className="text-base font-bold text-gray-900 leading-tight">ИИ-помощь</h1>
                <p className="text-xs text-gray-400 leading-none">
                  {isLoading ? (
                    <span className="text-purple-600 font-medium">Думаю...</span>
                  ) : isPremium || isTrial ? (
                    <span className="text-emerald-600 font-medium">Безлимитный доступ активен 🔥</span>
                  ) : remaining === null && !isPremium && !isTrial ? (
                    <span className="text-gray-400">Загружаю лимиты...</span>
                  ) : showFreeCounter ? (
                    <span className={freeLeft === 0 ? 'text-red-500 font-medium' : freeLeft === 1 ? 'text-amber-600' : 'text-gray-400'}>
                      Осталось: {freeLeft} из {aiMax}
                    </span>
                  ) : (
                    <span className="text-gray-400">Studyfay</span>
                  )}
                </p>
              </div>
              <Icon name="ChevronDown" size={14} className="text-gray-400 mt-0.5" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            {materials.length > 0 && (
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
            )}
            <button onClick={startNewChat} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
              <Icon name="Plus" size={20} />
            </button>
            <button onClick={() => { setShowSidebar(true); loadSessions(); }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
              <Icon name="Clock" size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Статус-бар с лимитом */}
      {showFreeCounter && (
        <div className={`flex-shrink-0 px-4 py-2 border-b ${freeLeft === 0 ? 'bg-red-50 border-red-100' : freeLeft === 1 ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600">Сегодня доступно: {aiMax} вопроса</span>
              <span className="text-gray-300">·</span>
              <span className={`text-xs font-bold ${freeLeft === 0 ? 'text-red-600' : freeLeft === 1 ? 'text-amber-600' : 'text-gray-700'}`}>
                Осталось: {freeLeft} из {aiMax}
              </span>
            </div>
            {freeLeft <= 1 && (
              <button
                onClick={() => setShowLimitScreen(true)}
                className="text-xs text-purple-600 font-semibold hover:text-purple-800"
              >
                Premium →
              </button>
            )}
          </div>
          {freeLeft > 0 && (
            <div className="max-w-2xl mx-auto mt-1">
              <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${freeLeft === 1 ? 'bg-amber-400' : 'bg-purple-500'}`}
                  style={{ width: `${(freeLeft / (aiMax || 3)) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

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
            <div className="flex flex-wrap gap-2">
              {materials.map(m => (
                <button
                  key={m.id}
                  onClick={() => toggleMaterial(m.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedMaterials.includes(m.id) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'}`}
                >
                  {m.title.length > 30 ? m.title.slice(0, 30) + '...' : m.title}
                </button>
              ))}
            </div>
            {selectedMaterials.length === 0 && (
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
              <div className="w-10 h-10 border-4 border-purple-100 border-t-purple-500 rounded-full animate-spin" />
            </div>
          ) : !hasMessages ? (
            /* === ПУСТОЙ ЭКРАН === */
            <div className="flex flex-col items-center pt-6 px-2">
              {/* Аватар */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-purple-200">
                <Icon name="Sparkles" size={32} className="text-white" />
              </div>

              {/* Заголовок */}
              <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">Привет! Я Studyfay ✨</h2>
              <p className="text-gray-500 text-center text-sm leading-relaxed mb-1 max-w-xs">
                ИИ-репетитор для учёбы и экзаменов.
              </p>
              <p className="text-gray-400 text-center text-xs mb-5 max-w-xs">
                Объясняю темы, даю задания и разбираю материалы.
              </p>

              {/* Быстрые действия */}
              <div className="w-full space-y-2 mb-3">
                {quickActions.map((qa, i) => (
                  <button
                    key={i}
                    onClick={() => qa.action === 'navigate' && qa.path ? navigate(qa.path) : sendMessage(qa.text)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-purple-50 rounded-2xl border border-gray-100 hover:border-purple-200 transition-all active:scale-[0.98] text-left"
                  >
                    <span className="text-xl flex-shrink-0">{qa.icon}</span>
                    <span className="text-gray-700 font-medium text-sm flex-1">{qa.text}</span>
                    <Icon name={qa.action === 'navigate' ? 'ExternalLink' : 'ChevronRight'} size={14} className="text-gray-300 flex-shrink-0" />
                  </button>
                ))}
              </div>

              <p className="text-gray-400 text-xs mb-5">Каждое действие считается вопросом</p>

              {/* Блок Premium — только для бесплатных */}
              {!isTrial && !isPremium && (
                <div className="w-full bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">💎</span>
                      <span className="font-bold text-gray-800 text-sm">Premium</span>
                    </div>
                    <span className="text-indigo-500 text-xs font-bold">449 ₽/мес</span>
                  </div>
                  <div className="space-y-1 mb-3">
                    {['Безлимит вопросов к ИИ', 'Безлимит анализа файлов', 'Подготовка к ЕГЭ и ОГЭ', '×2 XP за все действия'].map(f => (
                      <div key={f} className="flex items-center gap-2 text-gray-600 text-xs">
                        <span className="text-indigo-400">✓</span>{f}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => navigate('/pricing')}
                    className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold rounded-xl active:scale-[0.98] transition-all"
                  >
                    Попробовать бесплатно
                  </button>
                </div>
              )}

              {sessions.length > 0 && (
                <button
                  onClick={() => setShowSidebar(true)}
                  className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1.5 border border-purple-200 rounded-full px-4 py-2 hover:bg-purple-50 transition-colors"
                >
                  <Icon name="Clock" size={13} />
                  История чатов ({sessions.length})
                </button>
              )}
            </div>
          ) : (
            /* === СООБЩЕНИЯ === */
            <div className="space-y-4">
              {messages.map((msg, i) => {
                const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1 && !isLoading;
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

                    {/* Плашка после последнего ответа ИИ */}
                    {isLastAssistant && (
                      <>
                        {/* Лимит 0 */}
                        {!isPremium && !isTrial && remaining !== null && remaining === 0 && (
                          <div className="mt-3 ml-10 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-4">
                            <p className="font-bold text-gray-800 text-sm mb-0.5">Ты задал все бесплатные вопросы на сегодня</p>
                            <p className="text-gray-500 text-xs mb-3">Продолжай обучение без ограничений</p>
                            <button
                              onClick={() => setShowLimitScreen(true)}
                              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold rounded-xl active:scale-[0.98] transition-all"
                            >
                              Подключить Premium
                            </button>
                          </div>
                        )}

                        {/* Последний вопрос */}
                        {!isPremium && !isTrial && remaining !== null && remaining === 1 && (
                          <div className="mt-2 ml-10 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                            <span className="text-sm">⚡</span>
                            <span className="text-amber-800 text-xs flex-1">Остался 1 вопрос — </span>
                            <button onClick={() => setShowLimitScreen(true)} className="text-amber-700 text-xs font-bold hover:text-amber-900">Premium →</button>
                          </div>
                        )}

                        {/* Блок "Продолжить обучение" — всегда после ответа */}
                        <div className="mt-2 ml-10 flex gap-2 flex-wrap">
                          <button
                            onClick={() => sendMessage('Дай ещё задание')}
                            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-purple-50 hover:text-purple-700 rounded-full text-gray-600 transition-colors border border-gray-200 hover:border-purple-200"
                          >
                            Дай ещё задание
                          </button>
                          <button
                            onClick={() => sendMessage('Объясни проще')}
                            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-purple-50 hover:text-purple-700 rounded-full text-gray-600 transition-colors border border-gray-200 hover:border-purple-200"
                          >
                            Объясни проще
                          </button>
                          {!isPremium && !isTrial && (
                            <button
                              onClick={() => setShowLimitScreen(true)}
                              className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition-colors"
                            >
                              Подключить Premium
                            </button>
                          )}
                        </div>
                      </>
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
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isLimitReached ? 'Лимит вопросов исчерпан' : 'Задай любой вопрос…'}
              rows={1}
              disabled={isLoading || isLimitReached}
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
            onClick={() => {
              if (!limitsLoaded || isLoading) return;
              if (isLimitReached) { setShowLimitScreen(true); } else { sendMessage(); }
            }}
            disabled={(!limitsLoaded || isLoading) || (!question.trim() && !isLimitReached)}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
              isLimitReached
                ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                : 'bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:cursor-not-allowed'
            }`}
          >
            {isLoading
              ? <Icon name="Loader2" size={20} className="text-white animate-spin" />
              : !limitsLoaded
              ? <Icon name="Loader2" size={18} className="text-gray-400 animate-spin" />
              : isLimitReached
              ? <Icon name="Lock" size={18} className="text-white" />
              : <Icon name="ArrowUp" size={20} className={question.trim() ? 'text-white' : 'text-gray-400'} />
            }
          </button>
        </div>
        {!isTrial && !isPremium && (
          <p className="max-w-2xl mx-auto mt-1.5 text-center text-[11px] text-gray-400">
            Бесплатно: 3 вопроса в день · Безлимит — в Premium
          </p>
        )}
        {isLoading && (
          <p className="max-w-2xl mx-auto mt-1 text-center text-[11px] text-purple-400 animate-pulse">
            Готовлю ответ, не закрывай страницу…
          </p>
        )}
      </div>

      <BottomNav />

      {showLimitScreen && (
        <LimitScreen onClose={() => setShowLimitScreen(false)} navigate={navigate} />
      )}
    </div>
  );
};

export default Assistant;