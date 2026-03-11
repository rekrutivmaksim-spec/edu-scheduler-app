import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import AdminMenu from '@/components/AdminMenu';

const ADMIN_API = 'https://functions.poehali.dev/6667a30b-a520-41d8-b23a-e240a9aefb15';

interface Stats {
  total_users: number;
  total_lookbooks: number;
  total_replicate: number;
  total_seedream: number;
  total_nanobana: number;
  today_replicate: number;
  today_seedream: number;
  today_nanobana: number;
  total_revenue: number;
  today_revenue: number;
  month_revenue: number;
  total_payments: number;
  total_colortypes: number;
  completed_colortypes: number;
  failed_colortypes: number;
  total_refunds: number;
  charges_colortype: number;
  charges_tryon: number;
  charges_manual: number;
  users_balance: number;
}

export default function AdminStats() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`${ADMIN_API}?action=stats`, {
        credentials: 'include'
      });

      if (response.status === 401) {
        navigate('/vf-console');
        return;
      }

      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      toast.error('Ошибка загрузки статистики');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <Icon name="Loader2" className="animate-spin" size={48} />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <AdminMenu />
          
          <div className="flex-1">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Статистика</h1>
              <p className="text-muted-foreground">Управление платформой</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Пользователей
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Icon name="Users" size={24} className="text-blue-600" />
                    <span className="text-3xl font-bold">{stats?.total_users || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Лукбуков
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Icon name="Album" size={24} className="text-purple-600" />
                    <span className="text-3xl font-bold">{stats?.total_lookbooks || 0}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Примерочная 1 (Replicate)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Icon name="Shirt" size={24} className="text-blue-600" />
                    <div>
                      <div className="text-2xl font-bold">{stats?.total_replicate || 0}</div>
                      <div className="text-xs text-muted-foreground">Сегодня: {stats?.today_replicate || 0}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Примерочная 2 (SeeDream)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Icon name="Sparkles" size={24} className="text-purple-600" />
                    <div>
                      <div className="text-2xl font-bold">{stats?.total_seedream || 0}</div>
                      <div className="text-xs text-muted-foreground">Сегодня: {stats?.today_seedream || 0}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Примерочная 3 (NanoBanana)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Icon name="Zap" size={24} className="text-orange-600" />
                    <div>
                      <div className="text-2xl font-bold">{stats?.total_nanobana || 0}</div>
                      <div className="text-xs text-muted-foreground">Сегодня: {stats?.today_nanobana || 0}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-green-200 bg-green-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Доход всего
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Icon name="Coins" size={24} className="text-green-600" />
                    <span className="text-3xl font-bold">{stats?.total_revenue?.toFixed(0) || 0} ₽</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Платежей: {stats?.total_payments || 0}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-blue-200 bg-blue-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Доход за месяц
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Icon name="TrendingUp" size={24} className="text-blue-600" />
                    <span className="text-3xl font-bold">{stats?.month_revenue?.toFixed(0) || 0} ₽</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Последние 30 дней
                  </p>
                </CardContent>
              </Card>

              <Card className="border-orange-200 bg-orange-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Доход сегодня
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Icon name="Wallet" size={24} className="text-orange-600" />
                    <span className="text-3xl font-bold">{stats?.today_revenue?.toFixed(0) || 0} ₽</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    За текущий день
                  </p>
                </CardContent>
              </Card>

              <Card className="border-purple-200 bg-purple-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Средний чек
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Icon name="CreditCard" size={24} className="text-purple-600" />
                    <span className="text-3xl font-bold">
                      {stats?.total_payments ? (stats.total_revenue / stats.total_payments).toFixed(0) : 0} ₽
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    На транзакцию
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-8 mt-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Всего цветотипов
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Icon name="Palette" size={24} className="text-pink-600" />
                    <span className="text-3xl font-bold">{stats?.total_colortypes || 0}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Всего анализов
                  </p>
                </CardContent>
              </Card>

              <Card className="border-green-200 bg-green-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Завершённых
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Icon name="CheckCircle" size={24} className="text-green-600" />
                    <span className="text-3xl font-bold">{stats?.completed_colortypes || 0}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {stats?.total_colortypes ? ((stats.completed_colortypes / stats.total_colortypes) * 100).toFixed(1) : 0}% успешных
                  </p>
                </CardContent>
              </Card>

              <Card className="border-red-200 bg-red-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Неудачных
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Icon name="XCircle" size={24} className="text-red-600" />
                    <span className="text-3xl font-bold">{stats?.failed_colortypes || 0}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {stats?.total_colortypes ? ((stats.failed_colortypes / stats.total_colortypes) * 100).toFixed(1) : 0}% ошибок
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mt-8">
              <Card className="border-purple-200 bg-purple-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Списания за цветотип
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Icon name="Palette" size={24} className="text-purple-600" />
                    <span className="text-3xl font-bold">{stats?.charges_colortype?.toFixed(0) || 0} ₽</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Анализ цветотипа
                  </p>
                </CardContent>
              </Card>

              <Card className="border-blue-200 bg-blue-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Списания за примерку
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Icon name="Shirt" size={24} className="text-blue-600" />
                    <span className="text-3xl font-bold">{stats?.charges_tryon?.toFixed(0) || 0} ₽</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Виртуальная примерочная
                  </p>
                </CardContent>
              </Card>

              <Card className="border-orange-200 bg-orange-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Ручные списания
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Icon name="HandCoins" size={24} className="text-orange-600" />
                    <span className="text-3xl font-bold">{stats?.charges_manual?.toFixed(0) || 0} ₽</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Для возврата в ЮКассе
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mt-8">
              <Card className="border-rose-200 bg-rose-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Сумма возвратов
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Icon name="Undo2" size={24} className="text-rose-600" />
                    <span className="text-3xl font-bold">{stats?.total_refunds?.toFixed(0) || 0} ₽</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Возвращено пользователям
                  </p>
                </CardContent>
              </Card>

              <Card className="border-teal-200 bg-teal-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Баланс пользователей
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Icon name="PiggyBank" size={24} className="text-teal-600" />
                    <span className="text-3xl font-bold">{stats?.users_balance?.toFixed(0) || 0} ₽</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    На счетах платформы
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}