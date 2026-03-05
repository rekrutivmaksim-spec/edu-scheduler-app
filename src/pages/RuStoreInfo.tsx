import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";

const APP_NAME = "Studyfay";
const SHORT_DESC =
  "ИИ-репетитор, расписание пар, трекер задач и помодоро для студентов";
const CONTACT_EMAIL = "support@studyfay.ru";

const FULL_DESC = `Studyfay — бесплатное мобильное приложение для студентов вузов и колледжей, которое объединяет все необходимые инструменты для продуктивной учёбы в одном месте.

РАСПИСАНИЕ ПАР
Удобное расписание занятий с поддержкой чётных и нечётных недель. Автоматическое определение текущей пары, уведомления о начале занятий, информация об аудиториях и преподавателях. Импорт расписания из популярных систем вузов.

ИИ-РЕПЕТИТОР 24/7
Персональный ИИ-помощник, который поможет разобраться в сложной теме, подготовиться к экзамену, решить задачу с пошаговым объяснением. Поддержка всех предметов — от математики до философии. Работает на основе современных языковых моделей.

ТРЕКЕР ЗАДАЧ С ДЕДЛАЙНАМИ
Управляйте домашними заданиями, курсовыми и проектами. Устанавливайте дедлайны, приоритеты и получайте напоминания. Никогда не пропустите важную сдачу.

ПОМОДОРО-ТАЙМЕР
Таймер продуктивной учёбы по методике Pomodoro. Настраиваемые интервалы работы и отдыха. Статистика учебного времени по дням и неделям.

ЭЛЕКТРОННАЯ ЗАЧЁТНАЯ КНИЖКА
Ведите учёт оценок по всем предметам и семестрам. Расчёт среднего балла, отслеживание прогресса, анализ академической успеваемости.

СКАНИРОВАНИЕ КОНСПЕКТОВ
Сфотографируйте конспект или учебник — ИИ распознает текст, структурирует информацию и поможет создать краткое содержание или карточки для повторения.

КАРТОЧКИ ДЛЯ ЗАПОМИНАНИЯ
Создавайте флеш-карточки для подготовки к экзаменам. Интервальное повторение по научно обоснованной методике помогает запоминать информацию надолго.

ПРОБНЫЕ ЭКЗАМЕНЫ
Тренируйтесь перед реальными экзаменами с помощью ИИ-генерируемых тестов по вашим предметам. Подробный разбор ошибок и рекомендации.

ГЕЙМИФИКАЦИЯ УЧЁБЫ
Стрики за ежедневную учёбу, достижения за выполнение задач, уровни и рейтинг среди друзей. Учёба становится увлекательной!

УЧЕБНЫЕ ГРУППЫ
Создавайте группы с одногруппниками, делитесь расписанием, материалами и заметками. Совместная подготовка к экзаменам.

ВИДЖЕТЫ
Виджеты для домашнего экрана с расписанием на сегодня, ближайшими дедлайнами и прогрессом учёбы.

Studyfay создан студентами для студентов. Приложение постоянно обновляется и улучшается на основе обратной связи пользователей.

Бесплатный тариф включает все основные функции. Подписка Studyfay Pro открывает безлимитный доступ к ИИ-репетитору, расширенную аналитику и дополнительные возможности.`;

const BUBBLEWRAP_STEPS = [
  "npm i -g @nicolo-ribaudo/bubblewrap",
  "bubblewrap init --manifest https://studyfay.poehali.dev/manifest.json",
  'Указать package_name: dev.studyfay.app.twa',
  "bubblewrap build",
  "Подписать APK с помощью keytool / jarsigner",
  "Получить SHA-256 fingerprint: keytool -list -v -keystore my-key.keystore",
  "Обновить /.well-known/assetlinks.json с реальным fingerprint",
  "Загрузить APK в RuStore Console: https://console.rustore.ru",
];

const RuStoreInfo = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <Icon name="ArrowLeft" className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold truncate">
            RuStore Publication Info
          </h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-4">
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
            <Icon name="Store" className="h-5 w-5" />
            <h2 className="font-bold text-base">Основная информация</h2>
          </div>
          <div className="space-y-2 text-sm">
            <InfoRow label="Название" value={APP_NAME} />
            <InfoRow label="Категория" value="Образование" />
            <InfoRow label="Возрастной рейтинг" value="0+" />
            <InfoRow label="Цена" value="Бесплатное (с подпиской)" />
            <InfoRow label="Email" value={CONTACT_EMAIL} />
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
            <Icon name="FileText" className="h-5 w-5" />
            <h2 className="font-bold text-base">Краткое описание</h2>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 font-mono">
            {SHORT_DESC}
          </p>
          <p className="text-xs text-gray-400">
            {SHORT_DESC.length} / 80 символов
          </p>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
            <Icon name="AlignLeft" className="h-5 w-5" />
            <h2 className="font-bold text-base">Полное описание</h2>
          </div>
          <pre className="text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 whitespace-pre-wrap font-sans leading-relaxed max-h-96 overflow-y-auto">
            {FULL_DESC}
          </pre>
          <p className="text-xs text-gray-400">
            {FULL_DESC.length} / 4000 символов
          </p>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
            <Icon name="Link" className="h-5 w-5" />
            <h2 className="font-bold text-base">Ссылки</h2>
          </div>
          <div className="space-y-2 text-sm">
            <InfoRow label="Политика конфиденциальности" value="/privacy" isLink />
            <InfoRow label="Условия использования" value="/terms" isLink />
            <InfoRow
              label="Digital Asset Links"
              value="/.well-known/assetlinks.json"
              isLink
            />
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
            <Icon name="Hammer" className="h-5 w-5" />
            <h2 className="font-bold text-base">Сборка APK (Bubblewrap)</h2>
          </div>
          <ol className="space-y-2">
            {BUBBLEWRAP_STEPS.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 text-xs font-bold">
                  {i + 1}
                </span>
                <span className="text-gray-700 dark:text-gray-300 font-mono text-xs leading-6 break-all">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-5 space-y-3 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Icon name="AlertTriangle" className="h-5 w-5" />
            <h2 className="font-bold text-base">Digital Asset Links</h2>
          </div>
          <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
            После подписания APK необходимо заменить{" "}
            <code className="bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded text-xs font-mono">
              PLACEHOLDER_SHA256_FINGERPRINT
            </code>{" "}
            в файле{" "}
            <code className="bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded text-xs font-mono">
              /.well-known/assetlinks.json
            </code>{" "}
            на реальный SHA-256 отпечаток сертификата подписи. Без этого TWA
            будет открываться в Custom Tab вместо полноэкранного режима.
          </p>
        </Card>
      </div>
    </div>
  );
};

const InfoRow = ({
  label,
  value,
  isLink,
}: {
  label: string;
  value: string;
  isLink?: boolean;
}) => (
  <div className="flex items-start justify-between gap-4">
    <span className="text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
    {isLink ? (
      <a
        href={value}
        className="text-purple-600 dark:text-purple-400 font-medium text-right hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {value}
      </a>
    ) : (
      <span className="text-gray-900 dark:text-gray-100 font-medium text-right">
        {value}
      </span>
    )}
  </div>
);

export default RuStoreInfo;