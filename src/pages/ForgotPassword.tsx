import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import Captcha from '@/components/ui/captcha';

const PASSWORD_RESET_API = 'https://functions.poehali.dev/94d17619-aeab-4b07-b099-fafb742f304c';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [captchaValid, setCaptchaValid] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!captchaValid) {
      toast.error('Пожалуйста, решите пример');
      return;
    }

    if (!email) {
      toast.error('Введите email');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(PASSWORD_RESET_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'request_reset',
          email
        })
      });

      const data = await response.json();

      if (response.ok) {
        setIsEmailSent(true);
        toast.success('Ссылка для сброса пароля отправлена на email');
      } else {
        toast.error(data.error || 'Ошибка при отправке');
      }
    } catch (error) {
      toast.error('Ошибка соединения с сервером');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Восстановление пароля</CardTitle>
            <CardDescription className="text-center">
              {isEmailSent 
                ? 'Проверьте свою почту' 
                : 'Введите email для получения ссылки'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isEmailSent ? (
              <div className="space-y-4">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <Icon name="Mail" className="text-green-600" size={32} />
                  </div>
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  Мы отправили ссылку для сброса пароля на <strong>{email}</strong>
                </p>
                <p className="text-center text-sm text-muted-foreground">
                  Письмо должно прийти в течение нескольких минут. Проверьте также папку "Спам".
                </p>
                <div className="space-y-2 pt-4">
                  <Button 
                    onClick={() => navigate('/login')} 
                    className="w-full"
                    variant="outline"
                  >
                    Вернуться на страницу входа
                  </Button>
                  <Button 
                    onClick={() => {
                      setIsEmailSent(false);
                      setEmail('');
                    }} 
                    className="w-full"
                    variant="ghost"
                  >
                    Отправить ещё раз
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>

                <Captcha onVerify={setCaptchaValid} className="space-y-2" />

                <Button type="submit" className="w-full" disabled={isLoading || !captchaValid}>
                  {isLoading ? (
                    <>
                      <Icon name="Loader2" className="mr-2 animate-spin" size={18} />
                      Отправка...
                    </>
                  ) : (
                    <>
                      <Icon name="Send" className="mr-2" size={18} />
                      Отправить ссылку
                    </>
                  )}
                </Button>

                <div className="text-center pt-2">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => navigate('/login')}
                    className="text-sm"
                  >
                    Вернуться к входу
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}