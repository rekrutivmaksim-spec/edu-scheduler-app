import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Icon from "@/components/ui/icon";

/* ────────────────────────────────── static data ────────────────────────────────── */

const FEATURES = [
  {
    icon: "Brain",
    title: "ИИ-репетитор 24/7",
    desc: "Задавай любые вопросы по учёбе и получай понятные ответы от ИИ-ассистента в любое время дня и ночи.",
  },
  {
    icon: "Calendar",
    title: "Умное расписание",
    desc: "Импортируй расписание вуза или создай своё. Уведомления о парах, дедлайнах и экзаменах.",
  },
  {
    icon: "Timer",
    title: "Помодоро-таймер",
    desc: "Учись по методу Помодоро с трекером сессий, статистикой фокуса и системой стриков.",
  },
  {
    icon: "BookOpen",
    title: "Зачётная книжка",
    desc: "Веди учёт оценок, рассчитывай средний балл и отслеживай академическую успеваемость.",
  },
  {
    icon: "CheckSquare",
    title: "Трекер задач",
    desc: "Управляй домашними заданиями, курсовыми и проектами. Приоритеты, дедлайны, напоминания.",
  },
  {
    icon: "Camera",
    title: "Сканер конспектов",
    desc: "Фотографируй лекции и конспекты — ИИ распознает текст, структурирует и сохранит в базу знаний.",
  },
];

const SCREENSHOTS = [
  "https://cdn.poehali.dev/projects/3ff43efa-4f20-46c2-b4c7-d9b10642fd31/files/d8375537-4959-49cb-9e75-e898c5ca2f9f.jpg",
  "https://cdn.poehali.dev/projects/3ff43efa-4f20-46c2-b4c7-d9b10642fd31/files/2ad1ea59-a4f6-43b5-b90a-b3fe09efe110.jpg",
  "https://cdn.poehali.dev/projects/3ff43efa-4f20-46c2-b4c7-d9b10642fd31/files/a794802d-bcee-4e6e-a529-87d228be6c56.jpg",
];

const REVIEWS = [
  {
    name: "Аня К.",
    uni: "НИУ ВШЭ, 2 курс",
    stars: 5,
    text: "Спасло на сессии! ИИ-ассистент объясняет лучше некоторых преподавателей. Серьёзно.",
  },
  {
    name: "Дмитрий Л.",
    uni: "МГТУ им. Баумана, 3 курс",
    stars: 5,
    text: "Помодоро-таймер и трекер задач наконец помогли мне перестать прокрастинировать.",
  },
  {
    name: "Мария С.",
    uni: "СПбГУ, 1 курс",
    stars: 4,
    text: "Очень удобно держать расписание, задачи и конспекты в одном приложении.",
  },
];

const FAQ = [
  {
    q: "Studyfay бесплатный?",
    a: "Да! Базовые функции полностью бесплатны: расписание, задачи, зачётная книжка и 5 вопросов ИИ-ассистенту в день. Premium открывает безлимитный доступ.",
  },
  {
    q: "Для каких вузов подходит?",
    a: "Для любых. Studyfay не привязан к конкретному вузу — вы сами настраиваете расписание, предметы и задачи под свою программу.",
  },
  {
    q: "Как работает ИИ-ассистент?",
    a: "Задавайте вопросы по любому предмету текстом. ИИ даёт развёрнутые ответы с объяснениями, примерами и формулами. Работает 24/7.",
  },
  {
    q: "Мои данные в безопасности?",
    a: "Конечно. Мы не передаём персональные данные третьим лицам. Оплата проходит через защищённый шлюз Т-Касса (Тинькофф).",
  },
  {
    q: "Могу ли я отменить подписку?",
    a: "Подписка продлевается автоматически — отключить можно в любой момент в разделе «Подписка». Возврат возможен в течение 14 дней, если вы не использовали платные функции.",
  },
];

/* ──────────────────────────── helpers ──────────────────────────── */

const scrollTo = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
};

const Stars = ({ count }: { count: number }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <Icon
        key={i}
        name="Star"
        size={14}
        className={i < count ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}
      />
    ))}
  </div>
);

/* ═══════════════════════════ Component ═══════════════════════════ */

const AppStore = () => {
  const navigate = useNavigate();
  const carouselRef = useRef<HTMLDivElement>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const goRegister = () => navigate("/register");

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">
      {/* ──────────── Hero ──────────── */}
      <section className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white overflow-hidden">
        {/* decorative blobs */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-pink-400/20 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-3xl mx-auto px-5 pt-14 pb-16 sm:pt-20 sm:pb-24 flex flex-col items-center text-center gap-6">
          {/* app icon */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[28%] bg-white/20 backdrop-blur-md shadow-2xl flex items-center justify-center ring-4 ring-white/30">
            <Icon name="GraduationCap" size={48} className="text-white sm:w-14 sm:h-14" />
          </div>

          <div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Studyfay
            </h1>
            <p className="mt-2 text-lg sm:text-xl text-white/80 font-medium">
              ИИ-помощник для студентов
            </p>
          </div>

          <p className="max-w-md text-sm sm:text-base text-white/70 leading-relaxed">
            Расписание, задачи, конспекты и умный ИИ-репетитор в одном приложении.
            Всё, что нужно для учёбы — бесплатно.
          </p>

          <Button
            onClick={goRegister}
            className="min-h-[52px] px-8 text-lg font-bold rounded-2xl bg-white text-purple-700 hover:bg-white/90 shadow-xl active:scale-[0.97] transition-transform"
          >
            Начать бесплатно
          </Button>

          {/* micro trust */}
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-white/60 mt-1">
            <span className="flex items-center gap-1">
              <Icon name="CheckCircle2" size={12} />
              Бесплатно навсегда
            </span>
            <span className="flex items-center gap-1">
              <Icon name="ShieldCheck" size={12} />
              Без автопродления
            </span>
            <span className="flex items-center gap-1">
              <Icon name="Users" size={12} />
              500+ студентов
            </span>
          </div>

          {/* scroll hint */}
          <button
            type="button"
            onClick={() => scrollTo("features")}
            className="mt-4 animate-bounce"
            aria-label="Scroll down"
          >
            <Icon name="ChevronDown" size={28} className="text-white/50" />
          </button>
        </div>
      </section>

      {/* ──────────── Features ──────────── */}
      <section id="features" className="max-w-5xl mx-auto px-4 py-14 sm:py-20">
        <div className="text-center mb-10 sm:mb-14">
          <Badge className="mb-3 bg-purple-100 text-purple-700 border-purple-200 text-xs">
            Возможности
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            Всё для продуктивной учёбы
          </h2>
          <p className="mt-2 text-sm sm:text-base text-gray-500 max-w-md mx-auto">
            Шесть инструментов, которые заменяют десяток приложений
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {FEATURES.map((f) => (
            <Card
              key={f.icon}
              className="p-5 sm:p-6 border border-gray-100 bg-white hover:shadow-lg hover:shadow-purple-100/50 transition-shadow"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-4">
                <Icon name={f.icon} size={22} className="text-white" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ──────────── Screenshots carousel ──────────── */}
      <section className="bg-gradient-to-b from-gray-50 to-white py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-8 sm:mb-12">
            <Badge className="mb-3 bg-indigo-100 text-indigo-700 border-indigo-200 text-xs">
              Интерфейс
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              Как это выглядит
            </h2>
          </div>

          <div
            ref={carouselRef}
            className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 -mx-4 px-4"
            style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
          >
            {SCREENSHOTS.map((src, i) => (
              <div
                key={i}
                className="flex-shrink-0 w-[280px] sm:w-[320px] snap-center"
              >
                <img
                  src={src}
                  alt={`Скриншот приложения Studyfay ${i + 1}`}
                  className="rounded-2xl shadow-lg border border-gray-200 w-full h-auto object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>

          {/* dots indicator */}
          <div className="flex justify-center gap-2 mt-5">
            {SCREENSHOTS.map((_, i) => (
              <button
                key={i}
                type="button"
                className="w-2.5 h-2.5 rounded-full bg-gray-300 hover:bg-purple-500 transition-colors"
                aria-label={`Скриншот ${i + 1}`}
                onClick={() => {
                  const el = carouselRef.current;
                  if (!el) return;
                  const card = el.children[i] as HTMLElement | undefined;
                  card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ──────────── Social proof ──────────── */}
      <section id="reviews" className="max-w-5xl mx-auto px-4 py-14 sm:py-20">
        <div className="text-center mb-10 sm:mb-14">
          <Badge className="mb-3 bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">
            Отзывы
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            500+ студентов уже учатся эффективнее
          </h2>
          <div className="flex items-center justify-center gap-2 mt-3">
            <Stars count={5} />
            <span className="text-sm text-gray-500 font-medium">4.8 из 5</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {REVIEWS.map((r, i) => (
            <Card key={i} className="p-5 sm:p-6 border border-gray-100 bg-white">
              <Stars count={r.stars} />
              <p className="mt-3 text-sm text-gray-700 leading-relaxed italic">
                &laquo;{r.text}&raquo;
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">
                  {r.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{r.name}</p>
                  <p className="text-xs text-gray-400">{r.uni}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ──────────── Pricing teaser ──────────── */}
      <section id="pricing" className="bg-gradient-to-b from-white to-gray-50 py-14 sm:py-20">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-10 sm:mb-14">
            <Badge className="mb-3 bg-green-100 text-green-700 border-green-200 text-xs">
              Тарифы
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              Начни бесплатно, переходи на Premium когда захочешь
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8 max-w-2xl mx-auto">
            {/* Free plan */}
            <Card className="p-6 sm:p-8 border-2 border-gray-200 bg-white flex flex-col">
              <h3 className="text-lg font-bold text-gray-800 mb-1">Free</h3>
              <p className="text-sm text-gray-500 mb-5">Навсегда бесплатно</p>

              <div className="flex items-end gap-1 mb-6">
                <span className="text-4xl font-extrabold text-gray-900">0</span>
                <span className="text-gray-500 mb-1">₽</span>
              </div>

              <div className="space-y-2.5 flex-1">
                {[
                  "Расписание и задачи",
                  "Зачётная книжка",
                  "Помодоро-таймер",
                  "3 вопроса ИИ / день",
                ].map((t) => (
                  <div key={t} className="flex items-center gap-2">
                    <Icon name="Check" size={16} className="text-green-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{t}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={goRegister}
                variant="outline"
                className="w-full mt-6 min-h-[48px] rounded-xl text-base active:scale-[0.97] transition-transform"
              >
                Зарегистрироваться
              </Button>
            </Card>

            {/* Premium plan */}
            <Card className="relative p-6 sm:p-8 border-[3px] border-purple-500 bg-white shadow-xl shadow-purple-200/30 flex flex-col">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <Badge className="bg-purple-600 text-white px-4 py-1 text-xs shadow-md">
                  <Icon name="Star" size={12} className="mr-1" />
                  Популярный
                </Badge>
              </div>

              <h3 className="text-lg font-bold text-gray-800 mb-1">Premium</h3>
              <p className="text-sm text-gray-500 mb-5">Полный доступ ко всему</p>

              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-extrabold text-purple-600">249</span>
                <span className="text-gray-500 mb-1">₽ / мес</span>
              </div>
              <p className="text-xs text-gray-400 mb-6">от 207 ₽/мес при оплате за 3 месяца</p>

              <div className="space-y-2.5 flex-1">
                {[
                  "Всё из Free",
                  "Безлимитный ИИ-ассистент",
                  "Безлимитные материалы",
                  "Прогноз вопросов к экзамену",
                  "Приоритетная поддержка",
                ].map((t) => (
                  <div key={t} className="flex items-center gap-2">
                    <Icon name="Check" size={16} className="text-purple-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{t}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={goRegister}
                className="w-full mt-6 min-h-[52px] rounded-xl text-base font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg active:scale-[0.97] transition-transform"
              >
                Попробовать бесплатно
              </Button>

              <p className="text-center text-[11px] text-gray-400 mt-2">
                7 дней бесплатно, без автопродления
              </p>
            </Card>
          </div>

          {/* trust micro-strip */}
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-xs text-gray-400 mt-8">
            <span className="flex items-center gap-1">
              <Icon name="Lock" size={12} className="text-green-500" />
              Оплата через Т-Кассу
            </span>
            <span className="flex items-center gap-1">
              <Icon name="ShieldCheck" size={12} className="text-green-500" />
              Без автопродления
            </span>
            <span className="flex items-center gap-1">
              <Icon name="RotateCcw" size={12} className="text-green-500" />
              14 дней возврат
            </span>
          </div>
        </div>
      </section>

      {/* ──────────── FAQ ──────────── */}
      <section id="faq" className="max-w-3xl mx-auto px-4 py-14 sm:py-20">
        <div className="text-center mb-10 sm:mb-14">
          <Badge className="mb-3 bg-gray-100 text-gray-700 border-gray-200 text-xs">
            FAQ
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            Частые вопросы
          </h2>
        </div>

        <div className="space-y-2">
          {FAQ.map((item, idx) => (
            <Card key={idx} className="border border-gray-200 bg-white overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-left min-h-[52px] active:bg-gray-50 transition-colors"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              >
                <span className="font-semibold text-sm sm:text-base text-gray-800">
                  {item.q}
                </span>
                <Icon
                  name="ChevronDown"
                  size={20}
                  className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                    openFaq === idx ? "rotate-180" : ""
                  }`}
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
      </section>

      {/* ──────────── Footer CTA ──────────── */}
      <section className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white">
        <div className="max-w-3xl mx-auto px-5 py-16 sm:py-24 flex flex-col items-center text-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center ring-2 ring-white/30">
            <Icon name="GraduationCap" size={32} className="text-white" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight">
            Начни учиться эффективнее прямо сейчас
          </h2>
          <p className="text-sm sm:text-base text-white/70 max-w-md">
            Присоединяйся к 500+ студентам, которые уже используют Studyfay для
            учёбы, планирования и подготовки к экзаменам.
          </p>

          <Button
            onClick={goRegister}
            className="min-h-[52px] px-8 text-lg font-bold rounded-2xl bg-white text-purple-700 hover:bg-white/90 shadow-xl active:scale-[0.97] transition-transform"
          >
            Создать аккаунт бесплатно
          </Button>

          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-white/50 mt-1">
            <span className="flex items-center gap-1">
              <Icon name="CheckCircle2" size={12} />
              Бесплатно
            </span>
            <span className="flex items-center gap-1">
              <Icon name="Clock" size={12} />
              Регистрация за 30 секунд
            </span>
            <span className="flex items-center gap-1">
              <Icon name="ShieldCheck" size={12} />
              Без спама
            </span>
          </div>
        </div>
      </section>

      {/* ──────────── Minimal footer ──────────── */}
      <footer className="bg-gray-950 text-gray-500 text-xs">
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>&copy; {new Date().getFullYear()} Studyfay</span>
          <div className="flex gap-4">
            <a href="/privacy" className="hover:text-white transition-colors">
              Политика конфиденциальности
            </a>
            <a href="/terms" className="hover:text-white transition-colors">
              Условия использования
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AppStore;