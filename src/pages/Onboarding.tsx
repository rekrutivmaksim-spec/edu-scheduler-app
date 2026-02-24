import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { authService } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { COMPANIONS, type CompanionId } from '@/lib/companion';

const AUTH_URL = 'https://functions.poehali.dev/0c04829e-3c05-40bd-a560-5dcd6c554dd5';

const GOALS = [
  { id: 'ege', label: 'Готовлюсь к ЕГЭ', icon: '🎯', desc: '11 класс' },
  { id: 'oge', label: 'Готовлюсь к ОГЭ', icon: '📚', desc: '9 класс' },
  { id: 'university', label: 'Учусь в ВУЗе', icon: '🎓', desc: 'Студент' },
  { id: 'other', label: 'Другое', icon: '✨', desc: 'Саморазвитие' },
];

const GRADES_EGE = ['10 класс', '11 класс'];
const GRADES_OGE = ['8 класс', '9 класс'];
const COURSES_UNI = ['1 курс', '2 курс', '3 курс', '4 курс', '5 курс', '6 курс'];

const SUBJECTS_EGE = [
  'Математика (база)', 'Математика (профиль)', 'Русский язык',
  'Физика', 'Химия', 'Биология', 'История', 'Обществознание',
  'Информатика', 'Литература', 'География', 'Английский язык',
];

const SUBJECTS_OGE = [
  'Математика', 'Русский язык', 'Физика', 'Химия',
  'Биология', 'История', 'Обществознание', 'Информатика',
  'География', 'Английский язык',
];

const EGE_DATES: { label: string; value: string }[] = [
  { label: 'Май 2025', value: '2025-05-26' },
  { label: 'Июнь 2025', value: '2025-06-02' },
  { label: 'Май 2026', value: '2026-05-25' },
  { label: 'Июнь 2026', value: '2026-06-01' },
];

const OGE_DATES: { label: string; value: string }[] = [
  { label: 'Май 2025', value: '2025-05-20' },
  { label: 'Июнь 2025', value: '2025-06-09' },
  { label: 'Май 2026', value: '2026-05-19' },
  { label: 'Июнь 2026', value: '2026-06-08' },
];

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.max(0, Math.ceil((d.getTime() - now.getTime()) / 86400000));
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState('');
  const [companion, setCompanion] = useState<CompanionId | ''>('');
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [examDate, setExamDate] = useState('');
  const [saving, setSaving] = useState(false);

  const isExam = goal === 'ege' || goal === 'oge';
  const gradeOptions = goal === 'ege' ? GRADES_EGE : goal === 'oge' ? GRADES_OGE : COURSES_UNI;
  const subjectOptions = goal === 'ege' ? SUBJECTS_EGE : SUBJECTS_OGE;
  const dateOptions = goal === 'ege' ? EGE_DATES : OGE_DATES;

  // шаги: 0=цель, 1=помощник, 2=класс, 3=предмет(exam only), 4=дата(exam only)
  const totalSteps = isExam ? 5 : 3;

  const handleNext = () => {
    if (step < totalSteps - 1) setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1);
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const token = authService.getToken();
      if (token && token !== 'guest_token') {
        const res = await fetch(AUTH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: 'update_profile',
            full_name: authService.getUser()?.full_name || '',
            goal,
            grade,
            companion: companion || 'owl',
            exam_type: isExam ? goal : null,
            exam_subject: isExam ? subject : null,
            exam_date: isExam && examDate ? examDate : null,
            onboarding_completed: true,
          }),
        });
        if (!res.ok) {
          toast({ title: 'Ошибка сохранения', description: 'Не удалось сохранить профиль. Попробуй снова.', variant: 'destructive' });
          setSaving(false);
          return;
        }
        const updated = await authService.verifyToken();
        if (updated) authService.setUser(updated);
      }
    } catch {
      toast({ title: 'Нет соединения', description: 'Проверь интернет и попробуй снова.', variant: 'destructive' });
      setSaving(false);
      return;
    } finally {
      setSaving(false);
    }
    navigate('/');
  };

  const canNext = () => {
    if (step === 0) return !!goal;
    if (step === 1) return !!companion;
    if (step === 2) return !!grade;
    if (step === 3) return !!subject;
    if (step === 4) return !!examDate;
    return true;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 flex flex-col">
      {/* Прогресс */}
      <div className="px-6 pt-14 pb-4">
        <div className="flex items-center gap-2 mb-6">
          {step > 0 && (
            <button onClick={handleBack} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center mr-1">
              <Icon name="ChevronLeft" size={18} className="text-white" />
            </button>
          )}
          <div className="flex-1 flex gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= step ? 'bg-white' : 'bg-white/30'}`}
              />
            ))}
          </div>
          <span className="text-white/60 text-xs ml-2">{step + 1}/{totalSteps}</span>
        </div>

        <p className="text-white/70 text-sm">Настройка под тебя</p>
        <h1 className="text-white font-bold text-2xl mt-1">
          {step === 0 && 'Какова твоя цель?'}
          {step === 1 && 'Выбери помощника'}
          {step === 2 && (goal === 'university' ? 'На каком курсе?' : 'В каком классе?')}
          {step === 3 && 'Главный предмет?'}
          {step === 4 && 'Когда экзамен?'}
        </h1>
        <p className="text-white/60 text-sm mt-1">
          {step === 0 && 'Это поможет подобрать темы именно для тебя'}
          {step === 1 && 'Он будет учиться вместе с тобой и расти'}
          {step === 2 && 'Адаптируем программу под твой уровень'}
          {step === 3 && 'Начнём с него — остальные добавишь позже'}
          {step === 4 && 'Рассчитаем темп подготовки'}
        </p>
      </div>

      {/* Карточки */}
      <div className="flex-1 bg-white rounded-t-[2rem] px-5 pt-6 pb-8 flex flex-col">
        <div className="flex-1">

          {/* Шаг 0: Цель */}
          {step === 0 && (
            <div className="grid grid-cols-2 gap-3">
              {GOALS.map(g => (
                <button
                  key={g.id}
                  onClick={() => setGoal(g.id)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    goal === g.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-100 bg-gray-50 hover:border-indigo-200'
                  }`}
                >
                  <span className="text-3xl block mb-2">{g.icon}</span>
                  <p className="font-semibold text-gray-900 text-sm leading-tight">{g.label}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{g.desc}</p>
                </button>
              ))}
            </div>
          )}

          {/* Шаг 1: Выбор помощника */}
          {step === 1 && (
            <div className="grid grid-cols-1 gap-3">
              {COMPANIONS.map(c => {
                const isSelected = companion === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCompanion(c.id)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-100 bg-gray-50 hover:border-indigo-200'
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${c.style} flex items-center justify-center text-3xl flex-shrink-0 shadow-sm`}>
                      {c.emoji}
                    </div>
                    <div className="flex-1">
                      <p className={`font-bold text-base ${isSelected ? 'text-indigo-700' : 'text-gray-800'}`}>{c.name}</p>
                      <p className="text-gray-400 text-sm mt-0.5">{c.description}</p>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">✓</span>
                      </div>
                    )}
                  </button>
                );
              })}
              <p className="text-gray-400 text-xs text-center mt-1">Можно сменить позже в профиле</p>
            </div>
          )}

          {/* Шаг 2: Класс/курс */}
          {step === 2 && (
            <div className="flex flex-col gap-2.5">
              {gradeOptions.map(g => (
                <button
                  key={g}
                  onClick={() => setGrade(g)}
                  className={`py-4 px-5 rounded-2xl border-2 text-left font-medium transition-all ${
                    grade === g
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-indigo-200'
                  }`}
                >
                  {g}
                </button>
              ))}
              {(goal === 'other') && (
                <button
                  onClick={() => setGrade('—')}
                  className={`py-4 px-5 rounded-2xl border-2 text-left font-medium transition-all ${
                    grade === '—'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-indigo-200'
                  }`}
                >
                  Не важно
                </button>
              )}
            </div>
          )}

          {/* Шаг 3: Предмет (только для ЕГЭ/ОГЭ) */}
          {step === 3 && isExam && (
            <div className="grid grid-cols-2 gap-2.5">
              {subjectOptions.map(s => (
                <button
                  key={s}
                  onClick={() => setSubject(s)}
                  className={`py-3 px-3 rounded-xl border-2 text-sm text-left font-medium transition-all ${
                    subject === s
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-indigo-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Шаг 4: Дата экзамена */}
          {step === 4 && isExam && (
            <div className="flex flex-col gap-3">
              {dateOptions.map(d => {
                const days = daysUntil(d.value);
                const isSelected = examDate === d.value;
                return (
                  <button
                    key={d.value}
                    onClick={() => setExamDate(d.value)}
                    className={`py-4 px-5 rounded-2xl border-2 flex items-center justify-between transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-100 bg-gray-50 hover:border-indigo-200'
                    }`}
                  >
                    <div className="text-left">
                      <p className={`font-semibold ${isSelected ? 'text-indigo-700' : 'text-gray-800'}`}>{d.label}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{d.value}</p>
                    </div>
                    {days > 0 && (
                      <span className={`text-sm font-bold px-3 py-1 rounded-xl ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                        {days} дн.
                      </span>
                    )}
                  </button>
                );
              })}
              <button
                onClick={() => setExamDate('custom')}
                className={`py-4 px-5 rounded-2xl border-2 text-left font-medium transition-all ${
                  examDate === 'custom'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-indigo-200'
                }`}
              >
                Ещё не знаю точно
              </button>
            </div>
          )}
        </div>

        {/* Кнопки */}
        <div className="mt-6">
          {step < totalSteps - 1 ? (
            <Button
              onClick={handleNext}
              disabled={!canNext()}
              className="w-full h-14 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base rounded-2xl shadow-[0_4px_20px_rgba(99,102,241,0.35)] disabled:opacity-40"
            >
              Продолжить <Icon name="ArrowRight" size={18} className="ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={!canNext() || saving}
              className="w-full h-14 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base rounded-2xl shadow-[0_4px_20px_rgba(99,102,241,0.35)] disabled:opacity-40"
            >
              {saving ? 'Сохраняю...' : 'Начать обучение 🚀'}
            </Button>
          )}

          {step === 0 && (
            <button
              onClick={() => navigate('/')}
              className="w-full text-center text-gray-400 text-sm mt-3 py-2"
            >
              Пропустить
            </button>
          )}
        </div>
      </div>
    </div>
  );
}