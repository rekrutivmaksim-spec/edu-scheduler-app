import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import BottomNav from '@/components/BottomNav';
import PaywallSheet from '@/components/PaywallSheet';
import { authService } from '@/lib/auth';

type ExamType = 'ege' | 'oge' | null;

const SUBJECTS_EGE = [
  { id: 'math', label: 'Математика', icon: '📐', topics: 24 },
  { id: 'russian', label: 'Русский язык', icon: '📝', topics: 18 },
  { id: 'physics', label: 'Физика', icon: '⚡', topics: 20 },
  { id: 'chemistry', label: 'Химия', icon: '🧪', topics: 16 },
  { id: 'biology', label: 'Биология', icon: '🌿', topics: 22 },
  { id: 'history', label: 'История', icon: '🏛️', topics: 30 },
  { id: 'society', label: 'Обществознание', icon: '⚖️', topics: 25 },
  { id: 'informatics', label: 'Информатика', icon: '💻', topics: 14 },
  { id: 'english', label: 'Английский', icon: '🇬🇧', topics: 12 },
  { id: 'geography', label: 'География', icon: '🌍', topics: 18 },
];

const SUBJECTS_OGE = [
  { id: 'math', label: 'Математика', icon: '📐', topics: 16 },
  { id: 'russian', label: 'Русский язык', icon: '📝', topics: 12 },
  { id: 'physics', label: 'Физика', icon: '⚡', topics: 14 },
  { id: 'chemistry', label: 'Химия', icon: '🧪', topics: 10 },
  { id: 'biology', label: 'Биология', icon: '🌿', topics: 14 },
  { id: 'history', label: 'История', icon: '🏛️', topics: 20 },
  { id: 'society', label: 'Обществознание', icon: '⚖️', topics: 16 },
  { id: 'informatics', label: 'Информатика', icon: '💻', topics: 10 },
  { id: 'english', label: 'Английский', icon: '🇬🇧', topics: 8 },
  { id: 'geography', label: 'География', icon: '🌍', topics: 12 },
];

const TASK_TYPES = [
  { id: 'theory', label: 'Теория', icon: '📖', desc: 'Объяснение темы' },
  { id: 'practice', label: 'Практика', icon: '✏️', desc: 'Задания как на экзамене' },
  { id: 'mistakes', label: 'Разбор ошибок', icon: '🔍', desc: 'Типичные ошибки' },
];

function daysUntilExam(examDate?: string | null): number {
  if (!examDate || examDate === 'custom') return 0;
  const d = new Date(examDate);
  const now = new Date();
  return Math.max(0, Math.ceil((d.getTime() - now.getTime()) / 86400000));
}

export default function ExamPrep() {
  const navigate = useNavigate();
  const user = authService.getUser();
  const profileExamType = user?.exam_type as ExamType | undefined;
  const [examType, setExamType] = useState<ExamType>(profileExamType || null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const daysLeft = daysUntilExam(user?.exam_date);

  const subjects = examType === 'oge' ? SUBJECTS_OGE : SUBJECTS_EGE;
  const selectedSubjectData = subjects.find(s => s.id === selectedSubject);

  const handleStartTask = (taskType: string) => {
    if (taskType === 'practice') {
      setShowPaywall(true);
      return;
    }
    navigate('/session');
  };

  if (!examType) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 px-4 pt-12 pb-8">
          <h1 className="text-white font-extrabold text-2xl mb-1">Подготовка к экзамену</h1>
          <p className="text-white/60 text-sm">Структурированная подготовка к ЕГЭ и ОГЭ</p>
        </div>

        <div className="px-4 -mt-4 space-y-3 max-w-xl mx-auto">
          <div className="bg-white rounded-3xl p-5 shadow-sm">
            <p className="text-gray-500 text-sm mb-4 font-medium">Какой экзамен сдаёшь?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setExamType('ege')}
                className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-gray-100 hover:border-indigo-400 hover:bg-indigo-50 transition-all active:scale-[0.97]"
              >
                <span className="text-4xl">🎓</span>
                <div>
                  <p className="font-extrabold text-gray-900 text-lg">ЕГЭ</p>
                  <p className="text-gray-400 text-xs mt-0.5">11 класс</p>
                </div>
              </button>
              <button
                onClick={() => setExamType('oge')}
                className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-gray-100 hover:border-purple-400 hover:bg-purple-50 transition-all active:scale-[0.97]"
              >
                <span className="text-4xl">📚</span>
                <div>
                  <p className="font-extrabold text-gray-900 text-lg">ОГЭ</p>
                  <p className="text-gray-400 text-xs mt-0.5">9 класс</p>
                </div>
              </button>
            </div>
          </div>

          {daysLeft > 0 && (
            <div className="bg-indigo-50 rounded-3xl p-4 border border-indigo-100 flex items-center gap-3">
              <span className="text-2xl">🎯</span>
              <div>
                <p className="text-indigo-800 font-bold text-sm">До экзамена {daysLeft} {daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}</p>
                <p className="text-indigo-500 text-xs mt-0.5">Выбери предмет — составим план</p>
              </div>
            </div>
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!selectedSubject) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 px-4 pt-12 pb-6">
          <button onClick={() => setExamType(null)} className="flex items-center gap-2 text-white/70 mb-3">
            <Icon name="ArrowLeft" size={18} />
            <span className="text-sm">Назад</span>
          </button>
          <h1 className="text-white font-extrabold text-xl">{examType === 'ege' ? 'ЕГЭ' : 'ОГЭ'} — выбери предмет</h1>
          <p className="text-white/60 text-sm mt-1">Подберём задания и темы под твой уровень</p>
        </div>

        <div className="px-4 py-4 max-w-xl mx-auto">
          <div className="grid grid-cols-2 gap-2.5">
            {subjects.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedSubject(s.id)}
                className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:border-indigo-300 border-2 border-transparent transition-all active:scale-[0.97] text-left"
              >
                <span className="text-2xl flex-shrink-0">{s.icon}</span>
                <div>
                  <p className="font-bold text-gray-800 text-sm leading-tight">{s.label}</p>
                  <p className="text-gray-400 text-[11px] mt-0.5">{s.topics} тем</p>
                </div>
              </button>
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 px-4 pt-12 pb-6">
        <button onClick={() => setSelectedSubject(null)} className="flex items-center gap-2 text-white/70 mb-3">
          <Icon name="ArrowLeft" size={18} />
          <span className="text-sm">Назад</span>
        </button>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{selectedSubjectData?.icon}</span>
          <div>
            <p className="text-white/60 text-xs uppercase tracking-wide">{examType === 'ege' ? 'ЕГЭ' : 'ОГЭ'}</p>
            <h1 className="text-white font-extrabold text-xl">{selectedSubjectData?.label}</h1>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3 max-w-xl mx-auto">

        {/* Прогресс по предмету */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">Твой прогресс</h3>
            <span className="text-xs text-gray-400">0 / {selectedSubjectData?.topics} тем</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: '0%' }} />
          </div>
          <p className="text-gray-400 text-xs">Начни первое занятие — прогресс появится здесь</p>
        </div>

        {/* Типы заданий */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-3">Что хочешь сделать?</h3>
          <div className="space-y-2.5">
            {TASK_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => handleStartTask(t.id)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 transition-all active:scale-[0.98] text-left"
              >
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
                  {t.icon}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-sm">{t.label}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{t.desc}</p>
                </div>
                {t.id === 'practice' && (
                  <span className="bg-purple-100 text-purple-600 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">Premium</span>
                )}
                <Icon name="ChevronRight" size={16} className="text-gray-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Быстрый старт */}
        <Button
          onClick={() => navigate('/session')}
          className="w-full h-14 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base rounded-2xl shadow-[0_4px_16px_rgba(99,102,241,0.35)] active:scale-[0.98] transition-all"
        >
          Начать занятие по теме <Icon name="ArrowRight" size={18} className="ml-1.5" />
        </Button>

        {/* До экзамена */}
        <div className="bg-amber-50 border border-amber-100 rounded-3xl p-4 flex items-center gap-3">
          <span className="text-2xl">⏰</span>
          <div>
            <p className="text-amber-800 font-bold text-sm">До экзамена {DAYS_TO_EXAM} дней</p>
            <p className="text-amber-600 text-xs mt-0.5">
              Нужно пройти {selectedSubjectData?.topics} тем — примерно {Math.ceil((selectedSubjectData?.topics || 0) / (DAYS_TO_EXAM / 7))} в неделю
            </p>
          </div>
        </div>

      </div>

      {showPaywall && (
        <PaywallSheet
          trigger="session_limit"
          daysToExam={DAYS_TO_EXAM}
          onClose={() => setShowPaywall(false)}
        />
      )}

      <BottomNav />
    </div>
  );
}