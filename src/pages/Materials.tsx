import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');

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
      uploadFile(file);
    }
  };

  const uploadFile = async (file: File) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/pdf'
    ];

    const allowedExtensions = ['.docx', '.xlsx', '.xls', '.pdf'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      toast({
        title: "Неподдерживаемый формат",
        description: "Загружайте файлы Word (.docx), Excel (.xlsx) или PDF",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Файл слишком большой",
        description: "Максимальный размер файла: 10 МБ",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64File = e.target?.result as string;

        const token = authService.getToken();
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            file: base64File,
            filename: file.name,
            file_type: file.type || 'application/octet-stream'
          })
        });

        if (response.ok) {
          const data = await response.json();
          
          toast({
            title: "✅ Файл обработан!",
            description: `Создан материал: ${data.material.title}`,
          });

          if (data.tasks && data.tasks.length > 0) {
            toast({
              title: "📋 Найдены задачи!",
              description: `Обнаружено ${data.tasks.length} задач(и) в тексте`,
            });
          }

          await loadMaterials();
        } else if (response.status === 403) {
          const errorData = await response.json();
          
          toast({
            title: 'Требуется подписка',
            description: errorData.message || 'Загрузка файлов доступна только по подписке. Переходим к оформлению...',
            variant: 'destructive'
          });
          
          setTimeout(() => {
            navigate('/subscription');
          }, 2000);
        } else {
          const errorData = await response.json();
          toast({
            title: "Ошибка",
            description: errorData.error || "Не удалось загрузить файл",
            variant: "destructive"
          });
        }

        setIsUploading(false);
      };

      reader.onerror = () => {
        toast({
          title: "Ошибка",
          description: "Не удалось прочитать файл",
          variant: "destructive"
        });
        setIsUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Проблема с загрузкой файла",
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

  const filteredMaterials = materials
    .filter(m => {
      if (filterSubject !== 'all' && m.subject !== filterSubject) return false;
      if (searchQuery && !m.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !m.recognized_text?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });

  const subjects = Array.from(new Set(materials.map(m => m.subject).filter(Boolean)));

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
                <p className="text-xs text-purple-600/70 font-medium">Загружайте документы для ИИ-анализа</p>
              </div>
            </div>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl shadow-lg"
            >
              {isUploading ? (
                <>
                  <Icon name="Loader2" size={20} className="mr-2 animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  <Icon name="Upload" size={20} className="mr-2" />
                  Загрузить файл
                </>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.xlsx,.xls,.pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Инфо о поддерживаемых форматах */}
        <Card className="p-4 mb-6 bg-blue-50 border-2 border-blue-200">
          <div className="flex items-start gap-3">
            <Icon name="Info" size={20} className="text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm text-blue-900 font-medium mb-1">Поддерживаемые форматы</p>
              <p className="text-xs text-blue-700">
                Word (.docx), Excel (.xlsx, .xls), PDF — до 10 МБ. ИИ автоматически извлечёт текст и создаст краткое резюме.
              </p>
            </div>
          </div>
        </Card>

        {/* Фильтры и поиск */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Input
            placeholder="Поиск по материалам..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 rounded-xl border-2 border-purple-200"
            icon={<Icon name="Search" size={20} />}
          />
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="w-full sm:w-48 rounded-xl border-2 border-purple-200">
              <SelectValue placeholder="Предмет" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все предметы</SelectItem>
              {subjects.map(subject => (
                <SelectItem key={subject} value={subject!}>{subject}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-48 rounded-xl border-2 border-purple-200">
              <SelectValue placeholder="Сортировка" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">По дате</SelectItem>
              <SelectItem value="title">По названию</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Список материалов */}
        {filteredMaterials.length === 0 ? (
          <Card className="p-12 text-center bg-white border-2 border-dashed border-purple-200">
            <Icon name="FileText" size={64} className="mx-auto mb-4 text-purple-300" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Нет материалов</h3>
            <p className="text-gray-600 mb-6">
              Загрузите первый документ, чтобы ИИ-ассистент мог помочь вам с учёбой
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl"
            >
              <Icon name="Upload" size={20} className="mr-2" />
              Загрузить документ
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMaterials.map((material) => (
              <Card
                key={material.id}
                className="p-5 bg-white hover:shadow-2xl hover:shadow-purple-500/20 transition-all cursor-pointer border-2 border-purple-200"
                onClick={() => setSelectedMaterial(material)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800 mb-1 line-clamp-2">{material.title}</h3>
                    {material.subject && (
                      <Badge variant="secondary" className="text-xs">{material.subject}</Badge>
                    )}
                  </div>
                  <Icon name="FileText" size={32} className="text-purple-400 ml-2" />
                </div>
                {material.summary && (
                  <p className="text-sm text-gray-600 line-clamp-3 mb-3">{material.summary}</p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{new Date(material.created_at).toLocaleDateString('ru-RU')}</span>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(material.id);
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Icon name="Trash2" size={16} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Модальное окно просмотра материала */}
      {selectedMaterial && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedMaterial(null)}>
          <Card className="max-w-3xl w-full max-h-[80vh] overflow-y-auto bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">{selectedMaterial.title}</h2>
                {selectedMaterial.subject && (
                  <Badge variant="secondary">{selectedMaterial.subject}</Badge>
                )}
              </div>
              <Button
                onClick={() => setSelectedMaterial(null)}
                variant="ghost"
                size="icon"
                className="rounded-xl"
              >
                <Icon name="X" size={24} />
              </Button>
            </div>
            <div className="p-6">
              {selectedMaterial.summary && (
                <div className="mb-6 p-4 bg-purple-50 rounded-xl">
                  <h3 className="font-bold text-purple-900 mb-2 flex items-center gap-2">
                    <Icon name="Sparkles" size={20} />
                    Краткое резюме (от ИИ)
                  </h3>
                  <p className="text-purple-800">{selectedMaterial.summary}</p>
                </div>
              )}
              {selectedMaterial.recognized_text && (
                <div>
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <Icon name="FileText" size={20} />
                    Полный текст документа
                  </h3>
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-xl">
                      {selectedMaterial.recognized_text}
                    </pre>
                  </div>
                </div>
              )}
              <div className="mt-6 flex gap-3">
                <Button
                  onClick={() => {
                    navigate('/assistant');
                    setSelectedMaterial(null);
                  }}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl"
                >
                  <Icon name="Bot" size={20} className="mr-2" />
                  Спросить у ИИ
                </Button>
                <Button
                  onClick={() => handleDelete(selectedMaterial.id)}
                  variant="outline"
                  className="rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Icon name="Trash2" size={20} className="mr-2" />
                  Удалить
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Materials;
