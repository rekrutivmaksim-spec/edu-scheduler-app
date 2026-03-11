import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import ReplicateClothingSelector from './ReplicateClothingSelector';

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

interface TryOnClothingSectionProps {
  clothingCatalog: ClothingItem[];
  selectedClothingItems: SelectedClothing[];
  filters: Filters | null;
  selectedCategories: number[];
  selectedColors: number[];
  selectedArchetypes: number[];
  selectedGender: string;
  setSelectedCategories: (categories: number[]) => void;
  setSelectedColors: (colors: number[]) => void;
  setSelectedArchetypes: (archetypes: number[]) => void;
  setSelectedGender: (gender: string) => void;
  handleSelectFromCatalog: (item: ClothingItem) => void;
  handleRemoveClothing: (clothingId: string) => void;
  updateClothingCategory: (id: string, category: string) => void;
  handleCustomClothingUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isGenerating: boolean;
}

export default function TryOnClothingSection({
  clothingCatalog,
  selectedClothingItems,
  filters,
  selectedCategories,
  selectedColors,
  selectedArchetypes,
  selectedGender,
  setSelectedCategories,
  setSelectedColors,
  setSelectedArchetypes,
  setSelectedGender,
  handleSelectFromCatalog,
  handleRemoveClothing,
  updateClothingCategory,
  handleCustomClothingUpload,
  isGenerating
}: TryOnClothingSectionProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Label className="text-lg font-semibold mb-4 block">
          Выберите одежду из каталога
        </Label>
        <ReplicateClothingSelector
          selectedClothingItems={selectedClothingItems}
          clothingCatalog={clothingCatalog}
          filters={filters}
          selectedCategories={selectedCategories}
          selectedColors={selectedColors}
          selectedArchetypes={selectedArchetypes}
          selectedGender={selectedGender}
          setSelectedCategories={setSelectedCategories}
          setSelectedColors={setSelectedColors}
          setSelectedArchetypes={setSelectedArchetypes}
          setSelectedGender={setSelectedGender}
          toggleClothingSelection={handleSelectFromCatalog}
          removeClothingItem={handleRemoveClothing}
          updateClothingCategory={updateClothingCategory}
          handleCustomClothingUpload={handleCustomClothingUpload}
          isGenerating={isGenerating}
        />
      </CardContent>
    </Card>
  );
}