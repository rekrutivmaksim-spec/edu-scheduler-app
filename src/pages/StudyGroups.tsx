import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import BottomNav from '@/components/BottomNav';

const API_URL = 'https://functions.poehali.dev/d92d1f53-826f-4a85-bc2e-dec19a2ee674';

interface Group {
  id: number;
  name: string;
  description?: string;
  university?: string;
  faculty?: string;
  course?: number;
  invite_code: string;
  member_count: number;
  role: string;
  created_at: string;
}

interface GroupMember {
  id: number;
  user_id: number;
  full_name: string;
  email?: string;
  role: string;
  joined_at: string;
}

interface GroupLesson {
  id: number;
  subject: string;
  type: string;
  start_time: string;
  end_time: string;
  day_of_week: number;
  week_type?: string;
  room?: string;
  teacher?: string;
  color?: string;
  added_by?: string;
}

interface GroupTask {
  id: number;
  title: string;
  description?: string;
  subject?: string;
  deadline?: string;
  priority: string;
  completed: boolean;
  added_by?: string;
  created_at: string;
}

const StudyGroups = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [schedule, setSchedule] = useState<GroupLesson[]>([]);
  const [tasks, setTasks] = useState<GroupTask[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [activeTab, setActiveTab] = useState('schedule');
  const [selectedDay, setSelectedDay] = useState(1);

  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    university: '',
    faculty: '',
    course: ''
  });

  const [lessonForm, setLessonForm] = useState({
    subject: '',
    type: 'lecture',
    start_time: '',
    end_time: '',
    day_of_week: 1,
    week_type: 'every',
    room: '',
    teacher: '',
    color: 'bg-purple-500'
  });

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    subject: '',
    deadline: '',
    priority: 'medium'
  });

  const dayNames = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

  useEffect(() => {
    const checkAuth = async () => {
      if (!authService.isAuthenticated()) {
        navigate('/login');
        return;
      }
      const verifiedUser = await authService.verifyToken();
      if (!verifiedUser) {
        navigate('/login');
      } else {
        loadGroups();
      }
    };
    checkAuth();
  }, [navigate]);

  const apiGet = async (params: string) => {
    const token = authService.getToken();
    const response = await fetch(`${API_URL}?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Request failed');
    return response.json();
  };

  const apiPost = async (body: Record<string, unknown>) => {
    const token = authService.getToken();
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error('Request failed');
    return response.json();
  };

  const loadGroups = async () => {
    setIsLoading(true);
    try {
      const data = await apiGet('action=my_groups');
      setGroups(data.groups || []);
    } catch {
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить группы",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroupDetail = async (group: Group) => {
    setIsLoadingDetail(true);
    setSelectedGroup(group);
    setActiveTab('schedule');
    try {
      const data = await apiGet(`action=group_detail&group_id=${group.id}`);
      setMembers(data.members || []);
      if (data.group) {
        setSelectedGroup(data.group);
      }
    } catch {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить данные группы",
        variant: "destructive"
      });
    } finally {
      setIsLoadingDetail(false);
    }
    loadGroupSchedule(group.id);
    loadGroupTasks(group.id);
  };

  const loadGroupSchedule = async (groupId: number) => {
    setIsLoadingSchedule(true);
    try {
      const data = await apiGet(`action=group_schedule&group_id=${groupId}`);
      setSchedule(data.schedule || []);
    } catch {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить расписание группы",
        variant: "destructive"
      });
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  const loadGroupTasks = async (groupId: number) => {
    setIsLoadingTasks(true);
    try {
      const data = await apiGet(`action=group_tasks&group_id=${groupId}`);
      setTasks(data.tasks || []);
    } catch {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить задачи группы",
        variant: "destructive"
      });
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!createForm.name.trim()) {
      toast({ title: "Ошибка", description: "Введите название группы", variant: "destructive" });
      return;
    }
    try {
      await apiPost({
        action: 'create_group',
        name: createForm.name,
        description: createForm.description,
        university: createForm.university,
        faculty: createForm.faculty,
        course: createForm.course ? Number(createForm.course) : undefined
      });
      toast({ title: "Группа создана" });
      setIsCreateOpen(false);
      setCreateForm({ name: '', description: '', university: '', faculty: '', course: '' });
      loadGroups();
    } catch {
      toast({ title: "Ошибка", description: "Не удалось создать группу", variant: "destructive" });
    }
  };

  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) {
      toast({ title: "Ошибка", description: "Введите код приглашения", variant: "destructive" });
      return;
    }
    setIsJoining(true);
    try {
      await apiPost({ action: 'join_group', invite_code: inviteCode.trim() });
      toast({ title: "Вы вступили в группу" });
      setInviteCode('');
      loadGroups();
    } catch {
      toast({ title: "Ошибка", description: "Неверный код или группа не найдена", variant: "destructive" });
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroup) return;
    try {
      await apiPost({ action: 'leave_group', group_id: selectedGroup.id });
      toast({ title: "Вы покинули группу" });
      setSelectedGroup(null);
      loadGroups();
    } catch {
      toast({ title: "Ошибка", description: "Не удалось покинуть группу", variant: "destructive" });
    }
  };

  const handleAddLesson = async () => {
    if (!selectedGroup || !lessonForm.subject || !lessonForm.start_time || !lessonForm.end_time) {
      toast({ title: "Ошибка", description: "Заполните обязательные поля", variant: "destructive" });
      return;
    }
    try {
      await apiPost({
        action: 'add_schedule',
        group_id: selectedGroup.id,
        ...lessonForm,
        day_of_week: Number(lessonForm.day_of_week)
      });
      toast({ title: "Занятие добавлено" });
      setIsAddingLesson(false);
      setLessonForm({
        subject: '', type: 'lecture', start_time: '', end_time: '',
        day_of_week: 1, week_type: 'every', room: '', teacher: '', color: 'bg-purple-500'
      });
      loadGroupSchedule(selectedGroup.id);
    } catch {
      toast({ title: "Ошибка", description: "Не удалось добавить занятие", variant: "destructive" });
    }
  };

  const handleAddTask = async () => {
    if (!selectedGroup || !taskForm.title.trim()) {
      toast({ title: "Ошибка", description: "Введите название задачи", variant: "destructive" });
      return;
    }
    try {
      await apiPost({
        action: 'add_task',
        group_id: selectedGroup.id,
        ...taskForm
      });
      toast({ title: "Задача добавлена" });
      setIsAddingTask(false);
      setTaskForm({ title: '', description: '', subject: '', deadline: '', priority: 'medium' });
      loadGroupTasks(selectedGroup.id);
    } catch {
      toast({ title: "Ошибка", description: "Не удалось добавить задачу", variant: "destructive" });
    }
  };

  const handleImportSchedule = async () => {
    if (!selectedGroup) return;
    setIsImporting(true);
    try {
      await apiPost({ action: 'import_schedule', group_id: selectedGroup.id });
      toast({ title: "Расписание импортировано", description: "Занятия добавлены в ваше личное расписание" });
    } catch {
      toast({ title: "Ошибка", description: "Не удалось импортировать расписание", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const handleCopyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Код скопирован" });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const dayLessons = schedule.filter(l => l.day_of_week === selectedDay);

  if (selectedGroup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <header className="bg-white/70 backdrop-blur-xl border-b border-purple-200/50 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedGroup(null)}
                className="hover:bg-purple-100/50 rounded-xl h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
              >
                <Icon name="ArrowLeft" size={20} className="text-purple-600" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-2xl font-heading font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent truncate">
                  {selectedGroup.name}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[10px] sm:text-xs">
                    <Icon name="Users" size={10} className="mr-1" />
                    {selectedGroup.member_count} {selectedGroup.member_count === 1 ? 'участник' : selectedGroup.member_count < 5 ? 'участника' : 'участников'}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] sm:text-xs cursor-pointer hover:bg-purple-50"
                    onClick={() => handleCopyInviteCode(selectedGroup.invite_code)}
                  >
                    <Icon name="Copy" size={10} className="mr-1" />
                    {selectedGroup.invite_code}
                  </Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLeaveGroup}
                className="hover:bg-red-100/50 text-gray-500 hover:text-red-600 rounded-xl h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
              >
                <Icon name="LogOut" size={18} />
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-20 md:pb-8">
          {isLoadingDetail ? (
            <Card className="p-8 sm:p-12 text-center bg-white">
              <LoadingSpinner size={40} text="Загрузка группы..." />
            </Card>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
              <TabsList className="grid w-full grid-cols-3 h-12 sm:h-14 bg-white/90 backdrop-blur-xl border-2 border-purple-200/50 shadow-lg shadow-purple-500/10 rounded-2xl p-1 sm:p-2">
                <TabsTrigger value="schedule" className="rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all text-xs sm:text-sm">
                  <Icon name="Calendar" size={16} className="mr-1 sm:mr-2" />
                  Расписание
                </TabsTrigger>
                <TabsTrigger value="tasks" className="rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all text-xs sm:text-sm">
                  <Icon name="CheckSquare" size={16} className="mr-1 sm:mr-2" />
                  Задачи
                </TabsTrigger>
                <TabsTrigger value="members" className="rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-pink-600 data-[state=active]:to-rose-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all text-xs sm:text-sm">
                  <Icon name="Users" size={16} className="mr-1 sm:mr-2" />
                  Участники
                </TabsTrigger>
              </TabsList>

              <TabsContent value="schedule" className="space-y-4 sm:space-y-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                  <div className="flex-1">
                    <h2 className="text-xl sm:text-2xl font-heading font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Расписание группы</h2>
                    <p className="text-purple-600/70 text-xs sm:text-sm mt-0.5">Общее расписание занятий</p>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      onClick={handleImportSchedule}
                      disabled={isImporting}
                      className="border-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-xl text-xs sm:text-sm h-9 sm:h-10 flex-1 sm:flex-initial"
                    >
                      <Icon name="Download" size={14} className="mr-1.5" />
                      {isImporting ? 'Импорт...' : 'Импортировать'}
                    </Button>
                    <Button
                      onClick={() => setIsAddingLesson(true)}
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-purple-500/30 rounded-xl text-xs sm:text-sm h-9 sm:h-10 flex-1 sm:flex-initial"
                    >
                      <Icon name="Plus" size={14} className="mr-1.5" />
                      Добавить
                    </Button>
                  </div>
                </div>

                <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
                  {dayNames.map((day, idx) => (
                    <Button
                      key={idx}
                      variant={selectedDay === idx + 1 ? "default" : "outline"}
                      onClick={() => setSelectedDay(idx + 1)}
                      className={`flex-shrink-0 text-[11px] sm:text-sm h-8 sm:h-10 px-2.5 sm:px-4 whitespace-nowrap ${selectedDay === idx + 1 ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white" : ""}`}
                    >
                      {day}
                    </Button>
                  ))}
                </div>

                {isAddingLesson && (
                  <Card className="p-4 sm:p-6 bg-white">
                    <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">Новое занятие</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <Label className="text-xs sm:text-sm">Предмет *</Label>
                        <Input
                          value={lessonForm.subject}
                          onChange={(e) => setLessonForm({...lessonForm, subject: e.target.value})}
                          placeholder="Математический анализ"
                          className="mt-1.5 sm:mt-2 h-9 sm:h-10 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs sm:text-sm">Тип</Label>
                        <Select value={lessonForm.type} onValueChange={(v) => setLessonForm({...lessonForm, type: v})}>
                          <SelectTrigger className="mt-1.5 sm:mt-2 h-9 sm:h-10 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lecture">Лекция</SelectItem>
                            <SelectItem value="practice">Практика</SelectItem>
                            <SelectItem value="lab">Лабораторная</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs sm:text-sm">Начало *</Label>
                        <Input
                          type="time"
                          value={lessonForm.start_time}
                          onChange={(e) => setLessonForm({...lessonForm, start_time: e.target.value})}
                          className="mt-1.5 sm:mt-2 h-9 sm:h-10 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs sm:text-sm">Конец *</Label>
                        <Input
                          type="time"
                          value={lessonForm.end_time}
                          onChange={(e) => setLessonForm({...lessonForm, end_time: e.target.value})}
                          className="mt-1.5 sm:mt-2 h-9 sm:h-10 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs sm:text-sm">День недели</Label>
                        <Select value={String(lessonForm.day_of_week)} onValueChange={(v) => setLessonForm({...lessonForm, day_of_week: Number(v)})}>
                          <SelectTrigger className="mt-1.5 sm:mt-2 h-9 sm:h-10 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {dayNames.map((day, idx) => (
                              <SelectItem key={idx} value={String(idx + 1)}>{day}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs sm:text-sm">Неделя</Label>
                        <Select value={lessonForm.week_type} onValueChange={(v) => setLessonForm({...lessonForm, week_type: v})}>
                          <SelectTrigger className="mt-1.5 sm:mt-2 h-9 sm:h-10 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="every">Каждую неделю</SelectItem>
                            <SelectItem value="even">Чётная неделя</SelectItem>
                            <SelectItem value="odd">Нечётная неделя</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs sm:text-sm">Аудитория</Label>
                        <Input
                          value={lessonForm.room}
                          onChange={(e) => setLessonForm({...lessonForm, room: e.target.value})}
                          placeholder="ауд. 301"
                          className="mt-1.5 sm:mt-2 h-9 sm:h-10 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs sm:text-sm">Преподаватель</Label>
                        <Input
                          value={lessonForm.teacher}
                          onChange={(e) => setLessonForm({...lessonForm, teacher: e.target.value})}
                          placeholder="Иванов И.И."
                          className="mt-1.5 sm:mt-2 h-9 sm:h-10 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 sm:mt-4">
                      <Button onClick={handleAddLesson} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-xs sm:text-sm h-9 sm:h-10 flex-1 sm:flex-initial">
                        Сохранить
                      </Button>
                      <Button variant="outline" onClick={() => setIsAddingLesson(false)} className="text-xs sm:text-sm h-9 sm:h-10 flex-1 sm:flex-initial">
                        Отмена
                      </Button>
                    </div>
                  </Card>
                )}

                <div className="space-y-3 sm:space-y-4">
                  {isLoadingSchedule ? (
                    <Card className="p-8 sm:p-12 text-center bg-white">
                      <LoadingSpinner size={40} text="Загрузка расписания..." />
                    </Card>
                  ) : dayLessons.length === 0 ? (
                    <Card className="p-8 sm:p-12 text-center bg-white border-2 border-dashed border-purple-200">
                      <Icon name="CalendarOff" size={40} className="mx-auto mb-3 sm:mb-4 text-purple-300 sm:w-12 sm:h-12" />
                      <p className="text-sm sm:text-base text-gray-600">Нет занятий на этот день</p>
                    </Card>
                  ) : (
                    dayLessons.map((lesson) => (
                      <Card key={lesson.id} className="p-4 sm:p-6 bg-white hover:shadow-xl transition-all">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                            <div className={`w-12 h-12 sm:w-16 sm:h-16 ${lesson.color || 'bg-purple-500'} rounded-xl flex items-center justify-center text-white shadow-lg flex-shrink-0`}>
                              <Icon name="BookOpen" size={20} className="sm:w-6 sm:h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-sm sm:text-lg truncate">{lesson.subject}</h3>
                              <p className="text-xs sm:text-sm text-gray-600">{lesson.start_time} - {lesson.end_time}</p>
                              <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                                {lesson.room && `${lesson.room} \u2022 `}{lesson.type === 'lecture' ? 'Лекция' : lesson.type === 'practice' ? 'Практика' : 'Лаб'}
                                {lesson.teacher && ` \u2022 ${lesson.teacher}`}
                              </p>
                              {lesson.added_by && (
                                <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5">
                                  <Icon name="User" size={9} className="inline mr-0.5" />
                                  {lesson.added_by}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <Badge className="text-[10px] sm:text-xs">{lesson.type === 'lecture' ? 'Лекция' : lesson.type === 'practice' ? 'Практика' : 'Лаб'}</Badge>
                            {lesson.week_type && lesson.week_type !== 'every' && (
                              <Badge variant="outline" className="text-[9px] sm:text-[10px] bg-indigo-50 text-indigo-600 border-indigo-200">
                                {lesson.week_type === 'even' ? 'Чёт' : 'Нечёт'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="tasks" className="space-y-4 sm:space-y-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                  <div className="flex-1">
                    <h2 className="text-xl sm:text-2xl font-heading font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Задачи группы</h2>
                    <p className="text-purple-600/70 text-xs sm:text-sm mt-0.5">Общие дедлайны и задания</p>
                  </div>
                  <Button
                    onClick={() => setIsAddingTask(true)}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-pink-500/30 rounded-xl text-xs sm:text-sm h-9 sm:h-10 w-full sm:w-auto"
                  >
                    <Icon name="Plus" size={14} className="mr-1.5" />
                    Новая задача
                  </Button>
                </div>

                {isAddingTask && (
                  <Card className="p-4 sm:p-6 bg-white">
                    <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">Новая задача</h3>
                    <div className="space-y-3 sm:space-y-4">
                      <div>
                        <Label className="text-xs sm:text-sm">Название *</Label>
                        <Input
                          value={taskForm.title}
                          onChange={(e) => setTaskForm({...taskForm, title: e.target.value})}
                          placeholder="Решить задачи по математике"
                          className="mt-1.5 sm:mt-2 h-9 sm:h-10 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs sm:text-sm">Описание</Label>
                        <Textarea
                          value={taskForm.description}
                          onChange={(e) => setTaskForm({...taskForm, description: e.target.value})}
                          placeholder="Дополнительная информация..."
                          className="mt-1.5 sm:mt-2 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                        <div>
                          <Label className="text-xs sm:text-sm">Предмет</Label>
                          <Input
                            value={taskForm.subject}
                            onChange={(e) => setTaskForm({...taskForm, subject: e.target.value})}
                            placeholder="Математика"
                            className="mt-1.5 sm:mt-2 h-9 sm:h-10 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs sm:text-sm">Дедлайн</Label>
                          <Input
                            type="datetime-local"
                            value={taskForm.deadline}
                            onChange={(e) => setTaskForm({...taskForm, deadline: e.target.value})}
                            className="mt-1.5 sm:mt-2 h-9 sm:h-10 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs sm:text-sm">Приоритет</Label>
                          <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({...taskForm, priority: v})}>
                            <SelectTrigger className="mt-1.5 sm:mt-2 h-9 sm:h-10 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Низкий</SelectItem>
                              <SelectItem value="medium">Средний</SelectItem>
                              <SelectItem value="high">Высокий</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 sm:mt-4">
                      <Button onClick={handleAddTask} className="bg-gradient-to-r from-purple-600 to-pink-600 text-xs sm:text-sm h-9 sm:h-10 flex-1 sm:flex-initial">
                        Создать
                      </Button>
                      <Button variant="outline" onClick={() => setIsAddingTask(false)} className="text-xs sm:text-sm h-9 sm:h-10 flex-1 sm:flex-initial">
                        Отмена
                      </Button>
                    </div>
                  </Card>
                )}

                <div className="space-y-3 sm:space-y-4">
                  {isLoadingTasks ? (
                    <Card className="p-8 sm:p-12 text-center bg-white">
                      <LoadingSpinner size={40} text="Загрузка задач..." />
                    </Card>
                  ) : tasks.length === 0 ? (
                    <Card className="p-8 sm:p-12 text-center bg-white border-2 border-dashed border-purple-200">
                      <Icon name="ListTodo" size={40} className="mx-auto mb-3 sm:mb-4 text-purple-300 sm:w-12 sm:h-12" />
                      <p className="text-sm sm:text-base text-gray-600">Нет задач в группе</p>
                    </Card>
                  ) : (
                    tasks.map((task) => (
                      <Card key={task.id} className={`p-4 sm:p-5 bg-white hover:shadow-xl transition-all ${task.completed ? 'opacity-60' : ''}`}>
                        <div className="flex items-start gap-3 sm:gap-4">
                          <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full mt-2 flex-shrink-0 ${getPriorityColor(task.priority)}`} />
                          <div className="flex-1 min-w-0">
                            <h3 className={`font-bold text-sm sm:text-base ${task.completed ? 'line-through text-gray-500' : ''}`}>{task.title}</h3>
                            {task.description && <p className="text-xs sm:text-sm text-gray-600 mt-1">{task.description}</p>}
                            <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2 flex-wrap">
                              {task.subject && <Badge variant="outline" className="text-[10px] sm:text-xs">{task.subject}</Badge>}
                              {task.deadline && (
                                <Badge variant="outline" className="text-[10px] sm:text-xs">
                                  <Icon name="Clock" size={10} className="mr-0.5 sm:mr-1" />
                                  {new Date(task.deadline).toLocaleString('ru-RU', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </Badge>
                              )}
                              {task.added_by && (
                                <Badge variant="outline" className="text-[10px] sm:text-xs text-gray-500">
                                  <Icon name="User" size={10} className="mr-0.5" />
                                  {task.added_by}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="members" className="space-y-4 sm:space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-heading font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">Участники</h2>
                    <p className="text-purple-600/70 text-xs sm:text-sm mt-0.5">{members.length} {members.length === 1 ? 'человек' : members.length < 5 ? 'человека' : 'человек'}</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleCopyInviteCode(selectedGroup.invite_code)}
                    className="border-2 border-purple-200 text-purple-600 hover:bg-purple-50 rounded-xl text-xs sm:text-sm h-9 sm:h-10"
                  >
                    <Icon name="Share2" size={14} className="mr-1.5" />
                    Пригласить
                  </Button>
                </div>

                <Card className="p-3 sm:p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Icon name="Link" size={18} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm text-gray-600 font-medium">Код приглашения</p>
                      <p className="text-lg sm:text-xl font-bold font-mono tracking-wider text-purple-700">{selectedGroup.invite_code}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopyInviteCode(selectedGroup.invite_code)}
                      className="rounded-xl h-9 w-9 sm:h-10 sm:w-10 border-purple-300 hover:bg-purple-100 flex-shrink-0"
                    >
                      <Icon name="Copy" size={16} className="text-purple-600" />
                    </Button>
                  </div>
                </Card>

                <div className="space-y-2 sm:space-y-3">
                  {members.map((member) => (
                    <Card key={member.id} className="p-3 sm:p-4 bg-white hover:shadow-lg transition-all">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg flex-shrink-0">
                          <span className="text-sm sm:text-lg font-bold text-white">
                            {member.full_name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm sm:text-base truncate">{member.full_name}</h3>
                            <Badge
                              variant={member.role === 'owner' ? 'default' : 'outline'}
                              className={`text-[9px] sm:text-[10px] flex-shrink-0 ${member.role === 'owner' ? 'bg-gradient-to-r from-amber-500 to-orange-500 border-0' : ''}`}
                            >
                              {member.role === 'owner' ? 'Создатель' : 'Участник'}
                            </Badge>
                          </div>
                          <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                            <Icon name="Calendar" size={10} className="inline mr-0.5" />
                            {new Date(member.joined_at).toLocaleDateString('ru-RU', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </main>

        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <header className="bg-white/70 backdrop-blur-xl border-b border-purple-200/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                className="hover:bg-purple-100/50 rounded-xl h-9 w-9 sm:h-10 sm:w-10"
              >
                <Icon name="ArrowLeft" size={20} className="text-purple-600" />
              </Button>
              <div>
                <h1 className="text-lg sm:text-2xl font-heading font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Учебные группы
                </h1>
                <p className="text-[10px] sm:text-xs text-purple-600/70 font-medium">Учись вместе с одногруппниками</p>
              </div>
            </div>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-purple-500/30 rounded-xl text-xs sm:text-sm h-9 sm:h-10"
            >
              <Icon name="Plus" size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Создать группу</span>
              <span className="sm:hidden">Создать</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-20 md:pb-8">
        <Card className="p-4 sm:p-6 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border-2 border-purple-200 mb-4 sm:mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Icon name="UserPlus" size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5">Вступить по коду приглашения</p>
              <div className="flex gap-2">
                <Input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Введите код..."
                  className="h-9 sm:h-10 text-sm font-mono"
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinGroup()}
                />
                <Button
                  onClick={handleJoinGroup}
                  disabled={isJoining}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl text-xs sm:text-sm h-9 sm:h-10 px-4 flex-shrink-0"
                >
                  {isJoining ? <LoadingSpinner size={16} /> : 'Вступить'}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {isLoading ? (
          <Card className="p-8 sm:p-12 text-center bg-white">
            <LoadingSpinner size={40} text="Загрузка групп..." />
          </Card>
        ) : groups.length === 0 ? (
          <Card className="p-8 sm:p-16 text-center bg-white border-2 border-dashed border-purple-200">
            <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6 bg-gradient-to-br from-purple-100 to-pink-100 rounded-3xl flex items-center justify-center">
              <Icon name="Users" size={40} className="text-purple-400 sm:w-12 sm:h-12" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-700 mb-2">У вас пока нет групп</h3>
            <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto mb-4 sm:mb-6">
              Создайте учебную группу и пригласите одногруппников, чтобы вместе следить за расписанием и дедлайнами
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-purple-500/30 rounded-xl text-sm"
              >
                <Icon name="Plus" size={16} className="mr-2" />
                Создать группу
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {groups.map((group) => (
              <Card
                key={group.id}
                className="p-4 sm:p-6 bg-white hover:shadow-xl transition-all cursor-pointer group"
                onClick={() => loadGroupDetail(group)}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all flex-shrink-0">
                    <Icon name="Users" size={22} className="text-white sm:w-7 sm:h-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-sm sm:text-lg truncate">{group.name}</h3>
                      <Badge
                        variant={group.role === 'owner' ? 'default' : 'outline'}
                        className={`text-[9px] sm:text-[10px] flex-shrink-0 ${group.role === 'owner' ? 'bg-gradient-to-r from-amber-500 to-orange-500 border-0' : ''}`}
                      >
                        {group.role === 'owner' ? 'Создатель' : 'Участник'}
                      </Badge>
                    </div>
                    {group.description && (
                      <p className="text-xs sm:text-sm text-gray-600 truncate mb-1">{group.description}</p>
                    )}
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <span className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1">
                        <Icon name="Users" size={11} />
                        {group.member_count} {group.member_count === 1 ? 'участник' : group.member_count < 5 ? 'участника' : 'участников'}
                      </span>
                      {group.university && (
                        <span className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1">
                          <Icon name="GraduationCap" size={11} />
                          {group.university}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className="text-[9px] sm:text-[10px] font-mono cursor-pointer hover:bg-purple-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyInviteCode(group.invite_code);
                        }}
                      >
                        <Icon name="Copy" size={9} className="mr-0.5" />
                        {group.invite_code}
                      </Badge>
                    </div>
                  </div>
                  <Icon name="ChevronRight" size={20} className="text-gray-400 group-hover:text-purple-600 transition-colors flex-shrink-0" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl font-heading font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Создать группу
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Создайте учебную группу и пригласите одногруппников
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4 mt-2">
            <div>
              <Label className="text-xs sm:text-sm">Название группы *</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                placeholder="ИВТ-21-1"
                className="mt-1.5 h-9 sm:h-10 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs sm:text-sm">Описание</Label>
              <Textarea
                value={createForm.description}
                onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                placeholder="Информация о группе..."
                className="mt-1.5 text-sm"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs sm:text-sm">Университет</Label>
                <Input
                  value={createForm.university}
                  onChange={(e) => setCreateForm({...createForm, university: e.target.value})}
                  placeholder="МГУ"
                  className="mt-1.5 h-9 sm:h-10 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Факультет</Label>
                <Input
                  value={createForm.faculty}
                  onChange={(e) => setCreateForm({...createForm, faculty: e.target.value})}
                  placeholder="ВМК"
                  className="mt-1.5 h-9 sm:h-10 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs sm:text-sm">Курс</Label>
              <Select value={createForm.course} onValueChange={(v) => setCreateForm({...createForm, course: v})}>
                <SelectTrigger className="mt-1.5 h-9 sm:h-10 text-sm">
                  <SelectValue placeholder="Выберите курс" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 курс</SelectItem>
                  <SelectItem value="2">2 курс</SelectItem>
                  <SelectItem value="3">3 курс</SelectItem>
                  <SelectItem value="4">4 курс</SelectItem>
                  <SelectItem value="5">5 курс</SelectItem>
                  <SelectItem value="6">6 курс</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleCreateGroup}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-sm h-10 flex-1"
              >
                <Icon name="Plus" size={16} className="mr-1.5" />
                Создать
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="text-sm h-10 flex-1"
              >
                Отмена
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default StudyGroups;
