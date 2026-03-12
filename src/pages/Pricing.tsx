import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';
import { openPaymentUrl } from '@/lib/payment-utils';

const SUBSCRIPTION_URL = 'https://functions.poehali.dev/7fe183c2-49af-4817-95f3-6ab4912778c4';
const PAYMENTS_URL = 'https://functions.poehali.dev/b45c4361-c9fa-4b81-b687-67d3a9406f1b';

const PREMIUM_FEATURES = [
  { icon: '🤖', text: '20 вопросов к ИИ в день (вместо 3)' },
  { icon: '📚', text: 'До 5 занятий в день (вместо 1)' },
  { icon: '📄', text: '3 загрузки файлов в день (вместо 1)' },
  { icon: '🎓', text: 'Подготовка к ЕГЭ и ОГЭ по всем предметам' },
  { icon: '✅', text: 'Проверка ответов с разбором ошибок' },
  { icon: '💬', text: 'Объяснение тем и решение задач' },
  { icon: '🏛️', text: 'Помощь с вузом: билеты, конспекты, сессия' },
  { icon: '🔥', text: 'Бонусы за стрик и ежедневные квесты' },
];

const GUARANTEE_FEATURES = [
  'Безопасная оплата через ЮKassa',
  'Возврат средств в течение 14 дней',
  'Отмена подписки в любой момент',
];

const FAQ = [
  {
    q: 'Чем отличается Premium от бесплатного?',
    a: 'Бесплатно: 3 вопроса к ИИ в день. При регистрации — 3 дня Premium бесплатно. Premium даёт 20 вопросов в день, до 5 занятий, 3 загрузки файлов и полный доступ к подготовке.',
  },
  {
    q: 'Что такое пакет вопросов?',
    a: '20 дополнительных вопросов к ИИ — не зависят от тарифа. Подходит если израсходовал дневной лимит и хочешь продолжить сегодня.',
  },
  {
    q: 'Как происходит оплата?',
    a: 'Оплата картой через ЮKassa. После нажатия кнопки вы перейдёте на защищённую страницу оплаты.',
  },
  {
    q: 'Можно отменить в любой момент?',
    a: 'Да. Подписка не продлевается автоматически. По окончании срока можно оформить заново.',
  },
];

const Pricing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState('free');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [bonusQuestions, setBonusQuestions] = useState(0);
  const [discountTimer, setDiscountTimer] = useState('');
  const [discountActive, setDiscountActive] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'1month' | '6months' | '12months'>('1month');

  useEffect(() => {
    const DISCOUNT_DURATION = 24 * 60 * 60 * 1000;
    const key = 'pricing_first_seen';
    let stored = localStorage.getItem(key);
    if (!stored) {
      stored = Date.now().toString();
      localStorage.setItem(key, stored);
    }
    const firstSeen = parseInt(stored, 10);
    
    const tick = () => {
      const elapsed = Date.now() - firstSeen;
      const remaining = DISCOUNT_DURATION - elapsed;
      if (remaining <= 0) {
        setDiscountActive(false);
        setDiscountTimer('');
        return false;
      }
      setDiscountActive(true);
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setDiscountTimer(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      return true;
    };
    
    if (tick()) {
      const interval = setInterval(() => {
        if (!tick()) clearInterval(interval);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    if (!authService.isAuthenticated()) { navigate('/auth'); return; }

    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      toast({ title: 'Оплата обрабатывается', description: 'Подписка активируется в течение минуты' });
      window.history.replaceState({}, '', '/pricing');
      const pendingId = localStorage.getItem('pending_payment_id');
      if (pendingId) {
        localStorage.removeItem('pending_payment_id');
        checkPaymentStatus(pendingId);
      }
    } else if (params.get('payment') === 'failed') {
      toast({ title: 'Оплата не прошла', description: 'Попробуйте снова', variant: 'destructive' });
      window.history.replaceState({}, '', '/pricing');
    }

    fetch(`${SUBSCRIPTION_URL}?action=status`, {
      headers: { Authorization: `Bearer ${authService.getToken()}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setCurrentPlan(d.subscription_type || 'free');
          setBonusQuestions(d.bonus_questions || 0);
          setIsTrial(d.is_trial || false);
          setTrialEndsAt(d.trial_ends_at || null);
        }
      })
      .catch(() => {});
  }, [navigate]);

  const checkPaymentStatus = async (paymentId: string) => {
    const token = authService.getToken();
    for (let i = 0; i < 24; i++) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const response = await fetch(PAYMENTS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ action: 'check_payment', payment_id: parseInt(paymentId) })
        });
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'completed') {
            toast({ title: 'Подписка активирована!', description: 'Полный доступ ко всем функциям' });
            setCurrentPlan('premium');
            return;
          }
        }
      } catch {
        continue;
      }
    }
    toast({ title: 'Оплата обрабатывается', description: 'Если деньги списались — подписка активируется автоматически в течение нескольких минут' });
  };

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const pendingId = localStorage.getItem('pending_payment_id');
      if (pendingId) {
        localStorage.removeItem('pending_payment_id');
        toast({ title: 'Проверяем оплату...', description: 'Подождите несколько секунд' });
        checkPaymentStatus(pendingId);
      }
      fetch(`${SUBSCRIPTION_URL}?action=status`, {
        headers: { Authorization: `Bearer ${authService.getToken()}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d) {
            setCurrentPlan(d.subscription_type || 'free');
            setBonusQuestions(d.bonus_questions || 0);
            setIsTrial(d.is_trial || false);
            setTrialEndsAt(d.trial_ends_at || null);
          }
        })
        .catch(() => {});
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const handleBuy = async (planId: string) => {
    setLoading(planId);
    try {
      const backendPlanId = planId === '12months' ? '1year' : planId;
      const token = authService.getToken();
      const returnUrl = `${window.location.origin}/pricing?payment=success`;

      const response = await fetch(PAYMENTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          action: 'create_payment',
          plan_type: backendPlanId,
          return_url: returnUrl
        })
      });

      const data = await response.json();

      if (data.success && data.confirmation_url) {
        if (data.payment_id) {
          localStorage.setItem('pending_payment_id', String(data.payment_id));
        }
        await openPaymentUrl(data.confirmation_url);
      } else {
        throw new Error(data.error || 'Не удалось создать платёж');
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Попробуйте снова',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  const isPremium = currentPlan === 'premium';

  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
    : 0;

  const planPrices: Record<string, { price: string; perMonth: string; label: string; badge?: string; save?: string }> = {
    '1month': { price: discountActive ? '299 ₽' : '499 ₽', perMonth: discountActive ? '299 ₽/мес' : '499 ₽/мес', label: '1 месяц', badge: 'Популярный' },
    '6months': { price: '1 499 ₽', perMonth: '250 ₽/мес', label: '6 месяцев', badge: 'Выгодный', save: '-50%' },
    '12months': { price: '2 399 ₽', perMonth: '200 ₽/мес', label: '12 месяцев', badge: 'Максимум', save: '-60%' },
  };

  return (
    <div className={`min-h-[100dvh] bg-gray-50 ${isPremium ? 'pb-nav' : 'pb-[140px]'}`}>

      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl hover:bg-gray-100">
          <Icon name="ArrowLeft" size={20} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900">Тарифы</h1>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">

        <div className="text-center pt-2 pb-1">
          <div className="text-4xl mb-2">🚀</div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Studyfay Premium</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            ИИ-репетитор объясняет темы, проверяет ответы и готовит<br />к ЕГЭ/ОГЭ каждый день — в 20 раз дешевле репетитора.
          </p>
        </div>

        {/* Социальное доказательство */}
        <div className="flex items-center justify-center gap-3 py-2">
          <div className="flex -space-x-2">
            {['🧑‍🎓', '👩‍🎓', '🧑‍💻', '👨‍🎓'].map((emoji, i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-sm border-2 border-white">
                {emoji}
              </div>
            ))}
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-gray-900">100+ учеников</p>
            <p className="text-xs text-gray-500">уже готовятся с Premium</p>
          </div>
        </div>

        {/* Триал-баннер */}
        {isTrial && trialDaysLeft > 0 && (
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Icon name="Gift" size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-sm">Бесплатный Premium активен</p>
                <p className="text-white/70 text-xs">Осталось {trialDaysLeft} {trialDaysLeft === 1 ? 'день' : trialDaysLeft < 5 ? 'дня' : 'дней'} — все функции доступны</p>
              </div>
              <div className="bg-white/20 rounded-xl px-3 py-1.5">
                <p className="text-white font-extrabold text-lg">{trialDaysLeft}</p>
                <p className="text-white/60 text-[10px] -mt-0.5">{trialDaysLeft === 1 ? 'день' : 'дн.'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Скидка */}
        {discountActive && !isPremium && (
          <div className="bg-gradient-to-r from-red-500 via-pink-500 to-rose-500 rounded-3xl p-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">🔥</span>
                <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">Только сейчас</span>
              </div>
              <h3 className="text-white font-extrabold text-xl mb-1">Первый месяц — 299 ₽</h3>
              <p className="text-white/70 text-sm mb-3">
                <span className="line-through">499 ₽</span> → 299 ₽ · Экономия 40%
              </p>
              <div className="bg-white/15 rounded-2xl px-4 py-2.5 flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Icon name="Clock" size={16} className="text-white/70" />
                  <span className="text-white/80 text-sm">Скидка сгорит через</span>
                </div>
                <span className="text-white font-mono font-extrabold text-lg">{discountTimer}</span>
              </div>
              <Button
                onClick={() => handleBuy('1month_discount')}
                disabled={!!loading}
                className="w-full h-13 bg-white text-pink-600 font-extrabold text-base rounded-2xl shadow-lg active:scale-[0.97] transition-all disabled:opacity-70"
              >
                {loading === '1month_discount'
                  ? <Icon name="Loader2" size={18} className="animate-spin" />
                  : 'Подключить за 299 ₽'
                }
              </Button>
              <p className="text-white/50 text-xs text-center mt-2">Далее 499 ₽/мес · Отмена в любой момент</p>
            </div>
          </div>
        )}

        {/* Выбор тарифа — табы */}
        {!isPremium && (
          <div className="bg-gray-100 rounded-2xl p-1 flex gap-1">
            {(['1month', '6months', '12months'] as const).map(plan => (
              <button
                key={plan}
                onClick={() => setSelectedPlan(plan)}
                className={`flex-1 py-2.5 rounded-xl text-center transition-all relative ${
                  selectedPlan === plan
                    ? 'bg-white shadow-sm'
                    : 'hover:bg-gray-50'
                }`}
              >
                <p className={`text-xs font-bold ${selectedPlan === plan ? 'text-indigo-600' : 'text-gray-500'}`}>
                  {planPrices[plan].label}
                </p>
                <p className={`text-[10px] mt-0.5 ${selectedPlan === plan ? 'text-indigo-400' : 'text-gray-400'}`}>
                  {planPrices[plan].perMonth}
                </p>
                {planPrices[plan].save && (
                  <span className="absolute -top-2 -right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    {planPrices[plan].save}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Основная карточка Premium */}
        {!isPremium ? (
          <div className="rounded-3xl overflow-hidden shadow-xl">
            <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🟣</span>
                  <span className="text-white font-extrabold text-lg">Premium</span>
                </div>
                <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
                  {planPrices[selectedPlan].badge}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-white font-extrabold text-2xl">{planPrices[selectedPlan].price}</span>
                <span className="text-white/50 text-sm">/ {planPrices[selectedPlan].label}</span>
              </div>
              {selectedPlan !== '1month' && (
                <p className="text-white/60 text-xs mb-3">≈ {planPrices[selectedPlan].perMonth}</p>
              )}
              {selectedPlan === '1month' && <div className="mb-3" />}

              <div className="space-y-2.5 mb-5">
                {PREMIUM_FEATURES.map(f => (
                  <div key={f.text} className="flex items-center gap-2.5">
                    <span className="text-base flex-shrink-0">{f.icon}</span>
                    <span className="text-white/90 text-sm">{f.text}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => handleBuy(selectedPlan === '1month' && discountActive ? '1month_discount' : selectedPlan)}
                disabled={!!loading}
                className="w-full h-12 bg-white text-purple-700 font-extrabold text-base rounded-2xl shadow-lg active:scale-[0.97] transition-all disabled:opacity-70"
              >
                {loading
                  ? <Icon name="Loader2" size={18} className="animate-spin" />
                  : `Подключить за ${planPrices[selectedPlan].price}`
                }
              </Button>
              <p className="text-white/50 text-xs text-center mt-2">Отмена в любой момент · Безопасная оплата</p>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-5 shadow-xl flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <Icon name="Crown" size={24} className="text-yellow-300" />
            </div>
            <div>
              <p className="text-white font-bold text-base">Premium активен</p>
              <p className="text-white/60 text-sm">Полный доступ открыт</p>
              {bonusQuestions > 0 && (
                <p className="text-green-300 text-xs mt-0.5">+{bonusQuestions} бонусных вопросов</p>
              )}
            </div>
          </div>
        )}

        {/* Блок «до/после» — реальный прогресс */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="text-lg">📊</span>
            Результат за 30 дней с Premium
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-red-50 rounded-2xl p-3 text-center">
              <p className="text-xs text-red-400 mb-1">Без Premium</p>
              <p className="text-2xl font-extrabold text-red-500">3</p>
              <p className="text-[10px] text-red-400">вопроса в день</p>
              <div className="mt-2 bg-red-100 rounded-lg h-2">
                <div className="bg-red-400 rounded-lg h-2 w-[15%]" />
              </div>
              <p className="text-[10px] text-red-400 mt-1">~90 вопросов/мес</p>
            </div>
            <div className="bg-green-50 rounded-2xl p-3 text-center">
              <p className="text-xs text-green-500 mb-1">С Premium</p>
              <p className="text-2xl font-extrabold text-green-600">20</p>
              <p className="text-[10px] text-green-500">вопросов в день</p>
              <div className="mt-2 bg-green-100 rounded-lg h-2">
                <div className="bg-green-500 rounded-lg h-2 w-full" />
              </div>
              <p className="text-[10px] text-green-500 mt-1">~600 вопросов/мес</p>
            </div>
          </div>
          <div className="mt-3 bg-indigo-50 rounded-xl p-3 flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <p className="text-xs text-indigo-700">
              <span className="font-bold">В 6.7 раз больше практики</span> — ученики с Premium набирают в среднем на 15+ баллов больше на ЕГЭ
            </p>
          </div>
        </div>

        {/* Пакет +20 вопросов */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border-2 border-green-100 relative">
          <div className="absolute -top-3 left-5">
            <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">⚡ Быстрый доступ</span>
          </div>
          <div className="flex items-start justify-between pt-1">
            <div>
              <h3 className="font-extrabold text-gray-900 text-lg">+20 вопросов к ИИ</h3>
              <p className="text-gray-500 text-xs mt-0.5">Работает с любым тарифом — сегодня же</p>
              <div className="mt-2 space-y-1">
                {[
                  'Добавляются к текущему лимиту',
                  'Не сгорают на следующий день',
                  'Для экзамена, ассистента, вуза',
                ].map(f => (
                  <div key={f} className="flex items-center gap-1.5 text-gray-500 text-xs">
                    <Icon name="Check" size={12} className="text-green-400 flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-3">
              <p className="text-gray-900 font-extrabold text-2xl leading-none">149 ₽</p>
              <p className="text-gray-400 text-xs mt-0.5">разово</p>
            </div>
          </div>
          <Button
            onClick={() => handleBuy('questions_20')}
            disabled={!!loading}
            className="w-full h-11 mt-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-2xl disabled:opacity-50"
          >
            {loading === 'questions_20'
              ? <Icon name="Loader2" size={16} className="animate-spin" />
              : 'Купить 20 вопросов — 149 ₽'
            }
          </Button>
        </div>

        {/* Сравнение с репетитором */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">💰</span>
            <h3 className="font-bold text-white">Почему это выгодно</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-white/10 rounded-2xl px-4 py-3">
              <div>
                <p className="text-gray-300 text-xs">Репетитор (1 занятие)</p>
                <p className="text-white font-bold text-base">800–2000 ₽</p>
              </div>
              <div className="text-right">
                <p className="text-gray-300 text-xs">В месяц</p>
                <p className="text-red-400 font-bold text-base">от 12 000 ₽</p>
              </div>
            </div>
            <div className="flex items-center justify-between bg-indigo-500/30 rounded-2xl px-4 py-3 border border-indigo-400/30">
              <div>
                <p className="text-indigo-200 text-xs">Studyfay Premium</p>
                <p className="text-white font-bold text-base">499 ₽</p>
              </div>
              <div className="text-right">
                <p className="text-indigo-200 text-xs">В месяц</p>
                <p className="text-green-400 font-bold text-base">≈ 17 ₽/день</p>
              </div>
            </div>
          </div>
          <div className="mt-3 bg-yellow-400/20 rounded-2xl px-4 py-3 flex items-center gap-2">
            <span className="text-yellow-300 text-xl">🏆</span>
            <p className="text-yellow-300 font-bold text-sm">Экономия от 11 500 ₽ в месяц</p>
          </div>
        </div>

        {/* Гарантии */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Icon name="ShieldCheck" size={18} className="text-green-500" />
            Гарантии
          </h3>
          <div className="space-y-2">
            {GUARANTEE_FEATURES.map(g => (
              <div key={g} className="flex items-center gap-2 text-gray-600 text-sm">
                <Icon name="Check" size={14} className="text-green-500 flex-shrink-0" />
                {g}
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-3">Частые вопросы</h3>
          <div className="space-y-2">
            {FAQ.map((item, i) => (
              <div key={i} className="border border-gray-100 rounded-2xl overflow-hidden">
                <button
                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-2"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="text-sm font-medium text-gray-800">{item.q}</span>
                  <Icon
                    name="ChevronDown"
                    size={16}
                    className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-3 text-sm text-gray-500 border-t border-gray-50">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Кабинет для родителей */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-5 border-2 border-blue-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <Icon name="Users" size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Кабинет для родителей</h3>
              <p className="text-xs text-gray-500">Пусть родители видят ваш прогресс</p>
            </div>
          </div>
          <div className="space-y-1.5 mb-3">
            {['Статистика учёбы каждый день', 'Стрик, оценки, достижения', 'Подготовка к ЕГЭ/ОГЭ'].map(f => (
              <div key={f} className="flex items-center gap-2 text-gray-600 text-sm">
                <Icon name="Check" size={14} className="text-blue-500 flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-lg font-extrabold text-indigo-700">299 ₽/мес</span>
            <Button
              onClick={() => navigate('/parent/auth')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm h-9 px-4"
            >
              Подробнее
            </Button>
          </div>
        </div>

        {/* Легал */}
        <div className="text-center pt-2 pb-4">
          <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
            <button onClick={() => navigate('/terms')} className="hover:text-gray-600">Пользовательское соглашение</button>
            <span>|</span>
            <button onClick={() => navigate('/privacy')} className="hover:text-gray-600">Конфиденциальность</button>
          </div>
        </div>

      </div>

      {!isPremium && (
        <div className="fixed bottom-[60px] left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-3 z-20">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <Button
              onClick={() => handleBuy(selectedPlan === '1month' && discountActive ? '1month_discount' : selectedPlan)}
              disabled={!!loading}
              className="flex-1 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-extrabold text-base rounded-2xl shadow-lg active:scale-[0.97] transition-all"
            >
              {loading
                ? <Icon name="Loader2" size={18} className="animate-spin" />
                : `Premium — ${planPrices[selectedPlan].price}`
              }
            </Button>
            <Button
              onClick={() => handleBuy('questions_20')}
              disabled={!!loading}
              variant="outline"
              className="h-12 px-4 font-bold text-green-600 border-green-300 rounded-2xl"
            >
              {loading === 'questions_20'
                ? <Icon name="Loader2" size={16} className="animate-spin" />
                : '+20 ⚡'
              }
            </Button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default Pricing;
