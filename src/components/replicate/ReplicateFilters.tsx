import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

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

interface ReplicateFiltersProps {
  filters: Filters | undefined;
  selectedCategories: number[];
  selectedColors: number[];
  selectedArchetypes: number[];
  selectedGender: string;
  onCategoriesChange: (categories: number[]) => void;
  onColorsChange: (colors: number[]) => void;
  onArchetypesChange: (archetypes: number[]) => void;
  onGenderChange: (gender: string) => void;
}

export default function ReplicateFilters({
  filters,
  selectedCategories,
  selectedColors,
  selectedArchetypes,
  selectedGender,
  onCategoriesChange,
  onColorsChange,
  onArchetypesChange,
  onGenderChange,
}: ReplicateFiltersProps) {
  const handleCategoryChange = (categoryId: number, checked: boolean) => {
    if (checked) {
      onCategoriesChange([...selectedCategories, categoryId]);
    } else {
      onCategoriesChange(selectedCategories.filter(id => id !== categoryId));
    }
  };

  const handleColorChange = (colorId: number, checked: boolean) => {
    if (checked) {
      onColorsChange([...selectedColors, colorId]);
    } else {
      onColorsChange(selectedColors.filter(id => id !== colorId));
    }
  };

  const handleArchetypeChange = (archetypeId: number, checked: boolean) => {
    if (checked) {
      onArchetypesChange([...selectedArchetypes, archetypeId]);
    } else {
      onArchetypesChange(selectedArchetypes.filter(id => id !== archetypeId));
    }
  };

  const handleGenderChange = (gender: string, checked: boolean) => {
    onGenderChange(checked ? gender : '');
  };

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="categories">
        <AccordionTrigger>Категории</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            {filters?.categories.map((category) => (
              <div key={category.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`category-${category.id}`}
                  checked={selectedCategories.includes(Number(category.id))}
                  onCheckedChange={(checked) => handleCategoryChange(Number(category.id), checked as boolean)}
                />
                <Label htmlFor={`category-${category.id}`} className="cursor-pointer">
                  {category.name}
                </Label>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="colors">
        <AccordionTrigger>Цвета</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            {filters?.colors.map((color) => (
              <div key={color.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`color-${color.id}`}
                  checked={selectedColors.includes(Number(color.id))}
                  onCheckedChange={(checked) => handleColorChange(Number(color.id), checked as boolean)}
                />
                <Label htmlFor={`color-${color.id}`} className="cursor-pointer">
                  {color.name}
                </Label>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="archetypes">
        <AccordionTrigger>Архетипы</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            {filters?.archetypes.map((archetype) => (
              <div key={archetype.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`archetype-${archetype.id}`}
                  checked={selectedArchetypes.includes(Number(archetype.id))}
                  onCheckedChange={(checked) => handleArchetypeChange(Number(archetype.id), checked as boolean)}
                />
                <Label htmlFor={`archetype-${archetype.id}`} className="cursor-pointer">
                  {archetype.name}
                </Label>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="gender">
        <AccordionTrigger>Пол</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            {filters?.genders.map((gender) => (
              <div key={gender.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`gender-${gender.id}`}
                  checked={selectedGender === gender.name}
                  onCheckedChange={(checked) => handleGenderChange(gender.name, checked as boolean)}
                />
                <Label htmlFor={`gender-${gender.id}`} className="cursor-pointer">
                  {gender.name}
                </Label>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
