import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { API } from '@/lib/api-urls';

const SHARING_URL = API.SHARING;

interface SharedSchedule {
  id: number;
  share_code: string;
  title: string;
  description?: string;
  created_at: string;
  subscribers_count: number;
}

interface Subscription {
  id: number;
  share_code: string;
  title: string;
  description?: string;
  owner_name: string;
  subscribed_at: string;
}

const Sharing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [myShares, setMyShares] = useState<SharedSchedule[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  
  const [createForm, setCreateForm] = useState({
    title: '',
    description: ''
  });

  useEffect(() => {
    const checkAuth = async () => {
      if (!authService.isAuthenticated()) {
        navigate('/auth');
        return;
      }
      await loadMyShares();
      await loadSubscriptions();
    };
    checkAuth();
  }, [navigate]);

  const loadMyShares = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${SHARING_URL}?action=my_shares`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMyShares(data.shares);
      }
    } catch { /* silent */ }
  };

  const loadSubscriptions = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${SHARING_URL}?action=my_subscriptions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSubscriptions(data.subscriptions);
      }
    } catch { /* silent */ }
  };

  const handleCreateShare = async () => {
    if (!createForm.title.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите название расписания',
        variant: 'destructive'
      });
      return;
    }

    try {
      const token = authService.getToken();
      const response = await fetch(SHARING_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'create',
          title: createForm.title,
          description: createForm.description
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: '✅ Расписание расшарено!',
          description: `Код доступа: ${data.share_code}`
        });
        setIsCreating(false);
        setCreateForm({ title: '', description: '' });
        await loadMyShares();
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать расшаривание',
        variant: 'destructive'
      });
    }
  };

  const handleJoinSchedule = async () => {
    if (!joinCode.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите код доступа',
        variant: 'destructive'
      });
      return;
    }

    try {
      const token = authService.getToken();
      const response = await fetch(SHARING_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'subscribe',
          share_code: joinCode.toUpperCase()
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: '✅ Успешно!',
          description: data.message
        });
        setJoinCode('');
        await loadSubscriptions();
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось подписаться',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось подключиться к расписанию',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteShare = async (id: number) => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${SHARING_URL}?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast({
          title: 'Расшаривание отключено'
        });
        await loadMyShares();
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить',
        variant: 'destructive'
      });
    }
  };

  const handleUnsubscribe = async (id: number) => {
    try {
      const token = authService.getToken();
      const response = await fetch(SHARING_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'unsubscribe',
          shared_schedule_id: id
        })
      });

      if (response.ok) {
        toast({
          title: 'Вы отписались от расписания'
        });
        await loadSubscriptions();
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось отписаться',
        variant: 'destructive'
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: '📋 Код скопирован!',
      description: 'Отправь его своей группе'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <header className="bg-white/70 backdrop-blur-xl border-b border-purple-200/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                className="rounded-xl hover:bg-purple-100/50 h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
              >
                <Icon name="ArrowLeft" size={20} className="text-purple-600 sm:w-6 sm:h-6" />
              </Button>
              <div className="overflow-hidden">
                <h1 className="text-lg sm:text-2xl font-heading font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent truncate">
                  Расшаривание
                </h1>
                <p className="text-[10px] sm:text-xs text-purple-600/70 font-medium truncate">Поделись расписанием с группой</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card className="p-6 bg-gradient-to-br from-indigo-50 to-purple-100 border-2 border-indigo-300">
            <h2 className="text-base sm:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Icon name="Share2" size={20} className="text-indigo-600 sm:w-6 sm:h-6 flex-shrink-0" />
              <span className="break-words">Расшарить моё расписание</span>
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Создай код доступа, чтобы другие студенты смогли подписаться на твоё расписание
            </p>
            <Button
              onClick={() => setIsCreating(true)}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            >
              <Icon name="Plus" size={20} className="mr-2" />
              Создать расшаривание
            </Button>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-100 border-2 border-green-300">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Icon name="UserPlus" size={24} className="text-green-600" />
              Подписаться на расписание
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Введи код, который тебе дал одногруппник, и получи доступ к его расписанию
            </p>
            <div className="flex gap-2">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Введи код (например: ABC123)"
                className="rounded-xl border-2 border-green-200"
                maxLength={6}
              />
              <Button
                onClick={handleJoinSchedule}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                <Icon name="ArrowRight" size={20} />
              </Button>
            </div>
          </Card>
        </div>

        {isCreating && (
          <Card className="p-6 bg-white mb-6">
            <h3 className="text-lg font-bold mb-4">Новое расшаривание</h3>
            <div className="space-y-4">
              <div>
                <Label>Название *</Label>
                <Input
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="Группа 401 • Информатика"
                  className="mt-2 rounded-xl"
                />
              </div>
              <div>
                <Label>Описание</Label>
                <Textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Расписание нашей группы"
                  className="mt-2 rounded-xl"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateShare} className="bg-gradient-to-r from-indigo-600 to-purple-600">
                  Создать
                </Button>
                <Button variant="outline" onClick={() => setIsCreating(false)}>
                  Отмена
                </Button>
              </div>
            </div>
          </Card>
        )}

        <Tabs defaultValue="my_shares" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="my_shares">Мои расшаривания ({myShares.length})</TabsTrigger>
            <TabsTrigger value="subscriptions">Подписки ({subscriptions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="my_shares">
            {myShares.length === 0 ? (
              <Card className="p-12 text-center bg-white border-2 border-dashed border-purple-200">
                <Icon name="Share2" size={48} className="mx-auto mb-4 text-purple-300" />
                <p className="text-gray-600">У тебя нет расшаренных расписаний</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {myShares.map(share => (
                  <Card key={share.id} className="p-6 bg-white hover:shadow-xl transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-lg">{share.title}</h3>
                        {share.description && (
                          <p className="text-sm text-gray-600 mt-1">{share.description}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteShare(share.id)}
                        className="text-red-600 hover:bg-red-100"
                      >
                        <Icon name="Trash2" size={18} />
                      </Button>
                    </div>
                    
                    <div className="bg-gradient-to-r from-indigo-100 to-purple-100 p-4 rounded-xl mb-4">
                      <p className="text-xs text-gray-600 mb-1">Код доступа:</p>
                      <div className="flex items-center justify-between">
                        <p className="text-2xl font-bold text-indigo-600 tracking-wider">{share.share_code}</p>
                        <Button
                          onClick={() => copyToClipboard(share.share_code)}
                          size="sm"
                          variant="ghost"
                          className="hover:bg-white"
                        >
                          <Icon name="Copy" size={18} />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Icon name="Users" size={16} />
                        {share.subscribers_count} подписчик(ов)
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon name="Calendar" size={16} />
                        {new Date(share.created_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="subscriptions">
            {subscriptions.length === 0 ? (
              <Card className="p-12 text-center bg-white border-2 border-dashed border-green-200">
                <Icon name="UserPlus" size={48} className="mx-auto mb-4 text-green-300" />
                <p className="text-gray-600">Ты не подписан ни на одно расписание</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {subscriptions.map(sub => (
                  <Card key={sub.id} className="p-6 bg-white hover:shadow-xl transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-lg">{sub.title}</h3>
                        {sub.description && (
                          <p className="text-sm text-gray-600 mt-1">{sub.description}</p>
                        )}
                        <Badge className="mt-2 bg-green-100 text-green-700">
                          <Icon name="User" size={12} className="mr-1" />
                          {sub.owner_name}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleUnsubscribe(sub.id)}
                        className="text-red-600 hover:bg-red-100"
                      >
                        <Icon name="UserMinus" size={18} />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>Код: {sub.share_code}</span>
                      <span className="flex items-center gap-1">
                        <Icon name="Calendar" size={16} />
                        {new Date(sub.subscribed_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Sharing;