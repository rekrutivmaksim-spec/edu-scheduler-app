import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import Icon from '@/components/ui/icon';
import { API } from '@/lib/api-urls';

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
  const user = authService.getUser();
  const subject = user?.exam_subject || 'ru';
  const subjectName = SUBJECT_NAMES[subject] || subject;

  const [screen, setScreen] = useState<'loading' | 'overview' | 'chat' | 'empty'>('loading');
  const [data, setData] = useState<TrainingData | null>(null);
  const [activeTopic, setActiveTopic] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const chatRef = useRef<HTMLDivElement>(null);

  const token = authService.getToken();
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!authService.isAuthenticated()) { navigate('/auth'); return; }
    loadTraining();
  }, []);

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
      <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Icon name="Target" size={28} className="text-white" />
          </div>
          <p className="text-gray-600 font-semibold">Анализирую твои ошибки...</p>
        </div>
      </div>
    );
  }

  if (screen === 'empty') {
    return (
      <div className="min-h-screen bg-[#f0f4ff] px-5 pt-14">
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
      <div className="min-h-screen bg-[#f0f4ff] flex flex-col">
        <div className="bg-white/90 backdrop-blur-xl border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
          <button onClick={() => setScreen('overview')} className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center active:scale-90 transition-transform">
            <Icon name="ArrowLeft" size={18} className="text-gray-700" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-gray-900 truncate">{activeTopic}</p>
            <p className="text-[11px] text-gray-400 font-medium">{score.correct}/{score.total} правильно</p>
          </div>
          {score.total > 0 && (
            <div className={`px-3 py-1 rounded-xl text-[12px] font-bold ${score.correct / score.total >= 0.7 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {Math.round((score.correct / Math.max(score.total, 1)) * 100)}%
            </div>
          )}
        </div>

        <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                m.role === 'user'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-br-md'
                  : 'bg-white shadow-md border border-gray-100 text-gray-800 rounded-bl-md'
              }`}>
                <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{m.text}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white shadow-md border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Введи ответ..."
              className="flex-1 h-11 bg-gray-100 rounded-xl px-4 text-[14px] font-medium outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="w-11 h-11 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white disabled:opacity-40 active:scale-90 transition-all shadow-lg shadow-indigo-300/30"
            >
              <Icon name="Send" size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f4ff] pb-8">
      <div className="bg-gradient-to-b from-indigo-500 via-purple-500 to-[#f0f4ff] px-5 pt-14 pb-8">
        <button onClick={() => navigate(-1)} className="mb-5 w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center active:scale-90 transition-transform">
          <Icon name="ArrowLeft" size={20} className="text-white" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
            <Icon name="Target" size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-[22px] font-black text-white">Слабые места</h1>
            <p className="text-white/60 text-[12px] font-semibold">{subjectName}</p>
          </div>
        </div>

        {data?.stats && data.stats.total > 0 && (
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-3 text-center">
              <p className="text-white text-[20px] font-black">{data.stats.total}</p>
              <p className="text-white/50 text-[10px] font-semibold">ответов</p>
            </div>
            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-3 text-center">
              <p className="text-white text-[20px] font-black">{pct}%</p>
              <p className="text-white/50 text-[10px] font-semibold">точность</p>
            </div>
            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-3 text-center">
              <p className="text-white text-[20px] font-black">{data.stats.wrong}</p>
              <p className="text-white/50 text-[10px] font-semibold">ошибок</p>
            </div>
          </div>
        )}
      </div>

      {data?.summary && (
        <div className="mx-5 -mt-3 mb-4 bg-white rounded-2xl p-4 shadow-lg shadow-indigo-200/30 border border-indigo-100/50">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon name="Lightbulb" size={16} className="text-indigo-600" />
            </div>
            <p className="text-[13px] text-gray-700 leading-relaxed font-medium">{data.summary}</p>
          </div>
        </div>
      )}

      <div className="px-5">
        <p className="text-[14px] font-extrabold text-gray-800 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-gradient-to-b from-red-400 to-orange-500 rounded-full" />
          Темы для прокачки
        </p>

        <div className="space-y-3">
          {data?.weaknesses?.map((w, i) => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-md shadow-gray-200/50 border border-gray-100">
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      i === 0 ? 'bg-gradient-to-br from-red-400 to-rose-500' :
                      i === 1 ? 'bg-gradient-to-br from-orange-400 to-amber-500' :
                      'bg-gradient-to-br from-yellow-400 to-orange-400'
                    } shadow-md`}>
                      <span className="text-white font-black text-[14px]">#{i + 1}</span>
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-gray-900">{w.topic}</p>
                      <p className="text-[11px] text-gray-400 font-medium">{w.description}</p>
                    </div>
                  </div>
                </div>

                {w.tasks && w.tasks.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {w.tasks.map((t, j) => (
                      <div key={j} className="bg-gray-50 rounded-xl p-3">
                        <p className="text-[12px] text-gray-700 font-medium">{t.question}</p>
                        {t.hint && <p className="text-[11px] text-gray-400 mt-1">Подсказка: {t.hint}</p>}
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => startChat(w.topic)}
                  className="mt-3 w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-300/25 active:scale-[0.97] transition-all text-[13px]"
                >
                  Прокачать эту тему
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default WeakTraining;
