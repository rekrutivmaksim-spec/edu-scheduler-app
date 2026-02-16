import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { courses } from '@/lib/universities';

const AUTH_API_URL = 'https://functions.poehali.dev/0c04829e-3c05-40bd-a560-5dcd6c554dd5';

export default function Onboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    university: '',
    faculty: '',
    course: ''
  });

  const handleSkip = () => {
    toast({
      title: '✅ Готово!',
      description: 'Можете заполнить профиль позже'
    });
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
          ...formData
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Обновляем данные пользователя
        const updatedUser = { ...user, ...formData, onboarding_completed: true };
        localStorage.setItem('user', JSON.stringify(updatedUser));

        toast({
          title: '🎉 Профиль заполнен!',
          description: 'Добро пожаловать в Studyfay!'
        });

        navigate('/');
      } else {
        throw new Error(data.error || 'Ошибка сохранения');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: error.message || 'Не удалось сохранить данные'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-10 bg-white/95 backdrop-blur-xl border-0 shadow-2xl rounded-3xl">
        {/* Прогресс */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-600">Шаг {step} из 3</span>
            <Button
              onClick={handleSkip}
              variant="ghost"
              size="sm"
              className="text-gray-500"
            >
              Пропустить
            </Button>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Шаг 1: Имя */}
        {step === 1 && (
          <div className="space-y-6">
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

            <Button
              onClick={() => setStep(2)}
              disabled={!formData.full_name.trim()}
              className="w-full h-14 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-base font-semibold shadow-lg rounded-xl disabled:opacity-50"
            >
              Далее
              <Icon name="ArrowRight" size={20} className="ml-2" />
            </Button>
          </div>
        )}

        {/* Шаг 2: Университет */}
        {step === 2 && (
          <div className="space-y-6">
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
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                className="flex-1 h-12 border-2 rounded-xl"
              >
                <Icon name="ArrowLeft" size={18} className="mr-2" />
                Назад
              </Button>
              <Button
                onClick={() => setStep(3)}
                className="flex-1 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl"
              >
                Далее
                <Icon name="ArrowRight" size={18} className="ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Шаг 3: Курс */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Icon name="BookOpen" size={64} className="mx-auto text-purple-600 mb-4" />
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">На каком курсе?</h2>
              <p className="text-gray-600">Выбери свой курс обучения</p>
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
              <Button
                onClick={() => setStep(2)}
                variant="outline"
                className="flex-1 h-12 border-2 rounded-xl"
              >
                <Icon name="ArrowLeft" size={18} className="mr-2" />
                Назад
              </Button>
              <Button
                onClick={handleComplete}
                disabled={loading || !formData.course}
                className="flex-1 h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-lg rounded-xl disabled:opacity-50"
              >
                {loading ? (
                  <Icon name="Loader2" size={18} className="animate-spin" />
                ) : (
                  <>
                    <Icon name="Check" size={18} className="mr-2" />
                    Завершить
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}