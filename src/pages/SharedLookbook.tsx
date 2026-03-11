import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import Layout from '@/components/Layout';
import { toast } from 'sonner';

interface Lookbook {
  id: string;
  name: string;
  person_name: string;
  photos: string[];
  color_palette: string[];
  created_at: string;
  updated_at: string;
}

const LOOKBOOKS_API = 'https://functions.poehali.dev/69de81d7-5596-4e1d-bbd3-4b3e1a520d6b';

export default function SharedLookbook() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [lookbook, setLookbook] = useState<Lookbook | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLookbook();
  }, [shareToken]);

  const fetchLookbook = async () => {
    try {
      const response = await fetch(`${LOOKBOOKS_API}?share_token=${shareToken}`);
      
      if (!response.ok) {
        throw new Error('Лукбук не найден');
      }
      
      const data = await response.json();
      setLookbook(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки лукбука');
      toast.error('Лукбук не найден или недоступен');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <Icon name="Loader2" className="animate-spin" size={48} />
        </div>
      </Layout>
    );
  }

  if (error || !lookbook) {
    return (
      <Layout>
        <section className="py-12 px-4">
          <div className="container mx-auto max-w-4xl text-center">
            <Icon name="AlertCircle" size={64} className="mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-3xl font-light mb-4">Лукбук не найден</h2>
            <p className="text-muted-foreground">
              Возможно, ссылка устарела или лукбук был удалён
            </p>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-8">
            <h2 className="text-4xl font-light mb-2">{lookbook.name}</h2>
            <p className="text-muted-foreground text-lg">{lookbook.person_name}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon name="Image" size={24} />
                  Фотографии
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lookbook.photos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {lookbook.photos.map((photo, index) => (
                      <div
                        key={index}
                        className="aspect-square rounded-lg overflow-hidden bg-muted"
                      >
                        <img
                          src={photo}
                          alt={`Фото ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Фотографии не добавлены
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon name="Palette" size={24} />
                  Цветовая палитра
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lookbook.color_palette.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {lookbook.color_palette.map((color, index) => (
                      <div
                        key={index}
                        className="flex flex-col items-center gap-2"
                      >
                        <div
                          className="w-20 h-20 rounded-lg border-2 border-border shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs font-mono text-muted-foreground">
                          {color}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Цвета не добавлены
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            Создан: {new Date(lookbook.created_at).toLocaleDateString('ru-RU', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>
        </div>
      </section>
    </Layout>
  );
}
