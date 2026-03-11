import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import ImageViewer from '@/components/ImageViewer';

interface Lookbook {
  id: string;
  name: string;
  person_name: string;
  photos: string[];
  color_palette: string[];
  is_public?: boolean;
  share_token?: string;
  created_at: string;
  updated_at: string;
}

interface LookbookFormDialogProps {
  mode: 'create' | 'edit';
  open: boolean;
  onClose: () => void;
  lookbookName: string;
  setLookbookName: (name: string) => void;
  personName: string;
  setPersonName: (name: string) => void;
  selectedPhotos: string[];
  setSelectedPhotos: (photos: string[]) => void;
  colorPalette: string[];
  setColorPalette: (palette: string[]) => void;
  onSubmit: () => void;
  onPhotoUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  editingLookbookId?: string | null;
  lookbooks?: Lookbook[];
  selectedPhotoIndexes?: number[];
  setSelectedPhotoIndexes?: (indexes: number[]) => void;
  targetLookbookId?: string;
  setTargetLookbookId?: (id: string) => void;
  onTransferPhotos?: () => void;
  userId?: string;
}

export default function LookbookFormDialog({
  mode,
  open,
  onClose,
  lookbookName,
  setLookbookName,
  personName,
  setPersonName,
  selectedPhotos,
  setSelectedPhotos,
  colorPalette,
  setColorPalette,
  onSubmit,
  onPhotoUpload,
  editingLookbookId,
  lookbooks = [],
  selectedPhotoIndexes = [],
  setSelectedPhotoIndexes,
  targetLookbookId = '',
  setTargetLookbookId,
  onTransferPhotos
}: LookbookFormDialogProps) {
  
  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleClose();
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Создать новый лукбук' : 'Редактировать лукбук'}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div>
            <label className="block text-sm font-medium mb-2">Название лукбука</label>
            <Input
              value={lookbookName}
              onChange={(e) => setLookbookName(e.target.value)}
              placeholder={mode === 'create' ? 'Например: Весна 2024' : 'Например: Весна 2025'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Для кого</label>
            <Input
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              placeholder={mode === 'create' ? 'Имя' : 'Имя человека'}
            />
          </div>

          {selectedPhotos.length > 0 && (
            <div>
              {mode === 'edit' && <label className="block text-sm font-medium mb-2">Результаты примерок</label>}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {selectedPhotos.map((photo, index) => (
                  <div key={index} className={`relative group ${mode === 'create' ? '' : 'border'} rounded-lg overflow-hidden bg-muted aspect-[5/7]`}>
                    {mode === 'create' ? (
                      <>
                        <img 
                          src={photo} 
                          alt={`Photo ${index + 1}`}
                          className="w-full h-32 object-cover rounded"
                        />
                        <button
                          onClick={() => setSelectedPhotos(selectedPhotos.filter((_, i) => i !== index))}
                          className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Icon name="X" size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <ImageViewer src={photo} alt="" className="w-full h-full object-contain" />
                        {setSelectedPhotoIndexes && (
                          <div className="absolute bottom-2 left-2" title="Выберите фото для переноса в другой лукбук">
                            <input
                              type="checkbox"
                              checked={selectedPhotoIndexes.includes(index)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPhotoIndexes([...selectedPhotoIndexes, index]);
                                } else {
                                  setSelectedPhotoIndexes(selectedPhotoIndexes.filter(i => i !== index));
                                }
                              }}
                              className="w-5 h-5 cursor-pointer"
                              title="Выберите фото для переноса в другой лукбук"
                            />
                          </div>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 right-2 h-8 w-8 p-0 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            if (confirm('Удалить фото из лукбука?')) {
                              setSelectedPhotos(selectedPhotos.filter((_, i) => i !== index));
                            }
                          }}
                          title="Удалить фото"
                        >
                          <Icon name="X" size={14} />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              
              {mode === 'edit' && selectedPhotoIndexes.length > 0 && setTargetLookbookId && onTransferPhotos && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                  <label className="block text-sm font-medium">Перенос фото в другой лукбук</label>
                  <div className="flex gap-2">
                    <Select value={targetLookbookId} onValueChange={setTargetLookbookId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Выберите лукбук" />
                      </SelectTrigger>
                      <SelectContent>
                        {lookbooks
                          .filter(lb => lb.id !== editingLookbookId)
                          .map(lb => (
                            <SelectItem key={lb.id} value={lb.id}>
                              {lb.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      onClick={onTransferPhotos}
                      disabled={!targetLookbookId || selectedPhotoIndexes.length === 0}
                    >
                      Перенести
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Цветовая палитра</label>
            <div className="flex gap-2 flex-wrap mb-3">
              {colorPalette.map((color, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => {
                      const newPalette = [...colorPalette];
                      newPalette[index] = e.target.value;
                      setColorPalette(newPalette);
                    }}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setColorPalette(colorPalette.filter((_, i) => i !== index))}
                  >
                    <Icon name="X" size={14} />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setColorPalette([...colorPalette, '#000000'])}
            >
              <Icon name="Plus" className="mr-2" size={14} />
              Добавить цвет
            </Button>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={onSubmit} className="flex-1">
              {mode === 'create' ? 'Создать' : 'Сохранить изменения'}
            </Button>
            <Button variant="outline" onClick={handleClose}>
              Отмена
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
