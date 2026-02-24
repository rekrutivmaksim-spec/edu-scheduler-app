import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';

const SUBSCRIPTION_URL = 'https://functions.poehali.dev/7fe183c2-49af-4817-95f3-6ab4912778c4';

const PREMIUM_FEATURES = [
  { icon: '📅', text: 'Занятия каждый день без ограничений' },
  { icon: '💬', text: 'Объяснение сложных тем' },
  { icon: '✅', text: 'Задания и проверка решений' },
  { icon: '🔍', text: 'Разбор ошибок' },
  { icon: '🤖', text: 'Помощь ИИ' },
  { icon: '🎓', text: 'Подготовка к ЕГЭ и ОГЭ' },
  { icon: '🏛️', text: 'Помощь по учёбе в вузе' },
  { icon: '📄', text: 'Анализ PDF и конспектов' },
];

const STUDENT_FEATURES = [
  'Разбор лекций',
  'Помощь по билетам',
  'Ответы на вопросы по конспектам',
];

const GUARANTEE_FEATURES = [
  'Безопасная оплата через RuStore',
  'Возврат средств в течение 14 дней',
  'Отмена подписки в любой момент',
];

const FAQ = [
  { q: 'Как работает подписка?', a: 'После подключения открывается полный доступ к занятиям и ИИ.' },
  { q: 'Можно отменить?', a: 'Да, в профиле в любой момент.' },
  { q: 'Будут списания автоматически?', a: 'Только при включённом автопродлении.' },
];

const Pricing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState('free');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    if (!authService.isAuthenticated()) { navigate('/login'); return; }
    fetch(`${SUBSCRIPTION_URL}?action=status`, {
      headers: { Authorization: `Bearer ${authService.getToken()}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCurrentPlan(d.subscription_type || 'free'); })
      .catch(() => {});
  }, [navigate]);

  const handleBuy = async (planId: string) => {
    setLoading(planId);
    try {
      const token = authService.getToken();
      const res = await fetch(SUBSCRIPTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'create_payment', plan: planId }),
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
    <div className="min-h-screen bg-gray-50">

      {/* Шапка */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl hover:bg-gray-100">
          <Icon name="ArrowLeft" size={20} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900">Тарифы</h1>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 pb-16 space-y-4">

        {/* Заголовок */}
        <div className="text-center pt-2 pb-2">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Учись без ограничений с Studyfay</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            ИИ объясняет темы, подбирает задания и помогает готовиться<br />к экзаменам и сессии каждый день.
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
            {[
              '1 занятие в день',
              '3 вопроса ИИ в день',
              '1 анализ файла в день',
              'базовая подготовка к экзаменам',
            ].map(f => (
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
              <p className="text-white/70 text-sm mb-1">449 ₽ / месяц</p>
              <p className="text-white/60 text-xs mb-4">Подготовка к учёбе без ограничений:</p>

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
                  <p className="text-white font-extrabold text-xl leading-none">449 ₽</p>
                  <p className="text-white/50 text-xs">в месяц</p>
                </div>
              </div>
              <p className="text-white/50 text-xs text-center">Отмена в любой момент</p>
            </div>

            {/* Ограничение */}
            <div className="bg-purple-900 px-5 py-3 flex items-center gap-2">
              <span className="text-yellow-400 text-sm">⚡</span>
              <p className="text-white/70 text-xs">
                Сегодня доступно бесплатно: <span className="text-white font-semibold">1 занятие.</span> Дальше — продолжение с Premium
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
              <p className="text-white/60 text-sm">Безлимитный доступ открыт</p>
            </div>
          </div>
        )}

        {/* 6 месяцев — самый выгодный */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border-2 border-orange-200 relative">
          <div className="absolute -top-3 left-5">
            <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">🟠 Самый выгодный</span>
          </div>
          <div className="flex items-start justify-between pt-1">
            <div>
              <h3 className="font-extrabold text-gray-900 text-lg">6 месяцев</h3>
              <p className="text-gray-500 text-xs mt-0.5">Лучший вариант для подготовки к экзаменам</p>
              <div className="mt-2 space-y-1">
                {[
                  'всё из Premium',
                  'экономия vs оплаты помесячно',
                  'непрерывный прогресс',
                ].map(f => (
                  <div key={f} className="flex items-center gap-1.5 text-gray-500 text-xs">
                    <Icon name="Check" size={12} className="text-orange-400 flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-3">
              <p className="text-gray-900 font-extrabold text-xl leading-none">2290 ₽</p>
              <p className="text-gray-400 text-xs mt-0.5">≈ 382 ₽/мес</p>
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
              <h3 className="font-extrabold text-gray-900 text-lg">12 месяцев</h3>
              <p className="text-gray-500 text-xs mt-0.5">Максимальная экономия</p>
              <div className="mt-2 space-y-1">
                {[
                  'всё из Premium',
                  'подходит для долгой подготовки',
                ].map(f => (
                  <div key={f} className="flex items-center gap-1.5 text-gray-500 text-xs">
                    <Icon name="Check" size={12} className="text-blue-400 flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-3">
              <p className="text-gray-900 font-extrabold text-xl leading-none">3990 ₽</p>
              <p className="text-gray-400 text-xs mt-0.5">≈ 333 ₽/мес</p>
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

        {/* Для студентов */}
        <div className="bg-indigo-50 rounded-3xl p-5 border border-indigo-100">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🎓</span>
            <h3 className="font-bold text-indigo-800">Для студентов</h3>
            <span className="ml-auto text-xs text-indigo-400 bg-indigo-100 px-2 py-0.5 rounded-full">входит в Premium</span>
          </div>
          <p className="text-indigo-700 text-sm font-medium mb-2">Подготовка к сессии:</p>
          <div className="space-y-1.5">
            {STUDENT_FEATURES.map(f => (
              <div key={f} className="flex items-center gap-2 text-indigo-700 text-sm">
                <Icon name="Check" size={13} className="text-indigo-400 flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Почему выгодно */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">💰</span>
            <h3 className="font-bold text-white">Почему это выгодно</h3>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">
            1 занятие с репетитором стоит <span className="text-white font-bold">800–1500 ₽</span>
          </p>
          <p className="text-gray-300 text-sm mt-1">
            Studyfay — от <span className="text-white font-bold">449 ₽ в месяц</span>
          </p>
          <div className="mt-3 bg-white/10 rounded-2xl px-4 py-3">
            <p className="text-yellow-300 font-bold text-base">Экономия до 5000 ₽ ежемесячно</p>
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