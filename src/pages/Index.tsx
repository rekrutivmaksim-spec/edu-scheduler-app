import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

import Icon from '@/components/ui/icon';

const Index = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('schedule');
  const [user, setUser] = useState(authService.getUser());

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
      }
    };
    checkAuth();
  }, [navigate]);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const schedule = [
    { id: 1, subject: 'Математический анализ', time: '09:00 - 10:30', room: 'ауд. 301', type: 'lecture', color: 'bg-purple-500' },
    { id: 2, subject: 'Программирование', time: '10:45 - 12:15', room: 'ауд. 205', type: 'practice', color: 'bg-blue-500' },
    { id: 3, subject: 'Физика', time: '12:30 - 14:00', room: 'ауд. 410', type: 'lecture', color: 'bg-green-500' },
    { id: 4, subject: 'Английский язык', time: '14:15 - 15:45', room: 'ауд. 102', type: 'practice', color: 'bg-orange-500' },
  ];

  const tasks = [
    { id: 1, title: 'Решить задачи по матанализу', subject: 'Математика', deadline: '25 янв', priority: 'high', completed: false },
    { id: 2, title: 'Написать лабораторную работу', subject: 'Программирование', deadline: '27 янв', priority: 'medium', completed: false },
    { id: 3, title: 'Подготовить презентацию', subject: 'Физика', deadline: '30 янв', priority: 'low', completed: true },
    { id: 4, title: 'Выучить слова по английскому', subject: 'Английский', deadline: '23 янв', priority: 'high', completed: false },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <header className="bg-white/70 backdrop-blur-xl border-b border-purple-200/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <Icon name="Sparkles" size={24} className="text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-2xl font-heading font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Studyfay
                </h1>
                <p className="text-xs text-purple-600/70 font-medium">ИИ-помощник студента</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="relative hover:bg-purple-100/50 rounded-xl">
                <Icon name="Bell" size={20} className="text-purple-600" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full animate-pulse shadow-lg shadow-pink-500/50"></span>
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => navigate('/profile')}
                className="rounded-xl hover:bg-purple-100/50 text-gray-600"
              >
                <Icon name="User" size={20} className="mr-2" />
                Профиль
              </Button>
              <Button 
                variant="ghost" 
                onClick={handleLogout}
                className="rounded-xl hover:bg-red-100/50 text-gray-600 hover:text-red-600"
              >
                <Icon name="LogOut" size={20} className="mr-2" />
                Выйти
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="group relative overflow-hidden p-7 bg-white border-0 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-indigo-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 group-hover:text-white transition-colors">Занятий сегодня</p>
                <p className="text-4xl font-bold mt-3 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent group-hover:text-white transition-all">4</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-100 to-purple-100 group-hover:from-white/20 group-hover:to-white/10 rounded-2xl flex items-center justify-center transition-all shadow-lg">
                <Icon name="Calendar" size={28} className="text-indigo-600 group-hover:text-white transition-colors" />
              </div>
            </div>
          </Card>

          <Card className="group relative overflow-hidden p-7 bg-white border-0 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 group-hover:text-white transition-colors">Активных задач</p>
                <p className="text-4xl font-bold mt-3 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent group-hover:text-white transition-all">3</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-pink-100 group-hover:from-white/20 group-hover:to-white/10 rounded-2xl flex items-center justify-center transition-all shadow-lg">
                <Icon name="CheckSquare" size={28} className="text-purple-600 group-hover:text-white transition-colors" />
              </div>
            </div>
          </Card>

          <Card className="group relative overflow-hidden p-7 bg-white border-0 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-pink-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-rose-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 group-hover:text-white transition-colors">Выполнено задач</p>
                <p className="text-4xl font-bold mt-3 bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent group-hover:text-white transition-all">75%</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-pink-100 to-rose-100 group-hover:from-white/20 group-hover:to-white/10 rounded-2xl flex items-center justify-center transition-all shadow-lg">
                <Icon name="TrendingUp" size={28} className="text-pink-600 group-hover:text-white transition-colors" />
              </div>
            </div>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 h-16 bg-white/90 backdrop-blur-xl border-2 border-purple-200/50 shadow-lg shadow-purple-500/10 rounded-2xl p-2">
            <TabsTrigger value="schedule" className="rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/30 transition-all">
              <Icon name="Calendar" size={20} className="mr-2" />
              <span className="hidden sm:inline font-semibold">Расписание</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/30 transition-all">
              <Icon name="CheckSquare" size={20} className="mr-2" />
              <span className="hidden sm:inline font-semibold">Задачи</span>
            </TabsTrigger>
            <TabsTrigger value="scanner" onClick={() => navigate('/materials')} className="rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-pink-600 data-[state=active]:to-rose-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-pink-500/30 transition-all">
              <Icon name="Camera" size={20} className="mr-2" />
              <span className="hidden sm:inline font-semibold">Сканер</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/30 transition-all">
              <Icon name="BarChart3" size={20} className="mr-2" />
              <span className="hidden sm:inline font-semibold">Аналитика</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/30 transition-all">
              <Icon name="User" size={20} className="mr-2" />
              <span className="hidden sm:inline font-semibold">Профиль</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-heading font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Расписание</h2>
                <p className="text-purple-600/70 text-sm mt-1">21 января, понедельник</p>
              </div>
              <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-purple-500/30 rounded-xl">
                <Icon name="Plus" size={18} className="mr-2" />
                Добавить
              </Button>
            </div>
            <div className="space-y-4">
              {schedule.map((lesson, index) => (
                <Card key={lesson.id} className="group relative overflow-hidden p-6 bg-white hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] border-0 shadow-md rounded-2xl">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-indigo-600 to-purple-600 group-hover:w-2 transition-all"></div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-5 flex-1">
                      <div className="relative">
                        <div className={`w-16 h-16 ${lesson.color} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                          <div className="text-center">
                            <div className="text-xl font-bold leading-none">{lesson.time.split(':')[0]}</div>
                            <div className="text-xs mt-0.5 opacity-90">{lesson.time.split(':')[1].split(' ')[0]}</div>
                          </div>
                        </div>
                        {index === 0 && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
                            ✓
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-xl text-gray-900 mb-1">{lesson.subject}</h3>
                        <p className="text-purple-600/70 text-sm mb-3">{lesson.time}</p>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="text-xs px-3 py-1 rounded-lg bg-purple-100 text-purple-700 border-0">
                            <Icon name="MapPin" size={14} className="mr-1" />
                            {lesson.room}
                          </Badge>
                          <Badge variant={lesson.type === 'lecture' ? 'default' : 'outline'} className="text-xs px-3 py-1 rounded-lg">
                            {lesson.type === 'lecture' ? '📚 Лекция' : '💻 Практика'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-xl hover:bg-purple-100/50">
                      <Icon name="MoreVertical" size={20} className="text-gray-600" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-heading font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Учебные задачи</h2>
                <p className="text-purple-600/70 text-sm mt-1">3 активные задачи</p>
              </div>
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-pink-500/30 rounded-xl">
                <Icon name="Plus" size={18} className="mr-2" />
                Новая задача
              </Button>
            </div>
            <div className="space-y-4">
              {tasks.map((task) => (
                <Card key={task.id} className={`group p-6 bg-white hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] border-0 shadow-md rounded-2xl ${task.completed ? 'opacity-70' : ''}`}>
                  <div className="flex items-start gap-5">
                    <div className="mt-1">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          className="w-6 h-6 rounded-lg border-2 border-purple-300 text-purple-600 focus:ring-purple-500 focus:ring-2 cursor-pointer transition-all checked:scale-110"
                          readOnly
                        />
                        {task.completed && (
                          <Icon name="Check" size={16} className="absolute top-1 left-1 text-white pointer-events-none" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className={`font-bold text-lg ${task.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {task.title}
                        </h3>
                        <div className={`w-3 h-3 ${getPriorityColor(task.priority)} rounded-full shadow-lg animate-pulse`}></div>
                      </div>
                      <p className="text-purple-600/70 text-sm mb-3">{task.subject}</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant="outline" className="text-xs px-3 py-1 rounded-lg border-purple-200 bg-purple-50 text-purple-700">
                          <Icon name="Clock" size={14} className="mr-1" />
                          {task.deadline}
                        </Badge>
                        <Badge className={`text-xs px-3 py-1 rounded-lg ${
                          task.priority === 'high' ? 'bg-red-100 text-red-700 border-0' :
                          task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 border-0' :
                          'bg-green-100 text-green-700 border-0'
                        }`}>
                          {task.priority === 'high' ? '🔥 Высокий' : task.priority === 'medium' ? '⚡ Средний' : '✨ Низкий'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="scanner" className="animate-fade-in">
            <Card className="relative overflow-hidden p-16 text-center bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 border-0 shadow-2xl rounded-3xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-br from-indigo-400/20 to-blue-400/20 rounded-full blur-3xl"></div>
              <div className="relative z-10 max-w-2xl mx-auto">
                <div className="relative inline-block mb-8">
                  <div className="w-32 h-32 bg-gradient-to-br from-pink-500 via-purple-600 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-purple-500/40 animate-scale-in">
                    <Icon name="Camera" size={64} className="text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                    <Icon name="Sparkles" size={20} className="text-white" />
                  </div>
                </div>
                <h2 className="text-4xl font-heading font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                  ИИ Сканер Расписания
                </h2>
                <p className="text-purple-600/80 text-lg mb-10 leading-relaxed max-w-xl mx-auto">
                  Сфотографируй своё расписание — и волшебство начинается! ✨<br/>
                  ИИ мгновенно распознает все занятия и добавит их в твой календарь
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
                  <Button size="lg" className="bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-700 hover:via-purple-700 hover:to-indigo-700 shadow-2xl shadow-purple-500/40 text-lg px-8 py-6 rounded-2xl">
                    <Icon name="Upload" size={24} className="mr-3" />
                    Загрузить фото
                  </Button>
                  <Button size="lg" variant="outline" className="border-2 border-purple-300 text-purple-600 hover:bg-purple-50 text-lg px-8 py-6 rounded-2xl">
                    <Icon name="Camera" size={24} className="mr-3" />
                    Открыть камеру
                  </Button>
                </div>
                <div className="flex items-center justify-center gap-6 text-sm text-purple-600/60">
                  <div className="flex items-center gap-2">
                    <Icon name="FileImage" size={16} />
                    <span>JPG, PNG</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="FileText" size={16} />
                    <span>PDF</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="Zap" size={16} />
                    <span>До 10 MB</span>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6 animate-fade-in">
            <div className="mb-6">
              <h2 className="text-3xl font-heading font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">Учебная аналитика</h2>
              <p className="text-purple-600/70 text-sm mt-1">Твой прогресс за эту неделю</p>
            </div>
            
            <Card className="p-8 bg-white border-0 shadow-xl rounded-2xl">
              <h3 className="font-bold text-xl mb-6 text-gray-900">Выполнение задач по предметам</h3>
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700">📐 Математика</span>
                    <span className="text-sm font-bold text-purple-600 bg-purple-100 px-3 py-1 rounded-lg">80%</span>
                  </div>
                  <div className="h-3 bg-purple-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full shadow-lg" style={{ width: '80%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700">💻 Программирование</span>
                    <span className="text-sm font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-lg">65%</span>
                  </div>
                  <div className="h-3 bg-blue-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-lg" style={{ width: '65%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700">⚛️ Физика</span>
                    <span className="text-sm font-bold text-green-600 bg-green-100 px-3 py-1 rounded-lg">90%</span>
                  </div>
                  <div className="h-3 bg-green-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full shadow-lg" style={{ width: '90%' }}></div>
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-8 bg-gradient-to-br from-indigo-50 to-purple-50 border-0 shadow-xl rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-gray-900">Занятия в неделю</h3>
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Icon name="Calendar" size={24} className="text-white" />
                  </div>
                </div>
                <div className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">24</div>
                <div className="flex items-center gap-2 text-sm text-green-600 font-semibold">
                  <Icon name="TrendingUp" size={16} />
                  <span>+2 за неделю</span>
                </div>
              </Card>

              <Card className="p-8 bg-gradient-to-br from-pink-50 to-rose-50 border-0 shadow-xl rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-gray-900">Средний балл</h3>
                  <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Icon name="Star" size={24} className="text-white" />
                  </div>
                </div>
                <div className="text-5xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent mb-2">4.5</div>
                <p className="text-sm text-gray-600 font-semibold">Отличный результат! 🎉</p>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="profile" className="space-y-6 animate-fade-in">
            <Card className="relative overflow-hidden p-8 bg-gradient-to-br from-white to-purple-50 border-0 shadow-xl rounded-3xl">
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-purple-300/20 to-pink-300/20 rounded-full blur-3xl"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-6 mb-8">
                  <div className="relative">
                    <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center text-white text-3xl font-bold shadow-2xl shadow-purple-500/40">
                      ИИ
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                      <Icon name="Sparkles" size={20} className="text-white" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-3xl font-heading font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                      {user?.full_name || 'Загрузка...'}
                    </h2>
                    <p className="text-purple-600/70 mt-1">{user?.email || ''}</p>
                    <Badge className="mt-3 bg-gradient-to-r from-yellow-400 to-orange-500 border-0 shadow-lg px-4 py-1.5 text-sm">
                      <Icon name="Crown" size={14} className="mr-1" />
                      Премиум аккаунт
                    </Badge>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="p-5 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl">
                    <div className="flex items-center gap-3 mb-2">
                      <Icon name="GraduationCap" size={20} className="text-indigo-600" />
                      <label className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Университет</label>
                    </div>
                    <p className="text-gray-900 font-semibold text-sm">{user?.university || 'Не указано'}</p>
                  </div>
                  <div className="p-5 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl">
                    <div className="flex items-center gap-3 mb-2">
                      <Icon name="BookOpen" size={20} className="text-purple-600" />
                      <label className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Факультет</label>
                    </div>
                    <p className="text-gray-900 font-semibold text-sm">{user?.faculty || 'Не указано'}</p>
                  </div>
                  <div className="p-5 bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl">
                    <div className="flex items-center gap-3 mb-2">
                      <Icon name="Users" size={20} className="text-pink-600" />
                      <label className="text-xs font-semibold text-pink-600 uppercase tracking-wide">Курс</label>
                    </div>
                    <p className="text-gray-900 font-semibold text-sm">{user?.course || 'Не указано'}</p>
                  </div>
                </div>

                <div className="pt-6 border-t-2 border-purple-200/50">
                  <h3 className="font-bold text-xl mb-5 text-gray-900 flex items-center gap-2">
                    <Icon name="Settings" size={24} className="text-purple-600" />
                    Настройки уведомлений
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Icon name="Bell" size={20} className="text-purple-600" />
                        <span className="text-sm font-semibold text-gray-700">Напоминания о занятиях</span>
                      </div>
                      <Badge variant="outline" className="border-purple-300 text-purple-700 bg-white font-semibold">За 15 минут</Badge>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Icon name="Clock" size={20} className="text-indigo-600" />
                        <span className="text-sm font-semibold text-gray-700">Дедлайны по задачам</span>
                      </div>
                      <Badge variant="outline" className="border-indigo-300 text-indigo-700 bg-white font-semibold">За 1 день</Badge>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Icon name="Smartphone" size={20} className="text-green-600" />
                        <span className="text-sm font-semibold text-gray-700">Push-уведомления</span>
                      </div>
                      <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 border-0 shadow-lg font-semibold">
                        <Icon name="Check" size={14} className="mr-1" />
                        Включены
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;