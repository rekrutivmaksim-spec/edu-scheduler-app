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

interface QuestionPack {
  id: string;
  name: string;
  price: number;
  questions: number;
}

interface SeasonalPlan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
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

const FAQ_ITEMS = [
  { q: 'Как происходит оплата?', a: 'Через защищённый шлюз Т-Касса (Тинькофф). Карта привязывается для автопродления.' },
  { q: 'Подписка продлевается автоматически?', a: 'Да, подписка продлевается автоматически. Ты можешь отключить автопродление в любой момент.' },
  { q: 'Как отключить автопродление?', a: 'В разделе «Подписка» переключи тумблер «Автопродление». Подписка доработает до конца оплаченного периода.' },
  { q: 'Могу ли я вернуть деньги?', a: '14 дней на возврат, если не использовал(а) платные функции.' },
  { q: 'Что будет после окончания?', a: 'Без автопродления базовые функции остаются + 5 бесплатных вопросов ИИ в день.' },
  { q: 'Какие способы оплаты?', a: 'Карты МИР/Visa/MC, СБП, SberPay.' },
];

const Subscription = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tokenPacks, setTokenPacks] = useState<TokenPack[]>([]);
  const [questionPacks, setQuestionPacks] = useState<QuestionPack[]>([]);
  const [seasonalPlans, setSeasonalPlans] = useState<SeasonalPlan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    is_premium?: boolean;
    is_trial?: boolean;
    subscription_type?: string;
    subscription_expires_at?: string;
    trial_ends_at?: string;
  } | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [autoRenewInfo, setAutoRenewInfo] = useState<{
    auto_renew?: boolean;
    has_card?: boolean;
    card_last4?: string;
    next_charge_date?: string;
    next_charge_amount?: number;
  } | null>(null);
  const [togglingAutoRenew, setTogglingAutoRenew] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      if (!authService.isAuthenticated()) {
        navigate('/auth');
        return;
      }
      const params = new URLSearchParams(window.location.search);
      if (params.get('payment') === 'success') {
        toast({ title: 'Оплата прошла успешно!', description: 'Подписка активируется в течение минуты' });
        window.history.replaceState({}, '', '/subscription');
      } else if (params.get('payment') === 'failed') {
        toast({ title: 'Оплата не прошла', description: 'Попробуйте снова или выберите другой способ', variant: 'destructive' });
        window.history.replaceState({}, '', '/subscription');
      }
      await loadData();
      // Автооткрытие покупки пакета из deep link (?buy=questions_60)
      const buyPack = params.get('buy');
      if (buyPack) {
        window.history.replaceState({}, '', '/subscription');
        setTimeout(() => handleBuySubscription(buyPack), 500);
      }
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
        loadPaymentHistory(),
        loadAutoRenewInfo()
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
    } catch { /* silent */ }
  };

  const loadTokenPacks = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${PAYMENTS_URL}?action=token_packs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTokenPacks(data.token_packs || []);
        setQuestionPacks(data.question_packs || []);
        setSeasonalPlans(data.seasonal_packs || []);
      }
    } catch { /* silent */ }
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
    } catch { /* silent */ }
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
    } catch { /* silent */ }
  };

  const loadAutoRenewInfo = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${PAYMENTS_URL}?action=auto_renew`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAutoRenewInfo(data);
      }
    } catch { /* silent */ }
  };

  const handleToggleAutoRenew = async () => {
    setTogglingAutoRenew(true);
    try {
      const token = authService.getToken();
      const newValue = !autoRenewInfo?.auto_renew;
      const response = await fetch(PAYMENTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'toggle_auto_renew', enabled: newValue })
      });
      if (response.ok) {
        setAutoRenewInfo(prev => prev ? { ...prev, auto_renew: newValue } : null);
        toast({
          title: newValue ? 'Автопродление включено' : 'Автопродление отключено',
          description: newValue 
            ? 'Подписка будет продлеваться автоматически' 
            : 'Подписка доработает до конца оплаченного периода'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось изменить настройку',
        variant: 'destructive'
      });
    } finally {
      setTogglingAutoRenew(false);
    }
  };

  const handleBuySubscription = async (planId: string) => {
    setSelectedPlan(planId);
    setIsProcessing(true);

    try {
      const token = authService.getToken();
      
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

      if (createData.payment?.error) {
        throw new Error(createData.payment.error);
      }

      const paymentId = createData.payment.id;
      const paymentUrl = createData.payment_url;
      const tinkoffPaymentId = createData.tinkoff_payment_id;

      if (!paymentUrl || !tinkoffPaymentId) {
        const errorMsg = createData.payment?.error || 'Ошибка при создании платежа в Т-кассе';
        throw new Error(errorMsg);
      }

      toast({
        title: 'Переход к оплате',
        description: 'Открываем страницу оплаты...'
      });

      const paymentWindow = window.open(paymentUrl, '_blank');

      if (!paymentWindow) {
        toast({
          title: 'Всплывающее окно заблокировано',
          description: 'Разрешите всплывающие окна или нажмите снова',
          variant: 'destructive'
        });
        window.location.href = paymentUrl;
        return;
      }

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
                title: 'Подписка активирована!',
                description: 'Полный доступ ко всем функциям'
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
        } catch { /* silent */ }
      }, 3000);

      setTimeout(() => {
        clearInterval(checkInterval);
        setIsProcessing(false);
        setSelectedPlan(null);
        toast({
          title: 'Время ожидания истекло',
          description: 'Проверьте статус платежа позже',
          variant: 'destructive'
        });
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

  const handleActivateTrial = async () => {
    setIsProcessing(true);
    try {
      const token = authService.getToken();
      const response = await fetch(SUBSCRIPTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'upgrade_demo' })
      });
      const data = await response.json();
      if (response.ok) {
        toast({ title: '🎉 Пробный период активирован!', description: '7 дней безлимитного доступа — пользуйся на полную!' });
        await loadSubscriptionStatus();
      } else {
        toast({ title: 'Не удалось активировать', description: data.error || 'Пробный период уже был использован', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Попробуй снова', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
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
    <div className="min-h-[100dvh] bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <header className="bg-white/70 backdrop-blur-xl border-b border-purple-200/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="rounded-xl hover:bg-purple-100/50 h-9 w-9 sm:h-10 sm:w-10"
            >
              <Icon name="ArrowLeft" size={20} className="text-purple-600" />
            </Button>
            <div>
              <h1 className="text-lg sm:text-2xl font-heading font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Подписка
              </h1>
              <p className="text-[10px] sm:text-xs text-purple-600/70 font-medium">Управление тарифом</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-nav md:pb-8 space-y-4 sm:space-y-6">

        {/* Кнопка активации пробного периода */}
        {!isPremium && !isTrial && (
          <Card className="p-5 bg-gradient-to-br from-violet-600 to-purple-700 border-0 shadow-xl shadow-purple-500/30">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Icon name="Gift" size={24} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-white">7 дней бесплатно</h3>
                <p className="text-sm text-purple-200 mt-0.5">Попробуй всё без ограничений — ИИ-ассистент, материалы, расписание</p>
              </div>
              <Button
                onClick={handleActivateTrial}
                disabled={isProcessing}
                className="flex-shrink-0 bg-white text-purple-700 hover:bg-purple-50 font-bold rounded-xl px-6 h-10 shadow-lg"
              >
                {isProcessing ? <Icon name="Loader2" size={16} className="animate-spin" /> : 'Активировать бесплатно'}
              </Button>
            </div>
          </Card>
        )}

        {/* Статус: Триал */}
        {!isPremium && isTrial && trialEndsAt && (
          <Card className="p-4 sm:p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Icon name="Gift" size={24} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-gray-800">Пробный период активен</h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  До {new Date(trialEndsAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <Badge className="bg-blue-500 text-white text-xs px-2 py-0.5 flex-shrink-0">7 дней</Badge>
            </div>
          </Card>
        )}

        {/* Статус: Премиум активен */}
        {isPremium && expiresAt && (
          <Card className="p-4 sm:p-5 bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-green-300">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Icon name="Crown" size={24} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-gray-800">Premium активна</h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  До {new Date(expiresAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <Badge className="bg-green-500 text-white text-xs px-2 py-0.5 flex-shrink-0">Активна</Badge>
            </div>
          </Card>
        )}

        {/* Управление автопродлением */}
        {isPremium && autoRenewInfo && (
          <Card className="p-4 sm:p-5 bg-white border-2 border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon name="RefreshCw" size={20} className="text-purple-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">Автопродление</h3>
                  {autoRenewInfo.has_card && autoRenewInfo.card_last4 ? (
                    <p className="text-xs text-gray-500">Карта •••• {autoRenewInfo.card_last4}</p>
                  ) : (
                    <p className="text-xs text-gray-500">Карта будет привязана при следующей оплате</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleToggleAutoRenew}
                disabled={togglingAutoRenew}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                  autoRenewInfo.auto_renew ? 'bg-purple-600' : 'bg-gray-300'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                  autoRenewInfo.auto_renew ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>
            {autoRenewInfo.auto_renew && autoRenewInfo.next_charge_date && autoRenewInfo.next_charge_amount && (
              <p className="text-xs text-gray-400 mt-2 ml-13">
                Следующее списание {autoRenewInfo.next_charge_amount} ₽ — {new Date(autoRenewInfo.next_charge_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              </p>
            )}
          </Card>
        )}

        {/* Тарифы */}
        {!isPremium && plans.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-gray-800">Выберите тариф</h2>

            {plans.map((plan) => {
              const pricePerMonth = Math.round(plan.price / (plan.duration_days / 30));
              const isPopular = plan.id === '6months';
              const discount = plan.id === '6months' ? 16 : plan.id === '1year' ? 33 : 0;

              return (
                <Card
                  key={plan.id}
                  className={`p-4 sm:p-5 relative transition-all duration-200 ${
                    isPopular
                      ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-purple-400 shadow-lg shadow-purple-500/10'
                      : 'bg-white border-2 border-gray-200'
                  }`}
                >
                  {isPopular && (
                    <Badge className="absolute -top-2.5 right-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[10px] px-2.5 py-0.5">
                      Популярный
                    </Badge>
                  )}

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-gray-800">{plan.name}</h3>
                        {discount > 0 && (
                          <Badge variant="outline" className="border-green-400 text-green-600 text-[10px] px-1.5 py-0">
                            -{discount}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{pricePerMonth} ₽/мес · 20 ИИ-вопросов/день</p>
                    </div>

                    <div className="text-right flex-shrink-0 mr-2">
                      <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        {plan.price}
                      </span>
                      <span className="text-sm text-gray-500 ml-0.5">₽</span>
                    </div>

                    <Button
                      onClick={() => handleBuySubscription(plan.id)}
                      disabled={isProcessing}
                      className={`flex-shrink-0 rounded-xl text-xs sm:text-sm h-9 sm:h-10 px-4 ${
                        isPopular
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/30'
                          : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white'
                      }`}
                    >
                      {isProcessing && selectedPlan === plan.id ? (
                        <Icon name="Loader2" size={16} className="animate-spin" />
                      ) : (
                        'Оформить'
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Пакеты вопросов — для всех */}
        {questionPacks.length > 0 && (
          <div className="space-y-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-800">Дополнительные вопросы</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {isPremium
                  ? 'Сверх 20 вопросов в день — не сгорают, накапливаются'
                  : 'Не сгорают, накапливаются. При покупке подписки +15 бонусных вопросов'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {questionPacks.map((pack) => {
                const isPopularPack = pack.id === 'questions_30';
                return (
                  <Card
                    key={pack.id}
                    className={`p-3 sm:p-4 relative flex flex-col items-center text-center transition-all ${
                      isPopularPack
                        ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-400 shadow-md shadow-indigo-100'
                        : 'bg-white border-2 border-gray-200'
                    }`}
                  >
                    {isPopularPack && (
                      <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[10px] px-2 py-0">
                        Популярный
                      </Badge>
                    )}
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center mb-2 ${
                      isPopularPack ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gradient-to-br from-amber-400 to-orange-500'
                    }`}>
                      <Icon name="MessageCircle" size={16} className="text-white" />
                    </div>
                    <p className="text-lg sm:text-xl font-bold text-gray-800">{pack.questions}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500 mb-2">вопросов</p>
                    <Button
                      onClick={() => handleBuySubscription(pack.id)}
                      disabled={isProcessing}
                      size="sm"
                      className={`w-full text-xs sm:text-sm h-8 sm:h-9 rounded-lg ${
                        isPopularPack
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white'
                          : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                      }`}
                    >
                      {isProcessing && selectedPlan === pack.id ? (
                        <Icon name="Loader2" size={14} className="animate-spin" />
                      ) : (
                        `${pack.price} ₽`
                      )}
                    </Button>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Сезонный тариф */}
        {!isPremium && seasonalPlans.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-gray-800">Специальное предложение</h2>
            {seasonalPlans.map((plan) => (
              <Card key={plan.id} className="p-4 sm:p-5 bg-gradient-to-br from-rose-50 to-pink-50 border-2 border-rose-400 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-rose-300/20 rounded-full -mr-8 -mt-8" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-purple-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Icon name="Sparkles" size={24} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-gray-800">{plan.name}</h3>
                        <Badge className="bg-rose-500 text-white text-[10px] px-2 py-0">Сессия</Badge>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">30 дней безлимитного доступа</p>
                    </div>
                    <span className="text-xl font-bold bg-gradient-to-r from-rose-600 to-purple-600 bg-clip-text text-transparent flex-shrink-0">
                      {plan.price} ₽
                    </span>
                  </div>
                  <Button
                    onClick={() => handleBuySubscription(plan.id)}
                    disabled={isProcessing}
                    className="w-full bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-600 hover:to-purple-700 text-white rounded-xl text-sm h-10"
                  >
                    {isProcessing && selectedPlan === plan.id ? (
                      <Icon name="Loader2" size={16} className="animate-spin mr-2" />
                    ) : (
                      'Купить тариф'
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Пакеты токенов (для премиум) */}
        {isPremium && tokenPacks.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-gray-800">Дополнительные токены</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {tokenPacks.map((pack) => (
                <Card key={pack.id} className="p-4 bg-white border-2 border-blue-200">
                  <div className="text-center mb-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <Icon name="Zap" size={20} className="text-white" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-800">{pack.name}</h3>
                    <span className="text-lg font-bold text-blue-600">{pack.price} ₽</span>
                  </div>
                  <Button
                    onClick={() => handleBuySubscription(pack.id)}
                    disabled={isProcessing}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm h-9"
                  >
                    {isProcessing && selectedPlan === pack.id ? (
                      <Icon name="Loader2" size={16} className="animate-spin" />
                    ) : (
                      'Купить'
                    )}
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Доверие */}
        <div className="flex items-center justify-center gap-4 sm:gap-6 py-2">
          <div className="flex items-center gap-1.5">
            <Icon name="Lock" size={14} className="text-gray-400" />
            <span className="text-[10px] sm:text-xs text-gray-400">Т-Касса</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Icon name="ShieldCheck" size={14} className="text-gray-400" />
            <span className="text-[10px] sm:text-xs text-gray-400">Автопродление</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Icon name="RotateCcw" size={14} className="text-gray-400" />
            <span className="text-[10px] sm:text-xs text-gray-400">Возврат 14 дней</span>
          </div>
        </div>

        {/* Способы оплаты */}
        <div className="flex items-center justify-center gap-2">
          <Badge variant="outline" className="border-gray-200 text-gray-500 text-[10px] font-normal">
            <Icon name="CreditCard" size={12} className="mr-1" />МИР / Visa / MC
          </Badge>
          <Badge variant="outline" className="border-gray-200 text-gray-500 text-[10px] font-normal">
            <Icon name="Smartphone" size={12} className="mr-1" />СБП
          </Badge>
          <Badge variant="outline" className="border-gray-200 text-gray-500 text-[10px] font-normal">
            <Icon name="Wallet" size={12} className="mr-1" />SberPay
          </Badge>
        </div>

        {/* FAQ */}
        <div className="space-y-2">
          <h2 className="text-base sm:text-lg font-bold text-gray-800">Частые вопросы</h2>
          {FAQ_ITEMS.map((item, i) => (
            <Card key={i} className="bg-white border border-gray-200 overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-3 sm:p-4 text-left"
              >
                <span className="text-sm font-medium text-gray-800 pr-2">{item.q}</span>
                <Icon
                  name="ChevronDown"
                  size={16}
                  className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}
                />
              </button>
              {openFaq === i && (
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 -mt-1">
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{item.a}</p>
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* История платежей */}
        {payments.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-gray-800">История платежей</h2>
            <Card className="bg-white border border-gray-200 divide-y divide-gray-100">
              {payments.map((payment) => {
                const statusBadge = getStatusBadge(payment.payment_status);
                return (
                  <div key={payment.id} className="flex items-center justify-between p-3 sm:p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Icon name="CreditCard" size={18} className="text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{payment.plan_type}</p>
                        <p className="text-[10px] text-gray-500">
                          {new Date(payment.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-800">{payment.amount} ₽</span>
                      <Badge className={`${statusBadge.color} text-white text-[10px] px-1.5 py-0`}>
                        {statusBadge.text}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default Subscription;