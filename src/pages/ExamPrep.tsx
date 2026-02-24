import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import BottomNav from '@/components/BottomNav';
import PaywallSheet from '@/components/PaywallSheet';
import { authService } from '@/lib/auth';

const STUDY_PLAN_URL = 'https://functions.poehali.dev/bf62ca8a-918e-4f00-bfe4-c80b0ed0eab9';

type ExamType = 'ege' | 'oge' | null;

const SUBJECTS_EGE = [
  { id: 'math', label: 'Математика', icon: '📐' },
  { id: 'russian', label: 'Русский язык', icon: '📝' },
  { id: 'physics', label: 'Физика', icon: '⚡' },
  { id: 'chemistry', label: 'Химия', icon: '🧪' },
  { id: 'biology', label: 'Биология', icon: '🌿' },
  { id: 'history', label: 'История', icon: '🏛️' },
  { id: 'society', label: 'Обществознание', icon: '⚖️' },
  { id: 'informatics', label: 'Информатика', icon: '💻' },
  { id: 'english', label: 'Английский', icon: '🇬🇧' },
  { id: 'geography', label: 'География', icon: '🌍' },
];

const SUBJECTS_OGE = [
  { id: 'math', label: 'Математика', icon: '📐' },
  { id: 'russian', label: 'Русский язык', icon: '📝' },
  { id: 'physics', label: 'Физика', icon: '⚡' },
  { id: 'chemistry', label: 'Химия', icon: '🧪' },
  { id: 'biology', label: 'Биология', icon: '🌿' },
  { id: 'history', label: 'История', icon: '🏛️' },
  { id: 'society', label: 'Обществознание', icon: '⚖️' },
  { id: 'informatics', label: 'Информатика', icon: '💻' },
  { id: 'english', label: 'Английский', icon: '🇬🇧' },
  { id: 'geography', label: 'География', icon: '🌍' },
];

interface PlanDay {
  id: number;
  day_number: number;
  title: string;
  topics: string;
  minutes: number;
  is_completed: boolean;
}

interface StudyPlan {
  id: number;
  subject: string;
  exam_date: string;
  difficulty: string;
  total_days: number;
  completed_days: number;
  days: PlanDay[];
}

function daysUntilExam(examDate?: string | null): number {
  if (!examDate || examDate === 'custom') return 0;
  const d = new Date(examDate);
  const now = new Date();
  return Math.max(0, Math.ceil((d.getTime() - now.getTime()) / 86400000));
}

function pluralDays(n: number) {
  if (n === 1) return 'день';
  if (n >= 2 && n <= 4) return 'дня';
  return 'дней';
}

function getSubjectLabel(id: string, subjects: typeof SUBJECTS_EGE) {
  return subjects.find(s => s.id === id)?.label || id;
}

function getSubjectIcon(id: string, subjects: typeof SUBJECTS_EGE) {
  return subjects.find(s => s.id === id)?.icon || '📚';
}

export default function ExamPrep() {
  const navigate = useNavigate();
  const user = authService.getUser();
  const token = authService.getToken();

  const profileExamType = (user?.exam_type || user?.goal) as ExamType | undefined;
  const profileSubject = user?.exam_subject;
  const profileExamDate = user?.exam_date;

  const [examType, setExamType] = useState<ExamType>(profileExamType || null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(profileSubject || null);
  const [showPaywall, setShowPaywall] = useState(false);

  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [completingDay, setCompletingDay] = useState<number | null>(null);

  const daysLeft = daysUntilExam(profileExamDate);

  const subjects = examType === 'oge' ? SUBJECTS_OGE : SUBJECTS_EGE;

  const fetchPlan = useCallback(async (subject: string, examDate: string) => {
    if (!token) return;
    setPlanLoading(true);
    setPlanError(null);
    try {
      const res = await fetch(`${STUDY_PLAN_URL}?action=list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const existing = (data.plans || []).find(
        (p: StudyPlan) => p.subject.toLowerCase() === subject.toLowerCase()
      );
      if (existing) {
        const detailRes = await fetch(`${STUDY_PLAN_URL}?action=detail&plan_id=${existing.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const detailData = await detailRes.json();
        setPlan(detailData.plan);
      } else {
        await generatePlan(subject, examDate);
      }
    } catch {
      setPlanError('Не удалось загрузить план');
    } finally {
      setPlanLoading(false);
    }
  }, [token]);

  const generatePlan = async (subject: string, examDate: string) => {
    if (!token) return;
    setGenerating(true);
    setPlanError(null);
    try {
      const res = await fetch(STUDY_PLAN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'generate',
          subject,
          exam_date: examDate,
          difficulty: 'medium',
        }),
      });
      const data = await res.json();
      if (data.plan) {
        const detailRes = await fetch(`${STUDY_PLAN_URL}?action=detail&plan_id=${data.plan.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const detailData = await detailRes.json();
        setPlan(detailData.plan);
      } else if (data.error) {
        if (res.status === 403) {
          setShowPaywall(true);
        } else {
          setPlanError(data.error);
        }
      }
    } catch {
      setPlanError('Не удалось создать план');
    } finally {
      setGenerating(false);
    }
  };

  const completeDay = async (dayId: number) => {
    if (!token || !plan) return;
    setCompletingDay(dayId);
    try {
      await fetch(STUDY_PLAN_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'complete_day', day_id: dayId }),
      });
      setPlan(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          completed_days: prev.completed_days + 1,
          days: prev.days.map(d => d.id === dayId ? { ...d, is_completed: true } : d),
        };
      });
    } catch {
      // silent
    } finally {
      setCompletingDay(null);
    }
  };

  useEffect(() => {
    if (selectedSubject && profileExamDate && daysLeft > 0) {
      const subjectLabel = getSubjectLabel(selectedSubject, subjects);
      fetchPlan(subjectLabel, profileExamDate);
    }
  }, [selectedSubject, profileExamDate]);

  if (!examType) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 px-4 pt-12 pb-8">
          <h1 className="text-white font-extrabold text-2xl mb-1">Подготовка к экзамену</h1>
          <p className="text-white/60 text-sm">Персональный план под твой предмет и дату</p>
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
                <p className="text-indigo-800 font-bold text-sm">До экзамена {daysLeft} {pluralDays(daysLeft)}</p>
                <p className="text-indigo-500 text-xs mt-0.5">Выбери предмет — составим персональный план</p>
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
          <p className="text-white/60 text-sm mt-1">ИИ составит план под твою дату экзамена</p>
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
                <p className="font-bold text-gray-800 text-sm leading-tight">{s.label}</p>
              </button>
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const subjectLabel = getSubjectLabel(selectedSubject, subjects);
  const subjectIcon = getSubjectIcon(selectedSubject, subjects);
  const progressPct = plan && plan.total_days > 0
    ? Math.round((plan.completed_days / plan.total_days) * 100)
    : 0;

  const needsDate = !profileExamDate || daysLeft <= 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 px-4 pt-12 pb-6">
        <button onClick={() => setSelectedSubject(null)} className="flex items-center gap-2 text-white/70 mb-3">
          <Icon name="ArrowLeft" size={18} />
          <span className="text-sm">Назад</span>
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{subjectIcon}</span>
            <div>
              <p className="text-white/60 text-xs uppercase tracking-wide">{examType === 'ege' ? 'ЕГЭ' : 'ОГЭ'}</p>
              <h1 className="text-white font-extrabold text-xl">{subjectLabel}</h1>
            </div>
          </div>
          {daysLeft > 0 && (
            <div className="text-right">
              <p className="text-white font-bold text-xl">{daysLeft}</p>
              <p className="text-white/60 text-xs">{pluralDays(daysLeft)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3 max-w-xl mx-auto">

        {needsDate && (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 flex items-start gap-3">
            <span className="text-2xl mt-0.5">📅</span>
            <div className="flex-1">
              <p className="font-bold text-amber-800 text-sm">Укажи дату экзамена</p>
              <p className="text-amber-600 text-xs mt-0.5 mb-3">Без даты ИИ не сможет составить план</p>
              <Button size="sm" onClick={() => navigate('/profile')} className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs h-8">
                Указать в профиле
              </Button>
            </div>
          </div>
        )}

        {!needsDate && (planLoading || generating) && (
          <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
            <p className="text-gray-600 font-medium text-sm">
              {generating ? 'ИИ составляет твой план...' : 'Загружаю план...'}
            </p>
            <p className="text-gray-400 text-xs text-center">Анализирую предмет и дату экзамена</p>
          </div>
        )}

        {planError && (
          <div className="bg-red-50 border border-red-100 rounded-3xl p-4 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <p className="text-red-700 font-medium text-sm">{planError}</p>
              <button
                className="text-red-500 text-xs mt-1 underline"
                onClick={() => generatePlan(subjectLabel, profileExamDate!)}
              >
                Попробовать снова
              </button>
            </div>
          </div>
        )}

        {plan && !planLoading && !generating && (
          <>
            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-gray-800">Прогресс</h3>
                <span className="text-xs text-gray-400 font-medium">{plan.completed_days} / {plan.total_days} дней</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-gray-400 text-xs">{progressPct}% выполнено</p>
            </div>

            <div className="space-y-2">
              {plan.days.map(day => (
                <div
                  key={day.id}
                  className={`bg-white rounded-2xl p-4 shadow-sm border-2 transition-all ${
                    day.is_completed ? 'border-green-100 opacity-70' : 'border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold ${
                      day.is_completed
                        ? 'bg-green-100 text-green-600'
                        : 'bg-indigo-50 text-indigo-600'
                    }`}>
                      {day.is_completed ? '✓' : day.day_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm leading-snug ${day.is_completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                        {day.title}
                      </p>
                      <p className="text-gray-500 text-xs mt-1 leading-relaxed">{day.topics}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[11px] text-gray-400 flex items-center gap-1">
                          <Icon name="Clock" size={11} />
                          {day.minutes} мин
                        </span>
                        {!day.is_completed && (
                          <button
                            onClick={() => completeDay(day.id)}
                            disabled={completingDay === day.id}
                            className="text-[11px] text-indigo-500 font-medium hover:text-indigo-700 transition-colors ml-auto"
                          >
                            {completingDay === day.id ? 'Сохраняю...' : '✓ Выполнено'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => generatePlan(subjectLabel, profileExamDate!)}
              className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Обновить план
            </button>
          </>
        )}

        {!needsDate && !planLoading && !generating && !plan && !planError && (
          <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col items-center gap-3 text-center">
            <span className="text-4xl">🤖</span>
            <p className="font-bold text-gray-800">Готов составить план</p>
            <p className="text-gray-400 text-sm">ИИ разобьёт подготовку к {examType === 'ege' ? 'ЕГЭ' : 'ОГЭ'} по дням</p>
            <Button
              onClick={() => generatePlan(subjectLabel, profileExamDate!)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-6"
            >
              Составить план
            </Button>
          </div>
        )}
      </div>

      {showPaywall && <PaywallSheet trigger="ai_limit" onClose={() => setShowPaywall(false)} />}
      <BottomNav />
    </div>
  );
}