import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

const VK_AUTH_URL = 'https://functions.poehali.dev/1875b272-ccd5-4605-acd1-44f343ebd7d3';

export default function AuthNew() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleVKAuth = async () => {
    if (!agreedToTerms) {
      toast({
        variant: 'destructive',
        title: 'Необходимо согласие',
        description: 'Подтвердите согласие с условиями использования'
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(VK_AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_auth_url',
          redirect_uri: `${window.location.origin}/auth/vk`
        })
      });

      const data = await response.json();
      
      if (response.ok && data.auth_url) {
        window.location.href = data.auth_url;
      } else {
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: 'VK авторизация временно недоступна'
        });
        setLoading(false);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось подключиться к VK'
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <Card className="relative z-10 w-full max-w-md p-8 bg-white/95 backdrop-blur-xl border-0 shadow-2xl rounded-3xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-3xl shadow-xl mb-4">
            <Icon name="GraduationCap" size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            Studyfay
          </h1>
          <p className="text-gray-600">Твой умный помощник для учёбы</p>
        </div>

        <div className="space-y-6">
          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <Checkbox
              id="terms"
              checked={agreedToTerms}
              onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              className="mt-1"
            />
            <label htmlFor="terms" className="text-sm text-gray-700 cursor-pointer">
              Я согласен(на) с{' '}
              <Link to="/terms" className="text-purple-600 font-semibold hover:underline">
                Пользовательским соглашением
              </Link>
              {' '}и{' '}
              <Link to="/privacy" className="text-purple-600 font-semibold hover:underline">
                Политикой конфиденциальности
              </Link>
            </label>
          </div>

          <Button
            onClick={handleVKAuth}
            disabled={loading || !agreedToTerms}
            className="w-full h-16 bg-[#0077FF] hover:bg-[#0066DD] text-white text-lg font-semibold shadow-lg rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Icon name="Loader2" size={24} className="animate-spin" />
            ) : (
              <>
                <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.07 2H8.93C3.33 2 2 3.33 2 8.93v6.14C2 20.67 3.33 22 8.93 22h6.14c5.6 0 6.93-1.33 6.93-6.93V8.93C22 3.33 20.67 2 15.07 2zm3.06 13.54h-1.39c-.56 0-.73-.45-1.73-1.45-.87-.82-1.25-.93-1.47-.93-.3 0-.38.08-.38.47v1.32c0 .36-.11.57-1.06.57-1.52 0-3.21-.92-4.4-2.64-1.78-2.42-2.27-4.25-2.27-4.63 0-.22.08-.43.47-.43h1.39c.35 0 .48.16.62.53.69 2.02 1.84 3.79 2.31 3.79.18 0 .26-.08.26-.54v-2.09c-.06-.99-.58-1.08-.58-1.43 0-.17.14-.35.37-.35h2.18c.3 0 .4.16.4.50v2.81c0 .3.13.4.22.4.18 0 .33-.1.66-.43 1.02-1.14 1.75-2.9 1.75-2.9.1-.2.25-.43.64-.43h1.39c.42 0 .51.21.42.50-.15.71-1.54 2.74-1.54 2.74-.15.24-.21.35 0 .62.15.2.64.63 .97.1 1.08 1.08 1.57 1.57 1.41.42.19.5-.02.5z" />
                </svg>
                Войти через ВКонтакте
              </>
            )}
          </Button>

          <div className="text-center text-xs text-gray-500 mt-6">
            <p>После входа вы сможете пользоваться всеми функциями приложения</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
