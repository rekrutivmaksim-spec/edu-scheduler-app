import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';

const RESEND_API = 'https://functions.poehali.dev/cf48d1a6-141c-4ecb-befe-6203d8292d89';

export default function RegistrationSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || '';
  const [isResending, setIsResending] = useState(false);

  if (!email) {
    navigate('/register');
    return null;
  }

  return (
    <Layout>
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Icon name="Mail" className="text-green-600" size={32} />
            </div>
            <CardTitle className="text-2xl">Проверьте почту</CardTitle>
            <CardDescription>
              Регистрация почти завершена!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              Мы отправили письмо с подтверждением на адрес:
            </p>
            <p className="text-center font-medium">{email}</p>
            <p className="text-center text-sm text-muted-foreground">
              Перейдите по ссылке в письме, чтобы активировать аккаунт.
              Ссылка действительна 24 часа.
            </p>
            
            <div className="pt-4 space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/login')}
              >
                Перейти на страницу входа
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={async () => {
                  setIsResending(true);
                  try {
                    const response = await fetch(RESEND_API, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email })
                    });
                    
                    if (response.ok) {
                      toast.success('Письмо отправлено повторно');
                    } else {
                      const data = await response.json();
                      toast.error(data.error || 'Ошибка отправки');
                    }
                  } catch (error) {
                    toast.error('Ошибка отправки');
                  } finally {
                    setIsResending(false);
                  }
                }}
                disabled={isResending}
              >
                {isResending ? 'Отправка...' : 'Отправить письмо повторно'}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Не получили письмо? Проверьте папку «Спам»
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}