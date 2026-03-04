import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/lib/auth';

const VK_AUTH_URL = 'https://functions.poehali.dev/1875b272-ccd5-4605-acd1-44f343ebd7d3';

export default function VKCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');

  useEffect(() => {
    const code = searchParams.get('code');
    const deviceId = searchParams.get('device_id') || '';
    const state = searchParams.get('state') || '';
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      toast({
        variant: 'destructive',
        title: 'Ошибка авторизации',
        description: 'Вы отменили вход через VK'
      });
      setTimeout(() => navigate('/auth'), 2000);
      return;
    }

    if (!code) {
      setStatus('error');
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не получен код авторизации'
      });
      setTimeout(() => navigate('/auth'), 2000);
      return;
    }

    const codeVerifier = sessionStorage.getItem('vk_code_verifier') || '';
    const savedState = sessionStorage.getItem('vk_state') || '';

    if (savedState && state && savedState !== state) {
      setStatus('error');
      toast({
        variant: 'destructive',
        title: 'Ошибка безопасности',
        description: 'Несовпадение state. Попробуйте ещё раз.'
      });
      setTimeout(() => navigate('/auth'), 2000);
      return;
    }

    const exchangeCode = async () => {
      try {
        const response = await fetch(VK_AUTH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'exchange_code',
            code,
            code_verifier: codeVerifier,
            device_id: deviceId,
            state,
          })
        });

        const data = await response.json();

        sessionStorage.removeItem('vk_code_verifier');
        sessionStorage.removeItem('vk_state');

        if (response.ok && data.success) {
          authService.setToken(data.token);
          authService.setUser(data.user);

          setStatus('success');

          toast({
            title: 'Добро пожаловать!',
            description: `Привет, ${data.user.full_name}!`
          });

          setTimeout(() => {
            if (!data.user.onboarding_completed) {
              navigate('/onboarding');
            } else {
              navigate('/');
            }
          }, 1000);
        } else {
          throw new Error(data.error || 'Ошибка авторизации');
        }
      } catch (e) {
        setStatus('error');
        const msg = e instanceof Error ? e.message : 'Не удалось войти через VK';
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: msg
        });
        setTimeout(() => navigate('/auth'), 2000);
      }
    };

    exchangeCode();
  }, [searchParams, navigate, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-10 bg-white/95 backdrop-blur-xl border-0 shadow-2xl rounded-3xl text-center">
        {status === 'processing' && (
          <>
            <Icon name="Loader2" size={64} className="mx-auto text-purple-600 animate-spin mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Входим через VK...</h2>
            <p className="text-gray-600">Подождите несколько секунд</p>
          </>
        )}

        {status === 'success' && (
          <>
            <Icon name="CheckCircle" size={64} className="mx-auto text-green-600 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Вход выполнен!</h2>
            <p className="text-gray-600">Перенаправляем вас...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <Icon name="XCircle" size={64} className="mx-auto text-red-600 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Ошибка входа</h2>
            <p className="text-gray-600">Возвращаемся на страницу входа...</p>
          </>
        )}
      </Card>
    </div>
  );
}
