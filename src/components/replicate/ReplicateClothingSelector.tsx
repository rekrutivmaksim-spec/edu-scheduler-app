import React from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import ImageViewer from "@/components/ImageViewer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface ReplicateClothingSelectorProps {
  selectedClothingItems: SelectedClothing[];
  clothingCatalog: ClothingItem[];
  filters: Filters | null;
  selectedCategories: number[];
  selectedColors: number[];
  selectedArchetypes: number[];
  selectedGender: string;
  setSelectedCategories: (categories: number[]) => void;
  setSelectedColors: (colors: number[]) => void;
  setSelectedArchetypes: (archetypes: number[]) => void;
  setSelectedGender: (gender: string) => void;
  toggleClothingSelection: (item: ClothingItem) => void;
  removeClothingItem: (id: string) => void;
  updateClothingCategory: (id: string, category: string) => void;
  handleCustomClothingUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isGenerating: boolean;
  showCategoryError: boolean;
}

export default function ReplicateClothingSelector({
  selectedClothingItems,
  clothingCatalog,
  filters,
  selectedCategories,
  selectedColors,
  selectedArchetypes,
  selectedGender,
  setSelectedCategories,
  setSelectedColors,
  setSelectedArchetypes,
  setSelectedGender,
  toggleClothingSelection,
  removeClothingItem,
  updateClothingCategory,
  handleCustomClothingUpload,
  isGenerating,
  showCategoryError,
}: ReplicateClothingSelectorProps) {
  const [filtersExpanded, setFiltersExpanded] = React.useState(false);

  const toggleFilter = (array: number[], value: number) => {
    if (!array) return [value];
    return array.includes(value)
      ? array.filter((v) => v !== value)
      : [...array, value];
  };

  const getCategoryHint = (
    itemId: string,
    currentCategory: string | undefined,
  ) => {
    if ((selectedClothingItems?.length || 0) === 1) {
      if (currentCategory === "dresses") {
        return "Это фото полного образа";
      }
      return "Любая категория";
    }

    if ((selectedClothingItems?.length || 0) === 2) {
      const otherItem = selectedClothingItems?.find(
        (item) => item.id !== itemId,
      );
      if (!otherItem || !otherItem.category) {
        return "Выберите категорию";
      }

      if (currentCategory === "dresses") {
        return "Это фото полного образа (нельзя комбинировать с другими вещами)";
      }

      if (otherItem.category === "dresses") {
        return "Другая вещь — полный образ (нельзя комбинировать)";
      }

      if (otherItem.category === "upper_body") {
        if (currentCategory === "upper_body") {
          return "Выберите фото из категории низ (брюки, шорты, юбки)";
        }
        return currentCategory === "lower_body"
          ? "Низ (правильно ✓)"
          : "Нужен низ (брюки, юбки, шорты)";
      }

      if (otherItem.category === "lower_body") {
        if (currentCategory === "lower_body") {
          return "Выберите фото из категории верх (топы, рубашки, жакеты)";
        }
        return currentCategory === "upper_body"
          ? "Верх (правильно ✓)"
          : "Нужен верх (топы, рубашки, жакеты)";
      }
    }

    return "";
  };

  return (
    <div>
      <Label className="text-lg font-semibold mb-2 block">
        <Icon name="Shirt" className="inline mr-2" size={20} />
        2. Выберите вещи для примерки
      </Label>
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <Icon name="Info" className="inline mr-1" size={16} />
          Можно выбрать 1 полный образ/вещь (любой категории) или 2 вещи (верх +
          низ)
        </p>
      </div>

      {(selectedClothingItems?.length || 0) > 0 && (
        <div className="mb-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Выбрано: {selectedClothingItems?.length || 0}
          </p>
          <div className="space-y-3">
            {selectedClothingItems?.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 p-3 border rounded-lg bg-card"
              >
                <div className="relative flex-shrink-0 w-20 h-20">
                  <ImageViewer
                    src={item.image}
                    alt={item.name || "Clothing"}
                    className="w-full h-full object-cover rounded border-2 border-primary bg-muted"
                  />
                  {item.category && (
                    <div
                      className={`absolute -top-2 -left-2 px-2 py-0.5 rounded-full text-xs font-semibold shadow-sm ${
                        item.category === "upper_body"
                          ? "bg-blue-500 text-white"
                          : item.category === "lower_body"
                            ? "bg-green-500 text-white"
                            : "bg-purple-500 text-white"
                      }`}
                    >
                      {item.category === "upper_body"
                        ? "👕 Верх"
                        : item.category === "lower_body"
                          ? "👖 Низ"
                          : "👗 Образ"}
                    </div>
                  )}
                  <button
                    onClick={() => removeClothingItem(item.id)}
                    className="absolute -top-2 -right-2 bg-gray-600 hover:bg-gray-700 text-white rounded-full p-1 shadow-sm transition-colors"
                    disabled={isGenerating}
                  >
                    <Icon name="X" size={14} />
                  </button>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-sm font-medium truncate">
                    {item.name || "Одежда"}
                  </p>
                  <Select
                    value={item.category || ""}
                    onValueChange={(value) =>
                      updateClothingCategory(item.id, value)
                    }
                    disabled={
                      item.isFromCatalog ||
                      isGenerating ||
                      ((selectedClothingItems?.length || 0) === 2 &&
                        item.category &&
                        selectedClothingItems?.find(
                          (i) =>
                            i.id !== item.id &&
                            i.category &&
                            i.category !== item.category &&
                            ["upper_body", "lower_body"].includes(i.category),
                        ) !== undefined)
                    }
                  >
                    <SelectTrigger
                      className={`h-8 text-xs ${showCategoryError && !item.category ? "border-red-500 border-2" : ""}`}
                    >
                      <SelectValue
                        placeholder="Выберите категорию"
                        className={
                          showCategoryError && !item.category
                            ? "text-red-500"
                            : ""
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upper_body" className="text-xs">
                        Верх (Топы, Рубашки, Жакеты)
                      </SelectItem>
                      <SelectItem value="lower_body" className="text-xs">
                        Низ (Брюки, Юбки, Шорты)
                      </SelectItem>
                      {(selectedClothingItems?.length || 0) === 1 && (
                        <SelectItem value="dresses" className="text-xs">
                          Весь образ, платья, верх и низ вместе
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {getCategoryHint(item.id, item.category) && (
                    <p
                      className={`text-xs ${showCategoryError && !item.category ? "text-red-500 font-medium" : "text-muted-foreground"}`}
                    >
                      {getCategoryHint(item.id, item.category)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(selectedClothingItems?.length || 0) > 0 &&
        selectedClothingItems?.[0]?.category === "dresses" && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-900">
              <Icon name="CheckCircle2" className="inline mr-1" size={16} />
              Отлично! Выбран полный образ. Чтобы выбрать другие вещи, удалите
              выбранные
            </p>
          </div>
        )}

      {(selectedClothingItems?.length || 0) === 2 &&
        selectedClothingItems?.every((item) => item.category) &&
        selectedClothingItems?.some((item) => item.category === "upper_body") &&
        selectedClothingItems?.some(
          (item) => item.category === "lower_body",
        ) && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-900">
              <Icon name="CheckCircle2" className="inline mr-1" size={16} />
              Отлично! Выбран комплект: верх и низ. Можно создавать образ
            </p>
          </div>
        )}

      {(selectedClothingItems?.length || 0) === 2 &&
        selectedClothingItems?.every((item) => item.category) &&
        (selectedClothingItems?.filter((item) => item.category === "upper_body")
          ?.length || 0) === 2 && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-900">
              <Icon name="AlertCircle" className="inline mr-1" size={16} />
              Выбрано два верха. Измените одну вещь на категорию "Низ"
            </p>
          </div>
        )}

      {(selectedClothingItems?.length || 0) === 2 &&
        selectedClothingItems?.every((item) => item.category) &&
        (selectedClothingItems?.filter((item) => item.category === "lower_body")
          ?.length || 0) === 2 && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-900">
              <Icon name="AlertCircle" className="inline mr-1" size={16} />
              Выбрано два низа. Измените одну вещь на категорию "Верх"
            </p>
          </div>
        )}

      {(selectedClothingItems?.length || 0) === 2 &&
        selectedClothingItems?.some((item) => item.category === "dresses") && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-900">
              <Icon name="AlertCircle" className="inline mr-1" size={16} />
              Полный образ нельзя комбинировать с другими вещами. Удалите одну
              вещь
            </p>
          </div>
        )}

      <div className="space-y-3">
        <div>
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            multiple
            onChange={handleCustomClothingUpload}
            className="hidden"
            id="clothing-upload"
            disabled={
              isGenerating ||
              (selectedClothingItems?.length || 0) >= 2 ||
              ((selectedClothingItems?.length || 0) > 0 &&
                selectedClothingItems?.[0]?.category === "dresses")
            }
          />
          <label htmlFor="clothing-upload">
            <Button
              type="button"
              variant="outline"
              className={`w-full ${isGenerating || (selectedClothingItems?.length || 0) >= 2 || ((selectedClothingItems?.length || 0) > 0 && selectedClothingItems?.[0]?.category === "dresses") ? "opacity-50 cursor-not-allowed" : ""}`}
              disabled={
                isGenerating ||
                (selectedClothingItems?.length || 0) >= 2 ||
                ((selectedClothingItems?.length || 0) > 0 &&
                  selectedClothingItems?.[0]?.category === "dresses")
              }
              asChild
            >
              <span>
                <Icon name="Upload" className="mr-2" size={16} />
                Загрузить свои вещи
              </span>
            </Button>
          </label>
        </div>

        {filters && (
          <div className="border rounded-lg">
            <button
              type="button"
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm font-medium">Фильтры каталога</span>
              <Icon
                name={filtersExpanded ? "ChevronUp" : "ChevronDown"}
                size={20}
                className="text-muted-foreground"
              />
            </button>

            {filtersExpanded && (
              <div className="p-3 pt-0 border-t">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <p className="text-sm font-medium mb-2">Категории</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2 bg-background">
                      {filters.categories?.map((category) => (
                        <label
                          key={category.id}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(
                              category.id as number,
                            )}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCategories([
                                  ...selectedCategories,
                                  category.id as number,
                                ]);
                              } else {
                                setSelectedCategories(
                                  selectedCategories.filter(
                                    (id) => id !== category.id,
                                  ),
                                );
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm">{category.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Цвета</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2 bg-background">
                      {filters.colors?.map((color) => (
                        <label
                          key={color.id}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedColors.includes(
                              color.id as number,
                            )}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedColors([
                                  ...selectedColors,
                                  color.id as number,
                                ]);
                              } else {
                                setSelectedColors(
                                  selectedColors.filter(
                                    (id) => id !== color.id,
                                  ),
                                );
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
                    <p className="text-sm font-medium mb-2">Архетипы</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2 bg-background">
                      {filters.archetypes?.map((arch) => (
                        <label
                          key={arch.id}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedArchetypes.includes(
                              arch.id as number,
                            )}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedArchetypes([
                                  ...selectedArchetypes,
                                  arch.id as number,
                                ]);
                              } else {
                                setSelectedArchetypes(
                                  selectedArchetypes.filter(
                                    (id) => id !== arch.id,
                                  ),
                                );
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm">{arch.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Пол</p>
                    <select
                      value={selectedGender}
                      onChange={(e) => setSelectedGender(e.target.value)}
                      className="w-full p-2 border rounded text-sm bg-background"
                    >
                      <option value="">Все</option>
                      {filters.genders?.map((gender) => (
                        <option key={gender.id} value={gender.id}>
                          {gender.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {(selectedCategories.length > 0 ||
                  selectedColors.length > 0 ||
                  selectedArchetypes.length > 0 ||
                  selectedGender) && (
                  <div className="pt-3 border-t mt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCategories([]);
                        setSelectedColors([]);
                        setSelectedArchetypes([]);
                        setSelectedGender("");
                      }}
                      className="w-full"
                    >
                      <Icon name="X" className="mr-2" size={16} />
                      Сбросить фильтр
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="max-h-64 overflow-y-auto border rounded-lg p-4">
          {(clothingCatalog?.length || 0) > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {clothingCatalog?.map((item) => {
                const isSelected =
                  selectedClothingItems?.some((i) => i.id === item.id) ?? false;
                const isDisabled =
                  isGenerating ||
                  ((selectedClothingItems?.length || 0) >= 2 && !isSelected) ||
                  ((selectedClothingItems?.length || 0) > 0 &&
                    selectedClothingItems?.[0]?.category === "dresses" &&
                    !isSelected);
                return (
                  <div
                    key={item.id}
                    onClick={() => !isDisabled && toggleClothingSelection(item)}
                    className={`rounded-lg border-2 transition-all ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-transparent hover:border-gray-300"
                    } ${
                      isDisabled
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer"
                    }`}
                  >
                    <ImageViewer
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-20 object-contain rounded bg-muted"
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-center text-muted-foreground">
              Каталог пуст
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
