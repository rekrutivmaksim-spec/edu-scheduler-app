import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

import ProfileAvatar from '@/components/ProfileAvatar';
import BottomNav from '@/components/BottomNav';

const API_URL = 'https://functions.poehali.dev/0c04829e-3c05-40bd-a560-5dcd6c554dd5';
const SCHEDULE_URL = 'https://functions.poehali.dev/7030dc26-77cd-4b59-91e6-1be52f31cf8d';
const MATERIALS_URL = 'https://functions.poehali.dev/177e7001-b074-41cb-9553-e9c715d36f09';
const SUBSCRIPTION_URL = 'https://functions.poehali.dev/7fe183c2-49af-4817-95f3-6ab4912778c4';

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState(authService.getUser());
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState({ materials: 0, tasks: 0, schedule: 0 });
  const [subscriptionType, setSubscriptionType] = useState('free');
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    university: user?.university || '',
    faculty: user?.faculty || '',
    course: user?.course || ''
  });

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
        setUser(verifiedUser);
        setFormData({
          full_name: verifiedUser.full_name || '',
          university: verifiedUser.university || '',
          faculty: verifiedUser.faculty || '',
          course: verifiedUser.course || ''
        });
        loadStats();
        loadSubscriptionStatus();
      }
    };
    checkAuth();
  }, [navigate]);

  const loadSubscriptionStatus = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${SUBSCRIPTION_URL}?action=status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSubscriptionType(data.subscription_type || 'free');
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
    }
  };

  const loadStats = async () => {
    try {
      const token = authService.getToken();
      
      const [materialsRes, tasksRes, scheduleRes] = await Promise.all([
        fetch(MATERIALS_URL, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${SCHEDULE_URL}?path=tasks`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${SCHEDULE_URL}?path=schedule`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const materials = materialsRes.ok ? await materialsRes.json() : { materials: [] };
      const tasks = tasksRes.ok ? await tasksRes.json() : { tasks: [] };
      const schedule = scheduleRes.ok ? await scheduleRes.json() : { schedule: [] };

      setStats({
        materials: materials.materials?.length || 0,
        tasks: tasks.tasks?.length || 0,
        schedule: schedule.schedule?.length || 0
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleSave = async () => {
    if (!formData.full_name.trim()) {
      toast({
        title: "Ошибка",
        description: "Имя не может быть пустым",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      const token = authService.getToken();
      const response = await fetch(API_URL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        setIsEditing(false);
        toast({
          title: "Успешно",
          description: "Профиль обновлён",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Ошибка",
          description: errorData.error || "Не удалось обновить профиль",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Проблема с подключением к серверу",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      full_name: user?.full_name || '',
      university: user?.university || '',
      faculty: user?.faculty || '',
      course: user?.course || ''
    });
    setIsEditing(false);
  };

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
                className="rounded-xl hover:bg-purple-100/50 h-9 w-9 sm:h-10 sm:w-10"
              >
                <Icon name="ArrowLeft" size={20} className="text-purple-600 sm:w-6 sm:h-6" />
              </Button>
              <div>
                <h1 className="text-lg sm:text-2xl font-heading font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Мой профиль
                </h1>
                <p className="text-[10px] sm:text-xs text-purple-600/70 font-medium">Управление данными</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-20 md:pb-0">
        <Card className="p-4 sm:p-8 bg-white border-0 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <ProfileAvatar userName={user?.full_name} size="md" />
              <div className="overflow-hidden">
                <h2 className="text-lg sm:text-2xl font-bold text-gray-800 truncate">{user?.full_name}</h2>
                <p className="text-xs sm:text-sm text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>
            {!isEditing && (
              <Button
                onClick={() => setIsEditing(true)}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl shadow-lg shadow-purple-500/30 text-xs sm:text-sm h-9 sm:h-10 w-full sm:w-auto"
              >
                <Icon name="Edit" size={16} className="mr-1.5 sm:mr-2 sm:w-[18px] sm:h-[18px]" />
                Редактировать
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <Card className="p-4 sm:p-5 bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 font-medium">Материалов</p>
                  <p className="text-2xl sm:text-3xl font-bold text-indigo-600 mt-1">{stats.materials}</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Icon name="FileText" size={20} className="text-indigo-600 sm:w-6 sm:h-6" />
                </div>
              </div>
            </Card>

            <Card className="p-4 sm:p-5 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 font-medium">Задач</p>
                  <p className="text-2xl sm:text-3xl font-bold text-purple-600 mt-1">{stats.tasks}</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Icon name="CheckSquare" size={20} className="text-purple-600 sm:w-6 sm:h-6" />
                </div>
              </div>
            </Card>

            <Card className="p-4 sm:p-5 bg-gradient-to-br from-pink-50 to-rose-50 border-2 border-pink-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 font-medium">Занятий</p>
                  <p className="text-2xl sm:text-3xl font-bold text-pink-600 mt-1">{stats.schedule}</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-pink-100 rounded-xl flex items-center justify-center">
                  <Icon name="Calendar" size={20} className="text-pink-600 sm:w-6 sm:h-6" />
                </div>
              </div>
            </Card>
          </div>

          <Card 
            onClick={() => navigate('/subscription')}
            className={`p-4 sm:p-6 cursor-pointer hover:shadow-xl transition-all mb-4 ${subscriptionType === 'premium' ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-300' : 'bg-gradient-to-r from-purple-50 via-pink-50 to-rose-50 border-2 border-purple-300 hover:shadow-purple-500/30 hover:scale-[1.02]'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 sm:gap-4 flex-1">
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${subscriptionType === 'premium' ? 'bg-gradient-to-br from-indigo-600 to-purple-600' : 'bg-gradient-to-br from-purple-500 to-pink-600'}`}>
                  <Icon name={subscriptionType === 'premium' ? 'Crown' : 'Sparkles'} size={24} className="text-white sm:w-7 sm:h-7" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 truncate">
                    {subscriptionType === 'premium' ? 'Premium активен' : 'Подключить Premium'}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 break-words line-clamp-2">
                    {subscriptionType === 'premium' 
                      ? 'Доступ к ИИ-ассистенту активен' 
                      : 'Получи доступ к ИИ-ассистенту от 199₽/месяц'}
                  </p>
                </div>
              </div>
              <Icon name="ArrowRight" size={20} className={`flex-shrink-0 sm:w-6 sm:h-6 ${subscriptionType === 'premium' ? 'text-indigo-600' : 'text-purple-600'}`} />
            </div>
          </Card>

          <Card className="p-4 sm:p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 mb-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-green-500 to-emerald-500">
                <Icon name="PiggyBank" size={24} className="text-white sm:w-7 sm:h-7" />
              </div>
              <div className="flex-1">
                <p className="text-xs sm:text-sm text-gray-600 font-medium">Сэкономлено на репетиторах</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-bold text-green-600">{stats.materials * 500}</span>
                  <span className="text-sm sm:text-base text-gray-600">₽</span>
                </div>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                  ~{stats.materials} материалов × 500₽ за консультацию
                </p>
              </div>
            </div>
          </Card>

          <div className="space-y-4 sm:space-y-6">
            <div>
              <Label htmlFor="full_name" className="text-gray-700 font-semibold text-sm sm:text-base">
                Полное имя *
              </Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                disabled={!isEditing}
                className="mt-1.5 sm:mt-2 rounded-xl border-2 border-purple-200/50 focus:border-purple-500 disabled:opacity-60 h-9 sm:h-10 text-sm"
              />
            </div>

            <div>
              <Label htmlFor="university" className="text-gray-700 font-semibold text-sm sm:text-base">
                Университет
              </Label>
              <Input
                id="university"
                value={formData.university}
                onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                disabled={!isEditing}
                className="mt-1.5 sm:mt-2 rounded-xl border-2 border-purple-200/50 focus:border-purple-500 disabled:opacity-60 h-9 sm:h-10 text-sm"
                placeholder="Название вуза"
              />
            </div>

            <div>
              <Label htmlFor="faculty" className="text-gray-700 font-semibold text-sm sm:text-base">
                Факультет
              </Label>
              <Input
                id="faculty"
                value={formData.faculty}
                onChange={(e) => setFormData({ ...formData, faculty: e.target.value })}
                disabled={!isEditing}
                className="mt-1.5 sm:mt-2 rounded-xl border-2 border-purple-200/50 focus:border-purple-500 disabled:opacity-60 h-9 sm:h-10 text-sm"
                placeholder="Название факультета"
              />
            </div>

            <div>
              <Label htmlFor="course" className="text-gray-700 font-semibold text-sm sm:text-base">
                Курс
              </Label>
              <Input
                id="course"
                value={formData.course}
                onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                disabled={!isEditing}
                className="mt-1.5 sm:mt-2 rounded-xl border-2 border-purple-200/50 focus:border-purple-500 disabled:opacity-60 h-9 sm:h-10 text-sm"
                placeholder="Например: 2 курс"
              />
            </div>
          </div>

          {isEditing && (
            <div className="flex gap-2 sm:gap-3 mt-6 sm:mt-8">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl shadow-lg shadow-purple-500/30 text-xs sm:text-sm h-9 sm:h-10"
              >
                {isSaving ? (
                  <>
                    <Icon name="Loader2" size={16} className="mr-1.5 sm:mr-2 animate-spin sm:w-[18px] sm:h-[18px]" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Icon name="Check" size={16} className="mr-1.5 sm:mr-2 sm:w-[18px] sm:h-[18px]" />
                    Сохранить
                  </>
                )}
              </Button>
              <Button
                onClick={handleCancel}
                disabled={isSaving}
                variant="outline"
                className="flex-1 rounded-xl border-2 border-purple-200/50 hover:bg-purple-50 text-xs sm:text-sm h-9 sm:h-10"
              >
                <Icon name="X" size={16} className="mr-1.5 sm:mr-2 sm:w-[18px] sm:h-[18px]" />
                Отмена
              </Button>
            </div>
          )}
        </Card>

        <Card 
          className="mt-6 p-5 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 border-0 shadow-xl cursor-pointer hover:opacity-95 transition-opacity"
          onClick={() => navigate('/referral')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Icon name="Gift" size={24} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Пригласи друга</h3>
                <p className="text-sm text-white/80">+7 дней Premium за каждого</p>
              </div>
            </div>
            <Icon name="ChevronRight" size={24} className="text-white/60" />
          </div>
        </Card>

        <Card className="p-6 bg-white border-0 shadow-xl mt-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Быстрые действия</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={() => navigate('/materials')}
              variant="outline"
              className="h-auto p-4 flex items-center gap-3 justify-start hover:bg-indigo-50 border-2 hover:border-indigo-300 transition-all"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Icon name="FileUp" size={20} className="text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-800">Загрузка файлов</p>
                <p className="text-xs text-gray-500">Загрузить фото конспектов</p>
              </div>
            </Button>

            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="h-auto p-4 flex items-center gap-3 justify-start hover:bg-purple-50 border-2 hover:border-purple-300 transition-all"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                <Icon name="Calendar" size={20} className="text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-800">Расписание и задачи</p>
                <p className="text-xs text-gray-500">Управление планами</p>
              </div>
            </Button>

            <Button
              onClick={() => {
                authService.logout();
                navigate('/login');
              }}
              variant="outline"
              className="h-auto p-4 flex items-center gap-3 justify-start hover:bg-red-50 border-2 hover:border-red-300 transition-all"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-rose-600 rounded-lg flex items-center justify-center">
                <Icon name="LogOut" size={20} className="text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-800">Выйти</p>
                <p className="text-xs text-gray-500">Завершить сеанс</p>
              </div>
            </Button>
          </div>
        </Card>

        <Card className="mt-6 p-6 bg-red-50 border-2 border-red-200">
          <div className="flex items-start gap-3">
            <Icon name="AlertCircle" size={24} className="text-red-600 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-800 mb-1">Удаление аккаунта</h3>
              <p className="text-sm text-red-700 mb-3">
                Это действие необратимо. Все ваши данные будут удалены.
              </p>
              <Button
                variant="destructive"
                className="rounded-xl"
                onClick={() => {
                  toast({
                    title: "В разработке",
                    description: "Функция удаления аккаунта скоро будет доступна",
                  });
                }}
              >
                <Icon name="Trash2" size={18} className="mr-2" />
                Удалить аккаунт
              </Button>
            </div>
          </div>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default Profile;