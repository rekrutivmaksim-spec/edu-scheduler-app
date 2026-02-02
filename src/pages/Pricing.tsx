import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

const SUBSCRIPTION_URL = 'https://functions.poehali.dev/7fe183c2-49af-4817-95f3-6ab4912778c4';

const Pricing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string>('free');

  useEffect(() => {
    const checkAuth = async () => {
      if (!authService.isAuthenticated()) {
        navigate('/login');
        return;
      }
      await loadSubscriptionStatus();
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
        setCurrentPlan(data.subscription_type || 'free');
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
    }
  };

  const handleActivateDemo = async () => {
    setLoading(true);
    try {
      const token = authService.getToken();
      const response = await fetch(SUBSCRIPTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'upgrade_demo' })
      });

      if (response.ok) {
        toast({
          title: '🎉 Премиум активирован!',
          description: 'У вас есть 7 дней бесплатного доступа ко всем функциям'
        });
        setCurrentPlan('premium');
      } else {
        const errorData = await response.json();
        toast({
          title: 'Ошибка',
          description: errorData.error || 'Не удалось активировать премиум',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось активировать премиум',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBuyPremium = () => {
    navigate('/payment-setup');
  };

  const plans = [
    {
      name: 'Free',
      price: '0₽',
      period: 'навсегда',
      features: [
        { text: 'До 15 занятий в расписании', included: true },
        { text: 'До 20 активных задач', included: true },
        { text: '3 материала в месяц', included: true },
        { text: '3 AI-вопроса в месяц', included: true },
        { text: 'Генерация шпаргалок', included: false },
        { text: 'AI-прогноз экзаменов', included: false },
        { text: 'Экспорт в PDF', included: false }
      ],
      current: currentPlan === 'free',
      buttonText: 'Текущий тариф',
      color: 'gray'
    },
    {
      name: 'Premium',
      price: '199₽',
      period: 'в месяц',
      badge: 'Популярный',
      features: [
        { text: 'Безлимитное расписание', included: true },
        { text: 'Безлимитные задачи', included: true },
        { text: 'Безлимитные материалы', included: true },
        { text: 'AI-ассистент (40 вопросов)', included: true },
        { text: 'Генерация шпаргалок', included: true },
        { text: 'AI-прогноз экзаменов', included: true },
        { text: 'Экспорт в PDF', included: true }
      ],
      current: currentPlan === 'premium',
      buttonText: currentPlan === 'premium' ? 'Активен' : 'Получить Premium',
      color: 'gradient'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <header className="bg-white/70 backdrop-blur-xl border-b border-purple-200/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                className="rounded-xl hover:bg-purple-100/50"
              >
                <Icon name="ArrowLeft" size={24} className="text-purple-600" />
              </Button>
              <div>
                <h1 className="text-2xl font-heading font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Тарифы
                </h1>
                <p className="text-xs text-purple-600/70 font-medium">Выберите подходящий план</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-heading font-bold mb-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Инвестируйте в свою учёбу
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Начните бесплатно или получите полный доступ к AI-функциям с Premium подпиской
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`p-8 relative overflow-hidden ${
                plan.color === 'gradient'
                  ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-300 shadow-2xl shadow-purple-500/20'
                  : 'bg-white border-2 border-gray-200'
              }`}
            >
              {plan.badge && (
                <Badge className="absolute top-4 right-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white">
                  {plan.badge}
                </Badge>
              )}

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    {plan.price}
                  </span>
                  <span className="text-gray-600">{plan.period}</span>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    {feature.included ? (
                      <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <Icon name="Check" size={14} className="text-green-600" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Icon name="X" size={14} className="text-gray-400" />
                      </div>
                    )}
                    <span className={feature.included ? 'text-gray-700' : 'text-gray-400'}>
                      {feature.text}
                    </span>
                  </div>
                ))}
              </div>

              {plan.color === 'gradient' && !plan.current ? (
                <div className="space-y-2">
                  <Button
                    onClick={handleBuyPremium}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-purple-500/30"
                  >
                    💳 Купить Premium
                  </Button>
                  <Button
                    onClick={handleActivateDemo}
                    disabled={loading}
                    variant="outline"
                    className="w-full border-2 border-purple-300 hover:bg-purple-50"
                  >
                    🎁 Попробовать 7 дней бесплатно
                  </Button>
                </div>
              ) : (
                <Button
                  disabled
                  className="w-full bg-gray-200 text-gray-600 cursor-not-allowed"
                >
                  {plan.buttonText}
                </Button>
              )}


            </Card>
          ))}
        </div>

        <Card className="p-8 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-orange-200">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Icon name="Zap" size={24} className="text-orange-600" />
            Разовые покупки (скоро)
          </h3>
          <p className="text-gray-600 mb-4">
            Не готовы к подписке? Покупайте AI-функции по мере необходимости
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-lg border border-orange-200">
              <p className="font-semibold text-gray-800">1 AI-прогноз</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">99₽</p>
              <p className="text-xs text-gray-500 mt-1">Один экзамен</p>
            </div>
            <div className="p-4 bg-white rounded-lg border border-orange-200">
              <p className="font-semibold text-gray-800">5 AI-прогнозов</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">399₽</p>
              <Badge className="mt-1 bg-green-100 text-green-700">-20%</Badge>
            </div>
            <div className="p-4 bg-white rounded-lg border border-orange-200">
              <p className="font-semibold text-gray-800">10 OCR-сканирований</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">29₽</p>
              <p className="text-xs text-gray-500 mt-1">Пакет материалов</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4 text-center">
            🚀 Функция находится в разработке
          </p>
        </Card>
      </main>
    </div>
  );
};

export default Pricing;