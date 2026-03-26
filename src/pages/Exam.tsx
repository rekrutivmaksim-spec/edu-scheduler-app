import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import Icon from '@/components/ui/icon';
import BottomNav from '@/components/BottomNav';
import { useLimits } from '@/hooks/useLimits';
import PaywallSheet from '@/components/PaywallSheet';
import { API } from '@/lib/api-urls';
import { trackActivity } from '@/lib/gamification';
import AiText from '@/components/AiText';
import { useHearts } from '@/hooks/useHearts';

const EGE_DATE = new Date('2026-05-25');
const OGE_DATE = new Date('2026-05-19');

const EGE_SUBJECTS = [
  { id: 'ru', name: 'Русский язык', icon: '\u{1F4DD}' },
  { id: 'math_base', name: 'Математика (база)', icon: '\u{1F522}' },
  { id: 'math_prof', name: 'Математика (профиль)', icon: '\u{1F4D0}' },
  { id: 'physics', name: 'Физика', icon: '\u269B\uFE0F' },
  { id: 'chemistry', name: 'Химия', icon: '\u{1F9EA}' },
  { id: 'biology', name: 'Биология', icon: '\u{1F33F}' },
  { id: 'history', name: 'История', icon: '\u{1F3DB}\uFE0F' },
  { id: 'social', name: 'Обществознание', icon: '\u{1F30D}' },
  { id: 'informatics', name: 'Информатика', icon: '\u{1F4BB}' },
  { id: 'english', name: 'Английский язык', icon: '\u{1F1EC}\u{1F1E7}' },
  { id: 'geography', name: 'География', icon: '\u{1F5FA}\uFE0F' },
  { id: 'literature', name: 'Литература', icon: '\u{1F4D6}' },
];

const MODES = [
  { id: 'explain', title: 'Разбор тем', desc: 'Теория и объяснения', iconName: 'BookOpen', gradient: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50' },
  { id: 'practice', title: 'Практика', desc: 'Задания с проверкой', iconName: 'PenTool', gradient: 'from-emerald-500 to-green-600', bg: 'bg-emerald-50' },
  { id: 'weak', title: 'Слабые темы', desc: 'Работа над ошибками', iconName: 'Target', gradient: 'from-amber-500 to-orange-500', bg: 'bg-amber-50' },
  { id: 'mock', title: 'Пробный тест', desc: 'Симуляция экзамена', iconName: 'GraduationCap', gradient: 'from-purple-500 to-pink-600', bg: 'bg-purple-50' },
];

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  ts: number;
}

function daysUntil(date: Date): number {
  const now = new Date();
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function pluralDays(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return 'день';
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'дня';
  return 'дней';
}

function getSystemPrompt(mode: string, subjectName: string, examType: string): string {
  const label = examType === 'oge' ? 'ОГЭ' : 'ЕГЭ';
  const fmt = 'Используй markdown: **жирный** для ключевых терминов, нумерованные списки для шагов, ## заголовки для разделов.';
  switch (mode) {
    case 'explain':
      return `Привет! Я твой репетитор по предмету "${subjectName}" для ${label}. Спрашивай любую тему — объясню понятно и с примерами. ${fmt} С чего начнём?`;
    case 'practice':
      return `Давай потренируемся! Я буду давать тебе задания формата ${label} по предмету "${subjectName}" и проверять ответы. ${fmt} Вот первое задание:`;
    case 'weak':
      return `Давай разберём твои слабые места по предмету "${subjectName}" для ${label}. Я дам объяснение проблемной темы и задание для закрепления. ${fmt} Начинаем:`;
    case 'mock':
      return `Начинаем пробный ${label} по предмету "${subjectName}"! Я буду давать задания по порядку, как на настоящем экзамене. ${fmt} Задание №1:`;
    default:
      return '';
  }
}

async function askAI(question: string, history: Message[], subjectName: string, mode: string, examType: string, isSystem = false) {
  const token = authService.getToken();
  const examMeta = `${examType}||${subjectName}|${mode}`;
  const hist = history.slice(-6).map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }));
  const res = await fetch(API.AI_ASSISTANT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question, exam_meta: examMeta, history: hist, system_only: isSystem }),
  });
  if (res.status === 403 || res.status === 429) throw new Error('limit');
  const data = await res.json();
  return { answer: data.answer || data.response || '', remaining: data.remaining };
}

export default function Exam() {
  const navigate = useNavigate();
  const hearts = useHearts();
  const limits = useLimits();
  const user = authService.getUser();
  const examType = user?.goal === 'oge' ? 'oge' : 'ege';
  const examDate = examType === 'oge' ? OGE_DATE : EGE_DATE;
  const days = daysUntil(examDate);

  const [screen, setScreen] = useState<'menu' | 'chat'>('menu');
  const [activeSubject, setActiveSubject] = useState(user?.exam_subject || 'ru');
  const [activeMode, setActiveMode] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const currentSubject = EGE_SUBJECTS.find(s => s.id === activeSubject) || EGE_SUBJECTS[0];

  useEffect(() => {
    if (!authService.isAuthenticated()) { navigate('/auth'); return; }
  }, [navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (tabsRef.current) {
      const el = tabsRef.current.querySelector(`[data-subid="${activeSubject}"]`);
      if (el) (el as HTMLElement).scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeSubject]);

  const addMessage = useCallback((role: 'user' | 'ai', text: string) => {
    setMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, role, text, ts: Date.now() }]);
  }, []);

  const startChat = useCallback(async (mode: string) => {
    if (!limits.isPremium && limits.aiRemaining() <= 0) {
      setShowPaywall(true);
      return;
    }
    setActiveMode(mode);
    setMessages([]);
    setScreen('chat');
    setLoading(true);
    try {
      const prompt = getSystemPrompt(mode, currentSubject.name, examType);
      const result = await askAI(prompt, [], currentSubject.name, mode, examType, true);
      addMessage('ai', result.answer);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'limit') {
        setShowPaywall(true);
        setScreen('menu');
      } else {
        addMessage('ai', 'Произошла ошибка. Попробуй ещё раз.');
      }
    } finally {
      setLoading(false);
    }
  }, [limits, currentSubject, examType, addMessage]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!limits.isPremium && limits.aiRemaining() <= 0) {
      setShowPaywall(true);
      return;
    }
    setInput('');
    addMessage('user', text);
    setLoading(true);
    try {
      const result = await askAI(text, messages, currentSubject.name, activeMode, examType);
      addMessage('ai', result.answer);
      if (['practice', 'weak', 'mock'].includes(activeMode)) {
        trackActivity('exam_tasks_done', 1);
        try {
          const saveToken = authService.getToken();
          if (saveToken) {
            const ansLower = result.answer.toLowerCase();
            const isCorrect = ansLower.includes('правильно') || ansLower.includes('верно!') || ansLower.includes('молодец') || ansLower.includes('отлично!');
            const isWrong = ansLower.includes('неверно') || ansLower.includes('ошибк') || ansLower.includes('неправильно') || ansLower.includes('к сожалению');
            if (isCorrect || isWrong) {
              fetch(API.WEAK_TRAINING, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${saveToken}` },
                body: JSON.stringify({
                  action: 'save_answer',
                  subject: currentSubject.name,
                  topic: activeMode,
                  question: messages.length > 1 ? messages[messages.length - 1]?.text?.slice(0, 300) || '' : '',
                  user_answer: text,
                  is_correct: isCorrect && !isWrong,
                  ai_feedback: result.answer.slice(0, 500),
                  source: 'exam',
                  mode: activeMode,
                }),
              }).catch(() => {});
              if (isWrong && !isCorrect) hearts.loseHeart();
            }
          }
        } catch { /* */ }
      }
      limits.reload(true);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'limit') {
        setShowPaywall(true);
      } else {
        addMessage('ai', 'Ошибка соединения. Попробуй ещё раз.');
      }
    } finally {
      setLoading(false);
    }
  }, [input, loading, limits, messages, currentSubject, activeMode, examType, addMessage]);

  const goBack = () => {
    setScreen('menu');
    setMessages([]);
    setActiveMode('');
  };

  if (screen === 'chat') {
    const modeInfo = MODES.find(m => m.id === activeMode);
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f0edff] via-[#f7f5ff] to-white">
        <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-2xl border-b border-gray-100/60">
          <div className="flex items-center gap-3 px-4 h-[52px]">
            <button onClick={goBack} className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 active:scale-90 transition-transform">
              <Icon name="ArrowLeft" size={18} className="text-gray-600" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-gray-900 truncate">{currentSubject.icon} {currentSubject.name}</p>
              <p className="text-[11px] text-gray-400 font-medium">{modeInfo?.title}</p>
            </div>
            {!limits.isPremium && (
              <div className="flex items-center gap-1 bg-purple-50 px-2.5 py-1 rounded-xl">
                <Icon name="Sparkles" size={12} className="text-purple-500" />
                <span className="text-[11px] font-bold text-purple-600">{limits.aiRemaining()}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-br-md px-4 py-3'
                  : 'bg-white shadow-sm border border-gray-100/60 rounded-bl-md px-4 py-4'
              }`}>
                {msg.role === 'user' ? (
                  <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                ) : (
                  <AiText text={msg.text} />
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-100/60">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur-xl border-t border-gray-100/60 px-4 py-3" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder={['practice', 'weak', 'mock'].includes(activeMode) ? 'Введи ответ...' : 'Задай вопрос...'}
              className="flex-1 h-11 bg-gray-100 rounded-xl px-4 text-[14px] text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-purple-300 transition-all"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white disabled:opacity-40 active:scale-90 transition-all shadow-lg shadow-purple-200"
            >
              <Icon name="Send" size={18} />
            </button>
          </div>
        </div>

        {showPaywall && <PaywallSheet trigger="ai_limit" onClose={() => setShowPaywall(false)} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-[#ede9fe] via-[#f5f3ff] to-[#eef2ff] relative overflow-hidden">
      <div className="absolute top-32 -left-20 w-72 h-72 bg-purple-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-[55%] -right-16 w-64 h-64 bg-indigo-200/15 rounded-full blur-3xl pointer-events-none" />

      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-2xl border-b border-white/40">
        <div className="flex items-center justify-between px-4 h-[52px]">
          <h1 className="text-[18px] font-extrabold text-gray-900">Экзамен</h1>
          <div className="flex items-center gap-2">
            {days > 0 && (
              <div className="flex items-center gap-1.5 bg-gradient-to-r from-red-50 to-orange-50 border border-red-100/60 rounded-2xl px-3 py-1.5">
                <Icon name="Clock" size={14} className="text-red-500" />
                <span className="text-[13px] font-bold text-red-600">{days} {pluralDays(days)}</span>
              </div>
            )}
            {!limits.isPremium && (
              <div className="flex items-center gap-1 bg-purple-50 border border-purple-100/60 rounded-2xl px-3 py-1.5">
                <Icon name="Sparkles" size={14} className="text-purple-500" />
                <span className="text-[13px] font-bold text-purple-600">{limits.aiRemaining()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-2">
        <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Предмет</p>
        <div ref={tabsRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          {EGE_SUBJECTS.map(s => {
            const active = s.id === activeSubject;
            return (
              <button
                key={s.id}
                data-subid={s.id}
                onClick={() => setActiveSubject(s.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl whitespace-nowrap transition-all duration-200 active:scale-95 flex-shrink-0 ${
                  active
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-200/50'
                    : 'bg-white/80 text-gray-700 border border-gray-200/60'
                }`}
              >
                <span className="text-[16px]">{s.icon}</span>
                <span className={`text-[13px] font-semibold ${active ? 'text-white' : 'text-gray-700'}`}>{s.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-2 pb-3">
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-5 shadow-xl shadow-purple-200/40">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{currentSubject.icon}</span>
              <div>
                <h2 className="text-white font-extrabold text-[17px] leading-tight">{currentSubject.name}</h2>
                <p className="text-white/60 text-[12px] font-medium">{examType === 'oge' ? 'ОГЭ' : 'ЕГЭ'} 2026</p>
              </div>
            </div>
          </div>
          {days > 0 && (
            <div className="bg-white/15 rounded-2xl px-4 py-2.5 flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                <Icon name="Calendar" size={18} className="text-white" />
              </div>
              <div>
                <p className="text-white/60 text-[11px] font-medium">До экзамена</p>
                <p className="text-white font-extrabold text-[16px]">{days} {pluralDays(days)}</p>
              </div>
              <div className="ml-auto">
                <div className="w-12 h-12 rounded-full border-[3px] border-white/30 flex items-center justify-center">
                  <span className="text-white font-black text-[14px]">{days}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-1 pb-2">
        <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Выбери режим</p>
        <div className="grid grid-cols-2 gap-3">
          {MODES.map(mode => (
            <button
              key={mode.id}
              onClick={() => startChat(mode.id)}
              className="bg-white rounded-2xl p-4 border border-gray-100/60 shadow-sm active:scale-[0.97] transition-all duration-200 text-left"
            >
              <div className={`w-11 h-11 bg-gradient-to-br ${mode.gradient} rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-gray-200/50`}>
                <Icon name={mode.iconName} size={20} className="text-white" />
              </div>
              <p className="text-[14px] font-bold text-gray-900 leading-tight">{mode.title}</p>
              <p className="text-[11px] text-gray-400 font-medium mt-0.5">{mode.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 pb-2">
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-gray-100/60">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
              <Icon name="Lightbulb" size={16} className="text-white" />
            </div>
            <p className="text-[14px] font-bold text-gray-900">Совет</p>
          </div>
          <p className="text-[13px] text-gray-500 leading-relaxed">
            Начни с <span className="font-semibold text-indigo-600">Разбора тем</span> для теории, потом закрепи через <span className="font-semibold text-emerald-600">Практику</span>. Перед экзаменом пройди <span className="font-semibold text-purple-600">Пробный тест</span>.
          </p>
        </div>
      </div>

      {showPaywall && <PaywallSheet trigger="ai_limit" onClose={() => setShowPaywall(false)} />}
      <BottomNav />
    </div>
  );
}