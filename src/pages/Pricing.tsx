import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';

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

const FREE_FEATURES = [
  '10 вопросов к ИИ в первые 4 дня',
  'Плавное понижение до 3 вопросов к 7-му дню',
  '1 занятие и 1 файл в день',
  'Базовая подготовка к экзаменам',
];

const GUARANTEE_FEATURES = [
  'Безопасная оплата через Т-банк',
  'Возврат средств в течение 14 дней',
  'Отмена подписки в любой момент',
];

const FAQ = [
  {
    q: 'Чем отличается Premium от бесплатного?',
    a: 'Бесплатно: 10 вопросов в первые 4 дня, затем плавное понижение до 3 в день к 7-му дню. Premium даёт 20 вопросов в день, до 5 занятий, 3 загрузки файлов и полный доступ к подготовке.',
  },
  {
    q: 'Что такое пакет вопросов?',
    a: '20 дополнительных вопросов к ИИ — не зависят от тарифа. Подходит если израсходовал дневной лимит и хочешь продолжить сегодня.',
  },
  {
    q: 'Как работает автопродление?',
    a: 'Подписка продлевается автоматически в дату окончания. Отключить можно в Профиле — в разделе «Подписка».',
  },
  {
    q: 'Можно отменить в любой момент?',
    a: 'Да. Зайди в Профиль → Подписка → Отменить. Доступ сохранится до конца оплаченного периода.',
  },
];

const Pricing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState('free');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [bonusQuestions, setBonusQuestions] = useState(0);

  useEffect(() => {
    if (!authService.isAuthenticated()) { navigate('/auth'); return; }
    fetch(`${SUBSCRIPTION_URL}?action=status`, {
      headers: { Authorization: `Bearer ${authService.getToken()}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setCurrentPlan(d.subscription_type || 'free');
          setBonusQuestions(d.bonus_questions || 0);
        }
      })
      .catch(() => {});
  }, [navigate]);

  const handleBuy = async (planId: string) => {
    setLoading(planId);
    try {
      const token = authService.getToken();
      const backendPlanId = planId === '12months' ? '1year' : planId;
      const res = await fetch(PAYMENTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'create_payment', plan_type: backendPlanId }),
      });
      const data = await res.json();
      if (res.ok && data.payment_url) {
        window.location.href = data.payment_url;
      } else {
        toast({ title: 'Ошибка', description: data.error || 'Не удалось создать платёж', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка сети', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const isPremium = currentPlan === 'premium';

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-nav">

      {/* Шапка */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl hover:bg-gray-100">
          <Icon name="ArrowLeft" size={20} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900">Тарифы</h1>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">

        {/* Заголовок */}
        <div className="text-center pt-2 pb-2">
          <div className="text-4xl mb-2">🚀</div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Studyfay Premium</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            ИИ-репетитор объясняет темы, проверяет ответы и готовит<br />к ЕГЭ/ОГЭ каждый день — в 20 раз дешевле репетитора.
          </p>
        </div>

        {/* Бесплатный тариф */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🟢</span>
              <h3 className="font-bold text-gray-800">Бесплатно</h3>
            </div>
            <span className="text-gray-400 font-bold text-lg">0 ₽</span>
          </div>
          <div className="space-y-2">
            {FREE_FEATURES.map(f => (
              <div key={f} className="flex items-center gap-2 text-gray-600 text-sm">
                <Icon name="Check" size={14} className="text-gray-400 flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>
          {!isPremium && (
            <div className="mt-3 pt-3 border-t border-gray-50">
              <span className="inline-block bg-gray-100 text-gray-500 text-xs font-medium px-3 py-1 rounded-full">Текущий тариф</span>
            </div>
          )}
        </div>

        {/* Premium — главный */}
        {!isPremium ? (
          <div className="rounded-3xl overflow-hidden shadow-xl">
            <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🟣</span>
                  <span className="text-white font-extrabold text-lg">Premium</span>
                </div>
                <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">Рекомендуем</span>
              </div>
              <p className="text-white/70 text-sm mb-1">499 ₽ / месяц</p>
              <p className="text-white/60 text-xs mb-4">Всё необходимое для подготовки без ограничений:</p>

              <div className="space-y-2.5 mb-5">
                {PREMIUM_FEATURES.map(f => (
                  <div key={f.text} className="flex items-center gap-2.5">
                    <span className="text-base flex-shrink-0">{f.icon}</span>
                    <span className="text-white/90 text-sm">{f.text}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 mb-2">
                <Button
                  onClick={() => handleBuy('1month')}
                  disabled={!!loading}
                  className="flex-1 h-12 bg-white text-purple-700 font-extrabold text-base rounded-2xl shadow-lg active:scale-[0.97] transition-all disabled:opacity-70"
                >
                  {loading === '1month'
                    ? <Icon name="Loader2" size={18} className="animate-spin" />
                    : 'Подключить Premium'
                  }
                </Button>
                <div className="text-right flex-shrink-0">
                  <p className="text-white font-extrabold text-xl leading-none">499 ₽</p>
                  <p className="text-white/50 text-xs">в месяц</p>
                </div>
              </div>
              <p className="text-white/50 text-xs text-center">Отмена в любой момент · Автопродление</p>
            </div>

            {/* Подсказка */}
            <div className="bg-purple-900 px-5 py-3 flex items-center gap-2">
              <span className="text-yellow-400 text-sm">⚡</span>
              <p className="text-white/70 text-xs">
                Первые 4 дня — <span className="text-white font-semibold">10 вопросов бесплатно,</span> затем плавно до 3 в день. Premium снимает все ограничения.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-5 shadow-xl flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <Icon name="Crown" size={24} className="text-yellow-300" />
            </div>
            <div>
              <p className="text-white font-bold text-base">Premium активен ✓</p>
              <p className="text-white/60 text-sm">Полный доступ открыт</p>
              {bonusQuestions > 0 && (
                <p className="text-green-300 text-xs mt-0.5">+{bonusQuestions} бонусных вопросов</p>
              )}
            </div>
          </div>
        )}

        {/* Пакет вопросов — для всех */}
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

        {/* 6 месяцев — самый выгодный */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border-2 border-orange-200 relative">
          <div className="absolute -top-3 left-5">
            <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">🟠 Самый выгодный</span>
          </div>
          <div className="flex items-start justify-between pt-1">
            <div>
              <h3 className="font-extrabold text-gray-900 text-lg">6 месяцев Premium</h3>
              <p className="text-gray-500 text-xs mt-0.5">Лучший выбор для подготовки к ЕГЭ/ОГЭ</p>
              <div className="mt-2 space-y-1">
                {[
                  'Всё из Premium',
                  'Выгоднее помесячной оплаты на 36%',
                  'Непрерывный прогресс до экзамена',
                ].map(f => (
                  <div key={f} className="flex items-center gap-1.5 text-gray-500 text-xs">
                    <Icon name="Check" size={12} className="text-orange-400 flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-3">
              <p className="text-gray-900 font-extrabold text-xl leading-none">1990 ₽</p>
              <p className="text-gray-400 text-xs mt-0.5">≈ 332 ₽/мес</p>
            </div>
          </div>
          <Button
            onClick={() => handleBuy('6months')}
            disabled={!!loading || isPremium}
            className="w-full h-11 mt-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-2xl disabled:opacity-50"
          >
            {loading === '6months'
              ? <Icon name="Loader2" size={16} className="animate-spin" />
              : isPremium ? 'Уже активен' : 'Выбрать на 6 месяцев'
            }
          </Button>
        </div>

        {/* Годовой тариф */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border-2 border-blue-100 relative">
          <div className="absolute -top-3 left-5">
            <span className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">🔵 Годовой тариф</span>
          </div>
          <div className="flex items-start justify-between pt-1">
            <div>
              <h3 className="font-extrabold text-gray-900 text-lg">12 месяцев Premium</h3>
              <p className="text-gray-500 text-xs mt-0.5">Максимальная экономия на весь учебный год</p>
              <div className="mt-2 space-y-1">
                {[
                  'Всё из Premium',
                  'Дешевле в 2 раза чем помесячно',
                ].map(f => (
                  <div key={f} className="flex items-center gap-1.5 text-gray-500 text-xs">
                    <Icon name="Check" size={12} className="text-blue-400 flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-3">
              <p className="text-gray-900 font-extrabold text-xl leading-none">2990 ₽</p>
              <p className="text-gray-400 text-xs mt-0.5">≈ 249 ₽/мес</p>
            </div>
          </div>
          <Button
            onClick={() => handleBuy('12months')}
            disabled={!!loading || isPremium}
            className="w-full h-11 mt-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold rounded-2xl disabled:opacity-50"
          >
            {loading === '12months'
              ? <Icon name="Loader2" size={16} className="animate-spin" />
              : isPremium ? 'Уже активен' : 'Выбрать на год'
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
                <p className="text-green-400 font-bold text-base">≈ 10 ₽/день</p>
              </div>
            </div>
          </div>
          <div className="mt-3 bg-yellow-400/20 rounded-2xl px-4 py-3 flex items-center gap-2">
            <span className="text-yellow-300 text-xl">🏆</span>
            <p className="text-yellow-300 font-bold text-sm">Экономия от 11 700 ₽ в месяц</p>
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

        {/* Юридическая строка */}
        <div className="text-center pb-4">
          <div className="flex items-center justify-center gap-3 text-xs text-gray-400">
            <button onClick={() => navigate('/terms')} className="hover:text-gray-600">Пользовательское соглашение</button>
            <span>·</span>
            <button onClick={() => navigate('/privacy')} className="hover:text-gray-600">Конфиденциальность</button>
          </div>
        </div>

      </div>
      <BottomNav />
    </div>
  );
};

export default Pricing;