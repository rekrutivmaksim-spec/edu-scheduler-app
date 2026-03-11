import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

interface ClothingItem {
  id: string;
  image_url: string;
  name: string;
  description: string;
  categories: string[];
  colors: string[];
  archetypes: string[];
  replicate_category?: string;
  gender?: string;
  created_at: string;
}

interface FilterOption {
  id: number | string;
  name: string;
}

interface Filters {
  categories: FilterOption[];
  colors: FilterOption[];
  archetypes: FilterOption[];
  genders: FilterOption[];
}

interface AdminCatalogItemFormProps {
  filters: Filters | null;
  editingClothing: ClothingItem | null;
  newClothing: {
    image_url: string;
    name: string;
    description: string;
    category_ids: number[];
    color_ids: number[];
    archetype_ids: number[];
    replicate_category: string;
    gender: string;
  };
  uploadSource: 'url' | 'file';
  isProcessingImage: boolean;
  onNewClothingChange: (clothing: any) => void;
  onEditingClothingChange: (clothing: ClothingItem | null) => void;
  onUploadSourceChange: (source: 'url' | 'file') => void;
  onImageCrop: (image: string) => void;
  onRemoveBackground: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function AdminCatalogItemForm({
  filters,
  editingClothing,
  newClothing,
  uploadSource,
  isProcessingImage,
  onNewClothingChange,
  onEditingClothingChange,
  onUploadSourceChange,
  onImageCrop,
  onRemoveBackground,
  onSubmit,
  onCancel
}: AdminCatalogItemFormProps) {
  if (!filters) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Пожалуйста, выберите изображение');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      onImageCrop(base64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-4">
        {editingClothing ? 'Редактировать одежду' : 'Добавить новую одежду'}
      </h3>
      
      <div className="space-y-4">
        {editingClothing ? (
          <div>
            <label className="text-sm font-medium mb-2 block">Изображение</label>
            <img 
              src={editingClothing.image_url} 
              alt="Preview" 
              className="w-32 h-32 object-cover rounded border"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Для изменения фото удалите позицию и создайте новую
            </p>
          </div>
        ) : (
          <>
            <div>
              <label className="text-sm font-medium mb-2 block">Источник изображения</label>
              <div className="flex gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={uploadSource === 'url'}
                    onChange={() => onUploadSourceChange('url')}
                    className="rounded"
                  />
                  <span className="text-sm">URL</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={uploadSource === 'file'}
                    onChange={() => onUploadSourceChange('file')}
                    className="rounded"
                  />
                  <span className="text-sm">Файл</span>
                </label>
              </div>
            </div>

            {uploadSource === 'url' ? (
              <div>
                <label className="text-sm font-medium mb-2 block">URL изображения</label>
                <Input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={newClothing.image_url}
                  onChange={(e) => onNewClothingChange({ ...newClothing, image_url: e.target.value })}
                />
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium mb-2 block">Загрузить файл</label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                />
              </div>
            )}

            {newClothing.image_url && (
              <div>
                <label className="text-sm font-medium mb-2 block">Превью</label>
                <img 
                  src={newClothing.image_url} 
                  alt="Preview" 
                  className="w-32 h-32 object-cover rounded border"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={onRemoveBackground}
                  disabled={isProcessingImage}
                >
                  {isProcessingImage ? (
                    <>
                      <Icon name="Loader2" className="w-4 h-4 mr-2 animate-spin" />
                      Удаление фона...
                    </>
                  ) : (
                    <>
                      <Icon name="Scissors" className="w-4 h-4 mr-2" />
                      Удалить фон
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}

        <div>
          <label className="text-sm font-medium mb-2 block">Название</label>
          <Input
            placeholder="Название одежды"
            value={editingClothing ? editingClothing.name : newClothing.name}
            onChange={(e) => {
              if (editingClothing) {
                onEditingClothingChange({ ...editingClothing, name: e.target.value });
              } else {
                onNewClothingChange({ ...newClothing, name: e.target.value });
              }
            }}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Описание</label>
          <Input
            placeholder="Описание"
            value={editingClothing ? editingClothing.description : newClothing.description}
            onChange={(e) => {
              if (editingClothing) {
                onEditingClothingChange({ ...editingClothing, description: e.target.value });
              } else {
                onNewClothingChange({ ...newClothing, description: e.target.value });
              }
            }}
          />
        </div>

        {filters && (
          <>
            <div>
              <label className="text-sm font-medium mb-2 block">Категории</label>
              <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2">
                {filters.categories.map(cat => {
                  const isChecked = editingClothing 
                    ? editingClothing.categories.includes(cat.name)
                    : newClothing.category_ids.includes(Number(cat.id));
                  
                  return (
                    <label key={cat.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (editingClothing) {
                            if (e.target.checked) {
                              onEditingClothingChange({
                                ...editingClothing,
                                categories: [...editingClothing.categories, cat.name]
                              });
                            } else {
                              onEditingClothingChange({
                                ...editingClothing,
                                categories: editingClothing.categories.filter(c => c !== cat.name)
                              });
                            }
                          } else {
                            if (e.target.checked) {
                              onNewClothingChange({
                                ...newClothing,
                                category_ids: [...newClothing.category_ids, Number(cat.id)]
                              });
                            } else {
                              onNewClothingChange({
                                ...newClothing,
                                category_ids: newClothing.category_ids.filter(id => id !== Number(cat.id))
                              });
                            }
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{cat.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Цвета</label>
              <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2">
                {filters.colors.map(color => {
                  const isChecked = editingClothing 
                    ? editingClothing.colors.includes(color.name)
                    : newClothing.color_ids.includes(Number(color.id));
                  
                  return (
                    <label key={color.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (editingClothing) {
                            if (e.target.checked) {
                              onEditingClothingChange({
                                ...editingClothing,
                                colors: [...editingClothing.colors, color.name]
                              });
                            } else {
                              onEditingClothingChange({
                                ...editingClothing,
                                colors: editingClothing.colors.filter(c => c !== color.name)
                              });
                            }
                          } else {
                            if (e.target.checked) {
                              onNewClothingChange({
                                ...newClothing,
                                color_ids: [...newClothing.color_ids, Number(color.id)]
                              });
                            } else {
                              onNewClothingChange({
                                ...newClothing,
                                color_ids: newClothing.color_ids.filter(id => id !== Number(color.id))
                              });
                            }
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{color.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Архетипы</label>
              <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2">
                {filters.archetypes.map(arch => {
                  const isChecked = editingClothing 
                    ? editingClothing.archetypes.includes(arch.name)
                    : newClothing.archetype_ids.includes(Number(arch.id));
                  
                  return (
                    <label key={arch.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (editingClothing) {
                            if (e.target.checked) {
                              onEditingClothingChange({
                                ...editingClothing,
                                archetypes: [...editingClothing.archetypes, arch.name]
                              });
                            } else {
                              onEditingClothingChange({
                                ...editingClothing,
                                archetypes: editingClothing.archetypes.filter(a => a !== arch.name)
                              });
                            }
                          } else {
                            if (e.target.checked) {
                              onNewClothingChange({
                                ...newClothing,
                                archetype_ids: [...newClothing.archetype_ids, Number(arch.id)]
                              });
                            } else {
                              onNewClothingChange({
                                ...newClothing,
                                archetype_ids: newClothing.archetype_ids.filter(id => id !== Number(arch.id))
                              });
                            }
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{arch.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <div>
          <label className="text-sm font-medium mb-2 block">Replicate категория</label>
          <select
            value={editingClothing ? editingClothing.replicate_category : newClothing.replicate_category}
            onChange={(e) => {
              if (editingClothing) {
                onEditingClothingChange({ ...editingClothing, replicate_category: e.target.value });
              } else {
                onNewClothingChange({ ...newClothing, replicate_category: e.target.value });
              }
            }}
            className="w-full p-2 border rounded"
          >
            <option value="">Не указано</option>
            <option value="upper_body">Верх (рубашки, топы, жакеты)</option>
            <option value="lower_body">Низ (брюки, юбки, шорты)</option>
            <option value="dresses">Полный образ (платья, комбинезоны)</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Пол</label>
          <select
            value={editingClothing ? editingClothing.gender : newClothing.gender}
            onChange={(e) => {
              if (editingClothing) {
                onEditingClothingChange({ ...editingClothing, gender: e.target.value });
              } else {
                onNewClothingChange({ ...newClothing, gender: e.target.value });
              }
            }}
            className="w-full p-2 border rounded"
          >
            <option value="unisex">Унисекс</option>
            <option value="male">Мужское</option>
            <option value="female">Женское</option>
          </select>
        </div>

        <div className="flex gap-2">
          <Button onClick={onSubmit}>
            {editingClothing ? 'Обновить' : 'Добавить'}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Отмена
          </Button>
        </div>
      </div>
    </Card>
  );
}