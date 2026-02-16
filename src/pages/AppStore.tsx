import { useState } from "react";
import Icon from "@/components/ui/icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ASO_TITLE = "Studyfay — Учись умнее";
const ASO_SHORT = "Планировщик учёбы с ИИ-репетитором, расписанием и геймификацией для студентов";
const ASO_FULL = `Studyfay — это твой персональный помощник в учёбе, который объединяет ИИ-репетитора, планировщик задач, расписание занятий и геймификацию в одном удобном приложении.

ИИ-АССИСТЕНТ
Загрузи свои конспекты, лекции и учебники (PDF, DOCX) — ИИ проанализирует их и ответит на любой вопрос по твоим материалам. Не нужно перечитывать 100 страниц — просто спроси, и получи точный ответ с ссылкой на источник. ИИ объясняет сложные темы простым языком, приводит примеры и помогает разобраться в трудных местах.

РАСПИСАНИЕ ЗАНЯТИЙ
Добавляй лекции, семинары, практики и лабораторные с указанием аудитории, преподавателя и времени. Расписание отображается на неделю и интегрировано с календарём. Больше не нужно запоминать, какая пара следующая.

ПЛАНИРОВЩИК ЗАДАЧ
Создавай задачи с дедлайнами, приоритетами (высокий, средний, низкий) и категориями. Отслеживай прогресс и не пропускай сроки сдачи. Задачи отображаются в календаре вместе с расписанием.

ТАЙМЕР ПОМОДОРО
Учись эффективно по методу Помодоро: 25 минут работы, 5 минут отдыха. Таймер ведёт подробную аналитику учебных сессий — сколько часов ты учился, какие предметы, в какие дни. Отслеживай свой прогресс и находи оптимальное время для учёбы.

ГЕЙМИФИКАЦИЯ
Получай XP за каждое действие: выполнение задач, учебные сессии, ежедневный вход. Повышай уровень (от Новичка до Легенды), открывай достижения (40+ уникальных наград), поддерживай стрик ежедневной активности. Выполняй ежедневные квесты для бонусных наград.

ЛИДЕРБОРД
Соревнуйся с другими студентами! Сравнивай свой прогресс, поднимайся в рейтинге и мотивируй себя учиться больше.

ИИ-ПЛАНЫ ПОДГОТОВКИ К ЭКЗАМЕНАМ
Укажи предмет, дату экзамена и сложность — ИИ составит персональный план подготовки по дням с конкретными темами и рекомендуемым временем. Отмечай пройденные дни и следи за прогрессом.

КАЛЕНДАРЬ
Все занятия, задачи и дедлайны в одном месте. Удобный вид по дням и неделям помогает планировать время.

АНАЛИТИКА УЧЁБЫ
Подробная статистика: время учёбы по дням и предметам, количество выполненных задач, продуктивность. Графики и диаграммы помогают понять, где ты молодец, а где стоит поднажать.

РЕФЕРАЛЬНАЯ ПРОГРАММА
Приглашай друзей и получай бонусные вопросы к ИИ-ассистенту. Чем больше друзей — тем больше возможностей.

ПОДПИСКА PREMIUM
- 1 месяц — 249 ₽
- 3 месяца — 599 ₽ (экономия 30%)
- 6 месяцев — 999 ₽ (экономия 50%)
Первые 7 дней бесплатно для новых пользователей!

Premium открывает полный доступ к ИИ-ассистенту, ИИ-планам подготовки и расширенной аналитике.

Studyfay — учись умнее, а не больше.`;

const FEATURES = [
  { icon: "Bot", title: "ИИ-ассистент", desc: "Задавай вопросы по своим конспектам и получай точные ответы" },
  { icon: "CalendarDays", title: "Расписание", desc: "Лекции, семинары, практики с аудиториями и преподавателями" },
  { icon: "ListChecks", title: "Планировщик задач", desc: "Дедлайны, приоритеты и категории для всех заданий" },
  { icon: "Timer", title: "Помодоро-таймер", desc: "Учись по методу Помодоро с подробной аналитикой сессий" },
  { icon: "Trophy", title: "Геймификация", desc: "XP, уровни, стрики, 40+ достижений и ежедневные квесты" },
  { icon: "Medal", title: "Лидерборд", desc: "Соревнуйся с другими студентами в рейтинге" },
  { icon: "GraduationCap", title: "ИИ-планы экзаменов", desc: "Персональный план подготовки по дням от ИИ" },
  { icon: "FileUp", title: "Загрузка материалов", desc: "PDF, DOCX — ИИ анализирует и отвечает по ним" },
  { icon: "Calendar", title: "Календарь", desc: "Все занятия и задачи в одном удобном виде" },
  { icon: "BarChart3", title: "Аналитика", desc: "Статистика учёбы с графиками и диаграммами" },
  { icon: "Users", title: "Реферальная программа", desc: "Приглашай друзей и получай бонусы" },
  { icon: "Crown", title: "Premium", desc: "От 249 ₽/мес, первые 7 дней бесплатно" },
];

const SCREENSHOTS = [
  "https://cdn.poehali.dev/projects/3ff43efa-4f20-46c2-b4c7-d9b10642fd31/files/0bea64bd-3f48-4049-a65e-de27e994809e.jpg",
  "https://cdn.poehali.dev/projects/3ff43efa-4f20-46c2-b4c7-d9b10642fd31/files/331ff0ba-d203-4dc2-8872-16bdd1395713.jpg",
];

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="shrink-0 gap-1.5"
    >
      <Icon name={copied ? "Check" : "Copy"} size={14} />
      {copied ? "Скопировано" : label}
    </Button>
  );
}

function CharCounter({ text, max }: { text: string; max: number }) {
  const len = text.length;
  const over = len > max;
  return (
    <span className={`text-xs font-mono ${over ? "text-red-500 font-bold" : "text-muted-foreground"}`}>
      {len}/{max}
    </span>
  );
}

const AppStore = () => {
  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden bg-gradient-to-br from-[hsl(262,90%,65%)] via-[hsl(280,100%,70%)] to-[hsl(262,90%,55%)] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,0,0,0.15),transparent_60%)]" />
        <div className="relative max-w-5xl mx-auto px-4 py-20 text-center">
          <Badge className="bg-white/20 text-white border-white/30 mb-6 text-sm px-4 py-1.5">
            RuStore ASO
          </Badge>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-4 font-[Montserrat]">
            Studyfay
          </h1>
          <p className="text-xl md:text-2xl font-medium opacity-90 mb-2">
            Учись умнее, а не больше
          </p>
          <p className="text-base md:text-lg opacity-75 max-w-2xl mx-auto mb-10">
            {ASO_SHORT}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Badge className="bg-white/20 text-white border-white/30 px-3 py-1">
              <Icon name="Bot" size={14} className="mr-1.5" />
              ИИ-репетитор
            </Badge>
            <Badge className="bg-white/20 text-white border-white/30 px-3 py-1">
              <Icon name="Trophy" size={14} className="mr-1.5" />
              Геймификация
            </Badge>
            <Badge className="bg-white/20 text-white border-white/30 px-3 py-1">
              <Icon name="Timer" size={14} className="mr-1.5" />
              Помодоро
            </Badge>
            <Badge className="bg-white/20 text-white border-white/30 px-3 py-1">
              <Icon name="CalendarDays" size={14} className="mr-1.5" />
              Расписание
            </Badge>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-2">ASO-метаданные для RuStore</h2>
          <p className="text-muted-foreground">Готовые тексты для публикации. Нажмите кнопку для копирования.</p>
        </div>

        <div className="space-y-6">
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg">Название приложения</CardTitle>
                  <CharCounter text={ASO_TITLE} max={50} />
                </div>
                <CopyButton text={ASO_TITLE} label="Копировать" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold text-primary">{ASO_TITLE}</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg">Краткое описание</CardTitle>
                  <CharCounter text={ASO_SHORT} max={80} />
                </div>
                <CopyButton text={ASO_SHORT} label="Копировать" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-base text-foreground/80">{ASO_SHORT}</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg">Полное описание</CardTitle>
                  <CharCounter text={ASO_FULL} max={4000} />
                </div>
                <CopyButton text={ASO_FULL} label="Копировать" />
              </div>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm text-foreground/80 leading-relaxed font-sans bg-muted/50 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                {ASO_FULL}
              </pre>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="bg-muted/30 py-16">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-2">Возможности приложения</h2>
            <p className="text-muted-foreground">12 функций для эффективной учёбы</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <Card key={f.title} className="hover:shadow-md transition-shadow hover:border-primary/30">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon name={f.icon} size={20} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{f.title}</h3>
                      <p className="text-sm text-muted-foreground leading-snug">{f.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-2">Тарифы Premium</h2>
          <p className="text-muted-foreground">Первые 7 дней бесплатно для новых пользователей</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {[
            { period: "1 месяц", price: "249 ₽", perMonth: "249 ₽/мес", save: null },
            { period: "3 месяца", price: "599 ₽", perMonth: "200 ₽/мес", save: "Экономия 30%" },
            { period: "6 месяцев", price: "999 ₽", perMonth: "167 ₽/мес", save: "Экономия 50%" },
          ].map((plan) => (
            <Card
              key={plan.period}
              className={`relative overflow-hidden text-center ${
                plan.save === "Экономия 50%"
                  ? "border-2 border-primary shadow-lg shadow-primary/10"
                  : ""
              }`}
            >
              {plan.save === "Экономия 50%" && (
                <div className="absolute top-0 left-0 right-0 bg-primary text-white text-xs font-bold py-1 text-center">
                  ЛУЧШЕЕ ПРЕДЛОЖЕНИЕ
                </div>
              )}
              <CardContent className={`p-6 ${plan.save === "Экономия 50%" ? "pt-10" : ""}`}>
                <h3 className="font-bold text-lg mb-1">{plan.period}</h3>
                <p className="text-3xl font-extrabold text-primary mb-1">{plan.price}</p>
                <p className="text-sm text-muted-foreground mb-3">{plan.perMonth}</p>
                {plan.save && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                    {plan.save}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-muted/30 py-16">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-2">Скриншоты</h2>
            <p className="text-muted-foreground">Изображения для RuStore</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {SCREENSHOTS.map((src, i) => (
              <Card key={i} className="overflow-hidden">
                <img
                  src={src}
                  alt={`Скриншот ${i + 1}`}
                  className="w-full h-auto"
                  loading="lazy"
                />
                <CardContent className="p-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Скриншот {i + 1}</span>
                  <Button variant="ghost" size="sm" asChild>
                    <a href={src} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                      <Icon name="ExternalLink" size={14} />
                      Открыть
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-16 text-center">
        <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
          <CardContent className="p-8">
            <Icon name="Rocket" size={48} className="text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Готово к публикации</h2>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              Все тексты соответствуют требованиям RuStore. Скопируйте метаданные выше и загрузите скриншоты при публикации.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Icon name="Check" size={16} className="text-green-500" />
                Название: {ASO_TITLE.length}/50 символов
              </div>
              <div className="flex items-center gap-1.5">
                <Icon name="Check" size={16} className="text-green-500" />
                Краткое: {ASO_SHORT.length}/80 символов
              </div>
              <div className="flex items-center gap-1.5">
                <Icon name="Check" size={16} className="text-green-500" />
                Полное: {ASO_FULL.length}/4000 символов
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default AppStore;
