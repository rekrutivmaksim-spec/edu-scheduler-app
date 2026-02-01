import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useNavigate } from 'react-router-dom';

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Button
          onClick={() => navigate(-1)}
          variant="ghost"
          className="mb-6"
        >
          <Icon name="ArrowLeft" size={18} className="mr-2" />
          Назад
        </Button>

        <Card className="p-8 md:p-12 bg-white shadow-xl">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center">
                <Icon name="FileText" size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Пользовательское соглашение</h1>
                <p className="text-sm text-gray-500">Последнее обновление: {new Date().toLocaleDateString('ru-RU')}</p>
              </div>
            </div>
          </div>

          <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Общие положения</h2>
              <p>
                Настоящее Пользовательское соглашение (далее — Соглашение) регулирует использование 
                мобильного приложения <strong>Studyfay</strong> (далее — Приложение, Сервис).
              </p>
              <p>
                Используя Приложение, вы соглашаетесь с условиями данного Соглашения. 
                Если вы не согласны с условиями, пожалуйста, не используйте Приложение.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Описание Сервиса</h2>
              <p>Studyfay — это умный помощник для студентов, который предоставляет:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Планировщик расписания занятий</li>
                <li>Трекер задач и дедлайнов</li>
                <li>Хранилище материалов (конспекты, презентации, документы)</li>
                <li>ИИ-ассистент для помощи в учёбе</li>
                <li>Календарь с напоминаниями</li>
                <li>Аналитику продуктивности</li>
                <li>Возможность расшаривания расписания с группой</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Регистрация и аккаунт</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Для использования Приложения необходимо создать аккаунт через email</li>
                <li>Вы обязаны предоставлять достоверную информацию</li>
                <li>Вы несёте ответственность за сохранность данных для входа</li>
                <li>Один пользователь может иметь только один аккаунт</li>
                <li>Запрещено передавать доступ к аккаунту третьим лицам</li>
                <li>Мы можем заблокировать аккаунт при нарушении условий</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Использование Сервиса</h2>
              <p><strong>Разрешено:</strong></p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Использовать Приложение для личных образовательных целей</li>
                <li>Загружать свои учебные материалы</li>
                <li>Делиться расписанием с одногруппниками</li>
                <li>Использовать ИИ-ассистент для помощи в учёбе</li>
              </ul>

              <p className="mt-4"><strong>Запрещено:</strong></p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Загружать вредоносный контент или вирусы</li>
                <li>Публиковать материалы, нарушающие авторские права</li>
                <li>Использовать Сервис для мошенничества или спама</li>
                <li>Взламывать или нарушать безопасность Приложения</li>
                <li>Копировать, декомпилировать или модифицировать код Приложения</li>
                <li>Использовать автоматизированные средства (боты) без разрешения</li>
                <li>Размещать оскорбительный, незаконный или неэтичный контент</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Интеллектуальная собственность</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Все права на Приложение принадлежат разработчикам Studyfay</li>
                <li>Загруженные вами материалы остаются вашей собственностью</li>
                <li>Вы даёте нам лицензию на хранение и обработку ваших материалов для работы Сервиса</li>
                <li>Запрещено использовать наш логотип, дизайн или название без разрешения</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Платные функции</h2>
              <p>Базовый функционал Приложения бесплатен. Премиум-подписка включает:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Безлимитные обращения к ИИ-ассистенту</li>
                <li>Расширенное хранилище материалов</li>
                <li>Детальную аналитику продуктивности</li>
                <li>Отключение рекламы (при её наличии)</li>
              </ul>
              <p className="mt-4">
                <strong>Условия подписки:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Оплата через YooKassa или другие платёжные системы</li>
                <li>Подписка продлевается автоматически (можно отключить)</li>
                <li>Возврат возможен в течение 14 дней при отсутствии использования</li>
                <li>Цены могут меняться с уведомлением за 30 дней</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Ответственность и гарантии</h2>
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                <p className="font-semibold text-yellow-900 mb-2">Важно:</p>
                <ul className="list-disc pl-6 space-y-1 text-yellow-800">
                  <li>Приложение предоставляется "как есть" без гарантий</li>
                  <li>Мы не гарантируем 100% доступность Сервиса (возможны технические работы)</li>
                  <li>ИИ-ассистент может давать неточные ответы — всегда проверяйте информацию</li>
                  <li>Мы не несём ответственности за содержание загруженных пользователями материалов</li>
                  <li>Рекомендуем делать резервные копии важных данных</li>
                </ul>
              </div>
              <p className="mt-4">
                Наша ответственность ограничена суммой, уплаченной вами за последние 3 месяца подписки.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Прекращение использования</h2>
              <p><strong>Вы можете:</strong></p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Удалить аккаунт в любой момент через настройки профиля</li>
                <li>При удалении все данные будут удалены в течение 30 дней</li>
              </ul>
              <p className="mt-4"><strong>Мы можем заблокировать ваш аккаунт при:</strong></p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Нарушении условий данного Соглашения</li>
                <li>Неактивности более 3 лет</li>
                <li>По требованию правоохранительных органов</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Изменения в Соглашении</h2>
              <p>
                Мы можем изменять условия Соглашения. О значительных изменениях мы уведомим вас 
                через SMS или push-уведомление за 7 дней до вступления в силу.
              </p>
              <p className="mt-4">
                Продолжая использовать Приложение после изменений, вы соглашаетесь с новыми условиями.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Применимое право и споры</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Соглашение регулируется законодательством Российской Федерации</li>
                <li>Споры разрешаются путём переговоров</li>
                <li>При невозможности урегулирования — в судебном порядке по месту нахождения разработчика</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Контакты</h2>
              <p>По вопросам работы Приложения:</p>
              <ul className="list-none space-y-2 mt-4">
                <li><strong>Email поддержки:</strong> support@studyfay.app</li>
              </ul>
            </section>

            <div className="bg-gray-100 p-6 rounded-xl mt-8">
              <p className="text-sm text-gray-600">
                <strong>Принятие условий:</strong> Регистрируясь или используя Приложение, вы подтверждаете, 
                что прочитали, поняли и согласны с условиями настоящего Соглашения и 
                <a href="/privacy" className="text-blue-600 hover:underline ml-1">Политикой конфиденциальности</a>.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}