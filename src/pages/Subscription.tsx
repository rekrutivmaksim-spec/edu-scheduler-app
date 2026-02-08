import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

const PAYMENTS_URL = 'https://functions.poehali.dev/b45c4361-c9fa-4b81-b687-67d3a9406f1b';
const SUBSCRIPTION_URL = 'https://functions.poehali.dev/7fe183c2-49af-4817-95f3-6ab4912778c4';

interface Plan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
}

interface TokenPack {
  id: string;
  name: string;
  price: number;
  tokens: number;
}

interface Payment {
  id: number;
  amount: number;
  plan_type: string;
  payment_status: string;
  created_at: string;
  completed_at?: string;
  expires_at?: string;
}

const Subscription = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tokenPacks, setTokenPacks] = useState<TokenPack[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (!authService.isAuthenticated()) {
        navigate('/login');
        return;
      }
      await loadData();
    };
    checkAuth();
  }, [navigate]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadPlans(),
        loadTokenPacks(),
        loadSubscriptionStatus(),
        loadPaymentHistory()
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${PAYMENTS_URL}?action=plans`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans);
      }
    } catch (error) {
      console.error('Failed to load plans:', error);
    }
  };

  const loadTokenPacks = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${PAYMENTS_URL}?action=token_packs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTokenPacks(data.token_packs);
      }
    } catch (error) {
      console.error('Failed to load token packs:', error);
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
        setSubscriptionStatus(data);
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
    }
  };

  const loadPaymentHistory = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${PAYMENTS_URL}?action=history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPayments(data.payments);
      }
    } catch (error) {
      console.error('Failed to load payment history:', error);
    }
  };

  const handleBuySubscription = async (planId: string) => {
    setSelectedPlan(planId);
    setIsProcessing(true);

    try {
      const token = authService.getToken();
      
      // Создаем платеж в Т-кассе
      const createResponse = await fetch(PAYMENTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'create_payment',
          plan_type: planId
        })
      });

      if (!createResponse.ok) {
        throw new Error('Не удалось создать платеж');
      }

      const createData = await createResponse.json();
      
      console.log('[PAYMENT] Ответ от backend:', createData);
      
      // Проверяем наличие ошибок от backend
      if (createData.payment?.error) {
        throw new Error(createData.payment.error);
      }
      
      const paymentId = createData.payment.id;
      const paymentUrl = createData.payment_url;
      const tinkoffPaymentId = createData.tinkoff_payment_id;

      console.log('[PAYMENT] Payment URL:', paymentUrl);
      console.log('[PAYMENT] Tinkoff Payment ID:', tinkoffPaymentId);

      if (!paymentUrl || !tinkoffPaymentId) {
        const errorMsg = createData.payment?.error || 'Ошибка при создании платежа в Т-кассе';
        throw new Error(errorMsg);
      }

      console.log('[PAYMENT] Открываем окно оплаты:', paymentUrl);

      toast({
        title: '💳 Переход к оплате',
        description: 'Открываем страницу оплаты Т-касса...'
      });

      // Открываем страницу оплаты в новой вкладке
      const paymentWindow = window.open(paymentUrl, '_blank');
      
      console.log('[PAYMENT] Window.open result:', paymentWindow);

      if (!paymentWindow) {
        toast({
          title: '⚠️ Всплывающее окно заблокировано',
          description: 'Разрешите всплывающие окна для этого сайта или нажмите снова',
          variant: 'destructive'
        });
        // Пробуем открыть в текущей вкладке как запасной вариант
        window.location.href = paymentUrl;
        return;
      }

      // Проверяем статус платежа каждые 3 секунды
      const checkInterval = setInterval(async () => {
        try {
          const checkResponse = await fetch(PAYMENTS_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              action: 'check_payment',
              payment_id: paymentId,
              tinkoff_payment_id: tinkoffPaymentId
            })
          });

          if (checkResponse.ok) {
            const checkData = await checkResponse.json();

            if (checkData.status === 'completed') {
              clearInterval(checkInterval);
              
              if (paymentWindow && !paymentWindow.closed) {
                paymentWindow.close();
              }

              toast({
                title: '🎉 Подписка активирована!',
                description: 'Теперь у вас есть доступ к ИИ-ассистенту'
              });

              await loadData();
              setIsProcessing(false);
              setSelectedPlan(null);
            } else if (checkData.status === 'failed') {
              clearInterval(checkInterval);

              toast({
                title: 'Оплата не прошла',
                description: checkData.message || 'Попробуйте снова',
                variant: 'destructive'
              });

              setIsProcessing(false);
              setSelectedPlan(null);
            }
          }
        } catch (error) {
          console.error('Ошибка проверки платежа:', error);
        }
      }, 3000);

      // Останавливаем проверку через 10 минут
      setTimeout(() => {
        clearInterval(checkInterval);
        if (isProcessing) {
          setIsProcessing(false);
          setSelectedPlan(null);
          toast({
            title: 'Время ожидания истекло',
            description: 'Проверьте статус платежа позже',
            variant: 'destructive'
          });
        }
      }, 600000);

    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось оформить подписку',
        variant: 'destructive'
      });
      setIsProcessing(false);
      setSelectedPlan(null);
    }
  };

  const getPlanBadge = (planId: string) => {
    if (planId === '1month') return { text: 'Базовый', color: 'bg-blue-500' };
    if (planId === '3months') return { text: 'Популярный', color: 'bg-purple-500' };
    if (planId === '6months') return { text: 'Выгодный', color: 'bg-green-500' };
    return { text: '', color: '' };
  };

  const getStatusBadge = (status: string) => {
    if (status === 'completed') return { text: 'Оплачен', color: 'bg-green-500' };
    if (status === 'pending') return { text: 'Ожидает', color: 'bg-yellow-500' };
    if (status === 'failed') return { text: 'Ошибка', color: 'bg-red-500' };
    return { text: status, color: 'bg-gray-500' };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <Icon name="Loader2" size={48} className="animate-spin text-purple-600" />
      </div>
    );
  }

  const isPremium = subscriptionStatus?.is_premium;
  const isTrial = subscriptionStatus?.is_trial;
  const expiresAt = subscriptionStatus?.subscription_expires_at;
  const trialEndsAt = subscriptionStatus?.trial_ends_at;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <header className="bg-white/70 backdrop-blur-xl border-b border-purple-200/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/profile')}
                className="rounded-xl hover:bg-purple-100/50"
              >
                <Icon name="ArrowLeft" size={24} className="text-purple-600" />
              </Button>
              <div>
                <h1 className="text-2xl font-heading font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Подписка
                </h1>
                <p className="text-xs text-purple-600/70 font-medium">Доступ к ИИ-ассистенту</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Пробный период */}
        {!isPremium && isTrial && trialEndsAt && (
          <Card className="p-6 mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center">
                  <Icon name="Gift" size={32} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-1">🎁 Пробный период активен</h3>
                  <p className="text-sm text-gray-600">
                    Действует до {new Date(trialEndsAt).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Полный доступ ко всем функциям ИИ-ассистента, материалам и прогнозам экзаменов
                  </p>
                </div>
              </div>
              <Badge className="bg-blue-500 text-white text-lg px-4 py-2">2 дня</Badge>
            </div>
          </Card>
        )}

        {/* Текущий статус подписки */}
        {isPremium && (
          <Card className="p-6 mb-8 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center">
                  <Icon name="CheckCircle2" size={32} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-1">Premium подписка активна</h3>
                  <p className="text-sm text-gray-600">
                    Действует до {new Date(expiresAt).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
              <Badge className="bg-green-500 text-white text-lg px-4 py-2">Активна</Badge>
            </div>
          </Card>
        )}

        {/* Тарифы */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Выберите подписку</h2>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg mb-6">
            <p className="text-sm text-blue-900">
              <Icon name="Info" size={16} className="inline mr-1" />
              <strong>Важно:</strong> Подписка не продлевается автоматически. Для продления необходимо повторить оплату после окончания срока действия.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const badge = getPlanBadge(plan.id);
              const pricePerMonth = Math.round(plan.price / (plan.duration_days / 30));
              const discount = plan.id === '3months' ? 16 : plan.id === '6months' ? 17 : 0;

              return (
                <Card
                  key={plan.id}
                  className={`p-6 bg-white hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 ${
                    plan.id === '3months' ? 'border-4 border-purple-500 relative' : 'border-2 border-gray-200'
                  }`}
                >
                  {plan.id === '3months' && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <Badge className="bg-purple-500 text-white px-4 py-1">Популярный</Badge>
                    </div>
                  )}
                  
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">{plan.name}</h3>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-4xl font-bold text-purple-600">{plan.price}</span>
                      <span className="text-gray-600">₽</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">{pricePerMonth} ₽/месяц</p>
                    {discount > 0 && (
                      <Badge variant="outline" className="mt-2 border-green-500 text-green-600">
                        Экономия {discount}%
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2">
                      <Icon name="Check" size={20} className="text-green-500" />
                      <span className="text-sm text-gray-700">Безлимитный доступ к ИИ-ассистенту</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon name="Check" size={20} className="text-green-500" />
                      <span className="text-sm text-gray-700">Ответы на вопросы по материалам</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon name="Check" size={20} className="text-green-500" />
                      <span className="text-sm text-gray-700">Умный чат с DeepSeek AI</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon name="Check" size={20} className="text-green-500" />
                      <span className="text-sm text-gray-700">Поддержка 24/7</span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 mb-4 space-y-1">
                    <p className="font-semibold text-purple-600">🎁 Первые 2 дня бесплатно!</p>
                    <p>• Подписка НЕ продлевается автоматически</p>
                    <p>• Возврат возможен в течение 14 дней при отсутствии использования</p>
                  </div>

                  <Button
                    onClick={() => handleBuySubscription(plan.id)}
                    disabled={isProcessing || isPremium}
                    className={`w-full ${
                      plan.id === '3months'
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
                    } text-white rounded-xl shadow-lg`}
                  >
                    {isProcessing && selectedPlan === plan.id ? (
                      <>
                        <Icon name="Loader2" size={20} className="mr-2 animate-spin" />
                        Оформление...
                      </>
                    ) : isPremium ? (
                      'Уже активна'
                    ) : (
                      'Оформить подписку'
                    )}
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Дополнительные пакеты токенов */}
        {isPremium && tokenPacks.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Нужно больше запросов?</h2>
            <p className="text-sm text-gray-600 mb-6">Докупите дополнительные токены для ИИ-ассистента</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {tokenPacks.map((pack) => {
                const wordsCount = Math.round(pack.tokens * 1.3);
                
                return (
                  <Card
                    key={pack.id}
                    className="p-6 bg-white border-2 border-blue-200 hover:shadow-xl transition-all"
                  >
                    <div className="text-center mb-4">
                      <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <Icon name="Zap" size={24} className="text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-800 mb-2">{pack.name}</h3>
                      <div className="flex items-baseline justify-center gap-2">
                        <span className="text-3xl font-bold text-blue-600">{pack.price}</span>
                        <span className="text-gray-600">₽</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">≈{wordsCount.toLocaleString('ru-RU')} слов</p>
                    </div>

                    <div className="bg-blue-50 rounded-lg p-3 mb-4">
                      <p className="text-xs text-blue-900 text-center">
                        Добавляется к текущему лимиту
                      </p>
                    </div>

                    <Button
                      onClick={() => handleBuySubscription(pack.id)}
                      disabled={isProcessing}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                    >
                      {isProcessing && selectedPlan === pack.id ? (
                        <>
                          <Icon name="Loader2" size={20} className="mr-2 animate-spin" />
                          Оформление...
                        </>
                      ) : (
                        'Купить токены'
                      )}
                    </Button>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* История платежей */}
        {payments.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">История платежей</h2>
            <Card className="p-6 bg-white">
              <div className="space-y-4">
                {payments.map((payment) => {
                  const statusBadge = getStatusBadge(payment.payment_status);
                  const plan = plans.find(p => p.id === payment.plan_type);

                  return (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                          <Icon name="CreditCard" size={24} className="text-purple-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">{plan?.name || payment.plan_type}</h4>
                          <p className="text-sm text-gray-500">
                            {new Date(payment.created_at).toLocaleDateString('ru-RU', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-800 text-lg">{payment.amount} ₽</p>
                        <Badge className={`${statusBadge.color} text-white mt-1`}>
                          {statusBadge.text}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default Subscription;