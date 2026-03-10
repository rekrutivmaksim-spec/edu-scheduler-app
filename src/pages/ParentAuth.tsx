import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

const API_URL = 'https://functions.poehali.dev/fac60d23-7f1e-428a-99cf-820ddb897781';

const ParentAuth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('code') || '').toUpperCase().slice(0, 8);
  });
  const [name, setName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const codeFromUrl = !!new URLSearchParams(window.location.search).get('code');

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (digits.length === 0) return '';
    let formatted = '+7';
    if (digits.length > 1) formatted += ' (' + digits.slice(1, 4);
    if (digits.length > 4) formatted += ') ' + digits.slice(4, 7);
    if (digits.length > 7) formatted += '-' + digits.slice(7, 9);
    if (digits.length > 9) formatted += '-' + digits.slice(9, 11);
    return formatted;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw.length <= 11) {
      setPhone(raw.length === 0 ? '' : raw.startsWith('7') ? raw : '7' + raw);
    }
  };

  const handleSubmit = async () => {
    if (phone.length !== 11) {
      toast({ title: 'Введите номер телефона', variant: 'destructive' });
      return;
    }
    if (code.length < 4) {
      toast({ title: 'Введите код от ребёнка', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, string> = {
        action: isLogin ? 'login' : 'register',
        phone,
        access_code: code.toUpperCase(),
      };
      if (!isLogin && name.trim()) body.full_name = name.trim();

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка входа');
      }

      localStorage.setItem('parent_token', data.token);
      localStorage.setItem('parent_info', JSON.stringify(data.parent));

      if (data.needs_payment) {
        navigate('/parent/pay');
      } else {
        navigate('/parent');
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Попробуйте снова',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Icon name="Users" size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Кабинет родителя</h1>
          <p className="text-sm text-gray-500 mt-1">
            {codeFromUrl ? 'Код получен! Введите номер телефона для входа' : 'Следите за учёбой вашего ребёнка'}
          </p>
        </div>

        <Card className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Телефон</label>
            <Input
              type="tel"
              placeholder="+7 (900) 000-00-00"
              value={formatPhone(phone)}
              onChange={handlePhoneChange}
              className="h-11 rounded-xl"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Код от ребёнка</label>
            {codeFromUrl && code ? (
              <div className="h-11 rounded-xl font-mono tracking-wider text-center text-lg bg-green-50 border-2 border-green-300 flex items-center justify-center text-green-700 font-bold">
                {code} <Icon name="Check" size={16} className="ml-2 text-green-500" />
              </div>
            ) : (
              <Input
                placeholder="Например: ABC12345"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase().slice(0, 8))}
                className="h-11 rounded-xl font-mono tracking-wider text-center text-lg"
                maxLength={8}
              />
            )}
            {!codeFromUrl && <p className="text-xs text-gray-400 mt-1">Попросите ребёнка отправить вам ссылку из приложения</p>}
          </div>

          {!isLogin && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Ваше имя</label>
              <Input
                placeholder="Как к вам обращаться"
                value={name}
                onChange={e => setName(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl text-base"
          >
            {loading ? (
              <Icon name="Loader2" size={20} className="animate-spin" />
            ) : isLogin ? (
              'Войти'
            ) : (
              'Зарегистрироваться'
            )}
          </Button>

          <button
            onClick={() => setIsLogin(!isLogin)}
            className="w-full text-center text-sm text-indigo-600 hover:text-indigo-800"
          >
            {isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
          </button>
        </Card>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-700 text-center">Как это работает</h3>
          <div className="grid gap-2">
            {[
              { icon: 'Key', text: 'Ребёнок даёт вам код из приложения' },
              { icon: 'LogIn', text: 'Вы входите по телефону + код' },
              { icon: 'CreditCard', text: 'Оплачиваете доступ — 299 ₽/мес' },
              { icon: 'BarChart3', text: 'Видите прогресс учёбы ребёнка' },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/60 rounded-xl px-3 py-2.5">
                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon name={step.icon} size={16} className="text-indigo-600" />
                </div>
                <span className="text-sm text-gray-700">{step.text}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => navigate('/auth')}
          className="w-full text-center text-xs text-gray-400 hover:text-gray-600 pb-6"
        >
          Я ученик — войти в свой аккаунт
        </button>
      </div>
    </div>
  );
};

export default ParentAuth;