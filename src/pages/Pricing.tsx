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
    navigate('/subscription');
  };

  const plans = [
    {
      name: 'Бесплатный',
      price: '0₽',
      period: 'навсегда',
      features: [
        { text: 'До 7 занятий в расписании', included: true },
        { text: 'До 10 активных задач', included: true },
        { text: '2 материала в месяц', included: true },
        { text: '3 AI-вопроса в день', included: true },
        { text: '5 предметов в зачётке', included: true },
        { text: 'Безлимит ИИ-вопросов', included: false },
        { text: 'Заморозка стрика', included: false }
      ],
      current: currentPlan === 'free',
      buttonText: 'Текущий тариф',
      color: 'gray'
    },
    {
      name: 'Премиум',
      price: '299₽',
      period: 'в месяц, автопродление',
      planId: '1month',
      features: [
        { text: 'Безлимитное расписание', included: true },
        { text: 'Безлимитные задачи', included: true },
        { text: 'Безлимитные AI-вопросы', included: true },
        { text: 'Безлимитные материалы', included: true },
        { text: 'Безлимит зачётной книжки', included: true },
        { text: 'Помодоро-таймер с аналитикой', included: true },
        { text: 'Заморозка стрика (1 раз/нед)', included: true }
      ],
      current: currentPlan === 'premium',
      buttonText: currentPlan === 'premium' ? 'Активен' : 'Получить Премиум',
      color: 'gradient'
    },
    {
      name: 'Полгода',
      price: '1 499₽',
      period: 'за 6 месяцев, автопродление',
      pricePerMonth: '250₽/мес',
      badge: 'Популярный',
      savings: '295₽',
      planId: '6months',
      features: [
        { text: 'Безлимитное расписание', included: true },
        { text: 'Безлимитные задачи', included: true },
        { text: 'Безлимитные AI-вопросы', included: true },
        { text: 'Безлимитные материалы', included: true },
        { text: 'Безлимит зачётной книжки', included: true },
        { text: 'Помодоро-таймер с аналитикой', included: true },
        { text: 'Заморозка стрика (1 раз/нед)', included: true }
      ],
      current: currentPlan === 'premium',
      buttonText: currentPlan === 'premium' ? 'Активен' : 'Купить на полгода',
      color: 'gradient'
    },
    {
      name: 'Год',
      price: '2 399₽',
      period: 'за год, автопродление',
      pricePerMonth: '200₽/мес',
      badge: 'Выгода 33%',
      savings: '1 189₽',
      planId: '1year',
      features: [
        { text: 'Безлимитное расписание', included: true },
        { text: 'Безлимитные задачи', included: true },
        { text: 'Безлимитные AI-вопросы', included: true },
        { text: 'Безлимитные материалы', included: true },
        { text: 'Безлимит зачётной книжки', included: true },
        { text: 'Помодоро-таймер с аналитикой', included: true },
        { text: 'Заморозка стрика + приоритет', included: true }
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
                <p className="text-[10px] sm:text-xs text-purple-600/70 font-medium">Подписка с автопродлением</p>
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
              className={`p-4 sm:p-6 relative overflow-hidden flex flex-col ${
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

              <div className="space-y-1.5 sm:space-y-2 mb-4 sm:mb-6 flex-grow">
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
                <div className="space-y-2 mt-auto">
                  <Button
                    onClick={handleBuyPremium}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-purple-500/30 text-xs sm:text-sm h-9 sm:h-10"
                  >
                    💳 Купить Премиум
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
              ) : plan.color === 'gold' && !plan.current ? (
                <Button
                  onClick={handleBuyPremium}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-lg shadow-orange-500/30 text-xs sm:text-sm h-9 sm:h-10 mt-auto"
                >
                  {plan.buttonText}
                </Button>
              ) : (
                <Button
                  disabled
                  className="w-full bg-gray-200 text-gray-600 cursor-not-allowed text-xs sm:text-sm h-9 sm:h-10 mt-auto"
                >
                  {plan.buttonText}
                </Button>
              )}


            </Card>
          ))}
        </div>

        {/* ЕГЭ / ОГЭ тарифы */}
        <div className="mt-10 sm:mt-16">
          <div className="text-center mb-6 sm:mb-10">
            <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-200 px-4 py-1.5 rounded-full mb-3">
              <Icon name="GraduationCap" size={16} className="text-violet-600" />
              <span className="text-sm font-semibold text-violet-700">Для сдающих ЕГЭ и ОГЭ</span>
            </div>
            <h2 className="text-xl sm:text-3xl font-bold text-gray-900 mb-2">Подготовка к экзаменам</h2>
            <p className="text-sm sm:text-base text-gray-500">ИИ-репетитор знает структуру всех экзаменов и объясняет каждое задание</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
            {/* Бесплатно */}
            <Card className="p-5 sm:p-6 border-2 border-gray-200 flex flex-col">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Пробный</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-3xl font-bold text-gray-900">0₽</span>
              </div>
              <p className="text-xs text-gray-400 mb-4">навсегда</p>
              <ul className="space-y-2 text-sm text-gray-600 flex-1 mb-5">
                <li className="flex items-center gap-2"><Icon name="Check" size={15} className="text-green-500 flex-shrink-0" />5 вопросов к ИИ-репетитору в день</li>
                <li className="flex items-center gap-2"><Icon name="Check" size={15} className="text-green-500 flex-shrink-0" />Объяснение любой темы</li>
                <li className="flex items-center gap-2"><Icon name="Check" size={15} className="text-green-500 flex-shrink-0" />Тренировка заданий</li>
                <li className="flex items-center gap-2"><Icon name="X" size={15} className="text-gray-300 flex-shrink-0" />Безлимитные тренировки</li>
                <li className="flex items-center gap-2"><Icon name="X" size={15} className="text-gray-300 flex-shrink-0" />Разбор ошибок по истории</li>
              </ul>
              <Button disabled className="w-full bg-gray-100 text-gray-500 cursor-not-allowed text-sm h-10">
                Текущий тариф
              </Button>
            </Card>

            {/* Месяц ЕГЭ */}
            <Card className="p-5 sm:p-6 border-2 border-violet-400 flex flex-col relative overflow-hidden shadow-lg shadow-violet-100">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
              <div className="absolute top-3 right-3">
                <span className="text-[10px] font-bold bg-violet-600 text-white px-2 py-0.5 rounded-full">Популярный</span>
              </div>
              <p className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-1">Месяц подготовки</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-3xl font-bold text-gray-900">199₽</span>
              </div>
              <p className="text-xs text-gray-400 mb-4">за месяц, автопродление</p>
              <ul className="space-y-2 text-sm text-gray-600 flex-1 mb-5">
                <li className="flex items-center gap-2"><Icon name="Check" size={15} className="text-violet-500 flex-shrink-0" />Безлимитные вопросы к ИИ</li>
                <li className="flex items-center gap-2"><Icon name="Check" size={15} className="text-violet-500 flex-shrink-0" />Тренировка по всем заданиям</li>
                <li className="flex items-center gap-2"><Icon name="Check" size={15} className="text-violet-500 flex-shrink-0" />Все предметы ЕГЭ и ОГЭ</li>
                <li className="flex items-center gap-2"><Icon name="Check" size={15} className="text-violet-500 flex-shrink-0" />Подробный разбор ошибок</li>
                <li className="flex items-center gap-2"><Icon name="Check" size={15} className="text-violet-500 flex-shrink-0" />Все функции для студентов</li>
              </ul>
              <Button
                onClick={handleBuyPremium}
                className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-sm h-10 shadow-md shadow-violet-200"
              >
                Начать подготовку
              </Button>
            </Card>

            {/* 3 месяца ЕГЭ */}
            <Card className="p-5 sm:p-6 border-2 border-amber-300 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
              <div className="absolute top-3 right-3">
                <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">Выгода 25%</span>
              </div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">3 месяца к сессии</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-3xl font-bold text-gray-900">449₽</span>
              </div>
              <p className="text-xs text-gray-400 mb-1">за 3 месяца · 150₽/мес</p>
              <p className="text-xs text-green-600 font-medium mb-4">Экономия 149₽</p>
              <ul className="space-y-2 text-sm text-gray-600 flex-1 mb-5">
                <li className="flex items-center gap-2"><Icon name="Check" size={15} className="text-amber-500 flex-shrink-0" />Всё из месячного плана</li>
                <li className="flex items-center gap-2"><Icon name="Check" size={15} className="text-amber-500 flex-shrink-0" />Охватывает весь учебный квартал</li>
                <li className="flex items-center gap-2"><Icon name="Check" size={15} className="text-amber-500 flex-shrink-0" />Идеально для подготовки к ОГЭ</li>
                <li className="flex items-center gap-2"><Icon name="Check" size={15} className="text-amber-500 flex-shrink-0" />Идеально для финального спурта ЕГЭ</li>
                <li className="flex items-center gap-2"><Icon name="Check" size={15} className="text-amber-500 flex-shrink-0" />Все функции для студентов</li>
              </ul>
              <Button
                onClick={handleBuyPremium}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm h-10 shadow-md shadow-amber-100"
              >
                Выбрать 3 месяца
              </Button>
            </Card>
          </div>

          <div className="text-center bg-violet-50 rounded-2xl p-4 sm:p-5 border border-violet-100">
            <p className="text-sm text-gray-600">
              Все тарифы ЕГЭ/ОГЭ включают полный доступ к приложению для студентов вузов — расписание, задачи, помодоро, зачётная книжка
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Pricing;