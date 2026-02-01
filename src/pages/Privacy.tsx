import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useNavigate } from 'react-router-dom';

export default function Privacy() {
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
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center">
                <Icon name="Shield" size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Политика конфиденциальности</h1>
                <p className="text-sm text-gray-500">Последнее обновление: {new Date().toLocaleDateString('ru-RU')}</p>
              </div>
            </div>
          </div>

          <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Общие положения</h2>
              <p>
                Настоящая Политика конфиденциальности (далее — Политика) определяет порядок обработки и защиты 
                персональных данных пользователей мобильного приложения <strong>Studyfay</strong> (далее — Приложение).
              </p>
              <p>
                Используя Приложение, вы подтверждаете своё согласие с условиями данной Политики. 
                Если вы не согласны с условиями, пожалуйста, не используйте Приложение.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Какие данные мы собираем</h2>
              <p>Мы собираем следующие категории персональных данных:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Данные для авторизации:</strong>
                  <ul className="list-circle pl-6 mt-2">
                    <li>Email и пароль (при регистрации)</li>
                  </ul>
                </li>
                <li>
                  <strong>Профильная информация:</strong>
                  <ul className="list-circle pl-6 mt-2">
                    <li>ФИО (добровольно при регистрации)</li>
                    <li>Университет, факультет, курс (опционально)</li>
                  </ul>
                </li>
                <li>
                  <strong>Данные использования:</strong>
                  <ul className="list-circle pl-6 mt-2">
                    <li>Расписание занятий</li>
                    <li>Задачи и дедлайны</li>
                    <li>Загруженные материалы</li>
                    <li>История обращений к ИИ-ассистенту</li>
                  </ul>
                </li>
                <li>
                  <strong>Технические данные:</strong>
                  <ul className="list-circle pl-6 mt-2">
                    <li>IP-адрес</li>
                    <li>Тип устройства и браузер</li>
                    <li>Логи ошибок для улучшения сервиса</li>
                  </ul>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Цели обработки данных</h2>
              <p>Мы используем ваши данные для:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Авторизации:</strong> Вход в Приложение по email и паролю</li>
                <li><strong>Персонализации:</strong> Настройка интерфейса под ваши нужды</li>
                <li><strong>Уведомлений:</strong> Напоминания о занятиях и дедлайнах (по вашему согласию)</li>
                <li><strong>Поддержки:</strong> Решение технических проблем и ответы на вопросы</li>
                <li><strong>Аналитики:</strong> Улучшение функционала Приложения</li>
                <li><strong>Безопасности:</strong> Защита от мошенничества и несанкционированного доступа</li>
              </ul>
            </section>



            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Передача данных третьим лицам</h2>
              <p>Мы передаём минимально необходимые данные только следующим сервисам:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>DeepSeek AI</strong> — текст ваших вопросов ИИ-ассистенту (анонимно)</li>
                <li><strong>Яндекс.Облако</strong> — хостинг данных (сервера в России, защищены шифрованием)</li>
              </ul>
              <p className="mt-4">
                <strong>Мы НЕ продаём ваши данные!</strong> Передача происходит только для работы сервиса.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Хранение и защита данных</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Данные хранятся на защищённых серверах в России (Яндекс.Облако)</li>
                <li>Используется SSL-шифрование для передачи данных</li>
                <li>Пароли хранятся в зашифрованном виде (bcrypt)</li>
                <li>Доступ к данным имеют только авторизованные сотрудники</li>
                <li>Данные хранятся до удаления аккаунта или 3 года неактивности</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Ваши права</h2>
              <p>Вы имеете право:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Доступ:</strong> Запросить копию ваших персональных данных</li>
                <li><strong>Изменение:</strong> Обновить или исправить данные в разделе "Профиль"</li>
                <li><strong>Удаление:</strong> Удалить аккаунт и все связанные данные</li>
                <li><strong>Отзыв согласия:</strong> Отключить SMS-уведомления в настройках</li>
                <li><strong>Жалоба:</strong> Обратиться в Роскомнадзор при нарушении прав</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Согласие на обработку данных</h2>
              <p>
                Вводя номер телефона или регистрируясь в Приложении, вы подтверждаете своё согласие на:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Обработку персональных данных в соответствии с данной Политикой</li>
                <li>Использование cookie для улучшения работы Приложения</li>
              </ul>
              <p className="mt-4">
                Согласие можно отозвать, удалив аккаунт или отключив уведомления в настройках.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Изменения в Политике</h2>
              <p>
                Мы можем обновлять Политику при изменении законодательства или функционала Приложения. 
                О значительных изменениях мы уведомим вас через SMS или push-уведомление.
              </p>
              <p className="mt-4">
                Дата последнего обновления указана в начале документа.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Контакты</h2>
              <p>По вопросам обработки персональных данных:</p>
              <ul className="list-none space-y-2 mt-4">
                <li><strong>Email поддержки:</strong> support@studyfay.app</li>
                <li><strong>Telegram:</strong> <a href="https://t.me/+QgiLIa1gFRY4Y2Iy" className="text-blue-600 hover:underline">@studyfay_support</a></li>
              </ul>
            </section>

            <div className="bg-gray-100 p-6 rounded-xl mt-8">
              <p className="text-sm text-gray-600">
                <strong>Правовая основа:</strong> Обработка данных осуществляется в соответствии с законодательством Российской Федерации и согласием пользователя.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}