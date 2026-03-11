import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';

const VERIFY_API = 'https://functions.poehali.dev/fa1c7591-e53a-4699-8b1d-d0ed3ebfdd27';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const hasVerified = useRef(false);

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setError('Неверная ссылка для подтверждения');
      setIsVerifying(false);
      return;
    }

    // Предотвращаем повторные вызовы
    if (hasVerified.current) return;
    hasVerified.current = true;

    const verifyEmail = async () => {
      try {
        const response = await fetch(`${VERIFY_API}?token=${token}`, {
          credentials: 'include'
        });
        const data = await response.json();

        if (!response.ok) {
          // Если email уже подтвержден, показываем специальное сообщение
          if (data.error === 'Email already verified') {
            setError('Этот email уже был подтвержден ранее. Вы можете войти в свой аккаунт.');
          } else {
            setError(data.error || 'Ошибка подтверждения email');
          }
          setIsVerifying(false);
          return;
        }

        updateUser(data.user);

        setIsSuccess(true);
        toast.success('Email успешно подтвержден!');

        setTimeout(() => {
          navigate('/profile');
        }, 2000);
      } catch (err) {
        setError('Ошибка подтверждения email');
        toast.error('Ошибка подтверждения');
      } finally {
        setIsVerifying(false);
      }
    };

    verifyEmail();
  }, [searchParams, navigate, updateUser]);

  return (
    <Layout>
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Подтверждение email</CardTitle>
            <CardDescription>
              {isVerifying && 'Проверяем ваш email...'}
              {isSuccess && 'Email успешно подтвержден!'}
              {error && 'Ошибка подтверждения'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {isVerifying && (
              <Icon name="Loader2" className="animate-spin text-primary" size={48} />
            )}
            
            {isSuccess && (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <Icon name="Check" className="text-green-600" size={32} />
                </div>
                <p className="text-center text-muted-foreground">
                  Перенаправляем в личный кабинет...
                </p>
              </>
            )}
            
            {error && (
              <>
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <Icon name="X" className="text-red-600" size={32} />
                </div>
                <p className="text-center text-muted-foreground">{error}</p>
                <div className="flex gap-2 w-full">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate('/login')}
                  >
                    Войти
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => navigate('/register')}
                  >
                    Регистрация
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}