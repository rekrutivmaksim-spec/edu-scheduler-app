import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { authService } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';

const AI_API_URL = 'https://functions.poehali.dev/8e8cbd4e-7731-4853-8e29-a84b3d178249';

// ─── Данные предметов ────────────────────────────────────────────────────────

const EGE_SUBJECTS = [
  { id: 'ru', name: 'Русский язык', icon: '📝', required: true, color: 'from-blue-500 to-indigo-500' },
  { id: 'math_base', name: 'Математика (база)', icon: '🔢', required: true, color: 'from-purple-500 to-violet-500' },
  { id: 'math_prof', name: 'Математика (профиль)', icon: '📐', required: false, color: 'from-purple-600 to-pink-500' },
  { id: 'physics', name: 'Физика', icon: '⚛️', required: false, color: 'from-sky-500 to-blue-600' },
  { id: 'chemistry', name: 'Химия', icon: '🧪', required: false, color: 'from-green-500 to-teal-500' },
  { id: 'biology', name: 'Биология', icon: '🌿', required: false, color: 'from-emerald-500 to-green-600' },
  { id: 'history', name: 'История', icon: '🏛️', required: false, color: 'from-amber-500 to-orange-500' },
  { id: 'social', name: 'Обществознание', icon: '🌍', required: false, color: 'from-orange-500 to-red-500' },
  { id: 'informatics', name: 'Информатика', icon: '💻', required: false, color: 'from-cyan-500 to-blue-500' },
  { id: 'english', name: 'Английский язык', icon: '🇬🇧', required: false, color: 'from-red-500 to-rose-500' },
  { id: 'geography', name: 'География', icon: '🗺️', required: false, color: 'from-teal-500 to-cyan-500' },
  { id: 'literature', name: 'Литература', icon: '📖', required: false, color: 'from-pink-500 to-rose-500' },
];

const OGE_SUBJECTS = [
  { id: 'ru', name: 'Русский язык', icon: '📝', required: true, color: 'from-blue-500 to-indigo-500' },
  { id: 'math', name: 'Математика', icon: '🔢', required: true, color: 'from-purple-500 to-violet-500' },
  { id: 'physics', name: 'Физика', icon: '⚛️', required: false, color: 'from-sky-500 to-blue-600' },
  { id: 'chemistry', name: 'Химия', icon: '🧪', required: false, color: 'from-green-500 to-teal-500' },
  { id: 'biology', name: 'Биология', icon: '🌿', required: false, color: 'from-emerald-500 to-green-600' },
  { id: 'history', name: 'История', icon: '🏛️', required: false, color: 'from-amber-500 to-orange-500' },
  { id: 'social', name: 'Обществознание', icon: '🌍', required: false, color: 'from-orange-500 to-red-500' },
  { id: 'informatics', name: 'Информатика', icon: '💻', required: false, color: 'from-cyan-500 to-blue-500' },
  { id: 'english', name: 'Английский язык', icon: '🇬🇧', required: false, color: 'from-red-500 to-rose-500' },
  { id: 'geography', name: 'География', icon: '🗺️', required: false, color: 'from-teal-500 to-cyan-500' },
  { id: 'literature', name: 'Литература', icon: '📖', required: false, color: 'from-pink-500 to-rose-500' },
];

// Описания структуры экзамена
const EXAM_INFO: Record<string, { ege: string; oge: string }> = {
  ru: {
    ege: '27 заданий: тест (часть 1) + сочинение (часть 2). Проверяет грамотность, понимание текста, нормы языка.',
    oge: '9 заданий: изложение + тест + сочинение. Проверяет базовые навыки русского языка.',
  },
  math_base: { ege: '20 заданий без развёрнутого ответа. Практические задачи из жизни: финансы, геометрия, статистика.', oge: '' },
  math_prof: { ege: '19 заданий: 12 тестовых + 7 с развёрнутым ответом. Алгебра, геометрия, теория вероятностей.', oge: '' },
  math: { ege: '', oge: '25 заданий: модуль "Алгебра" + "Геометрия" + "Реальная математика".' },
  physics: {
    ege: '30 заданий: механика, термодинамика, электричество, оптика, ядерная физика. Есть расчётные задачи.',
    oge: '26 заданий: тест + лабораторная работа + расчётные задачи.',
  },
  chemistry: {
    ege: '34 задания: строение атома, реакции, органическая химия, решение задач.',
    oge: '22 задания: тест + практическая работа + задачи.',
  },
  biology: {
    ege: '29 заданий: клетка, организм, экосистемы, генетика, эволюция.',
    oge: '32 задания: тест + работа с текстом + практические задания.',
  },
  history: {
    ege: '21 задание: события от Руси до XXI века, карты, работа с источниками.',
    oge: '35 заданий: тест + работа с документами + задания на карту.',
  },
  social: {
    ege: '25 заданий: право, экономика, политика, социология, философия.',
    oge: '31 задание: тест + работа с текстом + эссе.',
  },
  informatics: {
    ege: '27 заданий: алгоритмы, программирование, логика, системы счисления.',
    oge: '15 заданий: тест + практика на компьютере.',
  },
  english: {
    ege: 'Аудирование, чтение, грамматика/лексика, письмо, устная часть (говорение).',
    oge: 'Аудирование, чтение, грамматика/лексика, письмо, говорение.',
  },
  geography: {
    ege: '31 задание: карты, климат, население, экономика, экология.',
    oge: '30 заданий: тест + практические задания с картой.',
  },
  literature: {
    ege: '12 заданий: анализ лирики + анализ эпоса/драмы + сочинение.',
    oge: '8 заданий: работа с текстом + развёрнутые ответы + сочинение.',
  },
};

function sanitize(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/[\u4e00-\u9fff]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

type Screen = 'pick_exam' | 'pick_subject' | 'pick_mode' | 'session';
type ExamType = 'ege' | 'oge';
type Mode = 'explain' | 'practice';

interface Subject { id: string; name: string; icon: string; required: boolean; color: string }
interface Message { role: 'user' | 'ai'; text: string }

export default function Exam() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>('pick_exam');
  const [examType, setExamType] = useState<ExamType>('ege');
  const [subject, setSubject] = useState<Subject | null>(null);
  const [mode, setMode] = useState<Mode>('explain');

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [taskNum, setTaskNum] = useState(1);
  const [userAnswer, setUserAnswer] = useState('');
  const [waitingAnswer, setWaitingAnswer] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const subjects = examType === 'ege' ? EGE_SUBJECTS : OGE_SUBJECTS;
  const subjectId = subject?.id ?? '';
  const examInfo = EXAM_INFO[subjectId]?.[examType === 'ege' ? 'ege' : 'oge'] ?? '';

  const scrollBottom = () => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

  const askAI = async (question: string, history: Message[] = []): Promise<string> => {
    const token = authService.getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(AI_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'demo_ask',
        question,
        history: history.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
      }),
    });
    const data = await res.json();
    return sanitize(data.answer || data.response || 'Не удалось получить ответ.');
  };

  const startSession = async (s: Subject, m: Mode) => {
    setSubject(s);
    setMode(m);
    setMessages([]);
    setTaskNum(1);
    setWaitingAnswer(false);
    setInput('');
    setScreen('session');

    setLoading(true);
    scrollBottom();

    let prompt = '';
    if (m === 'explain') {
      prompt = `Ты репетитор по предмету "${s.name}" для подготовки к ${examType.toUpperCase()}. Кратко объясни структуру экзамена и самые важные темы, которые точно встретятся. Дай конкретные советы что учить в первую очередь. Без воды, по делу.`;
    } else {
      prompt = `Ты экзаменатор ${examType.toUpperCase()} по предмету "${s.name}". Дай задание №1 — реальное типовое задание как на экзамене. Только условие задачи, без ответа. После условия напиши "Жду твой ответ."`;
    }

    try {
      const answer = await askAI(prompt);
      setMessages([{ role: 'ai', text: answer }]);
      if (m === 'practice') setWaitingAnswer(true);
    } catch {
      setMessages([{ role: 'ai', text: 'Не удалось загрузить. Попробуй ещё раз.' }]);
    } finally {
      setLoading(false);
      scrollBottom();
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const newMessages: Message[] = [...messages, { role: 'user', text }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    scrollBottom();

    try {
      const answer = await askAI(text, newMessages.slice(-6));
      setMessages(prev => [...prev, { role: 'ai', text: answer }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Ошибка. Попробуй ещё раз.' }]);
    } finally {
      setLoading(false);
      scrollBottom();
    }
  };

  const checkAnswer = async () => {
    const text = userAnswer.trim();
    if (!text || checkLoading) return;
    const lastTask = [...messages].reverse().find(m => m.role === 'ai')?.text ?? '';
    const newMessages: Message[] = [...messages, { role: 'user', text }];
    setMessages(newMessages);
    setUserAnswer('');
    setWaitingAnswer(false);
    setCheckLoading(true);
    scrollBottom();

    try {
      const nextNum = taskNum + 1;
      const prompt = `Задание: ${lastTask}\n\nОтвет ученика: ${text}\n\nПроверь ответ. Если правильно — начни со слова "Правильно!" и похвали. Если неправильно — начни со слова "Неверно." и объясни правильное решение по шагам. Потом дай задание №${nextNum} — новое типовое задание ${examType.toUpperCase()} по "${subject?.name}". Только условие, без ответа. В конце напиши "Жду твой ответ."`;
      const answer = await askAI(prompt, newMessages.slice(-4));
      setMessages(prev => [...prev, { role: 'ai', text: answer }]);
      setTaskNum(nextNum);
      setWaitingAnswer(true);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Ошибка. Попробуй ещё раз.' }]);
    } finally {
      setCheckLoading(false);
      scrollBottom();
    }
  };

  // ─── Экран 1: выбор типа экзамена ───────────────────────────────────────────
  if (screen === 'pick_exam') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 flex flex-col items-center justify-center px-6 pb-24">
        <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center text-3xl mb-4">🎓</div>
        <h1 className="text-white font-extrabold text-2xl mb-2 text-center">Подготовка к экзамену</h1>
        <p className="text-white/60 text-sm text-center mb-8">Выбери экзамен, к которому готовишься</p>

        <div className="w-full max-w-xs flex flex-col gap-3">
          <button
            onClick={() => { setExamType('ege'); setScreen('pick_subject'); }}
            className="bg-white rounded-2xl px-5 py-5 text-left shadow-xl active:scale-[0.97] transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🏆</span>
              <div>
                <p className="font-extrabold text-gray-800 text-lg">ЕГЭ</p>
                <p className="text-gray-400 text-xs">11 класс · Единый государственный</p>
              </div>
            </div>
            <p className="text-gray-500 text-xs">12 предметов на выбор + 2 обязательных</p>
          </button>

          <button
            onClick={() => { setExamType('oge'); setScreen('pick_subject'); }}
            className="bg-white/15 border border-white/30 rounded-2xl px-5 py-5 text-left active:scale-[0.97] transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📋</span>
              <div>
                <p className="font-extrabold text-white text-lg">ОГЭ</p>
                <p className="text-white/50 text-xs">9 класс · Основной государственный</p>
              </div>
            </div>
            <p className="text-white/50 text-xs">4 предмета: 2 обязательных + 2 по выбору</p>
          </button>
        </div>

        <button onClick={() => navigate('/')} className="text-white/40 text-sm mt-8">Вернуться</button>
        <BottomNav />
      </div>
    );
  }

  // ─── Экран 2: выбор предмета ─────────────────────────────────────────────────
  if (screen === 'pick_subject') {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 pt-12 pb-5">
          <div className="flex items-center gap-3">
            <button onClick={() => setScreen('pick_exam')} className="text-white/70 hover:text-white p-1">
              <Icon name="ArrowLeft" size={20} />
            </button>
            <div>
              <p className="text-white/60 text-xs uppercase tracking-wide">{examType.toUpperCase()}</p>
              <h1 className="text-white font-bold text-lg">Выбери предмет</h1>
            </div>
          </div>
        </div>

        <div className="px-4 py-4">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">Обязательные</p>
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            {subjects.filter(s => s.required).map(s => (
              <button
                key={s.id}
                onClick={() => { setSubject(s); setScreen('pick_mode'); }}
                className={`bg-gradient-to-br ${s.color} rounded-2xl p-4 text-left shadow-sm active:scale-[0.97] transition-all`}
              >
                <span className="text-2xl block mb-2">{s.icon}</span>
                <p className="text-white font-bold text-sm leading-tight">{s.name}</p>
                <span className="text-white/60 text-[10px]">Обязательный</span>
              </button>
            ))}
          </div>

          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">По выбору</p>
          <div className="grid grid-cols-2 gap-2.5">
            {subjects.filter(s => !s.required).map(s => (
              <button
                key={s.id}
                onClick={() => { setSubject(s); setScreen('pick_mode'); }}
                className="bg-white rounded-2xl p-4 text-left shadow-sm border border-gray-100 active:scale-[0.97] transition-all"
              >
                <span className="text-2xl block mb-2">{s.icon}</span>
                <p className="text-gray-800 font-bold text-sm leading-tight">{s.name}</p>
                <span className="text-gray-400 text-[10px]">По выбору</span>
              </button>
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─── Экран 3: выбор режима ────────────────────────────────────────────────────
  if (screen === 'pick_mode' && subject) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
        <div className={`bg-gradient-to-r ${subject.color} px-4 pt-12 pb-6`}>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setScreen('pick_subject')} className="text-white/70 hover:text-white p-1">
              <Icon name="ArrowLeft" size={20} />
            </button>
            <div>
              <p className="text-white/60 text-xs">{examType.toUpperCase()}</p>
              <h1 className="text-white font-bold text-lg">{subject.name}</h1>
            </div>
            <span className="text-3xl ml-auto">{subject.icon}</span>
          </div>

          {examInfo && (
            <div className="bg-white/15 rounded-2xl px-4 py-3">
              <p className="text-white/80 text-xs leading-relaxed">{examInfo}</p>
            </div>
          )}
        </div>

        <div className="px-4 py-5 flex flex-col gap-3">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Выбери режим</p>

          <button
            onClick={() => startSession(subject, 'explain')}
            className="bg-white rounded-2xl p-5 text-left shadow-sm border border-gray-100 active:scale-[0.97] transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-xl">💡</div>
              <div>
                <p className="font-bold text-gray-800">Режим объяснения</p>
                <p className="text-gray-400 text-xs">ИИ объясняет темы и отвечает на вопросы</p>
              </div>
            </div>
            <p className="text-gray-500 text-sm">Задавай любые вопросы по предмету — разберём сложные темы, формулы, теорию.</p>
          </button>

          <button
            onClick={() => startSession(subject, 'practice')}
            className="bg-white rounded-2xl p-5 text-left shadow-sm border border-gray-100 active:scale-[0.97] transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-xl">🎯</div>
              <div>
                <p className="font-bold text-gray-800">Режим практики</p>
                <p className="text-gray-400 text-xs">Типовые задания как на экзамене</p>
              </div>
            </div>
            <p className="text-gray-500 text-sm">ИИ даёт реальные задания по билетам, проверяет ответы и объясняет ошибки.</p>
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─── Экран 4: сессия (чат) ────────────────────────────────────────────────────
  if (screen === 'session' && subject) {
    const isExplain = mode === 'explain';

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Шапка */}
        <div className={`bg-gradient-to-r ${subject.color} px-4 pt-12 pb-4`}>
          <div className="flex items-center gap-3">
            <button onClick={() => setScreen('pick_mode')} className="text-white/70 hover:text-white p-1">
              <Icon name="ArrowLeft" size={20} />
            </button>
            <div className="flex-1">
              <p className="text-white/60 text-xs">{examType.toUpperCase()} · {subject.name}</p>
              <h1 className="text-white font-bold text-base">
                {isExplain ? '💡 Объяснение' : `🎯 Практика · задание ${taskNum}`}
              </h1>
            </div>
            <span className="text-2xl">{subject.icon}</span>
          </div>
        </div>

        {/* Сообщения */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">

          {loading && messages.length === 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <span key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i*150}ms` }} />
                ))}
              </div>
              <span className="text-indigo-500 text-sm">Загружаю...</span>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'ai' && (
                <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-0.5 text-sm">🤖</div>
              )}
              <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'
              }`}>
                {m.text}
              </div>
            </div>
          ))}

          {(loading || checkLoading) && messages.length > 0 && (
            <div className="flex justify-start">
              <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0 text-sm">🤖</div>
              <div className="bg-white rounded-2xl px-4 py-3 shadow-sm flex gap-1 items-center">
                {[0,1,2].map(i => (
                  <span key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i*150}ms` }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Ввод */}
        <div className="px-4 pb-8 pt-2 bg-gray-50 border-t border-gray-100">
          {/* Практика — отдельное поле ответа */}
          {!isExplain && waitingAnswer ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={userAnswer}
                onChange={e => setUserAnswer(e.target.value)}
                placeholder="Введи ответ на задание..."
                rows={2}
                className="w-full rounded-2xl border-2 border-gray-200 focus:border-indigo-400 px-4 py-3 text-sm text-gray-800 resize-none outline-none transition-colors"
              />
              <Button
                onClick={checkAnswer}
                disabled={!userAnswer.trim() || checkLoading}
                className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl disabled:opacity-50"
              >
                Проверить ответ
              </Button>
            </div>
          ) : (
            /* Объяснение — свободный чат */
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={isExplain ? 'Задай вопрос по теме...' : 'Задай вопрос...'}
                rows={1}
                className="flex-1 rounded-2xl border-2 border-gray-200 focus:border-indigo-400 px-4 py-3 text-sm text-gray-800 resize-none outline-none transition-colors"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all flex-shrink-0"
              >
                <Icon name="Send" size={18} className="text-white" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
