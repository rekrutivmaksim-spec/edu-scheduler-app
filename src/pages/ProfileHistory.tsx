import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import ProfileMenu from '@/components/ProfileMenu';
import HistoryTab from '@/components/HistoryTab';

export default function ProfileHistory() {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: dataLoading } = useData();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || dataLoading) {
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

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <ProfileMenu />
          
          <div className="flex-1">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">История</h1>
              <p className="text-muted-foreground">Просмотр истории генераций</p>
            </div>

            <HistoryTab userId={user.id} />
          </div>
        </div>
      </div>
    </Layout>
  );
}