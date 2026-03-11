import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { validateImageFile } from '@/utils/fileValidation';

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

interface NewClothing {
  image_url: string;
  name: string;
  description: string;
  category_ids: number[];
  color_ids: number[];
  archetype_ids: number[];
  replicate_category: string;
  gender: string;
}

interface CatalogItemFormProps {
  editingClothing: ClothingItem | null;
  setEditingClothing: (item: ClothingItem | null) => void;
  newClothing: NewClothing;
  setNewClothing: (clothing: NewClothing) => void;
  filters: Filters | null;
  isProcessingImage: boolean;
  uploadSource: 'url' | 'file';
  setUploadSource: (source: 'url' | 'file') => void;
  onRemoveBackground: () => void;
  onCropImage: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function CatalogItemForm({
  editingClothing,
  setEditingClothing,
  newClothing,
  setNewClothing,
  filters,
  isProcessingImage,
  uploadSource,
  setUploadSource,
  onRemoveBackground,
  onCropImage,
  onSubmit,
  onCancel,
}: CatalogItemFormProps) {
  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-4">{editingClothing ? 'Редактировать одежду' : 'Добавить новую одежду'}</h3>
      
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Источник изображения</label>
          <div className="flex gap-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                checked={uploadSource === 'url'}
                onChange={() => setUploadSource('url')}
                className="rounded"
              />
              <span className="text-sm">URL</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                checked={uploadSource === 'file'}
                onChange={() => setUploadSource('file')}
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
              placeholder="https://example.com/image.jpg"
              value={editingClothing ? editingClothing.image_url : newClothing.image_url}
              onChange={(e) => {
                if (editingClothing) {
                  setEditingClothing({ ...editingClothing, image_url: e.target.value });
                } else {
                  setNewClothing({ ...newClothing, image_url: e.target.value });
                }
              }}
            />
          </div>
        ) : (
          <div>
            <label className="text-sm font-medium mb-2 block">Загрузить изображение</label>
            <Input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                // Валидация файла
                const validation = validateImageFile(file);
                if (!validation.isValid) {
                  toast.error(validation.error || 'Неверный файл');
                  e.target.value = '';
                  return;
                }

                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64Image = reader.result as string;
                  if (editingClothing) {
                    setEditingClothing({ ...editingClothing, image_url: base64Image });
                  } else {
                    setNewClothing({ ...newClothing, image_url: base64Image });
                  }
                };
                reader.readAsDataURL(file);
              }}
            />
            <p className="text-xs text-gray-500 mt-1">
              Форматы: JPG, PNG, WebP, GIF. Максимум: 10MB
            </p>
          </div>
        )}

        {(editingClothing?.image_url || newClothing.image_url) && (
          <div>
            <label className="text-sm font-medium mb-2 block">Предпросмотр</label>
            <img
              src={editingClothing ? editingClothing.image_url : newClothing.image_url}
              alt="Preview"
              className="w-32 h-32 object-cover rounded border"
            />
          </div>
        )}

        <div>
          <label className="text-sm font-medium mb-2 block">Название</label>
          <Input
            placeholder="Название одежды"
            value={editingClothing ? editingClothing.name : newClothing.name}
            onChange={(e) => {
              if (editingClothing) {
                setEditingClothing({ ...editingClothing, name: e.target.value });
              } else {
                setNewClothing({ ...newClothing, name: e.target.value });
              }
            }}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Описание</label>
          <Input
            placeholder="Описание одежды"
            value={editingClothing ? editingClothing.description : newClothing.description}
            onChange={(e) => {
              if (editingClothing) {
                setEditingClothing({ ...editingClothing, description: e.target.value });
              } else {
                setNewClothing({ ...newClothing, description: e.target.value });
              }
            }}
          />
        </div>

        {filters && (
          <>
            <div>
              <label className="text-sm font-medium mb-2 block">Категории</label>
              <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2">
                {filters.categories.map(cat => (
                  <label key={cat.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        editingClothing
                          ? editingClothing.categories.includes(cat.name)
                          : newClothing.category_ids.includes(Number(cat.id))
                      }
                      onChange={(e) => {
                        if (editingClothing) {
                          const newCategories = e.target.checked
                            ? [...editingClothing.categories, cat.name]
                            : editingClothing.categories.filter(c => c !== cat.name);
                          setEditingClothing({ ...editingClothing, categories: newCategories });
                        } else {
                          const newCategoryIds = e.target.checked
                            ? [...newClothing.category_ids, Number(cat.id)]
                            : newClothing.category_ids.filter(id => id !== Number(cat.id));
                          setNewClothing({ ...newClothing, category_ids: newCategoryIds });
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Цвета</label>
              <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2">
                {filters.colors.map(color => (
                  <label key={color.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        editingClothing
                          ? editingClothing.colors.includes(color.name)
                          : newClothing.color_ids.includes(Number(color.id))
                      }
                      onChange={(e) => {
                        if (editingClothing) {
                          const newColors = e.target.checked
                            ? [...editingClothing.colors, color.name]
                            : editingClothing.colors.filter(c => c !== color.name);
                          setEditingClothing({ ...editingClothing, colors: newColors });
                        } else {
                          const newColorIds = e.target.checked
                            ? [...newClothing.color_ids, Number(color.id)]
                            : newClothing.color_ids.filter(id => id !== Number(color.id));
                          setNewClothing({ ...newClothing, color_ids: newColorIds });
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{color.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Архетипы</label>
              <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2">
                {filters.archetypes.map(arch => (
                  <label key={arch.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        editingClothing
                          ? editingClothing.archetypes.includes(arch.name)
                          : newClothing.archetype_ids.includes(Number(arch.id))
                      }
                      onChange={(e) => {
                        if (editingClothing) {
                          const newArchetypes = e.target.checked
                            ? [...editingClothing.archetypes, arch.name]
                            : editingClothing.archetypes.filter(a => a !== arch.name);
                          setEditingClothing({ ...editingClothing, archetypes: newArchetypes });
                        } else {
                          const newArchetypeIds = e.target.checked
                            ? [...newClothing.archetype_ids, Number(arch.id)]
                            : newClothing.archetype_ids.filter(id => id !== Number(arch.id));
                          setNewClothing({ ...newClothing, archetype_ids: newArchetypeIds });
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{arch.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        <div>
          <label className="text-sm font-medium mb-2 block">Категория для Replicate</label>
          <select
            value={editingClothing ? (editingClothing.replicate_category || '') : newClothing.replicate_category}
            onChange={(e) => {
              if (editingClothing) {
                setEditingClothing({ ...editingClothing, replicate_category: e.target.value });
              } else {
                setNewClothing({ ...newClothing, replicate_category: e.target.value });
              }
            }}
            className="w-full p-2 border rounded"
          >
            <option value="">Не указано</option>
            <option value="upper_body">Верх (upper_body)</option>
            <option value="lower_body">Низ (lower_body)</option>
            <option value="dresses">Платье (dresses)</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Пол</label>
          <select
            value={editingClothing ? (editingClothing.gender || 'unisex') : newClothing.gender}
            onChange={(e) => {
              if (editingClothing) {
                setEditingClothing({ ...editingClothing, gender: e.target.value });
              } else {
                setNewClothing({ ...newClothing, gender: e.target.value });
              }
            }}
            className="w-full p-2 border rounded"
          >
            <option value="unisex">Унисекс</option>
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
          </select>
        </div>

        {!editingClothing && (
          <div className="flex gap-2">
            <Button
              onClick={onRemoveBackground}
              disabled={isProcessingImage || !newClothing.image_url}
              variant="outline"
            >
              {isProcessingImage ? 'Обработка...' : 'Удалить фон'}
            </Button>
            <Button
              onClick={onCropImage}
              variant="outline"
            >
              <Icon name="Crop" className="w-4 h-4 mr-2" />
              Обрезать
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={onSubmit}>
            {editingClothing ? 'Сохранить изменения' : 'Добавить'}
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
          >
            Отмена
          </Button>
        </div>
      </div>
    </Card>
  );
}