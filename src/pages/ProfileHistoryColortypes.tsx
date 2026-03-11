import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import ProfileMenu from '@/components/ProfileMenu';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const colorTypeNames: Record<string, string> = {
  'SOFT WINTER': 'Мягкая Зима',
  'BRIGHT WINTER': 'Яркая Зима',
  'VIVID WINTER': 'Тёмная Зима',
  'SOFT SUMMER': 'Светлое Лето',
  'DUSTY SUMMER': 'Мягкое (Пыльное) Лето',
  'VIVID SUMMER': 'Яркое Лето',
  'GENTLE AUTUMN': 'Нежная Осень',
  'FIERY AUTUMN': 'Огненная Осень',
  'VIVID AUTUMN': 'Тёмная Осень',
  'GENTLE SPRING': 'Нежная Весна',
  'VIBRANT SPRING': 'Яркая Весна',
  'BRIGHT SPRING': 'Тёплая Весна'
};

const DB_QUERY_API = 'https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9';

interface ColorTypeHistory {
  id: string;
  cdn_url?: string;
  color_type: string;
  result_text: string;
  created_at: string;
  status: string;
}

export default function ProfileHistoryColortypes() {
  const { user, isLoading: authLoading } = useAuth();
  const { colorTypeHistory, isLoading: dataLoading, hasMoreColorType, isLoadingMoreColorType, refetchColorTypeHistory, loadMoreColorType } = useData();
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  const handleDelete = async (id: string) => {
    if (!user) return;
    
    if (!confirm('Удалить этот анализ цветотипа? Изображение также будет удалено из хранилища.')) {
      return;
    }

    setDeletingId(id);

    try {
      const response = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          table: 'color_type_history',
          action: 'delete',
          where: { id }
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Анализ удалён');
        await refetchColorTypeHistory();
      } else {
        toast.error('Ошибка удаления');
      }
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Ошибка удаления');
    } finally {
      setDeletingId(null);
    }
  };

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
              <h1 className="text-3xl font-bold mb-2">История цветотипов</h1>
              <p className="text-muted-foreground">Все ваши анализы цветотипа внешности</p>
            </div>

            {colorTypeHistory.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Icon name="Palette" className="mx-auto mb-4 text-muted-foreground" size={64} />
                  <h3 className="text-xl font-medium mb-2">История пуста</h3>
                  <p className="text-muted-foreground mb-6">
                    У вас пока нет анализов цветотипа
                  </p>
                  <button
                    onClick={() => navigate('/colortype')}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <Icon name="Palette" size={20} />
                    Определить цветотип
                  </button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {colorTypeHistory.map((item) => (
                  <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    {item.cdn_url && (
                      <div className="aspect-[3/4] relative overflow-hidden bg-muted group">
                        <img
                          src={item.cdn_url}
                          alt="Portrait"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(item.id)}
                            disabled={deletingId === item.id}
                            className="shadow-lg"
                          >
                            {deletingId === item.id ? (
                              <Icon name="Loader2" className="animate-spin" size={16} />
                            ) : (
                              <Icon name="Trash2" size={16} />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                    <CardContent className="p-4">
                      <div className="mb-2">
                        <h3 className="font-semibold text-lg">
                          {item.color_type ? (colorTypeNames[item.color_type] || item.color_type) : 'Цветотип'}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      {item.result_text && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {item.result_text}
                        </p>
                      )}
                      <Button
                        className="w-full"
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/palette/${item.id}`)}
                      >
                        <Icon name="Palette" className="mr-2" size={16} />
                        Смотреть палитру
                      </Button>
                    </CardContent>
                  </Card>
                  ))}
                </div>
                
                {hasMoreColorType && (
                  <div className="flex justify-center mt-6">
                    <Button
                      variant="outline"
                      onClick={loadMoreColorType}
                      disabled={isLoadingMoreColorType}
                    >
                      {isLoadingMoreColorType ? (
                        <>
                          <Icon name="Loader2" className="mr-2 animate-spin" size={16} />
                          Загрузка...
                        </>
                      ) : (
                        <>
                          <Icon name="ChevronDown" className="mr-2" size={16} />
                          Загрузить ещё
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}