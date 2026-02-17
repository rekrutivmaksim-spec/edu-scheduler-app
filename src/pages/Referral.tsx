import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { authService } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';

const SUBSCRIPTION_URL = 'https://functions.poehali.dev/7fe183c2-49af-4817-95f3-6ab4912778c4';

interface Invite {
  name: string;
  date: string;
}

interface ReferralData {
  referral_code: string;
  referral_count: number;
  rewards_earned: number;
  total_premium_days: number;
  next_reward: string;
  progress_to_1month: number;
  progress_to_1year: number;
  has_1month_reward: boolean;
  has_1year_reward: boolean;
  invites: Invite[];
}

export default function Referral() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate('/auth');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const token = authService.getToken();
      const resp = await fetch(`${SUBSCRIPTION_URL}?action=referral`, {
        headers: { 'X-Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        setData(await resp.json());
      }
    } catch (e) {
      console.error('Referral load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const shareLink = data ? `${window.location.origin}/auth?ref=${data.referral_code}` : '';

  const handleCopy = () => {
    if (!data) return;
    navigator.clipboard.writeText(shareLink);
    toast({ title: 'Ссылка скопирована!', description: 'Отправь её другу' });
  };

  const handleShare = async () => {
    if (!data) return;
    const text = `Я учусь в Studyfay — ИИ-помощник для студентов. Присоединяйся по моей ссылке и получи +5 бонусных вопросов к ИИ!`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Studyfay — приглашение', text, url: shareLink });
      } catch (_) { /* cancelled */ }
    } else {
      navigator.clipboard.writeText(`${text}\n${shareLink}`);
      toast({ title: 'Текст скопирован!', description: 'Вставь в любой мессенджер' });
    }
  };

  const handleSubmit = async () => {
    if (!code.trim()) return;
    setSubmitting(true);
    try {
      const token = authService.getToken();
      const resp = await fetch(SUBSCRIPTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'use_referral', referral_code: code.trim().toUpperCase() })
      });
      const result = await resp.json();
      if (resp.ok) {
        toast({ title: 'Код применён!', description: result.message });
        setCode('');
        await loadData();
      } else {
        toast({ title: 'Ошибка', description: result.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Попробуй позже', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center">
        <Icon name="Loader2" size={32} className="animate-spin text-purple-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
        <Card className="p-8 text-center">
          <p className="text-gray-600">Не удалось загрузить данные</p>
          <Button onClick={() => navigate('/')} className="mt-4">На главную</Button>
        </Card>
      </div>
    );
  }

  const rewards = [
    { count: 1, label: '7 дней Premium', icon: 'Star', done: data.referral_count >= 1 },
    { count: 3, label: '21 день Premium', icon: 'Flame', done: data.referral_count >= 3 },
    { count: 5, label: '35 дней Premium', icon: 'Zap', done: data.referral_count >= 5 },
    { count: 10, label: '70 дней + ачивка', icon: 'Trophy', done: data.referral_count >= 10 },
    { count: 20, label: '140 дней + VIP', icon: 'Crown', done: data.referral_count >= 20 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 pb-24">
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 text-white px-4 pt-12 pb-8">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1 text-white/80 hover:text-white text-sm">
            <Icon name="ArrowLeft" size={18} />
            Назад
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Icon name="Gift" size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Пригласи друга</h1>
              <p className="text-white/80 text-sm">+7 дней Premium тебе за каждого</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{data.referral_count}</p>
              <p className="text-xs text-white/70">друзей пришло</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{data.total_premium_days}</p>
              <p className="text-xs text-white/70">дней Premium</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4">
        <Card className="p-5 bg-white border-0 shadow-xl rounded-2xl">
          <p className="text-xs text-gray-500 mb-2 font-medium">Твоя ссылка для приглашения:</p>
          <div className="bg-gray-50 rounded-xl p-3 mb-3 flex items-center gap-2">
            <code className="flex-1 text-sm text-purple-700 font-medium break-all">{shareLink}</code>
            <Button size="sm" variant="ghost" onClick={handleCopy} className="shrink-0">
              <Icon name="Copy" size={18} />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={handleCopy} className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-12">
              <Icon name="Copy" size={18} className="mr-2" />
              Копировать
            </Button>
            <Button onClick={handleShare} className="bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-90 text-white rounded-xl h-12">
              <Icon name="Share2" size={18} className="mr-2" />
              Поделиться
            </Button>
          </div>
        </Card>

        <Card className="p-5 bg-white border-0 shadow-xl rounded-2xl">
          <h3 className="font-bold text-gray-800 mb-1">Как это работает?</h3>
          <div className="space-y-3 mt-3">
            {[
              { step: '1', text: 'Отправь ссылку другу', icon: 'Send' },
              { step: '2', text: 'Друг регистрируется и получает +5 вопросов', icon: 'UserPlus' },
              { step: '3', text: 'Ты получаешь +7 дней Premium', icon: 'Crown' },
            ].map((s) => (
              <div key={s.step} className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-violet-100 to-purple-100 rounded-lg flex items-center justify-center shrink-0">
                  <Icon name={s.icon} size={18} className="text-purple-600" />
                </div>
                <p className="text-sm text-gray-700">{s.text}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 bg-white border-0 shadow-xl rounded-2xl">
          <h3 className="font-bold text-gray-800 mb-3">Награды за друзей</h3>
          <div className="space-y-2">
            {rewards.map((r) => (
              <div key={r.count} className={`flex items-center gap-3 p-3 rounded-xl ${r.done ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${r.done ? 'bg-green-500' : 'bg-gray-200'}`}>
                  {r.done ? (
                    <Icon name="Check" size={18} className="text-white" />
                  ) : (
                    <Icon name={r.icon} size={18} className="text-gray-500" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${r.done ? 'text-green-700' : 'text-gray-700'}`}>{r.label}</p>
                  <p className="text-xs text-gray-500">{r.count} {r.count === 1 ? 'друг' : r.count < 5 ? 'друга' : 'друзей'}</p>
                </div>
                {r.done && <Badge className="bg-green-500 text-white text-[10px]">Получено</Badge>}
              </div>
            ))}
          </div>
        </Card>

        {data.invites && data.invites.length > 0 && (
          <Card className="p-5 bg-white border-0 shadow-xl rounded-2xl">
            <h3 className="font-bold text-gray-800 mb-3">Приглашённые друзья</h3>
            <div className="space-y-2">
              {data.invites.map((inv, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <Icon name="User" size={14} className="text-purple-600" />
                    </div>
                    <span className="text-sm text-gray-700">{inv.name}</span>
                  </div>
                  <span className="text-xs text-gray-400">{inv.date}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-5 bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="Ticket" size={20} className="text-blue-600" />
            <h3 className="font-bold text-gray-800">Есть код от друга?</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">Введи код и получи +5 бонусных вопросов к ИИ</p>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD1234"
              className="flex-1 font-mono text-lg border-2 border-blue-200 focus:border-blue-500 rounded-xl h-12"
              maxLength={8}
            />
            <Button
              onClick={handleSubmit}
              disabled={submitting || !code.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 h-12"
            >
              {submitting ? <Icon name="Loader2" size={18} className="animate-spin" /> : 'Ок'}
            </Button>
          </div>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
}