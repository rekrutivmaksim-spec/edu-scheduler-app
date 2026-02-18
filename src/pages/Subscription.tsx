import { useState, useEffect, useCallback } from 'react';
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

/* ──────────────── countdown helper ──────────────── */
const getSecondsUntilMidnight = () => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(23, 59, 59, 999);
  return Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
};

const formatCountdown = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return { h: String(h).padStart(2, '0'), m: String(m).padStart(2, '0'), s: String(s).padStart(2, '0') };
};

/* ──────────────── FAQ data ──────────────── */
const FAQ_ITEMS = [
  {
    q: 'Как происходит оплата?',
    a: 'Оплата проходит через защищённый платёжный шлюз Т-Касса (Тинькофф). Мы не храним данные вашей карты — вся информация обрабатывается на стороне банка.',
  },
  {
    q: 'Подписка продлевается автоматически?',
    a: 'Нет. Подписка НЕ продлевается автоматически. После окончания срока вы сами решаете, продлевать или нет. Никаких скрытых списаний.',
  },
  {
    q: 'Могу ли я вернуть деньги?',
    a: 'Да. В течение 14 дней после оплаты вы можете запросить полный возврат, если не использовали платные функции. Напишите в поддержку.',
  },
  {
    q: 'Что будет после окончания подписки?',
    a: 'Вы сохраните доступ к базовым функциям и сможете задавать 3 бесплатных вопроса ИИ-ассистенту ежедневно.',
  },
  {
    q: 'Какие способы оплаты доступны?',
    a: 'Банковские карты (Visa, Mastercard, МИР), СБП (Система быстрых платежей), SberPay и другие способы, доступные через Т-Кассу.',
  },
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

  /* new UI-only state */
  const [countdown, setCountdown] = useState(getSecondsUntilMidnight);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [stickyPlanId, setStickyPlanId] = useState<string | null>(null);

  /* countdown timer */
  useEffect(() => {
    const id = setInterval(() => setCountdown(getSecondsUntilMidnight()), 1000);
    return () => clearInterval(id);
  }, []);

  /* track which plan section is in view for sticky CTA */
  const bestPlanRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting && plans.length > 0) {
            const popular = plans.find((p) => p.id === '3months');
            setStickyPlanId(popular?.id ?? plans[0]?.id ?? null);
          } else {
            setStickyPlanId(null);
          }
        },
        { threshold: 0 }
      );
      observer.observe(node);
      return () => observer.disconnect();
    },
    [plans]
  );

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
        setTokenPacks(data.token_packs || []);
        setQuestionPacks(data.question_packs || []);
        setSeasonalPlans(data.seasonal_packs || []);
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
  const { h, m, s } = formatCountdown(countdown);

  /* popular plan for sticky CTA */
  const stickyPlan = stickyPlanId ? plans.find((p) => p.id === stickyPlanId) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 pb-0">
      {/* ─── Header ─── */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-purple-200/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                className="rounded-xl hover:bg-purple-100/50 h-10 w-10 sm:h-10 sm:w-10 min-h-[44px] min-w-[44px]"
              >
                <Icon name="ArrowLeft" size={20} className="text-purple-600 sm:w-6 sm:h-6" />
              </Button>
              <div>
                <h1 className="text-lg sm:text-2xl font-heading font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Подписка
                </h1>
                <p className="text-xs text-purple-600/70 font-medium">Полный доступ ко всем функциям</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-36 md:pb-8">
        {/* ─── Social proof banner ─── */}
        {!isPremium && (
          <div className="flex items-center justify-center gap-2 py-2.5 px-4 mb-4 rounded-xl bg-purple-600/10 border border-purple-300/40">
            <Icon name="Users" size={16} className="text-purple-600 flex-shrink-0" />
            <span className="text-sm font-semibold text-purple-800">
              Выбор 500+ студентов
            </span>
            <span className="text-xs text-purple-600/80 hidden sm:inline">
              — присоединяйтесь к тем, кто учится эффективнее
            </span>
          </div>
        )}

        {/* ─── Urgency: countdown timer ─── */}
        {!isPremium && (
          <div className="mb-5 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 p-[1px]">
            <div className="rounded-2xl bg-gradient-to-r from-orange-50 to-rose-50 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Icon name="Clock" size={18} className="text-orange-600" />
                <span className="text-sm font-bold text-orange-900">Специальная цена действует ещё:</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-orange-600 text-white font-mono font-bold text-base">{h}</span>
                <span className="text-orange-600 font-bold">:</span>
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-orange-600 text-white font-mono font-bold text-base">{m}</span>
                <span className="text-orange-600 font-bold">:</span>
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-orange-600 text-white font-mono font-bold text-base">{s}</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── Trial banner ─── */}
        {!isPremium && isTrial && trialEndsAt && (
          <Card className="p-4 sm:p-6 mb-5 sm:mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Icon name="Gift" size={24} className="text-white sm:w-8 sm:h-8" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-xl font-bold text-gray-800">Пробный период</h3>
                    <Badge className="bg-blue-500 text-white text-xs px-2 py-0.5 sm:hidden">7 дней</Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                    До {new Date(trialEndsAt).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Полный доступ! После — 3 вопроса в день бесплатно
                  </p>
                </div>
              </div>
              <Badge className="bg-blue-500 text-white text-lg px-4 py-2 hidden sm:inline-flex">7 дней</Badge>
            </div>
          </Card>
        )}

        {/* ─── Active subscription status ─── */}
        {isPremium && (
          <Card className="p-4 sm:p-6 mb-6 sm:mb-8 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Icon name="CheckCircle2" size={24} className="text-white sm:w-8 sm:h-8" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-xl font-bold text-gray-800">Premium активна</h3>
                  <Badge className="bg-green-500 text-white text-xs px-2 py-0.5">Активна</Badge>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                  До {new Date(expiresAt!).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* ─── Subscription plans ─── */}
        <div className="mb-10" ref={bestPlanRef}>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Выберите подписку</h2>

          {/* trust strip */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-5 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <Icon name="Lock" size={14} className="text-green-600" />
              Безопасная оплата через Т-Кассу
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="ShieldCheck" size={14} className="text-green-600" />
              Без автопродления
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="RotateCcw" size={14} className="text-green-600" />
              14 дней возврат
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {plans.map((plan) => {
              const badge = getPlanBadge(plan.id);
              const pricePerMonth = Math.round(plan.price / (plan.duration_days / 30));
              const discount = plan.id === '3months' ? 16 : plan.id === '6months' ? 17 : 0;
              const isPopular = plan.id === '3months';

              return (
                <Card
                  key={plan.id}
                  className={`relative p-5 sm:p-6 bg-white transition-all duration-300 ${
                    isPopular
                      ? 'border-[3px] border-purple-500 shadow-xl shadow-purple-200/40 ring-2 ring-purple-300/30'
                      : 'border-2 border-gray-200 hover:shadow-lg'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <Badge className="bg-purple-600 text-white px-4 py-1 shadow-md text-xs">
                        <Icon name="Star" size={12} className="mr-1" />
                        Популярный
                      </Badge>
                    </div>
                  )}

                  <div className="text-center mb-5">
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">{plan.name}</h3>

                    {/* price block */}
                    <div className="flex items-end justify-center gap-1 mt-2">
                      <span className={`text-4xl sm:text-5xl font-extrabold ${isPopular ? 'text-purple-600' : 'text-gray-800'}`}>
                        {plan.price}
                      </span>
                      <span className="text-lg text-gray-500 mb-1">₽</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{pricePerMonth} ₽ / мес</p>
                    {discount > 0 && (
                      <Badge variant="outline" className="mt-2 border-green-500 text-green-600 text-xs">
                        Экономия {discount}%
                      </Badge>
                    )}
                  </div>

                  {/* features */}
                  <div className="space-y-2.5 mb-5">
                    {[
                      'Безлимитное расписание и задачи',
                      'Безлимитный ИИ-ассистент',
                      'Безлимитные материалы',
                      'Помодоро-таймер + заморозка стрика',
                    ].map((f) => (
                      <div key={f} className="flex items-center gap-2">
                        <Icon name="Check" size={18} className="text-green-500 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{f}</span>
                      </div>
                    ))}
                  </div>

                  {/* fine-print */}
                  <div className="text-[11px] leading-relaxed text-gray-400 mb-4 space-y-0.5">
                    <p className="font-semibold text-purple-600 text-xs">Первые 24 часа бесплатно!</p>
                    <p>Подписка НЕ продлевается автоматически</p>
                    <p>После окончания: 3 бесплатных вопроса/день</p>
                  </div>

                  {/* CTA */}
                  <Button
                    onClick={() => handleBuySubscription(plan.id)}
                    disabled={isProcessing || isPremium}
                    className={`w-full min-h-[48px] text-base rounded-xl shadow-lg active:scale-[0.97] transition-transform ${
                      isPopular
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
                    } text-white`}
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

        {/* ─── Payment methods strip ─── */}
        {!isPremium && (
          <div className="mb-10 flex flex-col items-center gap-3">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Способы оплаты</p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { label: 'Карта МИР / Visa / MC', icon: 'CreditCard' },
                { label: 'СБП', icon: 'Smartphone' },
                { label: 'SberPay', icon: 'Wallet' },
              ].map((pm) => (
                <Badge
                  key={pm.label}
                  variant="outline"
                  className="gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border-gray-300 bg-white"
                >
                  <Icon name={pm.icon} size={14} className="text-gray-500" />
                  {pm.label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* ─── Guarantee section ─── */}
        {!isPremium && (
          <div className="mb-10 rounded-2xl bg-green-50 border border-green-200 p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center flex-shrink-0">
                <Icon name="ShieldCheck" size={24} className="text-green-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800 mb-1">Гарантия возврата 14 дней</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Если вам не понравится — вернём деньги в течение 14 дней без лишних вопросов. Просто напишите в поддержку, и мы оформим возврат.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── Question packs ─── */}
        {!isPremium && questionPacks.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">Нужны дополнительные вопросы?</h2>
            <p className="text-sm text-gray-600 mb-5">Купите пакет вопросов без подписки — доступно сразу после оплаты</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {questionPacks.map((pack) => (
                <Card
                  key={pack.id}
                  className="p-5 sm:p-6 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 hover:shadow-xl transition-all"
                >
                  <div className="text-center mb-4">
                    <div className="w-14 h-14 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Icon name="MessageCircle" size={28} className="text-white" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">{pack.name}</h3>
                    <div className="flex items-end justify-center gap-1">
                      <span className="text-4xl font-extrabold text-amber-600">{pack.price}</span>
                      <span className="text-gray-500 mb-1">₽</span>
                    </div>
                    <Badge className="mt-2 bg-amber-500 text-white text-xs">Разовая покупка</Badge>
                  </div>

                  <div className="bg-white rounded-xl p-4 mb-4 space-y-2">
                    {[
                      'Добавляется к вашим бесплатным вопросам',
                      'Не сгорает со временем',
                      'Мгновенная активация',
                    ].map((t) => (
                      <div key={t} className="flex items-start gap-2">
                        <Icon name="Check" size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700">{t}</p>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={() => handleBuySubscription(pack.id)}
                    disabled={isProcessing}
                    className="w-full min-h-[48px] text-base bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl shadow-lg active:scale-[0.97] transition-transform"
                  >
                    {isProcessing && selectedPlan === pack.id ? (
                      <>
                        <Icon name="Loader2" size={20} className="mr-2 animate-spin" />
                        Оформление...
                      </>
                    ) : (
                      'Купить вопросы'
                    )}
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ─── Seasonal plan ─── */}
        {!isPremium && seasonalPlans.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">Специальное предложение</h2>
            <p className="text-sm text-gray-600 mb-5">Доступно только в период сессии (январь и июнь)</p>
            <div className="grid grid-cols-1 gap-4 sm:gap-6 max-w-2xl mx-auto">
              {seasonalPlans.map((plan) => (
                <Card
                  key={plan.id}
                  className="p-6 sm:p-8 bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 border-[3px] border-rose-400 hover:shadow-2xl transition-all relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-rose-400/20 rounded-full -mr-16 -mt-16" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-400/20 rounded-full -ml-12 -mb-12" />

                  <div className="relative z-10">
                    <div className="text-center mb-6">
                      <Badge className="mb-4 bg-rose-500 text-white text-sm px-4 py-1">
                        Сезонный тариф
                      </Badge>
                      <h3 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">{plan.name}</h3>
                      <div className="flex items-end justify-center gap-1 mb-2">
                        <span className="text-5xl font-extrabold bg-gradient-to-r from-rose-600 to-purple-600 bg-clip-text text-transparent">
                          {plan.price}
                        </span>
                        <span className="text-gray-500 text-xl mb-1">₽</span>
                      </div>
                      <p className="text-sm text-gray-600">30 дней безлимитного доступа</p>
                    </div>

                    <div className="bg-white/80 backdrop-blur rounded-xl p-5 mb-6 space-y-3">
                      {[
                        { icon: 'Infinity', title: 'Безлимитный ИИ-ассистент', sub: 'Неограниченные вопросы весь месяц' },
                        { icon: 'BookOpen', title: 'Все материалы и конспекты', sub: 'Загружайте сколько угодно' },
                        { icon: 'TrendingUp', title: 'Прогноз экзаменационных вопросов', sub: 'ИИ анализирует и предсказывает' },
                        { icon: 'Calendar', title: 'Идеально для сессии', sub: 'Подготовься к экзаменам на 100%' },
                      ].map((item) => (
                        <div key={item.icon} className="flex items-start gap-3">
                          <Icon name={item.icon} size={22} className="text-purple-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-gray-800">{item.title}</p>
                            <p className="text-xs text-gray-600">{item.sub}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-rose-100 border-l-4 border-rose-500 rounded-lg p-4 mb-6">
                      <p className="text-sm text-rose-900 font-medium">
                        Ограниченное предложение! Тариф доступен только в январе и июне
                      </p>
                    </div>

                    <Button
                      onClick={() => handleBuySubscription(plan.id)}
                      disabled={isProcessing}
                      className="w-full min-h-[52px] bg-gradient-to-r from-rose-500 via-pink-500 to-purple-500 hover:from-rose-600 hover:via-pink-600 hover:to-purple-600 text-white rounded-xl shadow-xl text-lg active:scale-[0.97] transition-transform"
                    >
                      {isProcessing && selectedPlan === plan.id ? (
                        <>
                          <Icon name="Loader2" size={24} className="mr-2 animate-spin" />
                          Оформление...
                        </>
                      ) : (
                        <>
                          <Icon name="Sparkles" size={24} className="mr-2" />
                          Купить тариф "Сессия"
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ─── Token packs (premium only) ─── */}
        {isPremium && tokenPacks.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Нужно больше запросов?</h2>
            <p className="text-sm text-gray-600 mb-5">Докупите дополнительные токены для ИИ-ассистента</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {tokenPacks.map((pack) => {
                const wordsCount = Math.round(pack.tokens * 1.3);

                return (
                  <Card
                    key={pack.id}
                    className="p-5 sm:p-6 bg-white border-2 border-blue-200 hover:shadow-xl transition-all"
                  >
                    <div className="text-center mb-4">
                      <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <Icon name="Zap" size={24} className="text-white" />
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">{pack.name}</h3>
                      <div className="flex items-end justify-center gap-1">
                        <span className="text-3xl font-extrabold text-blue-600">{pack.price}</span>
                        <span className="text-gray-500 mb-0.5">₽</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">{wordsCount.toLocaleString('ru-RU')} слов</p>
                    </div>

                    <div className="bg-blue-50 rounded-lg p-3 mb-4">
                      <p className="text-xs text-blue-900 text-center">
                        Добавляется к текущему лимиту
                      </p>
                    </div>

                    <Button
                      onClick={() => handleBuySubscription(pack.id)}
                      disabled={isProcessing}
                      className="w-full min-h-[48px] text-base bg-blue-600 hover:bg-blue-700 text-white rounded-xl active:scale-[0.97] transition-transform"
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

        {/* ─── Payment history ─── */}
        {payments.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-5">История платежей</h2>
            <Card className="p-4 sm:p-6 bg-white">
              <div className="space-y-3">
                {payments.map((payment) => {
                  const statusBadge = getStatusBadge(payment.payment_status);
                  const plan = plans.find(p => p.id === payment.plan_type);

                  return (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Icon name="CreditCard" size={20} className="text-purple-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800 text-sm sm:text-base">{plan?.name || payment.plan_type}</h4>
                          <p className="text-xs sm:text-sm text-gray-500">
                            {new Date(payment.created_at).toLocaleDateString('ru-RU', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="font-bold text-gray-800 text-base sm:text-lg">{payment.amount} ₽</p>
                        <Badge className={`${statusBadge.color} text-white mt-1 text-[10px]`}>
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

        {/* ─── FAQ section ─── */}
        {!isPremium && (
          <div className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-5">Частые вопросы</h2>
            <div className="space-y-2">
              {FAQ_ITEMS.map((item, idx) => (
                <Card
                  key={idx}
                  className="bg-white overflow-hidden border border-gray-200"
                >
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-left min-h-[52px] active:bg-gray-50 transition-colors"
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  >
                    <span className="font-semibold text-sm sm:text-base text-gray-800">{item.q}</span>
                    <Icon
                      name="ChevronDown"
                      size={20}
                      className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${openFaq === idx ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {openFaq === idx && (
                    <div className="px-4 sm:px-5 pb-4 sm:pb-5 -mt-1">
                      <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ─── Bottom trust bar ─── */}
        {!isPremium && (
          <div className="text-center pb-6">
            <div className="inline-flex items-center gap-1.5 text-xs text-gray-400">
              <Icon name="Lock" size={12} className="text-gray-400" />
              <span>Защищённая оплата Т-Касса (Тинькофф)</span>
            </div>
          </div>
        )}
      </main>

      {/* ─── Sticky bottom CTA (mobile only, non-premium, when plans scroll out of view) ─── */}
      {!isPremium && stickyPlan && (
        <div className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/90 backdrop-blur-xl border-t border-gray-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between gap-3 px-4 py-3 max-w-lg mx-auto">
            <div className="min-w-0">
              <p className="text-xs text-gray-500 truncate">{stickyPlan.name}</p>
              <p className="font-extrabold text-lg text-gray-900">{stickyPlan.price} ₽</p>
            </div>
            <Button
              onClick={() => handleBuySubscription(stickyPlan.id)}
              disabled={isProcessing}
              className="min-h-[48px] px-6 text-base bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl shadow-lg active:scale-[0.97] transition-transform flex-shrink-0"
            >
              {isProcessing && selectedPlan === stickyPlan.id ? (
                <Icon name="Loader2" size={20} className="animate-spin" />
              ) : (
                'Оформить'
              )}
            </Button>
          </div>
          {/* trust micro-line */}
          <div className="flex items-center justify-center gap-1.5 pb-2 text-[10px] text-gray-400">
            <Icon name="Lock" size={10} />
            <span>Безопасная оплата</span>
            <span className="mx-1">|</span>
            <span>Без автопродления</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscription;
