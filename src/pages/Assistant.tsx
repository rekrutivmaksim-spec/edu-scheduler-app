import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { trackActivity } from '@/lib/gamification';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import BottomNav from '@/components/BottomNav';

const AI_URL = 'https://functions.poehali.dev/8e8cbd4e-7731-4853-8e29-a84b3d178249';
const MATERIALS_URL = 'https://functions.poehali.dev/177e7001-b074-41cb-9553-e9c715d36f09';

interface Material {
  id: number;
  title: string;
  subject?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

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
    if (elapsed < cumulative) {
      currentStage = stage;
      break;
    }
    currentStage = stage;
  }

  return (
    <div className="flex gap-2.5 justify-start">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
        <Icon name="Sparkles" size={16} className="text-white animate-pulse" />
      </div>
      <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%]">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="relative w-4 h-4">
            <div className="absolute inset-0 rounded-full border-2 border-purple-200" />
            <div className="absolute inset-0 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
          </div>
          <span className="text-sm font-medium text-purple-700">{currentStage.text}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-1 flex-1 bg-gray-200 rounded-full overflow-hidden max-w-[180px]">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(95, (elapsed / 30000) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-400 tabular-nums">{Math.floor(elapsed / 1000)}с</span>
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
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  const [thinkingElapsed, setThinkingElapsed] = useState(0);
  const thinkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate('/login');
      return;
    }
    loadMaterials();
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const loadMaterials = async () => {
    try {
      const token = authService.getToken();
      const resp = await fetch(MATERIALS_URL, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setMaterials(data.materials || []);
      }
    } catch (e) {
      console.warn('Materials load:', e);
    }
  };

  const startThinking = () => {
    setThinkingElapsed(0);
    if (thinkingTimerRef.current) clearInterval(thinkingTimerRef.current);
    const start = Date.now();
    thinkingTimerRef.current = setInterval(() => {
      setThinkingElapsed(Date.now() - start);
    }, 200);
  };

  const stopThinking = () => {
    if (thinkingTimerRef.current) {
      clearInterval(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    }
    setThinkingElapsed(0);
  };

  const sendMessage = useCallback(async (text?: string) => {
    const q = (text || question).trim();
    if (!q || isLoading) return;

    const userMsg: Message = { role: 'user', content: q, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setQuestion('');
    setIsLoading(true);
    startThinking();

    const doFetch = async (): Promise<Response> => {
      const token = authService.getToken();
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 35000);
      const resp = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ question: q, material_ids: selectedMaterials }),
        signal: controller.signal
      });
      clearTimeout(tid);
      return resp;
    };

    const handleOk = async (resp: Response) => {
      const data = await resp.json();
      if (data.remaining !== undefined) setRemaining(data.remaining);
      const aiMsg: Message = { role: 'assistant', content: data.answer, timestamp: new Date() };
      setMessages(prev => [...prev, aiMsg]);
      try {
        const gam = await trackActivity('ai_questions_asked', 1);
        if (gam?.new_achievements?.length) {
          gam.new_achievements.forEach((a: { title: string; xp_reward: number }) => {
            toast({ title: `🏆 ${a.title}`, description: `+${a.xp_reward} XP` });
          });
        }
      } catch (e) {
        console.warn('Gamification:', e);
      }
    };

    try {
      const resp = await doFetch();
      if (resp.ok) {
        await handleOk(resp);
      } else if (resp.status === 403) {
        const data = await resp.json();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message || 'Лимит исчерпан. Оформи подписку или подожди до завтра!',
          timestamp: new Date()
        }]);
        setRemaining(0);
      } else if (resp.status === 504) {
        const resp2 = await doFetch();
        if (resp2.ok) {
          await handleOk(resp2);
        } else {
          throw new Error('retry_failed');
        }
      } else {
        throw new Error('server_error');
      }
    } catch (_) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'ИИ сейчас думает дольше обычного. Нажми ➤ ещё раз — скорее всего ответ уже готов.',
        timestamp: new Date()
      }]);
    } finally {
      stopThinking();
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [question, isLoading, selectedMaterials, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleMaterial = (id: number) => {
    setSelectedMaterials(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const quickActions = [
    { icon: '📝', text: 'Объясни тему простыми словами' },
    { icon: '📋', text: 'Составь краткий конспект' },
    { icon: '🎯', text: 'Помоги подготовиться к экзамену' },
    { icon: '❓', text: 'Какие главные тезисы?' },
    { icon: '🧮', text: 'Какие формулы важны?' },
  ];

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[100dvh] bg-white">
      <header className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-3 safe-top">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <Icon name="ArrowLeft" size={22} className="text-gray-700" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Studyfay</h1>
              <p className="text-xs text-gray-500">
                {isLoading ? (
                  <span className="text-purple-600 font-medium flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
                    Думаю... {thinkingElapsed > 0 ? `${Math.floor(thinkingElapsed / 1000)}с` : ''}
                  </span>
                ) : remaining !== null && remaining < 999 ? `Осталось ${remaining} вопросов` : 'ИИ-ассистент'}
              </p>
            </div>
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
              onClick={() => {
                setMessages([]);
                setRemaining(null);
              }}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <Icon name="Plus" size={20} />
            </button>
          </div>
        </div>
      </header>

      {showMaterialPicker && (
        <div className="flex-shrink-0 border-b border-gray-100 bg-gray-50 px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Контекст из материалов</p>
              {selectedMaterials.length > 0 && (
                <button onClick={() => setSelectedMaterials([])} className="text-xs text-purple-600 hover:text-purple-800">
                  Сбросить
                </button>
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
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      selectedMaterials.includes(m.id)
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'
                    }`}
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

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4">
          {!hasMessages ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-5 shadow-lg shadow-purple-200">
                <Icon name="Sparkles" size={32} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Привет! Я Studyfay</h2>
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
              {materials.length > 0 && selectedMaterials.length === 0 && (
                <button
                  onClick={() => setShowMaterialPicker(true)}
                  className="mt-4 text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"
                >
                  <Icon name="Paperclip" size={14} />
                  Выбери материалы для точных ответов
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon name="Sparkles" size={16} className="text-white" />
                    </div>
                  )}
                  <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-first' : ''}`}>
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
                    <p className={`text-[11px] mt-1 px-1 ${msg.role === 'user' ? 'text-right text-gray-400' : 'text-gray-400'}`}>
                      {msg.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <ThinkingIndicator hasMaterials={selectedMaterials.length > 0} elapsed={thinkingElapsed} />
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

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
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 128) + 'px';
              }}
            />
          </div>
          <button
            onClick={() => sendMessage()}
            disabled={!question.trim() || isLoading}
            className="w-11 h-11 rounded-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
          >
            {isLoading ? (
              <Icon name="Loader2" size={20} className="text-white animate-spin" />
            ) : (
              <Icon name="ArrowUp" size={20} className={question.trim() ? 'text-white' : 'text-gray-400'} />
            )}
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Assistant;