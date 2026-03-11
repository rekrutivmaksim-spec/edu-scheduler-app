import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import ImageViewer from '@/components/ImageViewer';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';

interface HistoryItem {
  id: string;
  result_image: string;
  created_at: string;
  model_used?: string;
  saved_to_lookbook?: boolean;
  cost?: number;
}

interface Lookbook {
  id: string;
  name: string;
  person_name: string;
  photos: string[];
}

interface HistoryTabProps {
  userId: string;
}

const DB_QUERY_API = 'https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9';

export default function HistoryTab({ userId }: HistoryTabProps) {
  const { history, lookbooks, hasMoreHistory, isLoadingMoreHistory, refetchHistory, loadMoreHistory, refetchLookbooks } = useData();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedLookbookId, setSelectedLookbookId] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    console.log('[HistoryTab] userId received:', userId);
    setIsLoading(false);
  }, [userId]);



  const toggleSelection = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedItems.length === history.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(history.map(item => item.id));
    }
  };

  const handleAddToLookbook = async () => {
    if (selectedItems.length === 0) {
      toast.error('Выберите фото для добавления');
      return;
    }

    if (!selectedLookbookId) {
      toast.error('Выберите лукбук');
      return;
    }

    setIsAdding(true);
    try {
      const lookbook = lookbooks.find(lb => lb.id === selectedLookbookId);
      if (!lookbook) return;

      const selectedPhotos = history
        .filter(item => selectedItems.includes(item.id))
        .map(item => item.result_image);

      const updatedPhotos = [...lookbook.photos, ...selectedPhotos];

      const response = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          table: 'lookbooks',
          action: 'update',
          where: { id: selectedLookbookId },
          data: { photos: updatedPhotos }
        })
      });

      if (response.ok) {
        toast.success(`Добавлено ${selectedPhotos.length} фото в лукбук`);
        setSelectedItems([]);
        setSelectedLookbookId('');
        await refetchLookbooks();
      } else {
        throw new Error('Failed to update lookbook');
      }
    } catch (error) {
      console.error('Failed to add to lookbook:', error);
      toast.error('Ошибка добавления в лукбук');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteFromHistory = async (id: string) => {
    if (!confirm('Удалить это фото из истории?')) return;

    try {
      const response = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          table: 'try_on_history',
          action: 'delete',
          where: { id }
        })
      });

      if (response.ok) {
        toast.success('Фото удалено из истории');
        await refetchHistory();
      } else {
        throw new Error('Failed to delete');
      }
    } catch (error) {
      console.error('Failed to delete from history:', error);
      toast.error('Ошибка удаления');
    }
  };

  const handleDeleteSelected = async () => {
    const count = selectedItems.length;
    const photoWord = count === 1 ? 'фото' : (count < 5 ? 'фото' : 'фото');
    
    if (!confirm(`Удалить выбранные фото?\n\nВы собираетесь удалить ${count} ${photoWord} из истории примерок.\nЭто действие нельзя отменить.`)) return;

    try {
      const deletePromises = selectedItems.map(id => 
        fetch(DB_QUERY_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            table: 'try_on_history',
            action: 'delete',
            where: { id }
          })
        })
      );

      await Promise.all(deletePromises);
      
      toast.success(`Удалено ${count} ${photoWord}`);
      setSelectedItems([]);
      await refetchHistory();
    } catch (error) {
      console.error('Failed to delete selected:', error);
      toast.error('Ошибка удаления');
    }
  };

  const handleDownloadImage = async (imageUrl: string, historyId: string) => {
    try {
      let blob: Blob;
      
      // Use proxy for all external images (not from cdn.poehali.dev)
      const needsProxy = !imageUrl.includes('cdn.poehali.dev');
      
      if (needsProxy) {
        console.log('[HistoryTab] External URL detected, proxying for download...');
        const IMAGE_PROXY_API = 'https://functions.poehali.dev/7f105c4b-f9e7-4df3-9f64-3d35895b8e90';
        
        const proxyResponse = await fetch(IMAGE_PROXY_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: imageUrl })
        });
        
        if (!proxyResponse.ok) {
          throw new Error('Failed to proxy image for download');
        }
        
        const proxyData = await proxyResponse.json();
        const dataUrl = proxyData.data_url;
        
        // Convert base64 data URL to blob
        const response = await fetch(dataUrl);
        blob = await response.blob();
      } else {
        // cdn.poehali.dev URL - direct fetch
        console.log('[HistoryTab] Own CDN URL detected, downloading directly');
        const response = await fetch(imageUrl);
        blob = await response.blob();
      }
      
      // Create download link with blob URL
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `fitting-room-${historyId}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      
      toast.success('Фото скачано');
    } catch (error) {
      console.error('Failed to download image:', error);
      toast.error('Ошибка скачивания');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Icon name="Loader2" className="animate-spin" size={48} />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64">
          <Icon name="Image" size={48} className="text-gray-300 mb-4" />
          <p className="text-muted-foreground">История пуста</p>
          <p className="text-sm text-muted-foreground mt-2">
            Результаты генераций будут сохраняться здесь автоматически
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {selectedItems.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              <div className="flex-1">
                <p className="font-medium text-blue-900">
                  Выбрано: {selectedItems.length}
                </p>
                <p className="text-sm text-blue-700">
                  Добавьте выбранные фото в лукбук
                </p>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <Select value={selectedLookbookId} onValueChange={setSelectedLookbookId}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Выберите лукбук" />
                  </SelectTrigger>
                  <SelectContent>
                    {lookbooks.map(lb => (
                      <SelectItem key={lb.id} value={lb.id}>
                        {lb.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleAddToLookbook} 
                  disabled={isAdding || !selectedLookbookId}
                >
                  {isAdding ? (
                    <>
                      <Icon name="Loader2" className="mr-2 animate-spin" size={16} />
                      Добавление...
                    </>
                  ) : (
                    <>
                      <Icon name="Plus" className="mr-2" size={16} />
                      Добавить
                    </>
                  )}
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDeleteSelected}
                >
                  <Icon name="Trash2" className="mr-2" size={16} />
                  Удалить
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedItems([])}
                >
                  Отменить
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={selectAll}
        >
          {selectedItems.length === history.length ? 'Снять выделение' : 'Выбрать все'}
        </Button>
        <p className="text-sm text-muted-foreground">
          Показано: {history.length}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {history.map((item) => (
          <Card 
            key={item.id} 
            className={`relative overflow-hidden transition-all ${
              selectedItems.includes(item.id) 
                ? 'ring-2 ring-primary' 
                : ''
            }`}
          >
            <CardContent className="p-0">
              <div className="relative">
                <ImageViewer
                  src={item.result_image}
                  alt="История примерки"
                  className="w-full aspect-[3/4] object-cover"
                />
              </div>
              <div className="p-2 bg-muted space-y-2">
                <div className="flex items-center gap-2 justify-center">
                  <Checkbox
                    checked={selectedItems.includes(item.id)}
                    onCheckedChange={() => toggleSelection(item.id)}
                    id={`history-checkbox-${item.id}`}
                  />
                  <label 
                    htmlFor={`history-checkbox-${item.id}`}
                    className="text-xs text-muted-foreground cursor-pointer select-none"
                  >
                    Выбрать фото
                  </label>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {new Date(item.created_at).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </p>
                <div className="flex gap-1 justify-center">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 bg-blue-500 hover:bg-blue-600 text-white"
                    onClick={() => handleDownloadImage(item.result_image, item.id)}
                    title="Скачать фото"
                  >
                    <Icon name="Download" size={14} />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDeleteFromHistory(item.id)}
                    title="Удалить фото"
                  >
                    <Icon name="Trash2" size={14} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasMoreHistory && (
        <div className="flex justify-center mt-6">
          <Button
            variant="outline"
            onClick={loadMoreHistory}
            disabled={isLoadingMoreHistory}
          >
            {isLoadingMoreHistory ? (
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

      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Icon name="AlertTriangle" className="text-yellow-600 mt-0.5 flex-shrink-0" size={20} />
            <div>
              <p className="text-sm font-medium text-yellow-900">
                ⚠️ Временное хранение
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                Фото из истории примерок хранятся ограниченное время и могут быть удалены. 
                Сохраните важные изображения: добавьте в лукбуки или скачайте на устройство.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}