import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { universities, courses } from '@/lib/universities';

const API_URL = 'https://functions.poehali.dev/0c04829e-3c05-40bd-a560-5dcd6c554dd5';

export default function Register() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [universitySearch, setUniversitySearch] = useState('');
  const [showUniversities, setShowUniversities] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    university: '',
    faculty: '',
    course: ''
  });

  const filteredUniversities = universities.filter(uni =>
    uni.toLowerCase().includes(universitySearch.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Пароли не совпадают'
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'register',
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          university: formData.university,
          faculty: formData.faculty,
          course: formData.course
        })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        toast({
          title: '🎉 Регистрация успешна!',
          description: `Добро пожаловать в Studyfay, ${data.user.full_name}!`
        });
        
        navigate('/');
      } else {
        toast({
          variant: 'destructive',
          title: 'Ошибка регистрации',
          description: data.error || 'Попробуйте ещё раз'
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось подключиться к серверу'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-20 w-96 h-96 bg-gradient-to-br from-pink-400/20 to-rose-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-gradient-to-br from-purple-400/20 to-indigo-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <Card className="relative z-10 w-full max-w-2xl p-10 bg-white/95 backdrop-blur-lg border-0 shadow-2xl rounded-3xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-pink-600 via-purple-600 to-indigo-600 rounded-3xl shadow-2xl shadow-purple-500/40 mb-6">
            <Icon name="Sparkles" size={40} className="text-white" />
          </div>
          <h1 className="text-4xl font-heading font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            Регистрация
          </h1>
          <p className="text-purple-600/70">Начни умную учёбу прямо сейчас! 🚀</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Icon name="User" size={16} className="text-purple-600" />
                Полное имя *
              </label>
              <Input
                type="text"
                placeholder="Иван Иванов"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
                className="h-12 border-2 border-purple-200 focus:border-purple-500 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Icon name="Mail" size={16} className="text-purple-600" />
                Email *
              </label>
              <Input
                type="email"
                placeholder="student@university.ru"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="h-12 border-2 border-purple-200 focus:border-purple-500 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Icon name="Lock" size={16} className="text-purple-600" />
                Пароль *
              </label>
              <Input
                type="password"
                placeholder="Минимум 6 символов"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
                className="h-12 border-2 border-purple-200 focus:border-purple-500 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Icon name="Lock" size={16} className="text-purple-600" />
                Повторите пароль *
              </label>
              <Input
                type="password"
                placeholder="Повторите пароль"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                minLength={6}
                className="h-12 border-2 border-purple-200 focus:border-purple-500 rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Icon name="GraduationCap" size={16} className="text-purple-600" />
              Университет
            </label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Начните вводить название..."
                value={universitySearch || formData.university}
                onChange={(e) => {
                  setUniversitySearch(e.target.value);
                  setFormData({ ...formData, university: e.target.value });
                  setShowUniversities(true);
                }}
                onFocus={() => setShowUniversities(true)}
                className="h-12 border-2 border-purple-200 focus:border-purple-500 rounded-xl"
              />
              {showUniversities && filteredUniversities.length > 0 && universitySearch && (
                <div className="absolute z-50 w-full mt-2 bg-white border-2 border-purple-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                  {filteredUniversities.slice(0, 10).map((uni) => (
                    <div
                      key={uni}
                      onClick={() => {
                        setFormData({ ...formData, university: uni });
                        setUniversitySearch(uni);
                        setShowUniversities(false);
                      }}
                      className="px-4 py-3 hover:bg-purple-50 cursor-pointer transition-colors border-b border-purple-100 last:border-0"
                    >
                      <p className="text-sm font-medium text-gray-900">{uni}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Icon name="BookOpen" size={16} className="text-purple-600" />
                Факультет
              </label>
              <Input
                type="text"
                placeholder="Например: ВМК"
                value={formData.faculty}
                onChange={(e) => setFormData({ ...formData, faculty: e.target.value })}
                className="h-12 border-2 border-purple-200 focus:border-purple-500 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Icon name="Users" size={16} className="text-purple-600" />
                Курс
              </label>
              <select
                value={formData.course}
                onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                className="h-12 w-full border-2 border-purple-200 focus:border-purple-500 rounded-xl px-4 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Выберите курс</option>
                {courses.map((course) => (
                  <option key={course} value={course}>
                    {course}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-700 hover:via-purple-700 hover:to-indigo-700 text-lg font-bold shadow-2xl shadow-purple-500/40 rounded-xl mt-6"
          >
            {loading ? (
              <Icon name="Loader2" size={24} className="animate-spin" />
            ) : (
              <>
                <Icon name="Sparkles" size={24} className="mr-2" />
                Создать аккаунт
              </>
            )}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Уже есть аккаунт?{' '}
            <Link
              to="/login"
              className="font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent hover:from-purple-700 hover:to-pink-700 transition-all"
            >
              Войти
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}