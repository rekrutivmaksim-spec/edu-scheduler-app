import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import UpgradeModal from '@/components/UpgradeModal';
import { trackActivity } from '@/lib/gamification';

const API_URL = 'https://functions.poehali.dev/bf62ca8a-918e-4f00-bfe4-c80b0ed0eab9';

interface StudyPlan {
  id: number;
  subject: string;
  exam_date: string;
  difficulty: string;
  total_days: number;
  completed_days: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
  days?: StudyDay[];
}

interface StudyDay {
  id: number;
  day_number: number;
  title: string;
  topics: string;
  minutes: number;
  is_completed: boolean;
  completed_at: string | null;
}

type View = 'list' | 'create' | 'detail';
type Difficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; color: string; bg: string; border: string }> = {
  easy: { label: 'Лёгкий', color: 'text-green-700', bg: 'bg-green-100', border: 'border-green-300' },
  medium: { label: 'Средний', color: 'text-amber-700', bg: 'bg-amber-100', border: 'border-amber-300' },
  hard: { label: 'Сложный', color: 'text-red-700', bg: 'bg-red-100', border: 'border-red-300' },
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Лёгкий',
  medium: 'Средний',
  hard: 'Сложный',
};

function getDaysWord(n: number): string {
  const abs = Math.abs(n);
  if (abs % 100 >= 11 && abs % 100 <= 19) return 'дней';
  const last = abs % 10;
  if (last === 1) return 'день';
  if (last >= 2 && last <= 4) return 'дня';
  return 'дней';
}

function getDaysUntil(dateStr: string): number {
  const exam = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  exam.setHours(0, 0, 0, 0);
  return Math.ceil((exam.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getDayDate(planCreatedAt: string, dayNumber: number): string {
  const start = new Date(planCreatedAt);
  start.setDate(start.getDate() + dayNumber - 1);
  return start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

const StudyPlan = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [view, setView] = useState<View>('list');
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [completingDayId, setCompletingDayId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Create form state
  const [subject, setSubject] = useState('');
  const [examDate, setExamDate] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [notes, setNotes] = useState('');

  // Premium gate
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);

  const authHeaders = useCallback(() => {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${token}`,
    };
  }, []);

  // --- Data loading ---

  const loadPlans = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}?action=list`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
        setIsPremium(true);
      } else if (res.status === 403) {
        setIsPremium(false);
        setPlans([]);
      } else {
        throw new Error('Failed to load plans');
      }
    } catch (error) {
      console.error('Failed to load plans:', error);
    }
  }, [authHeaders]);

  const loadPlanDetail = useCallback(async (planId: number) => {
    try {
      const res = await fetch(`${API_URL}?action=detail&plan_id=${planId}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSelectedPlan(data.plan);
        setView('detail');
      } else if (res.status === 403) {
        setIsPremium(false);
        setUpgradeModalOpen(true);
      } else {
        toast({ title: 'Ошибка', description: 'Не удалось загрузить план', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to load plan detail:', error);
      toast({ title: 'Ошибка сети', description: 'Проверьте подключение', variant: 'destructive' });
    }
  }, [authHeaders, toast]);

  useEffect(() => {
    const init = async () => {
      if (!authService.isAuthenticated()) {
        navigate('/login');
        return;
      }
      setLoading(true);
      await loadPlans();
      setLoading(false);
    };
    init();
  }, [navigate, loadPlans]);

  // Show upgrade modal when non-premium detected
  useEffect(() => {
    if (isPremium === false) {
      setUpgradeModalOpen(true);
    }
  }, [isPremium]);

  // --- Actions ---

  const handleGenerate = async () => {
    if (!subject.trim()) {
      toast({ title: 'Ошибка', description: 'Введите предмет', variant: 'destructive' });
      return;
    }
    if (!examDate) {
      toast({ title: 'Ошибка', description: 'Выберите дату экзамена', variant: 'destructive' });
      return;
    }
    const daysLeft = getDaysUntil(examDate);
    if (daysLeft < 1) {
      toast({ title: 'Ошибка', description: 'Дата экзамена должна быть в будущем', variant: 'destructive' });
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          action: 'generate',
          subject: subject.trim(),
          exam_date: examDate,
          difficulty,
          notes: notes.trim() || undefined,
        }),
      });

      if (res.status === 403) {
        setIsPremium(false);
        setUpgradeModalOpen(true);
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Не удалось создать план');
      }

      const data = await res.json();
      toast({
        title: 'План создан!',
        description: `План по "${data.plan.subject}" на ${data.plan.total_days} ${getDaysWord(data.plan.total_days)}`,
      });

      // Reset form
      setSubject('');
      setExamDate('');
      setDifficulty('medium');
      setNotes('');

      // Navigate to detail
      setSelectedPlan(data.plan);
      setView('detail');

      // Refresh list in background
      loadPlans();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось создать план',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleCompleteDay = async (dayId: number, planId: number) => {
    setCompletingDayId(dayId);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'complete_day', plan_id: planId, day_id: dayId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Не удалось завершить день');
      }

      toast({ title: 'День выполнен!', description: '+XP за учёбу!' });

      // Track gamification
      try {
        const result = await trackActivity('tasks_completed', 1);
        if (result?.new_achievements?.length) {
          result.new_achievements.forEach((ach) => {
            toast({
              title: 'Достижение!',
              description: `${ach.title} (+${ach.xp_reward} XP)`,
            });
          });
        }
      } catch {
        // gamification tracking is non-critical
      }

      // Update local state
      if (selectedPlan) {
        const updatedDays = (selectedPlan.days || []).map((d) =>
          d.id === dayId ? { ...d, is_completed: true, completed_at: new Date().toISOString() } : d
        );
        const newCompletedCount = updatedDays.filter((d) => d.is_completed).length;
        setSelectedPlan({
          ...selectedPlan,
          days: updatedDays,
          completed_days: newCompletedCount,
        });
      }

      // Refresh list in background
      loadPlans();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось завершить день',
        variant: 'destructive',
      });
    } finally {
      setCompletingDayId(null);
    }
  };

  const handleDelete = async (planId: number) => {
    setDeleting(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'delete', plan_id: planId }),
      });

      if (!res.ok) {
        throw new Error('Failed to delete plan');
      }

      toast({ title: 'План удалён', description: 'Ваши планы подготовки были удалены' });
      setSelectedPlan(null);
      setView('list');
      await loadPlans();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить план',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  // --- Loading state ---

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Icon name="Loader2" size={48} className="animate-spin text-purple-600" />
          <p className="text-purple-600 font-medium">Загрузка планов...</p>
        </div>
      </div>
    );
  }

  // --- Detail view ---

  if (view === 'detail' && selectedPlan) {
    const progressPercent =
      selectedPlan.total_days > 0
        ? Math.round((selectedPlan.completed_days / selectedPlan.total_days) * 100)
        : 0;
    const daysUntilExam = getDaysUntil(selectedPlan.exam_date);
    const diffConf = DIFFICULTY_CONFIG[selectedPlan.difficulty as Difficulty] || DIFFICULTY_CONFIG.medium;

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        {/* Header */}
        <header className="bg-white/70 backdrop-blur-xl border-b border-purple-200/50 sticky top-0 z-50 shadow-sm">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setView('list'); setSelectedPlan(null); }}
                  className="rounded-xl hover:bg-purple-100/50 h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
                >
                  <Icon name="ArrowLeft" size={20} className="text-purple-600 sm:w-6 sm:h-6" />
                </Button>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-2xl font-heading font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent truncate">
                    {selectedPlan.subject}
                  </h1>
                  <p className="text-[10px] sm:text-xs text-purple-600/70 font-medium">
                    Экзамен: {formatDate(selectedPlan.exam_date)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <Badge className={`${diffConf.bg} ${diffConf.color} ${diffConf.border} border text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5`}>
                  {diffConf.label}
                </Badge>
                {daysUntilExam > 0 && (
                  <Badge className="bg-purple-100 text-purple-700 border border-purple-300 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                    {daysUntilExam} {getDaysWord(daysUntilExam)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
          {/* Progress card */}
          <Card className="p-3 sm:p-5 border-2 border-purple-200/50 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg">
                  <span className="text-xl sm:text-2xl">🧠</span>
                </div>
                <div>
                  <h2 className="text-sm sm:text-lg font-bold text-gray-800">Общий прогресс</h2>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {selectedPlan.completed_days} из {selectedPlan.total_days} {getDaysWord(selectedPlan.total_days)} выполнено
                  </p>
                </div>
              </div>
              <span className="text-xl sm:text-2xl font-bold text-purple-600">{progressPercent}%</span>
            </div>
            <div className="relative w-full h-2.5 sm:h-3 rounded-full bg-purple-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 transition-all duration-700 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </Card>

          {/* Days timeline */}
          <div className="space-y-2 sm:space-y-3">
            {(selectedPlan.days || []).map((day) => {
              const isCompleting = completingDayId === day.id;
              return (
                <Card
                  key={day.id}
                  className={`overflow-hidden transition-all duration-300 hover:shadow-md ${
                    day.is_completed
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                      : 'bg-white border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="p-3 sm:p-5">
                    <div className="flex items-start gap-2.5 sm:gap-4">
                      {/* Completion button */}
                      <button
                        onClick={() => !day.is_completed && handleCompleteDay(day.id, selectedPlan.id)}
                        disabled={day.is_completed || isCompleting}
                        className={`mt-0.5 flex-shrink-0 w-7 h-7 sm:w-9 sm:h-9 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                          day.is_completed
                            ? 'bg-green-500 border-green-500 text-white scale-100'
                            : isCompleting
                            ? 'border-purple-400 bg-purple-50'
                            : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50 hover:scale-110 cursor-pointer'
                        }`}
                      >
                        {isCompleting ? (
                          <Icon name="Loader2" size={14} className="animate-spin text-purple-500 sm:w-4 sm:h-4" />
                        ) : day.is_completed ? (
                          <Icon name="Check" size={14} className="text-white sm:w-4 sm:h-4" />
                        ) : null}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-[10px] sm:text-xs px-1.5 py-0 ${
                              day.is_completed
                                ? 'bg-green-100 text-green-700 border-green-300'
                                : 'bg-purple-50 text-purple-600 border-purple-200'
                            }`}
                          >
                            День {day.day_number}
                          </Badge>
                          <span className="text-[10px] sm:text-xs text-gray-400">
                            {getDayDate(selectedPlan.created_at, day.day_number)}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] sm:text-xs px-1.5 py-0 bg-blue-50 text-blue-600 border-blue-200"
                          >
                            <Icon name="Clock" size={10} className="mr-0.5" />
                            {day.minutes} мин
                          </Badge>
                        </div>

                        <h3
                          className={`text-sm sm:text-base font-bold mt-1 sm:mt-1.5 ${
                            day.is_completed ? 'text-green-700 line-through decoration-2' : 'text-gray-800'
                          }`}
                        >
                          {day.title}
                        </h3>

                        <p
                          className={`text-xs sm:text-sm mt-1 leading-relaxed whitespace-pre-line ${
                            day.is_completed ? 'text-green-600/70' : 'text-gray-600'
                          }`}
                        >
                          {day.topics}
                        </p>

                        {day.is_completed && day.completed_at && (
                          <p className="text-[10px] text-green-500 mt-1.5 sm:mt-2 flex items-center gap-1">
                            <Icon name="CheckCircle2" size={10} />
                            Выполнено {new Date(day.completed_at).toLocaleDateString('ru-RU', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Delete button */}
          <div className="pt-3 sm:pt-4 pb-6 sm:pb-8">
            <Button
              variant="outline"
              onClick={() => handleDelete(selectedPlan.id)}
              disabled={deleting}
              className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 h-10 sm:h-11 text-sm"
            >
              {deleting ? (
                <Icon name="Loader2" size={18} className="animate-spin mr-2" />
              ) : (
                <Icon name="Trash2" size={18} className="mr-2" />
              )}
              {deleting ? 'Удаление...' : 'Удалить план'}
            </Button>
          </div>
        </main>

        <UpgradeModal
          open={upgradeModalOpen}
          onClose={() => setUpgradeModalOpen(false)}
          feature="План подготовки"
          description="ИИ создаст персональный план на основе твоих материалов"
          trigger="general"
        />
      </div>
    );
  }

  // --- Create form view ---

  if (view === 'create') {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 1);
    const minDateStr = minDate.toISOString().split('T')[0];

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <header className="bg-white/70 backdrop-blur-xl border-b border-purple-200/50 sticky top-0 z-50 shadow-sm">
          <div className="max-w-2xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setView('list')}
                className="rounded-xl hover:bg-purple-100/50 h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
              >
                <Icon name="ArrowLeft" size={20} className="text-purple-600 sm:w-6 sm:h-6" />
              </Button>
              <div>
                <h1 className="text-lg sm:text-2xl font-heading font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Новый план подготовки
                </h1>
                <p className="text-[10px] sm:text-xs text-purple-600/70 font-medium">ИИ сгенерирует персональный план</p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
          <Card className="p-3 sm:p-5 md:p-8 border-2 border-purple-200/50 shadow-lg">
            <div className="space-y-4 sm:space-y-6">
              {/* Subject */}
              <div>
                <Label className="text-sm font-semibold text-gray-700">Предмет *</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Например: Математический анализ"
                  className="mt-1.5 sm:mt-2 h-10 sm:h-11 text-sm border-2 focus:border-purple-400"
                  maxLength={200}
                />
              </div>

              {/* Exam date */}
              <div>
                <Label className="text-sm font-semibold text-gray-700">Дата экзамена *</Label>
                <Input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  min={minDateStr}
                  className="mt-1.5 sm:mt-2 h-10 sm:h-11 text-sm border-2 focus:border-purple-400"
                />
                {examDate && getDaysUntil(examDate) > 0 && (
                  <p className="text-xs text-purple-600 mt-1.5 flex items-center gap-1">
                    <Icon name="Calendar" size={12} />
                    {getDaysUntil(examDate)} {getDaysWord(getDaysUntil(examDate))} до экзамена (план на {Math.min(getDaysUntil(examDate), 30)} {getDaysWord(Math.min(getDaysUntil(examDate), 30))})
                  </p>
                )}
              </div>

              {/* Difficulty */}
              <div>
                <Label className="text-sm font-semibold text-gray-700">Сложность</Label>
                <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-1.5 sm:mt-2">
                  {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => {
                    const isActive = difficulty === d;
                    const conf = DIFFICULTY_CONFIG[d];
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDifficulty(d)}
                        className={`py-2.5 sm:py-3 px-2 sm:px-3 rounded-xl border-2 text-xs sm:text-sm font-semibold transition-all duration-200 ${
                          isActive
                            ? `${conf.bg} ${conf.color} ${conf.border} shadow-md scale-[1.02]`
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {d === 'easy' && '🟢 '}
                        {d === 'medium' && '🟡 '}
                        {d === 'hard' && '🔴 '}
                        {DIFFICULTY_LABELS[d]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-sm font-semibold text-gray-700">Заметки (необязательно)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Акцент на темах, слабые места и т.д."
                  className="mt-1.5 sm:mt-2 min-h-[80px] text-sm border-2 focus:border-purple-400 resize-none"
                  maxLength={1000}
                />
              </div>

              {/* Generate button */}
              <Button
                onClick={handleGenerate}
                disabled={generating || !subject.trim() || !examDate}
                className="w-full h-11 sm:h-14 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 shadow-lg shadow-purple-500/30 rounded-xl text-sm sm:text-base font-bold transition-all duration-300 hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Icon name="Loader2" size={20} className="animate-spin" />
                    <span>Генерация...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Icon name="Sparkles" size={20} />
                    <span>Сгенерировать план</span>
                  </div>
                )}
              </Button>

              {generating && (
                <div className="text-center">
                  <p className="text-xs text-purple-600/70 animate-pulse">
                    Это может занять 10-20 секунд. ИИ анализирует материалы и составляет план...
                  </p>
                </div>
              )}
            </div>
          </Card>
        </main>

        <UpgradeModal
          open={upgradeModalOpen}
          onClose={() => setUpgradeModalOpen(false)}
          feature="План подготовки"
          description="ИИ создаст персональный план на основе твоих материалов"
          trigger="general"
        />
      </div>
    );
  }

  // --- List view (default) ---

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-purple-200/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                className="rounded-xl hover:bg-purple-100/50 h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
              >
                <Icon name="ArrowLeft" size={20} className="text-purple-600 sm:w-6 sm:h-6" />
              </Button>
              <div>
                <h1 className="text-lg sm:text-2xl font-heading font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-2">
                  <span>🧠</span> План подготовки
                </h1>
                <p className="text-[10px] sm:text-xs text-purple-600/70 font-medium">Подготовка к экзаменам с ИИ</p>
              </div>
            </div>
            <Button
              onClick={() => setView('create')}
              className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 shadow-lg shadow-purple-500/30 rounded-xl text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-5"
            >
              <Icon name="Plus" size={16} className="mr-1 sm:mr-1.5" />
              Создать план
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 space-y-3 sm:space-y-4">
        {plans.length === 0 ? (
          /* Empty state */
          <Card className="p-6 sm:p-16 text-center border-2 border-dashed border-purple-200">
            <div className="flex flex-col items-center gap-3 sm:gap-4">
              <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center">
                <span className="text-3xl sm:text-5xl">🧠</span>
              </div>
              <div>
                <h3 className="text-base sm:text-xl font-bold text-gray-800 mb-1 sm:mb-2">Пока нет планов</h3>
                <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
                  Создайте свой первый план подготовки к экзамену с помощью ИИ
                </p>
              </div>
              <Button
                onClick={() => setView('create')}
                className="mt-1 sm:mt-2 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 shadow-lg shadow-purple-500/30 rounded-xl h-10 sm:h-11 px-5 sm:px-6 text-sm"
              >
                <Icon name="Sparkles" size={18} className="mr-2" />
                Создать план
              </Button>
            </div>
          </Card>
        ) : (
          /* Plans list */
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            {plans.map((plan) => {
              const progressPercent =
                plan.total_days > 0 ? Math.round((plan.completed_days / plan.total_days) * 100) : 0;
              const daysUntilExam = getDaysUntil(plan.exam_date);
              const diffConf = DIFFICULTY_CONFIG[plan.difficulty as Difficulty] || DIFFICULTY_CONFIG.medium;

              return (
                <Card
                  key={plan.id}
                  onClick={() => loadPlanDetail(plan.id)}
                  className="p-3 sm:p-5 cursor-pointer bg-white border-2 border-gray-100 hover:border-purple-300 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300 hover:scale-[1.01]"
                >
                  <div className="flex items-start gap-2.5 sm:gap-4">
                    {/* Icon */}
                    <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg flex-shrink-0">
                      <span className="text-lg sm:text-2xl">🧠</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-bold text-gray-800 truncate">
                          {plan.subject}
                        </h3>
                        <Badge
                          className={`${diffConf.bg} ${diffConf.color} ${diffConf.border} border text-[10px] px-1.5 py-0`}
                        >
                          {diffConf.label}
                        </Badge>
                      </div>

                      <p className="text-xs text-gray-500 mt-0.5 sm:mt-1">
                        Экзамен: {formatDate(plan.exam_date)}
                      </p>

                      {/* Progress bar */}
                      <div className="mt-2 sm:mt-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] sm:text-xs text-gray-400 font-medium">
                            {plan.completed_days}/{plan.total_days} {getDaysWord(plan.total_days)}
                          </span>
                          <span className="text-[10px] sm:text-xs font-bold text-purple-600">
                            {progressPercent}%
                          </span>
                        </div>
                        <div className="relative w-full h-1.5 sm:h-2 rounded-full bg-purple-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2 flex-wrap">
                        {daysUntilExam > 0 ? (
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              daysUntilExam <= 3
                                ? 'border-red-300 text-red-600 bg-red-50'
                                : daysUntilExam <= 7
                                ? 'border-amber-300 text-amber-600 bg-amber-50'
                                : 'border-purple-200 text-purple-600 bg-purple-50'
                            }`}
                          >
                            <Icon name="Clock" size={10} className="mr-0.5" />
                            {daysUntilExam} {getDaysWord(daysUntilExam)} осталось
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 border-gray-300 text-gray-500 bg-gray-50"
                          >
                            Экзамен прошёл
                          </Badge>
                        )}
                        {progressPercent === 100 && (
                          <Badge className="bg-green-100 text-green-700 border border-green-300 text-[10px] px-1.5 py-0">
                            Выполнено!
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <Icon name="ChevronRight" size={20} className="text-gray-400 flex-shrink-0 mt-1" />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <UpgradeModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        feature="План подготовки"
        description="ИИ создаст персональный план на основе твоих материалов"
        trigger="general"
      />
    </div>
  );
};

export default StudyPlan;