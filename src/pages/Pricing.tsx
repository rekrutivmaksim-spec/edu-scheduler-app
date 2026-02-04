import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

const SUBSCRIPTION_URL = 'https://functions.poehali.dev/7fe183c2-49af-4817-95f3-6ab4912778c4';
const STATS_URL = 'https://functions.poehali.dev/81b3aaba-9af0-426e-8f14-e7420a9f4ecc';

const Pricing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [totalUsers, setTotalUsers] = useState<number>(0);

  useEffect(() => {
    const checkAuth = async () => {
      if (!authService.isAuthenticated()) {
        navigate('/login');
        return;
      }
      await loadSubscriptionStatus();
      await loadStats();
    };
    checkAuth();
  }, [navigate]);

  const loadStats = async () => {
    try {
      const response = await fetch(STATS_URL);
      if (response.ok) {
        const data = await response.json();
        setTotalUsers(data.total_users || 0);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

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
        { text: 'До 7 занятий в расписании', included: true },
        { text: 'До 10 активных задач', included: true },
        { text: '2 материала в месяц', included: true },
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
      price: '249₽',
      period: 'в месяц',
      badge: 'Популярный',
      planId: '1month',
      features: [
        { text: 'Безлимитное расписание', included: true },
        { text: 'Безлимитные задачи', included: true },
        { text: 'Безлимитные материалы', included: true },
        { text: 'Безлимит AI-вопросов', included: true },
        { text: 'Генерация шпаргалок', included: true },
        { text: 'AI-прогноз экзаменов', included: true },
        { text: 'Экспорт в PDF', included: true }
      ],
      current: currentPlan === 'premium',
      buttonText: currentPlan === 'premium' ? 'Активен' : 'Получить Premium',
      color: 'gradient'
    },
    {
      name: 'Premium Год',
      price: '1990₽',
      period: 'за год',
      pricePerMonth: '166₽/мес',
      badge: 'Выгода 33%',
      savings: '998₽',
      planId: '1year',
      features: [
        { text: 'Безлимитное расписание', included: true },
        { text: 'Безлимитные задачи', included: true },
        { text: 'Безлимитные материалы', included: true },
        { text: 'Безлимит AI-вопросов', included: true },
        { text: 'Генерация шпаргалок', included: true },
        { text: 'AI-прогноз экзаменов', included: true },
        { text: 'Экспорт в PDF + Приоритет', included: true }
      ],
      current: currentPlan === 'premium',
      buttonText: currentPlan === 'premium' ? 'Активен' : 'Купить на год',
      color: 'gold'
    }
  ];

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
                  Тарифы
                </h1>
                <p className="text-[10px] sm:text-xs text-purple-600/70 font-medium">Выберите подходящий план</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-12">
        <div className="text-center mb-6 sm:mb-12">
          {totalUsers > 0 && (
            <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-indigo-50 to-purple-50 px-3 sm:px-6 py-2 sm:py-3 rounded-full border border-purple-200 mb-4 sm:mb-6">
              <div className="flex -space-x-1 sm:-space-x-2">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 border-2 border-white"></div>
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 border-2 border-white"></div>
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 border-2 border-white"></div>
              </div>
              <span className="text-xs sm:text-sm font-semibold text-gray-700">
                <span className="text-purple-600">{totalUsers}</span> {totalUsers === 1 ? 'студент' : totalUsers < 5 ? 'студента' : 'студентов'} уже учатся эффективнее
              </span>
            </div>
          )}
          <h2 className="text-2xl sm:text-4xl font-heading font-bold mb-3 sm:mb-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent px-2">
            Инвестируйте в свою учёбу
          </h2>
          <p className="text-sm sm:text-lg text-gray-600 max-w-2xl mx-auto px-4">
            Начните бесплатно или получите полный доступ к AI-функциям с Premium подпиской
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-12">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`p-4 sm:p-6 relative overflow-hidden ${
                plan.color === 'gradient'
                  ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-300 shadow-2xl shadow-purple-500/20'
                  : plan.color === 'gold'
                  ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-400 shadow-2xl shadow-orange-500/20'
                  : 'bg-white border-2 border-gray-200'
              }`}
            >
              {plan.badge && (
                <Badge className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-[10px] sm:text-xs px-2 py-0.5 sm:px-2.5 sm:py-1">
                  {plan.badge}
                </Badge>
              )}

              <div className="mb-4 sm:mb-6">
                <h3 className="text-base sm:text-xl font-bold text-gray-800 mb-1 sm:mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 sm:gap-2 mb-1">
                  <span className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    {plan.price}
                  </span>
                  <span className="text-xs sm:text-sm text-gray-600">{plan.period}</span>
                </div>
                {'pricePerMonth' in plan && (
                  <p className="text-xs sm:text-sm text-amber-700 font-bold">
                    {plan.pricePerMonth}
                  </p>
                )}
                {'savings' in plan && (
                  <p className="text-[10px] sm:text-xs text-orange-600 font-semibold mt-1">
                    🔥 Экономия {plan.savings}
                  </p>
                )}
              </div>

              <div className="space-y-1.5 sm:space-y-2 mb-4 sm:mb-6">
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 sm:gap-2">
                    {feature.included ? (
                      <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <Icon name="Check" size={10} className="text-green-600 sm:w-3 sm:h-3" />
                      </div>
                    ) : (
                      <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Icon name="X" size={10} className="text-gray-400 sm:w-3 sm:h-3" />
                      </div>
                    )}
                    <span className={`text-xs sm:text-sm ${feature.included ? 'text-gray-700' : 'text-gray-400'}`}>
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
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-purple-500/30 text-xs sm:text-sm h-9 sm:h-10"
                  >
                    💳 Купить Premium
                  </Button>
                  <Button
                    onClick={handleActivateDemo}
                    disabled={loading}
                    variant="outline"
                    className="w-full border-2 border-purple-300 hover:bg-purple-50 text-xs sm:text-sm h-9 sm:h-10"
                  >
                    🎁 Попробовать 7 дней бесплатно
                  </Button>
                </div>
              ) : (
                <Button
                  disabled
                  className="w-full bg-gray-200 text-gray-600 cursor-not-allowed text-xs sm:text-sm h-9 sm:h-10"
                >
                  {plan.buttonText}
                </Button>
              )}


            </Card>
          ))}
        </div>

        <Card className="p-4 sm:p-8 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-orange-200">
          <h3 className="text-base sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
            <Icon name="Zap" size={20} className="text-orange-600 sm:w-6 sm:h-6" />
            Разовые покупки (скоро)
          </h3>
          <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">
            Не готовы к подписке? Покупайте AI-функции по мере необходимости
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="p-3 sm:p-4 bg-white rounded-lg border border-orange-200">
              <p className="text-sm sm:text-base font-semibold text-gray-800">1 AI-прогноз</p>
              <p className="text-xl sm:text-2xl font-bold text-orange-600 mt-1">99₽</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Один экзамен</p>
            </div>
            <div className="p-3 sm:p-4 bg-white rounded-lg border border-orange-200">
              <p className="text-sm sm:text-base font-semibold text-gray-800">5 AI-прогнозов</p>
              <p className="text-xl sm:text-2xl font-bold text-orange-600 mt-1">399₽</p>
              <Badge className="mt-1 bg-green-100 text-green-700 text-[10px] sm:text-xs">-20%</Badge>
            </div>
            <div className="p-3 sm:p-4 bg-white rounded-lg border border-orange-200">
              <p className="text-sm sm:text-base font-semibold text-gray-800">10 OCR-сканирований</p>
              <p className="text-xl sm:text-2xl font-bold text-orange-600 mt-1">29₽</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Пакет материалов</p>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-3 sm:mt-4 text-center">
            🚀 Функция находится в разработке
          </p>
        </Card>
      </main>
    </div>
  );
};

export default Pricing;