import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import ReplicateClothingSelector from '@/components/replicate/ReplicateClothingSelector';
import { validateImageFile } from '@/utils/fileValidation';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface ClothingItem {
  id: string;
  image_url: string;
  name: string;
  description: string;
  categories: string[];
  colors: string[];
  archetypes: string[];
  replicate_category?: string;
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

interface SelectedClothing {
  id: string;
  image: string;
  name?: string;
  category?: string;
  isFromCatalog?: boolean;
}

interface ReplicateTryOnClothingSelectorProps {
  selectedClothingItems: SelectedClothing[];
  onClothingItemsChange: (items: SelectedClothing[]) => void;
  filters: Filters | undefined;
  clothingCatalog: ClothingItem[] | undefined;
  selectedCategories: number[];
  onSelectedCategoriesChange: (categories: number[]) => void;
  selectedColors: number[];
  onSelectedColorsChange: (colors: number[]) => void;
  selectedArchetypes: number[];
  onSelectedArchetypesChange: (archetypes: number[]) => void;
  selectedGender: string;
  onSelectedGenderChange: (gender: string) => void;
  showCategoryError: boolean;
  disabled?: boolean;
}

export default function ReplicateTryOnClothingSelector({
  selectedClothingItems,
  onClothingItemsChange,
  filters,
  clothingCatalog,
  selectedCategories,
  onSelectedCategoriesChange,
  selectedColors,
  onSelectedColorsChange,
  selectedArchetypes,
  onSelectedArchetypesChange,
  selectedGender,
  onSelectedGenderChange,
  showCategoryError,
  disabled = false
}: ReplicateTryOnClothingSelectorProps) {

  const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleCustomClothingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const invalidFiles: string[] = [];
    Array.from(files).forEach(file => {
      const validation = validateImageFile(file);
      if (!validation.isValid) {
        invalidFiles.push(`${file.name}: ${validation.error}`);
      }
    });

    if (invalidFiles.length > 0) {
      toast.error(invalidFiles[0]);
      e.target.value = '';
      return;
    }

    if (selectedClothingItems?.length >= 1 && selectedClothingItems[0]?.category === 'dresses') {
      toast.error('Уже выбран полный образ. Удалите его, если хотите загрузить другую вещь');
      e.target.value = '';
      return;
    }

    const remainingSlots = 2 - (selectedClothingItems?.length || 0);
    if (remainingSlots <= 0) {
      toast.error('Максимум 2 вещи можно выбрать');
      e.target.value = '';
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      toast.warning(`Можно добавить только ${remainingSlots} вещь(и)`);
    }

    try {
      const resizedImages = await Promise.all(
        filesToProcess.map(async (file) => {
          const resized = await resizeImage(file, 1024, 1024);
          return {
            id: `custom-${Date.now()}-${Math.random()}`,
            image: resized,
            name: file.name,
            category: '',
            isFromCatalog: false,
          };
        })
      );

      onClothingItemsChange([...selectedClothingItems, ...resizedImages]);
    } catch (error) {
      console.error('Image resize error:', error);
      toast.error('Ошибка обработки изображений');
    }

    e.target.value = '';
  };

  const mapCategoryFromCatalog = (item: ClothingItem): string => {
    if (item.replicate_category) {
      return item.replicate_category;
    }
    
    const firstCategory = item.categories?.[0]?.toLowerCase() || '';
    
    if (firstCategory.includes('платье') || firstCategory.includes('сарафан')) {
      return 'dresses';
    }
    if (firstCategory.includes('брюк') || firstCategory.includes('джинс') || 
        firstCategory.includes('шорт') || firstCategory.includes('юбк')) {
      return 'lower_body';
    }
    return 'upper_body';
  };

  const toggleClothingSelection = (item: ClothingItem) => {
    const exists = selectedClothingItems?.find((i) => i.id === item.id);
    if (exists) {
      onClothingItemsChange(selectedClothingItems?.filter((i) => i.id !== item.id) || []);
    } else {
      if (selectedClothingItems?.length >= 1 && selectedClothingItems[0]?.category === 'dresses') {
        toast.error('Уже выбран полный образ. Удалите его, если хотите выбрать другую вещь');
        return;
      }
      
      if ((selectedClothingItems?.length || 0) >= 2) {
        toast.error('Максимум 2 вещи можно выбрать');
        return;
      }
      
      const newCategory = mapCategoryFromCatalog(item);
      if (newCategory === 'dresses' && (selectedClothingItems?.length || 0) > 0) {
        toast.error('Полный образ нельзя комбинировать с другими вещами. Удалите уже выбранные вещи');
        return;
      }
      
      onClothingItemsChange([
        ...selectedClothingItems,
        {
          id: item.id,
          image: item.image_url,
          name: item.name,
          category: newCategory,
          isFromCatalog: true,
        },
      ]);
    }
  };

  const removeClothingItem = (id: string) => {
    onClothingItemsChange(selectedClothingItems.filter((item) => item.id !== id));
  };

  const updateClothingCategory = (id: string, category: string) => {
    onClothingItemsChange(
      selectedClothingItems.map((item) => (item.id === id ? { ...item, category } : item))
    );
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">2. Выберите одежду</h3>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="filters">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Icon name="Filter" size={16} />
                  <span>Фильтры каталога</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div>
                    <p className="text-sm font-medium mb-2">Категория</p>
                    <div className="flex flex-wrap gap-2">
                      {filters?.categories?.map((cat) => (
                        <Button
                          key={cat.id}
                          variant={selectedCategories.includes(Number(cat.id)) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            const catId = Number(cat.id);
                            onSelectedCategoriesChange(
                              selectedCategories.includes(catId)
                                ? selectedCategories.filter((c) => c !== catId)
                                : [...selectedCategories, catId]
                            );
                          }}
                          disabled={disabled}
                        >
                          {cat.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Цвет</p>
                    <div className="flex flex-wrap gap-2">
                      {filters?.colors?.map((color) => (
                        <Button
                          key={color.id}
                          variant={selectedColors.includes(Number(color.id)) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            const colorId = Number(color.id);
                            onSelectedColorsChange(
                              selectedColors.includes(colorId)
                                ? selectedColors.filter((c) => c !== colorId)
                                : [...selectedColors, colorId]
                            );
                          }}
                          disabled={disabled}
                        >
                          {color.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Архетип</p>
                    <div className="flex flex-wrap gap-2">
                      {filters?.archetypes?.map((arch) => (
                        <Button
                          key={arch.id}
                          variant={selectedArchetypes.includes(Number(arch.id)) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            const archId = Number(arch.id);
                            onSelectedArchetypesChange(
                              selectedArchetypes.includes(archId)
                                ? selectedArchetypes.filter((a) => a !== archId)
                                : [...selectedArchetypes, archId]
                            );
                          }}
                          disabled={disabled}
                        >
                          {arch.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Пол</p>
                    <div className="flex flex-wrap gap-2">
                      {filters?.genders?.map((gender) => (
                        <Button
                          key={gender.id}
                          variant={selectedGender === gender.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            onSelectedGenderChange(selectedGender === gender.id ? '' : String(gender.id));
                          }}
                          disabled={disabled}
                        >
                          {gender.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              multiple
              onChange={handleCustomClothingUpload}
              className="hidden"
              id="custom-clothing-upload"
              disabled={disabled}
            />
            <label htmlFor="custom-clothing-upload">
              <Button
                variant="outline"
                className="w-full"
                disabled={disabled}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('custom-clothing-upload')?.click();
                }}
              >
                <Icon name="Upload" className="mr-2" size={16} />
                Загрузить свою вещь
              </Button>
            </label>
          </div>

          <ReplicateClothingSelector
            selectedItems={selectedClothingItems}
            catalog={clothingCatalog || []}
            onToggleSelection={toggleClothingSelection}
            onRemoveItem={removeClothingItem}
            onUpdateCategory={updateClothingCategory}
            showCategoryError={showCategoryError}
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}