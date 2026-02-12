import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { authService } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

const SUBSCRIPTION_URL = 'https://functions.poehali.dev/7fe183c2-49af-4817-95f3-6ab4912778c4';

interface ReferralData {
  referral_code: string;
  referral_count: number;
  rewards_earned: number;
  next_reward: string;
  progress_to_1month: number;
  progress_to_1year: number;
  has_1month_reward: boolean;
  has_1year_reward: boolean;
}

const ReferralProgram = () => {
  const { toast } = useToast();
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadReferralData();
  }, []);

  const loadReferralData = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${SUBSCRIPTION_URL}?action=referral`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setReferralData(data);
      }
    } catch (error) {
      console.error('Failed to load referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (referralData?.referral_code) {
      navigator.clipboard.writeText(referralData.referral_code);
      toast({
        title: '📋 Скопировано!',
        description: 'Реферальный код скопирован в буфер обмена'
      });
    }
  };

  const handleSubmitReferralCode = async () => {
    if (!referralCode.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите реферальный код',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);
    try {
      const token = authService.getToken();
      const response = await fetch(SUBSCRIPTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'use_referral',
          referral_code: referralCode.trim().toUpperCase()
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: '🎉 Успех!',
          description: data.message
        });
        setReferralCode('');
        await loadReferralData();
      } else {
        toast({
          title: 'Ошибка',
          description: data.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось применить код',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;
  if (!referralData) return null;

  const progress1month = (referralData.progress_to_1month / 10) * 100;
  const progress1year = (referralData.progress_to_1year / 20) * 100;

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-br from-violet-50 to-purple-50 border-2 border-violet-300">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Icon name="Users" size={24} className="text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">Реферальная программа</h3>
            <p className="text-sm text-gray-600">Приглашай друзей — получай награды</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 mb-4">
          <p className="text-xs text-gray-600 mb-2">Ваш реферальный код:</p>
          <div className="flex gap-2">
            <div className="flex-1 bg-gray-100 rounded-lg px-4 py-3 font-mono text-xl font-bold text-violet-600 flex items-center justify-center">
              {referralData.referral_code}
            </div>
            <Button
              onClick={handleCopyCode}
              className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg"
            >
              <Icon name="Copy" size={20} />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Прогресс до 1 месяца бесплатно</span>
              <Badge className={referralData.has_1month_reward ? 'bg-green-500' : 'bg-gray-400'}>
                {referralData.progress_to_1month}/10
              </Badge>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-violet-500 to-purple-600 h-3 rounded-full transition-all"
                style={{ width: `${progress1month}%` }}
              />
            </div>
            {referralData.has_1month_reward && (
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                <Icon name="CheckCircle" size={14} />
                Награда получена!
              </p>
            )}
          </div>

          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Прогресс до 1 года бесплатно</span>
              <Badge className={referralData.has_1year_reward ? 'bg-green-500' : 'bg-gray-400'}>
                {referralData.progress_to_1year}/20
              </Badge>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-violet-500 to-purple-600 h-3 rounded-full transition-all"
                style={{ width: `${progress1year}%` }}
              />
            </div>
            {referralData.has_1year_reward && (
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                <Icon name="CheckCircle" size={14} />
                Награда получена!
              </p>
            )}
          </div>
        </div>

        <div className="bg-violet-100 border-l-4 border-violet-500 rounded-lg p-4 mt-4">
          <p className="text-xs text-violet-900 font-medium">
            💡 Как это работает: делись своим кодом с одногруппниками. Когда они зарегистрируются и введут твой код, ты получишь прогресс к наградам!
          </p>
        </div>
      </Card>

      <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-300">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center">
            <Icon name="Gift" size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Есть код от друга?</h3>
            <p className="text-xs text-gray-600">Введи его и получи +5 бонусных вопросов</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            placeholder="Введите код"
            className="flex-1 rounded-xl border-2 border-blue-200 focus:border-blue-500 font-mono text-lg"
            maxLength={8}
          />
          <Button
            onClick={handleSubmitReferralCode}
            disabled={submitting || !referralCode.trim()}
            className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl px-6"
          >
            {submitting ? (
              <Icon name="Loader2" size={20} className="animate-spin" />
            ) : (
              'Применить'
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ReferralProgram;
