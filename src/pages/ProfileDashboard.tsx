import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import ProfileMenu from '@/components/ProfileMenu';

export default function ProfileDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <Icon name="Loader2" className="animate-spin" size={48} />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  const dashboardCards = [
    {
      title: 'Лукбуки',
      description: 'Управляйте лукбуками и историей примерок',
      icon: 'Album',
      path: '/profile/lookbooks',
      color: 'bg-purple-100 text-purple-700'
    },
    {
      title: 'История',
      description: 'Просмотр истории генераций',
      icon: 'History',
      path: '/profile/history',
      color: 'bg-blue-100 text-blue-700'
    },
    {
      title: 'Кошелёк',
      description: 'Управление балансом и платежами',
      icon: 'Wallet',
      path: '/profile/wallet',
      color: 'bg-green-100 text-green-700'
    },
    {
      title: 'Настройки',
      description: 'Настройки профиля и безопасности',
      icon: 'Settings',
      path: '/profile/settings',
      color: 'bg-gray-100 text-gray-700'
    }
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <ProfileMenu />
          
          <div className="flex-1">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Личный кабинет</h1>
              <p className="text-muted-foreground">Управляйте лукбуками и историей примерок</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      <p className="text-muted-foreground">{card.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}