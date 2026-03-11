import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const handleLogout = async () => {
    document.cookie = 'admin_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    navigate('/vf-console');
  };

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



  const dashboardCards = [
    {
      title: 'Статистика',
      description: 'Общая статистика платформы',
      icon: 'BarChart3',
      path: '/vf-console/stats',
      color: 'bg-indigo-100 text-indigo-700',
      value: '-'
    },
    {
      title: 'Пользователи',
      description: 'Управление пользователями',
      icon: 'Users',
      path: '/vf-console/users',
      color: 'bg-blue-100 text-blue-700',
      value: stats?.total_users || 0
    },
    {
      title: 'Лукбуки',
      description: 'Просмотр всех лукбуков',
      icon: 'Album',
      path: '/vf-console/lookbooks',
      color: 'bg-purple-100 text-purple-700',
      value: stats?.total_lookbooks || 0
    },
    {
      title: 'Платежи',
      description: 'История платежей',
      icon: 'CreditCard',
      path: '/vf-console/payments',
      color: 'bg-green-100 text-green-700',
      value: '-'
    },
    {
      title: 'Каталог',
      description: 'Управление каталогом одежды',
      icon: 'Package',
      path: '/vf-console/catalog',
      color: 'bg-orange-100 text-orange-700',
      value: '-'
    },
    {
      title: 'Генерации',
      description: 'История генераций',
      icon: 'Sparkles',
      path: '/vf-console/generations',
      color: 'bg-pink-100 text-pink-700',
      value: `${(stats?.total_replicate || 0) + (stats?.total_seedream || 0) + (stats?.total_nanobana || 0)}`
    }
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <AdminMenu />
          
          <div className="flex-1">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold mb-2">Админ-панель</h1>
                <p className="text-muted-foreground">Управление платформой</p>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                <Icon name="LogOut" size={16} className="mr-2" />
                Выйти
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Icon name="Loader2" className="animate-spin" size={48} />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dashboardCards.map((card) => (
                  <Link key={card.path} to={card.path}>
                    <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                      <CardHeader>
                        <div className={`w-12 h-12 rounded-lg ${card.color} flex items-center justify-center mb-4`}>
                          <Icon name={card.icon} size={24} />
                        </div>
                        <CardTitle>{card.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground text-sm mb-3">{card.description}</p>
                        <p className="text-2xl font-bold">{card.value}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}