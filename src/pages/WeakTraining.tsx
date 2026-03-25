import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import Icon from '@/components/ui/icon';
import { API } from '@/lib/api-urls';
import { useLimits } from '@/hooks/useLimits';
import AiText from '@/components/AiText';

interface Weakness {
  topic: string;
  description: string;
  tasks: { question: string; hint: string }[];
}

interface WeakTopic {
  topic: string;
  total: number;
  correct: number;
  wrong: number;
}

interface TrainingData {
  has_data: boolean;
  message?: string;
  weaknesses?: Weakness[];
  weak_topics?: WeakTopic[];
  stats?: { total: number; correct: number; wrong: number };
  summary?: string;
}

interface ChatMsg {
  role: 'user' | 'ai';
  text: string;
}

const SUBJECT_NAMES: Record<string, string> = {
  ru: 'Русский язык', math_prof: 'Математика (профиль)', math_base: 'Математика (база)',
  physics: 'Физика', chemistry: 'Химия', biology: 'Биология', history: 'История',
  social: 'Обществознание', informatics: 'Информатика', english: 'Английский язык',
  geography: 'География', literature: 'Литература',
};

function WeakTraining() {
  const navigate = useNavigate();
  const limits = useLimits();
  const user = authService.getUser();
  const subject = user?.exam_subject || 'ru';
  const subjectName = SUBJECT_NAMES[subject] || subject;

  const [screen, setScreen] = useState<'loading' | 'overview' | 'chat' | 'empty' | 'paywall'>('loading');
  const [data, setData] = useState<TrainingData | null>(null);
  const [activeTopic, setActiveTopic] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const chatRef = useRef<HTMLDivElement>(null);

  const token = authService.getToken();
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const isPremium = limits.isPremium || limits.isTrial;

  useEffect(() => {
    if (!authService.isAuthenticated()) { navigate('/auth'); return; }
    if (!limits.loading && !isPremium) {
      setScreen('paywall');
      return;
    }
    if (!limits.loading) loadTraining();
  }, [limits.loading, isPremium]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const loadTraining = async () => {
    try {
      const res = await fetch(API.WEAK_TRAINING, {
        method: 'POST', headers,
        body: JSON.stringify({ action: 'generate_training', subject: subjectName }),
      });
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setScreen(d.has_data ? 'overview' : 'empty');
      } else {
        setScreen('empty');
      }
    } catch {
      setScreen('empty');
    }
  };

  const startChat = (topic: string) => {
    setActiveTopic(topic);
    setMessages([]);
    setScore({ correct: 0, total: 0 });
    setScreen('chat');
    sendToAI(topic, 'Давай начнём тренировку! Дай мне первое задание.', []);
  };

  const sendToAI = async (topic: string, question: string, history: ChatMsg[]) => {
    setLoading(true);
    try {
      const res = await fetch(API.WEAK_TRAINING, {
        method: 'POST', headers,
        body: JSON.stringify({
          action: 'chat',
          subject: subjectName,
          topic,
          question,
          history: history.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setMessages(prev => [...prev, { role: 'ai', text: d.answer }]);
        if (d.is_correct === true) setScore(s => ({ correct: s.correct + 1, total: s.total + 1 }));
        else if (d.is_correct === false) setScore(s => ({ ...s, total: s.total + 1 }));
      }
    } catch { /* */ }
    setLoading(false);
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const newMsgs: ChatMsg[] = [...messages, { role: 'user', text }];
    setMessages(newMsgs);
    sendToAI(activeTopic, text, newMsgs);
  };

  const pct = data?.stats?.total ? Math.round((data.stats.correct / data.stats.total) * 100) : 0;

  if (screen === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f0f4ff] to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-5 animate-pulse shadow-xl shadow-orange-200/50">
            <Icon name="Target" size={32} className="text-white" />
          </div>
          <p className="text-gray-700 font-bold text-[15px]">Анализирую твои ошибки...</p>
          <p className="text-gray-400 text-[12px] mt-1">ИИ изучает твою статистику</p>
        </div>
      </div>
    );
  }

  if (screen === 'paywall') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f0f4ff] to-white px-5 pt-14">
        <button onClick={() => navigate(-1)} className="mb-6 w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-md active:scale-90 transition-transform">
          <Icon name="ArrowLeft" size={20} className="text-gray-700" />
        </button>
        <div className="text-center mt-10">
          <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-orange-200/50">
            <Icon name="Target" size={44} className="text-white" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Слабые места</h2>
          <p className="text-gray-500 text-[14px] leading-relaxed max-w-[300px] mx-auto mb-2">
            ИИ-репетитор находит твои слабые темы, объясняет ошибки и составляет персональные задания
          </p>

          <div className="bg-gradient-to-br from-orange-50 to-rose-50 border border-orange-200 rounded-2xl p-5 mt-6 text-left space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon name="BarChart3" size={18} className="text-orange-600" />
              </div>
              <p className="text-[13px] text-gray-700 font-medium">Подробная аналитика по каждой теме</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon name="Brain" size={18} className="text-orange-600" />
              </div>
              <p className="text-[13px] text-gray-700 font-medium">ИИ объясняет причины ошибок</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon name="Dumbbell" size={18} className="text-orange-600" />
              </div>
              <p className="text-[13px] text-gray-700 font-medium">Персональные задания для тренировки</p>
            </div>
          </div>

          <button
            onClick={() => navigate('/pricing')}
            className="mt-6 w-full bg-gradient-to-r from-orange-500 to-rose-500 text-white font-extrabold text-[16px] px-8 py-4 rounded-2xl shadow-xl shadow-orange-300/40 active:scale-95 transition-transform"
          >
            Подключить Premium
          </button>
          <p className="text-gray-400 text-[11px] mt-3">Доступно с подпиской Premium</p>
        </div>
      </div>
    );
  }

  if (screen === 'empty') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f0f4ff] to-white px-5 pt-14">
        <button onClick={() => navigate(-1)} className="mb-6 w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-md active:scale-90 transition-transform">
          <Icon name="ArrowLeft" size={20} className="text-gray-700" />
        </button>
        <div className="text-center mt-16">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-5">
            <Icon name="Target" size={36} className="text-indigo-500" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Пока нет данных</h2>
          <p className="text-gray-500 text-sm leading-relaxed max-w-[280px] mx-auto">
            Пройди несколько уроков или тестов — я проанализирую твои ответы и найду слабые места
          </p>
          <button onClick={() => navigate('/')} className="mt-8 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold px-8 py-3 rounded-2xl shadow-lg shadow-indigo-300/30 active:scale-95 transition-transform">
            К урокам
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'chat') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f0f4ff] to-white flex flex-col">
        <div className="bg-white/90 backdrop-blur-xl border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
          <button onClick={() => setScreen('overview')} className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center active:scale-90 transition-transform">
            <Icon name="ArrowLeft" size={18} className="text-gray-700" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-gray-900 truncate">{activeTopic}</p>
            <p className="text-[11px] text-gray-400 font-medium">{score.correct}/{score.total} правильно</p>
          </div>
          {score.total > 0 && (
            <div className={`px-3 py-1.5 rounded-xl text-[12px] font-bold ${score.correct / score.total >= 0.7 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {Math.round((score.correct / Math.max(score.total, 1)) * 100)}%
            </div>
          )}
        </div>

        <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl ${
                m.role === 'user'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-br-md px-4 py-3'
                  : 'bg-white shadow-md border border-gray-100 rounded-bl-md px-4 py-4'
              }`}>
                {m.role === 'user' ? (
                  <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{m.text}</p>
                ) : (
                  <AiText text={m.text} />
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white shadow-md border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 p-3" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Введи ответ..."
              className="flex-1 h-11 bg-gray-100 rounded-xl px-4 text-[14px] text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white disabled:opacity-40 active:scale-90 transition-all shadow-lg shadow-indigo-200"
            >
              <Icon name="Send" size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f0f4ff] to-white pb-8">
      <div className="bg-gradient-to-br from-orange-500 via-rose-500 to-pink-600 px-5 pt-12 pb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />

        <div className="relative z-10">
          <button onClick={() => navigate(-1)} className="mb-4 w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center active:scale-90 transition-transform backdrop-blur-sm">
            <Icon name="ArrowLeft" size={20} className="text-white" />
          </button>

          <h1 className="text-white font-extrabold text-2xl mb-1">Слабые места</h1>
          <p className="text-white/70 text-[13px] font-medium">{subjectName}</p>

          {data?.stats && (
            <div className="flex items-center gap-4 mt-4">
              <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3 flex-1">
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Всего ответов</p>
                <p className="text-white font-extrabold text-2xl">{data.stats.total}</p>
              </div>
              <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3 flex-1">
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Точность</p>
                <p className="text-white font-extrabold text-2xl">{pct}%</p>
              </div>
              <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3 flex-1">
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Ошибок</p>
                <p className="text-white font-extrabold text-2xl">{data.stats.wrong}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 -mt-4 relative z-10">
        {data?.summary && (
          <div className="bg-white rounded-2xl p-4 shadow-lg shadow-gray-200/50 border border-gray-100/50 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-orange-100 to-rose-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon name="Brain" size={18} className="text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-bold text-orange-500 uppercase tracking-wider mb-1">Рекомендация ИИ</p>
                <AiText text={data.summary} />
              </div>
            </div>
          </div>
        )}

        {data?.weaknesses && data.weaknesses.length > 0 && (
          <>
            <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-3 mt-5">Слабые темы</p>
            <div className="space-y-3">
              {data.weaknesses.map((w, i) => {
                const weakTopic = data.weak_topics?.find(t => t.topic === w.topic);
                const topicPct = weakTopic ? Math.round((weakTopic.correct / Math.max(weakTopic.total, 1)) * 100) : 0;
                return (
                  <div key={i} className="bg-white rounded-2xl shadow-md shadow-gray-100/50 border border-gray-100/50 overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start gap-3 mb-2">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          topicPct < 40 ? 'bg-red-100' : topicPct < 70 ? 'bg-amber-100' : 'bg-green-100'
                        }`}>
                          <span className="text-lg">{topicPct < 40 ? '🔴' : topicPct < 70 ? '🟡' : '🟢'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-bold text-gray-900">{w.topic}</p>
                          <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">{w.description}</p>
                        </div>
                        {weakTopic && (
                          <div className="text-right flex-shrink-0">
                            <p className={`text-[16px] font-extrabold ${topicPct < 40 ? 'text-red-500' : topicPct < 70 ? 'text-amber-500' : 'text-green-500'}`}>{topicPct}%</p>
                            <p className="text-[10px] text-gray-400">{weakTopic.wrong} ош.</p>
                          </div>
                        )}
                      </div>

                      {w.tasks && w.tasks.length > 0 && (
                        <div className="bg-gray-50 rounded-xl p-3 mt-3 space-y-2">
                          {w.tasks.slice(0, 2).map((task, j) => (
                            <div key={j} className="flex items-start gap-2">
                              <span className="w-5 h-5 bg-indigo-100 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-indigo-600 mt-0.5">{j + 1}</span>
                              <p className="text-[13px] text-gray-600 leading-relaxed flex-1">{task.question}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => startChat(w.topic)}
                      className="w-full py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-t border-gray-100 flex items-center justify-center gap-2 active:bg-indigo-100 transition-colors"
                    >
                      <Icon name="MessageCircle" size={16} className="text-indigo-600" />
                      <span className="text-[13px] font-bold text-indigo-600">Тренировка с ИИ</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {data?.weak_topics && data.weak_topics.length > 0 && (
          <>
            <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-3 mt-6">Статистика по темам</p>
            <div className="bg-white rounded-2xl shadow-md shadow-gray-100/50 border border-gray-100/50 overflow-hidden divide-y divide-gray-100">
              {data.weak_topics.map((t, i) => {
                const topicPct = Math.round((t.correct / Math.max(t.total, 1)) * 100);
                return (
                  <div key={i} className="px-4 py-3 flex items-center gap-3">
                    <div className={`w-2 h-8 rounded-full flex-shrink-0 ${topicPct < 40 ? 'bg-red-400' : topicPct < 70 ? 'bg-amber-400' : 'bg-green-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-gray-800 truncate">{t.topic}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px] text-gray-400">{t.total} ответов</span>
                        <span className="text-[11px] text-green-600 font-medium">{t.correct} верно</span>
                        <span className="text-[11px] text-red-500 font-medium">{t.wrong} ош.</span>
                      </div>
                    </div>
                    <div className="w-12 text-right">
                      <p className={`text-[14px] font-extrabold ${topicPct < 40 ? 'text-red-500' : topicPct < 70 ? 'text-amber-500' : 'text-green-500'}`}>{topicPct}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default WeakTraining;
