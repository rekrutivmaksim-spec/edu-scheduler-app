import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { trackActivity } from '@/lib/gamification';
import AIMessage from '@/components/AIMessage';
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

type ChatMode = 'general' | 'university';

const UNI_SYSTEM_PROMPT = `Ты Studyfay — личный ИИ-репетитор для студентов университета. Ты умный, дружелюбный, как старший товарищ который уже прошёл через всё это.

СТРОГО только русский язык. Никакого LaTeX ($...$ или \\[...\\]). Формулы обычным текстом.

ТЫ ЗНАЕШЬ ВСЁ что проходят в университете — высшую математику, физику, программирование, экономику, право, менеджмент, философию и другие дисциплины. Ты отвечаешь из своих знаний — без конспектов.

КАК ОТВЕЧАТЬ:
- По-человечески, без занудства — как умный друг-старшекурсник
- Если вопрос по теории — объясни суть + дай пример из практики
- Если задача — разбери по шагам, объясни ПОЧЕМУ каждый шаг
- Если подготовка к зачёту/экзамену — дай структуру: ключевые темы, формулы, типичные вопросы
- После ответа — предложи проверить себя: «Хочешь, дам контрольный вопрос?»
- Хвали за правильные ответы, мягко поправляй ошибки

ПОМОГАЕШЬ С:
- Лекциями и семинарами любых дисциплин
- Курсовыми и рефератами (структура, план, ключевые тезисы)
- Подготовкой к зачётам и экзаменам
- Формулами, теоремами, задачами
- Дипломными работами (методология, структура)
- Пониманием сложных концепций простым языком

ФОРМАТИРОВАНИЕ (Markdown):
- ## заголовки для разделения блоков
- **жирный** для терминов и ключевых мыслей
- > для определений и аксиом которые надо запомнить
- Списки и нумерация для шагов и перечислений
- Пустая строка между блоками

Будь вовлечённым и мотивирующим — студент должен чувствовать что разбирается, а не тупит.`;

const THINKING_STAGES: Record<ChatMode, string[]> = {
  general: [
    'Анализирую вопрос...',
    'Подбираю информацию...',
    'Формулирую ответ...',
    'Проверяю точность...',
    'Дополняю примерами...',
  ],
  university: [
    'Анализирую вопрос...',
    'Вспоминаю курс...',
    'Структурирую ответ...',
    'Проверяю точность...',
    'Добавляю примеры...',
  ],
};

const ThinkingIndicator = ({ mode, elapsed }: { mode: ChatMode; elapsed: number }) => {
  const stages = THINKING_STAGES[mode];
  const idx = Math.min(Math.floor(elapsed / 4000), stages.length - 1);

  return (
    <div className="flex gap-2.5 justify-start">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        mode === 'university'
          ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
          : 'bg-gradient-to-br from-purple-500 to-indigo-600'
      }`}>
        <Icon name={mode === 'university' ? 'GraduationCap' : 'Sparkles'} size={16} className="text-white animate-pulse" />
      </div>
      <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%]">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="relative w-4 h-4">
            <div className="absolute inset-0 rounded-full border-2 border-purple-200" />
            <div className="absolute inset-0 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
          </div>
          <span className="text-sm font-medium text-purple-700">{stages[idx]}</span>
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

const QUICK_ACTIONS: Record<ChatMode, { icon: string; text: string }[]> = {
  general: [
    { icon: '📐', text: 'Объясни тему простыми словами' },
    { icon: '🧩', text: 'Разбери задачу по шагам' },
    { icon: '🎯', text: 'Помоги подготовиться к экзамену' },
    { icon: '🃏', text: 'Создай флешкарты по теме' },
    { icon: '📋', text: 'Составь план конспекта' },
  ],
  university: [
    { icon: '📐', text: 'Объясни тему из университетского курса' },
    { icon: '🧮', text: 'Разбери задачу из высшей математики' },
    { icon: '📝', text: 'Помоги с курсовой — план и структура' },
    { icon: '🎯', text: 'Подготовь меня к зачёту' },
    { icon: '💡', text: 'Объясни формулу / теорему' },
  ],
};

const Assistant = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [chatMode, setChatMode] = useState<ChatMode>('general');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<number[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  const [thinkingElapsed, setThinkingElapsed] = useState(0);
  const thinkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lowLimitNotified = useRef(false);

  useEffect(() => {
    if (!authService.isAuthenticated()) { navigate('/login'); return; }
    loadMaterials();
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Push-уведомление при остатке 3 вопроса из 20
  useEffect(() => {
    if (remaining !== null && remaining <= 3 && remaining > 0 && !lowLimitNotified.current) {
      lowLimitNotified.current = true;
      toast({
        title: `Осталось ${remaining} вопрос${remaining === 1 ? '' : remaining < 5 ? 'а' : 'ов'}`,
        description: 'Купи пакет вопросов — они не сгорают завтра 💡',
        duration: 6000,
      });
    }
  }, [remaining, toast]);

  const loadMaterials = async () => {
    try {
      const token = authService.getToken();
      const resp = await fetch(MATERIALS_URL, { headers: { 'Authorization': `Bearer ${token}` } });
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
    thinkingTimerRef.current = setInterval(() => setThinkingElapsed(Date.now() - start), 200);
  };

  const stopThinking = () => {
    if (thinkingTimerRef.current) { clearInterval(thinkingTimerRef.current); thinkingTimerRef.current = null; }
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

    const body: Record<string, unknown> = {
      question: q,
      material_ids: selectedMaterials,
      history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
    };
    if (chatMode === 'university') {
      body.exam_system_prompt = UNI_SYSTEM_PROMPT;
    }

    const doFetch = async (): Promise<Response> => {
      const token = authService.getToken();
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 35000);
      const resp = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(tid);
      return resp;
    };

    const handleOk = async (resp: Response) => {
      const data = await resp.json();
      if (data.remaining !== undefined) setRemaining(data.remaining);
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer, timestamp: new Date() }]);
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
          timestamp: new Date(),
        }]);
        setRemaining(0);
      } else if (resp.status === 504) {
        const resp2 = await doFetch();
        if (resp2.ok) await handleOk(resp2);
        else throw new Error('retry_failed');
      } else {
        throw new Error('server_error');
      }
    } catch (_) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'ИИ сейчас думает дольше обычного. Нажми ➤ ещё раз — скорее всего ответ уже готов.',
        timestamp: new Date(),
      }]);
    } finally {
      stopThinking();
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [question, isLoading, selectedMaterials, messages, chatMode, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const toggleMaterial = (id: number) => {
    setSelectedMaterials(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const switchMode = (mode: ChatMode) => {
    if (mode === chatMode) return;
    setChatMode(mode);
    setMessages([]);
    setSelectedMaterials([]);
    setRemaining(null);
    lowLimitNotified.current = false;
  };

  const hasMessages = messages.length > 0;
  const quickActions = QUICK_ACTIONS[chatMode];

  return (
    <div className="flex flex-col h-[100dvh] bg-white">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-gray-100 px-4 pt-3 pb-0 safe-top">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
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
                  ) : remaining !== null ? (
                    <span className={remaining <= 3 ? 'text-orange-500 font-medium' : ''}>
                      Осталось {remaining} вопросов
                    </span>
                  ) : 'ИИ-ассистент'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {chatMode === 'general' && (
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
              <button
                onClick={() => { setMessages([]); setRemaining(null); lowLimitNotified.current = false; }}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                title="Новый чат"
              >
                <Icon name="Plus" size={20} />
              </button>
            </div>
          </div>

          {/* Mode switcher */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-0">
            <button
              onClick={() => switchMode('general')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                chatMode === 'general'
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon name="Sparkles" size={15} />
              Репетитор
            </button>
            <button
              onClick={() => switchMode('university')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                chatMode === 'university'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon name="GraduationCap" size={15} />
              ВУЗ
            </button>
          </div>
        </div>
      </header>

      {/* Material picker */}
      {showMaterialPicker && chatMode === 'general' && (
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
              <p className="text-xs text-gray-400 mt-1.5">Не выбрано — ИИ отвечает из своих знаний</p>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4">
          {!hasMessages ? (
            <div className="flex flex-col items-center justify-center min-h-[55vh] px-2">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg ${
                chatMode === 'university'
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-200'
                  : 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-purple-200'
              }`}>
                <Icon name={chatMode === 'university' ? 'GraduationCap' : 'Sparkles'} size={28} className="text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1 text-center">
                {chatMode === 'university' ? 'Репетитор для ВУЗа' : 'Привет! Я Studyfay'}
              </h2>
              <p className="text-gray-500 text-center mb-6 max-w-sm text-sm leading-relaxed">
                {chatMode === 'university'
                  ? 'Помогу с любой дисциплиной — высшая математика, физика, экономика, право, программирование и другое'
                  : 'Спрашивай по любому предмету — объясню тему, разберу задачу, помогу к экзамену'}
              </p>
              <div className="w-full space-y-2">
                {quickActions.map((qa, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(qa.text)}
                    className={`w-full text-left px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 transition-all text-sm text-gray-700 flex items-center gap-3 ${
                      chatMode === 'university'
                        ? 'hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700'
                        : 'hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700'
                    }`}
                  >
                    <span className="text-lg">{qa.icon}</span>
                    <span>{qa.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      chatMode === 'university'
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                        : 'bg-gradient-to-br from-purple-500 to-indigo-600'
                    }`}>
                      <Icon name={chatMode === 'university' ? 'GraduationCap' : 'Sparkles'} size={16} className="text-white" />
                    </div>
                  )}
                  <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                    <div className={`px-4 py-3 rounded-2xl ${
                      msg.role === 'user'
                        ? chatMode === 'university'
                          ? 'bg-blue-600 text-white rounded-br-md'
                          : 'bg-purple-600 text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-800 rounded-bl-md'
                    }`}>
                      {msg.role === 'assistant' ? (
                        <AIMessage content={msg.content} />
                      ) : (
                        <p className="text-[15px] leading-[1.7] whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                    <p className={`text-[11px] mt-1 px-1 ${msg.role === 'user' ? 'text-right text-gray-400' : 'text-gray-400'}`}>
                      {msg.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && <ThinkingIndicator mode={chatMode} elapsed={thinkingElapsed} />}
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
              placeholder={chatMode === 'university' ? 'Задай вопрос по любой дисциплине...' : 'Задай вопрос...'}
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
            className={`w-11 h-11 rounded-full disabled:bg-gray-200 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0 ${
              chatMode === 'university'
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
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
