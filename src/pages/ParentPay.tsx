import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

const API_URL = 'https://functions.poehali.dev/fac60d23-7f1e-428a-99cf-820ddb897781';

const ParentPay = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('parent_token');
    if (!token) {
      navigate('/parent/auth');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      window.history.replaceState({}, '', '/parent/pay');
      setChecking(true);
      checkPayment(token);
    }
  }, [navigate]);

  const checkPayment = async (token: string) => {
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const response = await fetch(`${API_URL}?action=dashboard`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          toast({ title: 'Доступ активирован!', description: 'Добро пожаловать в кабинет родителя' });
          navigate('/parent');
          return;
        }
      } catch { /* retry */ }
    }
    setChecking(false);
    toast({ title: 'Платёж обрабатывается', description: 'Попробуйте обновить страницу через минуту' });
  };

  const handlePay = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('parent_token');
      const returnUrl = `${window.location.origin}/parent/pay?payment=success`;

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'create_payment', return_url: returnUrl }),
      });

      const data = await response.json();

      if (data.success && data.confirmation_url) {
        window.location.href = data.confirmation_url;
      } else {
        throw new Error(data.error || 'Ошибка создания платежа');
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Попробуйте снова',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Icon name="Loader2" size={48} className="animate-spin text-indigo-600 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-800">Проверяем оплату...</h2>
          <p className="text-sm text-gray-500 mt-1">Это займёт пару секунд</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Icon name="Eye" size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Доступ к кабинету</h1>
          <p className="text-sm text-gray-500 mt-1">Следите за учёбой вашего ребёнка каждый день</p>
        </div>

        <Card className="p-5 bg-gradient-to-br from-indigo-600 to-blue-700 border-0 shadow-xl">
          <div className="text-center text-white space-y-3">
            <div className="text-4xl font-extrabold">299 ₽</div>
            <p className="text-indigo-200 text-sm">в месяц</p>
            <div className="h-px bg-white/20" />
            <div className="space-y-2.5 text-left">
              {[
                { icon: 'BarChart3', text: 'Статистика учёбы за каждый день' },
                { icon: 'Flame', text: 'Стрик: сколько дней подряд учится' },
                { icon: 'Brain', text: 'Сколько вопросов задаёт ИИ' },
                { icon: 'Trophy', text: 'Достижения и уровень ребёнка' },
                { icon: 'GraduationCap', text: 'Оценки по предметам и GPA' },
                { icon: 'CalendarCheck', text: 'Планы подготовки к экзаменам' },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Icon name={f.icon} size={16} className="text-indigo-200 flex-shrink-0" />
                  <span className="text-sm text-white/90">{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Button
          onClick={handlePay}
          disabled={loading}
          className="w-full h-13 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-extrabold text-lg rounded-2xl shadow-lg"
        >
          {loading ? (
            <Icon name="Loader2" size={22} className="animate-spin" />
          ) : (
            'Оплатить 299 ₽'
          )}
        </Button>

        <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <Icon name="Lock" size={12} />
            <span>ЮKassa</span>
          </div>
          <div className="flex items-center gap-1">
            <Icon name="ShieldCheck" size={12} />
            <span>Безопасно</span>
          </div>
        </div>

        <button
          onClick={() => { localStorage.removeItem('parent_token'); navigate('/parent/auth'); }}
          className="w-full text-center text-xs text-gray-400 hover:text-gray-600"
        >
          Выйти
        </button>
      </div>
    </div>
  );
};

export default ParentPay;
