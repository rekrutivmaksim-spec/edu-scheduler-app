import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

const API_URL = 'https://functions.poehali.dev/177e7001-b074-41cb-9553-e9c715d36f09';

interface Material {
  id: number;
  title: string;
  subject?: string;
  image_url: string;
  recognized_text?: string;
  summary?: string;
  created_at: string;
}

const Materials = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      if (!authService.isAuthenticated()) {
        navigate('/login');
        return;
      }
      await loadMaterials();
    };
    checkAuth();
  }, [navigate]);

  const loadMaterials = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMaterials(data.materials);
      }
    } catch (error) {
      console.error('Failed to load materials:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadImage(file);
    }
  };

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, выберите изображение",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Image = e.target?.result as string;

        const token = authService.getToken();
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            image: base64Image
          })
        });

        if (response.ok) {
          const data = await response.json();
          
          toast({
            title: "✅ Фото распознано!",
            description: `Создан материал: ${data.material.title}`,
          });

          if (data.tasks && data.tasks.length > 0) {
            toast({
              title: "📋 Найдены задачи!",
              description: `Обнаружено ${data.tasks.length} задач(и) в тексте`,
            });
          }

          await loadMaterials();
        } else {
          const errorData = await response.json();
          toast({
            title: "Ошибка",
            description: errorData.error || "Не удалось загрузить фото",
            variant: "destructive"
          });
        }

        setIsUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Проблема с загрузкой фото",
        variant: "destructive"
      });
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${API_URL}?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast({
          title: "Удалено",
          description: "Материал успешно удалён",
        });
        setSelectedMaterial(null);
        await loadMaterials();
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить материал",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <header className="bg-white/70 backdrop-blur-xl border-b border-purple-200/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                className="rounded-xl hover:bg-purple-100/50"
              >
                <Icon name="ArrowLeft" size={24} className="text-purple-600" />
              </Button>
              <div>
                <h1 className="text-2xl font-heading font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Мои материалы
                </h1>
                <p className="text-xs text-purple-600/70 font-medium">Фото с лекций и конспектов</p>
              </div>
            </div>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl shadow-lg shadow-purple-500/30"
            >
              {isUploading ? (
                <>
                  <Icon name="Loader2" size={20} className="mr-2 animate-spin" />
                  Распознаю...
                </>
              ) : (
                <>
                  <Icon name="Camera" size={20} className="mr-2" />
                  Загрузить фото
                </>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {materials.length === 0 ? (
          <Card className="p-12 text-center bg-white border-2 border-dashed border-purple-200">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
              <Icon name="Camera" size={40} className="text-purple-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Нет материалов</h3>
            <p className="text-gray-600 mb-6">
              Загрузите фото доски или конспекта, и ИИ автоматически распознает текст
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl shadow-lg shadow-purple-500/30"
            >
              <Icon name="Upload" size={20} className="mr-2" />
              Загрузить первое фото
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {materials.map((material) => (
              <Card
                key={material.id}
                className="group cursor-pointer overflow-hidden bg-white hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 hover:scale-105"
                onClick={() => setSelectedMaterial(material)}
              >
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={material.image_url}
                    alt={material.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  {material.subject && (
                    <Badge className="absolute top-3 right-3 bg-white/90 text-purple-600 shadow-lg">
                      {material.subject}
                    </Badge>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-gray-800 mb-2 truncate">{material.title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3">{material.summary}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(material.created_at).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {selectedMaterial && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMaterial(null)}
        >
          <Card
            className="max-w-4xl w-full max-h-[90vh] overflow-y-auto bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{selectedMaterial.title}</h2>
                {selectedMaterial.subject && (
                  <Badge className="mt-1 bg-purple-100 text-purple-600">{selectedMaterial.subject}</Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleDelete(selectedMaterial.id)}
                  className="rounded-xl"
                >
                  <Icon name="Trash2" size={20} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedMaterial(null)}
                  className="rounded-xl"
                >
                  <Icon name="X" size={24} />
                </Button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <img
                  src={selectedMaterial.image_url}
                  alt={selectedMaterial.title}
                  className="w-full rounded-xl shadow-lg"
                />
              </div>

              {selectedMaterial.summary && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl">
                  <h3 className="font-bold text-gray-800 mb-2 flex items-center">
                    <Icon name="Sparkles" size={18} className="mr-2 text-purple-600" />
                    Краткое резюме
                  </h3>
                  <p className="text-gray-700">{selectedMaterial.summary}</p>
                </div>
              )}

              {selectedMaterial.recognized_text && (
                <div>
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center">
                    <Icon name="FileText" size={18} className="mr-2 text-purple-600" />
                    Распознанный текст
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 whitespace-pre-wrap text-sm text-gray-700">
                    {selectedMaterial.recognized_text}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Materials;
