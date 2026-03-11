import Layout from "@/components/Layout";
import { GENERATION_COST, COLORTYPE_COST, MIN_TOPUP } from "@/config/prices";

const Payment = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Информация об оплате
          </h1>

          <div className="space-y-6 text-gray-700">
            <section>
              <h2 className="text-2xl font-semibold mb-3 text-gray-900">
                Способ оплаты
              </h2>
              <p className="mb-4">
                Оплата принимается через ЮКассу — безопасный сервис приема
                платежей от Яндекса.
              </p>
              <p className="mb-4">Доступные способы оплаты:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Банковские карты (Visa, MasterCard, Мир)</li>
                <li>Электронные кошельки (ЮМоней, Киви)</li>
                <li>СБП (Система быстрых платежей)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-gray-900">
                Тарифы
              </h2>
              <div className="bg-purple-50 rounded-lg p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Виртуальная примерочная
                  </h3>
                  <p className="text-2xl font-bold text-purple-600">
                    {GENERATION_COST} рублей
                  </p>
                  <p className="text-sm text-gray-600 mt-1">За одну примерку</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Определение цветотипа
                  </h3>
                  <p className="text-2xl font-bold text-purple-600">
                    {COLORTYPE_COST} рублей
                  </p>
                  <p className="text-sm text-gray-600 mt-1">За один анализ</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-gray-900">
                Как получить услугу
              </h2>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Пополните баланс
                    </h3>
                    <p>
                      В личном кабинете (вкладка "Кошелек") пополните счет на
                      нужную сумму через ЮКассу. Минимальная сумма пополнения —
                      {MIN_TOPUP} рублей.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Загрузите фото и запустите услугу
                    </h3>
                    <p>
                      Выберите нужную услугу (примерочная или цветотип),
                      загрузите фотографию и нажмите "Генерировать". {GENERATION_COST} рублей
                      списываются с баланса сразу при запуске генерации.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Получите результат
                    </h3>
                    <p>
                      Обработка занимает от 30 секунд до 2 минут. Готовый
                      результат появится на странице и сохранится в вашем личном
                      кабинете (вкладка "История").
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-gray-900">
                Безопасность платежей
              </h2>
              <p>
                Все платежи проходят через защищенное соединение ЮКассы. Мы не
                храним данные ваших банковских карт. ЮКасса — сертифицированная
                платежная система, соответствующая стандартам PCI DSS.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-gray-900">
                Когда списывается оплата
              </h2>
              <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-4">
                <h3 className="font-semibold text-gray-900 mb-2">
                  Списание происходит сразу
                </h3>
                <p className="text-gray-700">
                  {GENERATION_COST} рублей списываются с баланса сразу после нажатия кнопки
                  запуска (до начала обработки).
                </p>
              </div>

              <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4">
                <h3 className="font-semibold text-gray-900 mb-2">
                  Автоматический возврат средств
                </h3>
                <p className="text-gray-700 mb-3">
                  Деньги <strong>автоматически вернутся на баланс</strong>,
                  если:
                </p>

                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-gray-900">
                      Виртуальная примерочная:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                      <li>
                        Произошла техническая ошибка до отправки в нейросеть
                      </li>
                      <li>
                        Нейросеть вернула статус ошибки обработки (не смогла
                        создать результат)
                      </li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium text-gray-900">
                      Определение цветотипа:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                      <li>
                        Произошла техническая ошибка до отправки запроса в
                        нейросеть
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 border-l-4 border-red-500 p-4">
                <h3 className="font-semibold text-gray-900 mb-2">
                  Когда деньги НЕ возвращаются
                </h3>
                <p className="text-gray-700 mb-2">
                  <strong>Важно:</strong> Деньги <strong>не вернутся</strong>,
                  если:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  <li>
                    Нейросеть обработала фото и выдала результат (даже если
                    результат вам не понравился)
                  </li>
                  <li>
                    Вы закрыли страницу во время генерации — обработка
                    продолжится, результат сохранится в истории
                  </li>
                  <li>
                    Превышено время ожидания — обработка продолжается в фоне,
                    результат появится в истории позже
                  </li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-gray-900">
                Возврат средств с баланса
              </h2>
              <p className="mb-4">
                Возврат средств с баланса возможен при соблюдении следующих
                условий:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>
                  Вы не использовали платные услуги (нет записей в истории)
                </li>
                <li>
                  С момента пополнения баланса прошло не более 14 календарных
                  дней
                </li>
                <li>
                  Вы направили заявление о возврате на styleselect@mail.ru
                </li>
              </ul>
              <p className="mb-4">
                <strong>Важно:</strong> Возврат средств с баланса производится
                только в случае, если услуги не были использованы. Если в вашей
                истории есть готовые результаты (примерка или цветотип), эти
                услуги считаются оказанными, и возврат за них не производится.
              </p>
              <p>
                Возврат осуществляется в течение 10 рабочих дней на банковскую
                карту, с которой было пополнение.
              </p>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Payment;