import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';
import NetworkError from '@/components/NetworkError';

const API_URL = 'https://functions.poehali.dev/cb70f006-6ec2-4603-a46d-92eb7a854230';

interface Subject {
  id: number;
  name: string;
  semester: number;
  credit_units: number;
  grade_type: string;
  created_at: string;
  grades: Grade[];
}

interface Grade {
  id: number;
  subject_id: number;
  grade: number;
  grade_label: string;
  date: string;
  note: string;
}

interface Stats {
  overall_gpa: number;
  semester_gpa: Record<string, number>;
  scholarship: string | null;
  total_subjects: number;
  graded_subjects: number;
}

const gradeColors: Record<number, string> = {
  5: 'bg-emerald-500',
  4: 'bg-blue-500',
  3: 'bg-amber-500',
  2: 'bg-red-500',
};

const gradeLabels: Record<number, string> = {
  5: 'Отлично',
  4: 'Хорошо',
  3: 'Удовл.',
  2: 'Неудовл.',
};

const gradeTypeLabels: Record<string, string> = {
  exam: 'Экзамен',
  zachet: 'Зачёт',
  diff_zachet: 'Дифф. зачёт',
  coursework: 'Курсовая',
};

const GradeBook = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Record<number, Subject[]>>({});
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState<number>(1);
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [isAddingGrade, setIsAddingGrade] = useState<number | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [subjectCount, setSubjectCount] = useState(0);

  const [subjectForm, setSubjectForm] = useState({
    name: '',
    semester: '1',
    credit_units: '1',
    grade_type: 'exam',
  });

  const [gradeForm, setGradeForm] = useState({
    grade: '5',
    note: '',
  });

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate('/login');
      return;
    }
    loadData();
  }, [navigate]);

  const apiCall = async (params: string, options?: RequestInit) => {
    const token = authService.getToken();
    const res = await fetch(`${API_URL}${params}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options?.headers || {}),
      },
    });
    return res;
  };

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const [subjectsRes, statsRes] = await Promise.all([
        apiCall('?action=subjects'),
        apiCall('?action=stats'),
      ]);

      if (subjectsRes.ok) {
        const data = await subjectsRes.json();
        setSubjects(data.subjects || {});
        setIsPremium(data.is_premium || false);
        let count = 0;
        Object.values(data.subjects || {}).forEach((arr) => { count += (arr as Subject[]).length; });
        setSubjectCount(count);
        const semesters = Object.keys(data.subjects || {}).map(Number).sort((a, b) => b - a);
        if (semesters.length > 0) setSelectedSemester(semesters[0]);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSubject = async () => {
    if (!subjectForm.name.trim()) {
      toast({ title: 'Введите название предмета', variant: 'destructive' });
      return;
    }
    try {
      const res = await apiCall('', {
        method: 'POST',
        body: JSON.stringify({
          action: 'add_subject',
          name: subjectForm.name.trim(),
          semester: parseInt(subjectForm.semester),
          credit_units: parseFloat(subjectForm.credit_units),
          grade_type: subjectForm.grade_type,
        }),
      });
      if (res.ok) {
        toast({ title: 'Предмет добавлен' });
        setIsAddingSubject(false);
        setSubjectForm({ name: '', semester: '1', credit_units: '1', grade_type: 'exam' });
        loadData();
      } else {
        const err = await res.json();
        if (err.error?.includes('лимит') || err.error?.includes('Limit')) {
          toast({ title: 'Лимит бесплатного плана', description: 'Оформите подписку для безлимитных предметов', variant: 'destructive' });
        } else {
          toast({ title: 'Ошибка', description: err.error, variant: 'destructive' });
        }
      }
    } catch {
      toast({ title: 'Ошибка сети', variant: 'destructive' });
    }
  };

  const handleAddGrade = async (subjectId: number) => {
    try {
      const res = await apiCall('', {
        method: 'POST',
        body: JSON.stringify({
          action: 'add_grade',
          subject_id: subjectId,
          grade: parseInt(gradeForm.grade),
          note: gradeForm.note || '',
        }),
      });
      if (res.ok) {
        toast({ title: 'Оценка добавлена' });
        setIsAddingGrade(null);
        setGradeForm({ grade: '5', note: '' });
        loadData();
      } else {
        const err = await res.json();
        toast({ title: 'Ошибка', description: err.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка сети', variant: 'destructive' });
    }
  };

  const handleDeleteSubject = async (subjectId: number) => {
    try {
      const res = await apiCall('', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete_subject', subject_id: subjectId }),
      });
      if (res.ok) {
        toast({ title: 'Предмет удалён' });
        loadData();
      }
    } catch {
      toast({ title: 'Ошибка', variant: 'destructive' });
    }
  };

  const handleDeleteGrade = async (gradeId: number) => {
    try {
      const res = await apiCall('', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete_grade', grade_id: gradeId }),
      });
      if (res.ok) {
        toast({ title: 'Оценка удалена' });
        loadData();
      }
    } catch {
      toast({ title: 'Ошибка', variant: 'destructive' });
    }
  };

  const semesters = Object.keys(subjects).map(Number).sort((a, b) => a - b);
  const currentSubjects = subjects[selectedSemester] || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <NetworkError onRetry={loadData} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <header className="bg-white/70 backdrop-blur-xl border-b border-purple-200/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-xl hover:bg-purple-100/50 h-9 w-9 sm:h-10 sm:w-10">
                <Icon name="ArrowLeft" size={20} className="text-purple-600" />
              </Button>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
                  Зачётная книжка
                </h1>
                <p className="text-[10px] sm:text-xs text-purple-600/70 font-medium">Оценки и средний балл</p>
              </div>
            </div>
            {!isPremium && (
              <Button size="sm" onClick={() => navigate('/subscription')} className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs rounded-xl">
                <Icon name="Crown" size={14} className="mr-1" />
                Premium
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24">
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Card className="p-4 text-center bg-white/80 backdrop-blur-sm">
              <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                {stats.overall_gpa > 0 ? stats.overall_gpa.toFixed(2) : '—'}
              </p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Средний балл</p>
            </Card>
            <Card className="p-4 text-center bg-white/80 backdrop-blur-sm">
              <p className="text-2xl sm:text-3xl font-bold text-purple-600">{stats.total_subjects}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Предметов</p>
            </Card>
            <Card className="p-4 text-center bg-white/80 backdrop-blur-sm">
              <p className="text-2xl sm:text-3xl font-bold text-indigo-600">{stats.graded_subjects}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-1">С оценками</p>
            </Card>
            <Card className="p-4 text-center bg-white/80 backdrop-blur-sm">
              {stats.scholarship ? (
                <>
                  <p className="text-lg sm:text-xl font-bold text-amber-600">
                    {stats.scholarship === 'Повышенная стипендия' ? '🏆' : '📚'}
                  </p>
                  <p className="text-[10px] sm:text-xs text-amber-600 font-medium mt-1">{stats.scholarship}</p>
                </>
              ) : (
                <>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-300">—</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Стипендия</p>
                </>
              )}
            </Card>
          </div>
        )}

        {!isPremium && subjectCount >= 4 && (
          <Card className="mb-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
            <div className="flex items-center gap-3">
              <Icon name="Crown" size={20} className="text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">
                  {subjectCount >= 5 ? 'Лимит предметов достигнут' : `Использовано ${subjectCount}/5 предметов`}
                </p>
                <p className="text-xs text-amber-600">Оформите подписку для безлимитного количества</p>
              </div>
              <Button size="sm" onClick={() => navigate('/subscription')} className="bg-amber-500 text-white text-xs">
                Подписка
              </Button>
            </div>
          </Card>
        )}

        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
          {semesters.map((sem) => (
            <Button
              key={sem}
              variant={selectedSemester === sem ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedSemester(sem)}
              className={`rounded-xl whitespace-nowrap ${selectedSemester === sem ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white' : ''}`}
            >
              {sem} семестр
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddingSubject(true)}
            className="rounded-xl whitespace-nowrap border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50"
          >
            <Icon name="Plus" size={16} className="mr-1" />
            Добавить
          </Button>
        </div>

        {isAddingSubject && (
          <Card className="mb-4 p-4 sm:p-6 bg-white/90 backdrop-blur-sm border-emerald-200">
            <h3 className="font-semibold text-gray-800 mb-4">Новый предмет</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-gray-600">Название предмета</Label>
                <Input
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  placeholder="Математический анализ"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-gray-600">Семестр</Label>
                  <Select value={subjectForm.semester} onValueChange={(v) => setSubjectForm({ ...subjectForm, semester: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map((s) => (
                        <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Зач. единицы</Label>
                  <Select value={subjectForm.credit_units} onValueChange={(v) => setSubjectForm({ ...subjectForm, credit_units: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['0.5','1','1.5','2','2.5','3','4','5','6'].map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Тип</Label>
                  <Select value={subjectForm.grade_type} onValueChange={(v) => setSubjectForm({ ...subjectForm, grade_type: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exam">Экзамен</SelectItem>
                      <SelectItem value="zachet">Зачёт</SelectItem>
                      <SelectItem value="diff_zachet">Дифф. зачёт</SelectItem>
                      <SelectItem value="coursework">Курсовая</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleAddSubject} className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl">
                  Добавить
                </Button>
                <Button variant="outline" onClick={() => setIsAddingSubject(false)} className="rounded-xl">
                  Отмена
                </Button>
              </div>
            </div>
          </Card>
        )}

        {currentSubjects.length === 0 && !isAddingSubject ? (
          <Card className="p-8 sm:p-12 text-center bg-white/80 backdrop-blur-sm">
            <div className="text-5xl mb-4">📚</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Нет предметов</h3>
            <p className="text-sm text-gray-500 mb-4">
              {semesters.length === 0
                ? 'Добавьте первый предмет и начните вести зачётную книжку'
                : 'В этом семестре нет предметов'}
            </p>
            <Button onClick={() => setIsAddingSubject(true)} className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl">
              <Icon name="Plus" size={16} className="mr-2" />
              Добавить предмет
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {currentSubjects.map((subject) => {
              const latestGrade = subject.grades?.[0];
              return (
                <Card key={subject.id} className="p-4 bg-white/90 backdrop-blur-sm hover:shadow-lg transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-800 truncate text-sm sm:text-base">{subject.name}</h3>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {gradeTypeLabels[subject.grade_type] || subject.grade_type}
                        </Badge>
                      </div>
                      <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                        {subject.credit_units} з.е.
                        {subject.grades?.length > 0 && ` • ${subject.grades.length} оценок`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {latestGrade ? (
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${gradeColors[latestGrade.grade]} flex items-center justify-center shadow-lg`}>
                          <span className="text-white font-bold text-lg sm:text-xl">{latestGrade.grade}</span>
                        </div>
                      ) : (
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                          <span className="text-gray-400 text-sm">—</span>
                        </div>
                      )}
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
                          onClick={() => {
                            setIsAddingGrade(isAddingGrade === subject.id ? null : subject.id);
                            setGradeForm({ grade: '5', note: '' });
                          }}
                        >
                          <Icon name="Plus" size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400 hover:bg-red-50"
                          onClick={() => handleDeleteSubject(subject.id)}
                        >
                          <Icon name="Trash2" size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {isAddingGrade === subject.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex gap-2 items-end">
                        {subject.grade_type === 'zachet' ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setGradeForm({ ...gradeForm, grade: '5' });
                                handleAddGrade(subject.id);
                              }}
                              className="bg-emerald-500 text-white rounded-xl"
                            >
                              Зачёт
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setGradeForm({ ...gradeForm, grade: '2' });
                                handleAddGrade(subject.id);
                              }}
                              className="rounded-xl"
                            >
                              Незачёт
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex gap-1">
                              {[5, 4, 3, 2].map((g) => (
                                <button
                                  key={g}
                                  onClick={() => setGradeForm({ ...gradeForm, grade: String(g) })}
                                  className={`w-10 h-10 rounded-xl font-bold text-white transition-all ${
                                    gradeColors[g]
                                  } ${gradeForm.grade === String(g) ? 'ring-2 ring-offset-2 ring-purple-500 scale-110' : 'opacity-60 hover:opacity-100'}`}
                                >
                                  {g}
                                </button>
                              ))}
                            </div>
                            <Input
                              value={gradeForm.note}
                              onChange={(e) => setGradeForm({ ...gradeForm, note: e.target.value })}
                              placeholder="Заметка"
                              className="flex-1 h-10"
                            />
                            <Button onClick={() => handleAddGrade(subject.id)} className="bg-emerald-500 text-white rounded-xl h-10">
                              <Icon name="Check" size={16} />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {subject.grades && subject.grades.length > 0 && isAddingGrade !== subject.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex gap-2 flex-wrap">
                        {subject.grades.map((g) => (
                          <div key={g.id} className="flex items-center gap-1 group">
                            <div className={`w-7 h-7 rounded-lg ${gradeColors[g.grade]} flex items-center justify-center`}>
                              <span className="text-white font-bold text-xs">{g.grade}</span>
                            </div>
                            {g.note && <span className="text-[10px] text-gray-400">{g.note}</span>}
                            <button
                              onClick={() => handleDeleteGrade(g.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600"
                            >
                              <Icon name="X" size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {stats && Object.keys(stats.semester_gpa || {}).length > 0 && (
          <Card className="mt-6 p-4 sm:p-6 bg-white/90 backdrop-blur-sm">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Icon name="BarChart3" size={18} className="text-emerald-600" />
              Средний балл по семестрам
            </h3>
            <div className="space-y-2">
              {Object.entries(stats.semester_gpa)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([sem, gpa]) => (
                  <div key={sem} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-20">{sem} семестр</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-500"
                        style={{ width: `${((gpa as number) / 5) * 100}%` }}
                      />
                    </div>
                    <span className="font-bold text-sm text-gray-700 w-10 text-right">{(gpa as number).toFixed(2)}</span>
                  </div>
                ))}
            </div>
          </Card>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default GradeBook;