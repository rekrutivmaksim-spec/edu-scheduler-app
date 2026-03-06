import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import BottomNav from '@/components/BottomNav';
import { Subject, ExamType } from './types';

interface Props {
  examType: ExamType;
  subjects: Subject[];
  selectedSubject: Subject | null;
  onExamTypeChange: (et: ExamType) => void;
  onSubjectSelect: (sub: Subject) => void;
  onNext: () => void;
  getSubjectQuestions: (subId: string, et: ExamType) => unknown[];
  examTimes: Record<string, Record<string, number>>;
}

export default function MockExamSelect({
  examType,
  subjects,
  selectedSubject,
  onExamTypeChange,
  onSubjectSelect,
  onNext,
  getSubjectQuestions,
  examTimes,
}: Props) {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-nav">
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 px-5 pt-14 pb-8">
        <button onClick={() => navigate('/exam')} className="text-white/60 mb-4 flex items-center gap-1 text-sm">
          <Icon name="ArrowLeft" size={16} /> Подготовка к экзамену
        </button>
        <h1 className="text-white font-extrabold text-2xl mb-1">Пробный тест</h1>
        <p className="text-white/60 text-sm">Реальные задания с таймером и подсчётом баллов</p>
      </div>

      <div className="px-5 -mt-4">
        <div className="bg-white rounded-2xl p-1 flex mb-5 shadow-sm">
          {(['ege', 'oge'] as const).map(et => (
            <button
              key={et}
              onClick={() => onExamTypeChange(et)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${examType === et ? 'bg-indigo-600 text-white shadow' : 'text-gray-500'}`}
            >
              {et.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {subjects.map(sub => {
            const count = getSubjectQuestions(sub.id, examType).length;
            const time = examTimes[examType]?.[sub.id] ?? 180;
            const selected = selectedSubject?.id === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => count > 0 && onSubjectSelect(sub)}
                disabled={count === 0}
                className={`bg-white rounded-2xl p-4 text-left transition-all ${selected ? 'ring-2 ring-indigo-500 shadow-lg' : 'shadow-sm'} ${count === 0 ? 'opacity-50' : 'active:scale-[0.97]'}`}
              >
                <span className="text-2xl">{sub.icon}</span>
                <p className="font-bold text-gray-800 text-sm mt-2 leading-tight">{sub.name}</p>
                {count > 0 ? (
                  <p className="text-gray-400 text-xs mt-1">{count} заданий · {Math.floor(time / 60)}ч {time % 60}м</p>
                ) : (
                  <Badge variant="secondary" className="mt-1 text-[10px]">Скоро</Badge>
                )}
              </button>
            );
          })}
        </div>

        {selectedSubject && getSubjectQuestions(selectedSubject.id, examType).length > 0 && (
          <Button
            onClick={onNext}
            className="w-full mt-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-6 text-base font-bold"
          >
            Начать пробный тест
          </Button>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
