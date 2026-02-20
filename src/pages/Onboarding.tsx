import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { courses } from '@/lib/universities';

const AUTH_API_URL = 'https://functions.poehali.dev/0c04829e-3c05-40bd-a560-5dcd6c554dd5';

const TOTAL_STEPS = 6;

const FEATURES = [
  {
    icon: 'Brain',
    title: 'ИИ-репетитор 24/7',
    description: 'Объяснит любую тему и поможет с домашкой',
    gradient: 'from-purple-500 to-indigo-500',
    bg: 'bg-purple-50',
  },
  {
    icon: 'Calendar',
    title: 'Расписание и задачи',
    description: 'Чётные/нечётные недели, дедлайны, напоминания',
    gradient: 'from-indigo-500 to-blue-500',
    bg: 'bg-indigo-50',
  },
  {
    icon: 'Trophy',
    title: 'Достижения и стрики',
    description: '60+ ачивок, квесты, рейтинг среди студентов',
    gradient: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-50',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userType, setUserType] = useState<'student' | 'school' | ''>('');
  const [formData, setFormData] = useState({
    full_name: '',
    university: '',
    faculty: '',
    course: ''
  });

  const handleSkip = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const updatedUser = { ...user, user_type: userType || 'student', onboarding_completed: true };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    toast({ title: 'Готово!', description: 'Можете заполнить профиль позже' });
    navigate('/');
  };

  const handleComplete = async () => {
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      const response = await fetch(AUTH_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'update_profile',
          ...formData,
          user_type: userType || 'student'
        })
      });

      const data = await response.json();

      if (response.ok) {
        const updatedUser = { ...user, ...formData, user_type: userType || 'student', onboarding_completed: true };
        localStorage.setItem('user', JSON.stringify(updatedUser));

        toast({
          title: 'Профиль заполнен!',
          description: 'Добро пожаловать в Studyfay!'
        });

        navigate('/');
      } else {
        throw new Error(data.error || 'Ошибка сохранения');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Не удалось сохранить данные';
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-8 sm:p-10 bg-white/95 backdrop-blur-xl border-0 shadow-2xl rounded-3xl">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-600">
              {step < 3 ? '' : `Шаг ${step - 2} из ${TOTAL_STEPS - 3}`}
            </span>
            {step >= 3 && (
              <Button
                onClick={handleSkip}
                variant="ghost"
                size="sm"
                className="text-gray-500"
              >
                Пропустить
              </Button>
            )}
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-500 ease-out"
              style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="text-center mb-4">
              <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-xl shadow-purple-300/40">
                <Icon name="GraduationCap" size={40} className="text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                Добро пожаловать в Studyfay!
              </h2>
              <p className="text-gray-500 text-sm sm:text-base">
                Твой умный помощник для учебы
              </p>
            </div>

            <div className="space-y-3">
              {FEATURES.map((feature) => (
                <div
                  key={feature.icon}
                  className={`flex items-center gap-4 p-4 rounded-2xl ${feature.bg} border border-transparent transition-all`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center flex-shrink-0 shadow-md`}>
                    <Icon name={feature.icon} size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{feature.title}</h3>
                    <p className="text-gray-600 text-xs sm:text-sm mt-0.5">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={() => setStep(1)}
              className="w-full h-14 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-base font-semibold shadow-lg rounded-xl"
            >
              Начать
              <Icon name="ArrowRight" size={20} className="ml-2" />
            </Button>
          </div>
        )}

        {/* Step 1: Тип пользователя */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="text-center mb-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Ты студент или школьник?</h2>
              <p className="text-gray-500 text-sm">Настроим приложение под твои задачи</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => { setUserType('student'); setStep(2); }}
                className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${userType === 'student' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'}`}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Icon name="University" size={24} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-base">Студент вуза</p>
                  <p className="text-sm text-gray-500">Расписание пар, сессия, зачётная книжка, конспекты</p>
                </div>
              </button>
              <button
                onClick={() => { setUserType('school'); setStep(2); }}
                className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${userType === 'school' ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-violet-300 hover:bg-violet-50/50'}`}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Icon name="GraduationCap" size={24} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-base">Школьник / сдаю ЕГЭ или ОГЭ</p>
                  <p className="text-sm text-gray-500">ИИ-репетитор по всем предметам, тренировка заданий</p>
                </div>
              </button>
            </div>
            <Button variant="ghost" onClick={() => setStep(0)} className="w-full text-gray-500">
              <Icon name="ArrowLeft" size={16} className="mr-2" />Назад
            </Button>
          </div>
        )}

        {/* Step 2: Upload / intro hint */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="text-center mb-4">
              <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-300/40">
                <Icon name="FileUp" size={40} className="text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                Загрузи свой первый конспект
              </h2>
              <p className="text-gray-500 text-sm sm:text-base max-w-md mx-auto">
                Сфотографируй конспект или загрузи файл — ИИ распознает текст и поможет разобраться
              </p>
            </div>

            {/* Upload flow mockup */}
            <div className="relative mx-auto max-w-xs">
              <div className="rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/60 p-6 flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-white border border-indigo-200 flex items-center justify-center shadow-sm">
                  <Icon name="Camera" size={28} className="text-indigo-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-800">Фото или файл</p>
                  <p className="text-xs text-gray-500 mt-0.5">PDF, DOCX, JPG, PNG</p>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 shadow-sm">
                    <Icon name="FileText" size={14} className="text-purple-500" />
                    <span className="text-xs text-gray-700">Лекция.pdf</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 shadow-sm">
                    <Icon name="Image" size={14} className="text-blue-500" />
                    <span className="text-xs text-gray-700">Фото.jpg</span>
                  </div>
                </div>
              </div>

              {/* Arrow and result hint */}
              <div className="flex flex-col items-center my-3">
                <Icon name="ChevronDown" size={20} className="text-indigo-400" />
              </div>

              <div className="rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/60 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                  <Icon name="Sparkles" size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800">ИИ анализирует текст</p>
                  <p className="text-[11px] text-gray-500">Вопросы, карточки, конспекты</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={() => setStep(1)} variant="outline" className="flex-1 h-12 border-2 rounded-xl">
                <Icon name="ArrowLeft" size={18} className="mr-2" />Назад
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl">
                Далее<Icon name="ArrowRight" size={18} className="ml-2" />
              </Button>
            </div>
            <button onClick={() => setStep(3)} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 py-1">
              Пропустить
            </button>
          </div>
        )}

        {/* Step 3: Name */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="text-center mb-8">
              <Icon name="User" size={64} className="mx-auto text-purple-600 mb-4" />
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Как тебя зовут?</h2>
              <p className="text-gray-600">Так мы сможем обращаться к тебе по имени</p>
            </div>
            <Input
              type="text"
              placeholder="Иван Иванов"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="h-14 text-lg border-2 border-gray-300 focus:border-purple-500 rounded-xl"
              autoFocus
            />
            <div className="flex gap-3">
              <Button onClick={() => setStep(2)} variant="outline" className="flex-1 h-12 border-2 rounded-xl">
                <Icon name="ArrowLeft" size={18} className="mr-2" />Назад
              </Button>
              <Button
                onClick={() => setStep(userType === 'school' ? 5 : 4)}
                disabled={!formData.full_name.trim()}
                className="flex-1 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-base font-semibold shadow-lg rounded-xl disabled:opacity-50"
              >
                Далее<Icon name="ArrowRight" size={20} className="ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: University (только для студентов) */}
        {step === 4 && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="text-center mb-8">
              <Icon name="GraduationCap" size={64} className="mx-auto text-purple-600 mb-4" />
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Где ты учишься?</h2>
              <p className="text-gray-600">Университет и факультет (необязательно)</p>
            </div>
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Название университета"
                value={formData.university}
                onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                className="h-12 text-base border-2 border-gray-300 focus:border-purple-500 rounded-xl"
              />
              <Input
                type="text"
                placeholder="Факультет / Направление"
                value={formData.faculty}
                onChange={(e) => setFormData({ ...formData, faculty: e.target.value })}
                className="h-12 text-base border-2 border-gray-300 focus:border-purple-500 rounded-xl"
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setStep(3)} variant="outline" className="flex-1 h-12 border-2 rounded-xl">
                <Icon name="ArrowLeft" size={18} className="mr-2" />Назад
              </Button>
              <Button onClick={() => setStep(5)} className="flex-1 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl">
                Далее<Icon name="ArrowRight" size={18} className="ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Course */}
        {step === 5 && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="text-center mb-8">
              <Icon name="BookOpen" size={64} className="mx-auto text-purple-600 mb-4" />
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                {userType === 'school' ? 'В каком классе?' : 'На каком курсе?'}
              </h2>
              <p className="text-gray-600">
                {userType === 'school' ? 'Выбери свой класс' : 'Выбери свой курс обучения'}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {courses.map((course) => (
                <Button
                  key={course}
                  onClick={() => setFormData({ ...formData, course })}
                  variant={formData.course === course ? 'default' : 'outline'}
                  className={`h-16 text-lg font-semibold rounded-xl transition-all ${
                    formData.course === course
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg scale-105'
                      : 'border-2 hover:border-purple-400'
                  }`}
                >
                  {course}
                </Button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setStep(userType === 'school' ? 3 : 4)} variant="outline" className="flex-1 h-12 border-2 rounded-xl">
                <Icon name="ArrowLeft" size={18} className="mr-2" />Назад
              </Button>
              <Button
                onClick={handleComplete}
                disabled={loading || !formData.course}
                className="flex-1 h-12 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold shadow-lg rounded-xl disabled:opacity-50"
              >
                {loading ? <Icon name="Loader2" size={18} className="animate-spin" /> : <><Icon name="Check" size={18} className="mr-2" />Завершить</>}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}