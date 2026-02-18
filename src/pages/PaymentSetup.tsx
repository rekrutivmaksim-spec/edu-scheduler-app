import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

const PaymentSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copied, setCopied] = useState<'terminal' | 'password' | null>(null);

  const testCredentials = {
    terminalId: '176985028',
    password: '6UxEue_VM'
  };

  const copyToClipboard = (text: string, type: 'terminal' | 'password') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    toast({
      title: 'Скопировано',
      description: 'Данные скопированы в буфер обмена'
    });
    setTimeout(() => setCopied(null), 2000);
  };

  const handleTestPayment = () => {
    navigate('/subscription');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6 pt-6">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          >
            <Icon name="ChevronLeft" size={20} />
            <span className="ml-1">Назад</span>
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          >
            Закрыть
          </Button>
        </div>

        <div className="mb-6">
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full" style={{ width: '60%' }}></div>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Настройка оплаты через API
        </h1>
        <p className="text-gray-500 mb-8">
          Может понадобиться помощь разработчика
        </p>

        <Card className="p-6 mb-6 border-0 shadow-lg bg-white">
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                1
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Изучите инструкцию по настройке оплаты через API
                </h3>
                <Button
                  variant="outline"
                  className="border-blue-200 text-blue-600 hover:bg-blue-50"
                  onClick={() => window.open('https://www.tinkoff.ru/kassa/develop/api/', '_blank')}
                >
                  К инструкции
                </Button>
              </div>
            </div>

            <div className="h-px bg-gray-200"></div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                2
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Используйте данные тестового терминала для настройки
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-sm text-gray-600 mb-2">Terminal ID</div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-mono font-semibold text-gray-900">
                        {testCredentials.terminalId}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(testCredentials.terminalId, 'terminal')}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Icon name={copied === 'terminal' ? 'Check' : 'Copy'} size={18} />
                      </Button>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-sm text-gray-600 mb-2">Пароль</div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-mono font-semibold text-gray-900">
                        {testCredentials.password}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(testCredentials.password, 'password')}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Icon name={copied === 'password' ? 'Check' : 'Copy'} size={18} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Button
          onClick={handleTestPayment}
          className="w-full h-14 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-lg rounded-2xl shadow-lg"
        >
          К тестовым платежам
        </Button>
      </div>
    </div>
  );
};

export default PaymentSetup;
