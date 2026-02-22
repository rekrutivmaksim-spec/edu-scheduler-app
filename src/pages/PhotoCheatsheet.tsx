import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { authService } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import BottomNav from '@/components/BottomNav';

const API_URL = 'https://functions.poehali.dev/5d453e78-6a8d-4a09-b840-9557b58f6ca0';

const MODES = [
  { id: 'solve', label: 'Решить', icon: 'Calculator', desc: 'Пошаговое решение задачи' },
  { id: 'cheatsheet', label: 'Шпаргалка', icon: 'FileText', desc: 'Ответы на билеты/вопросы' },
  { id: 'summary', label: 'Конспект', icon: 'BookOpen', desc: 'Конспект страницы учебника' },
  { id: 'flashcards', label: 'Карточки', icon: 'Layers', desc: 'Флэшкарточки для повторения' },
];

const PhotoCheatsheet = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [mode, setMode] = useState('solve');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 1200;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
            else { width = Math.round(width * MAX / height); height = MAX; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Нужно фото', description: 'Загрузи изображение (jpg, png, heic)', variant: 'destructive' });
      return;
    }
    setResult('');
    try {
      const compressed = await compressImage(file);
      setImage(compressed);
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось обработать фото', variant: 'destructive' });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleGenerate = async () => {
    if (!image) return;
    if (!authService.isAuthenticated()) {
      navigate('/auth');
      return;
    }

    setIsLoading(true);
    setResult('');

    try {
      const token = authService.getToken();
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ image_data: image, mode })
      });

      const data = await response.json();

      if (response.status === 403) {
        toast({ title: 'Нужна подписка', description: data.message || 'Фото-шпаргалка доступна с Premium', variant: 'destructive' });
        setTimeout(() => navigate('/subscription'), 1500);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка генерации');
      }

      setResult(data.result);
    } catch (e) {
      toast({ title: 'Ошибка', description: e instanceof Error ? e.message : 'Попробуй ещё раз', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    toast({ title: 'Скопировано!' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 pb-24">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-purple-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-purple-50">
          <Icon name="ArrowLeft" size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-lg leading-tight">Фото → Шпаргалка</h1>
          <p className="text-xs text-purple-500">Сфотографируй задачу — ИИ решит пошагово</p>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-5 space-y-4">
        {/* Mode selector */}
        <div className="grid grid-cols-4 gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                mode === m.id
                  ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-200'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-purple-300'
              }`}
            >
              <Icon name={m.icon} size={18} className={mode === m.id ? 'text-white mb-1' : 'text-purple-500 mb-1'} />
              <p className="text-xs font-semibold">{m.label}</p>
              <p className={`text-[10px] leading-tight mt-0.5 ${mode === m.id ? 'text-purple-100' : 'text-gray-400'}`}>{m.desc}</p>
            </button>
          ))}
        </div>

        {/* Upload area */}
        {!image ? (
          <Card
            className="border-2 border-dashed border-purple-200 bg-white p-8 text-center cursor-pointer hover:border-purple-400 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Icon name="Camera" size={32} className="text-purple-500" />
            </div>
            <p className="font-semibold text-gray-800 mb-1">Загрузи фото билетов</p>
            <p className="text-xs text-gray-400 mb-4">Или перетащи файл сюда · JPG, PNG, HEIC</p>
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                className="rounded-xl border-purple-200 text-purple-600"
                onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
              >
                <Icon name="Camera" size={16} className="mr-2" />
                Камера
              </Button>
              <Button className="bg-purple-600 text-white rounded-xl hover:bg-purple-700">
                <Icon name="Upload" size={16} className="mr-2" />
                Из галереи
              </Button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </Card>
        ) : (
          <Card className="bg-white overflow-hidden">
            <div className="relative">
              <img src={image} alt="Фото" className="w-full max-h-64 object-contain bg-gray-50" />
              <button
                onClick={() => { setImage(null); setResult(''); }}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70"
              >
                <Icon name="X" size={14} />
              </button>
            </div>
            <div className="p-4">
              <Button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl h-12 font-semibold shadow-lg shadow-purple-200"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ИИ анализирует фото...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Icon name="Sparkles" size={18} />
                    Создать {MODES.find(m => m.id === mode)?.label}
                  </span>
                )}
              </Button>
            </div>
          </Card>
        )}

        {/* Result */}
        {result && (
          <Card className="bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Icon name="Sparkles" size={16} className="text-purple-600" />
                </div>
                <span className="font-semibold text-gray-800">Результат</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopy} className="rounded-xl border-gray-200 text-xs">
                <Icon name="Copy" size={14} className="mr-1.5" />
                Копировать
              </Button>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl border-purple-200 text-purple-600 text-sm"
                onClick={() => { setImage(null); setResult(''); }}
              >
                Новое фото
              </Button>
              <Button
                className="flex-1 bg-purple-600 text-white rounded-xl text-sm hover:bg-purple-700"
                onClick={() => navigate('/materials')}
              >
                Сохранить в материалы
              </Button>
            </div>
          </Card>
        )}

        {/* How it works */}
        {!image && !result && (
          <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-purple-100 p-4">
            <p className="text-xs font-semibold text-purple-700 mb-3 flex items-center gap-1.5">
              <Icon name="Lightbulb" size={14} />
              Как использовать
            </p>
            <div className="space-y-2">
              {[
                { icon: '📸', text: 'Сфотографируй задачу, билет или страницу учебника' },
                { icon: '🤖', text: 'GigaChat решит задачу пошагово или сделает шпаргалку за секунды' },
                { icon: '✅', text: 'Математика, физика, химия, история, языки — любой предмет' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-base">{item.icon}</span>
                  <p className="text-xs text-gray-600">{item.text}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default PhotoCheatsheet;