import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

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

interface AdminCatalogFiltersProps {
  filters: Filters | null;
  selectedCategories: number[];
  selectedColors: number[];
  selectedArchetypes: number[];
  selectedGender: string;
  onCategoriesChange: (categories: number[]) => void;
  onColorsChange: (colors: number[]) => void;
  onArchetypesChange: (archetypes: number[]) => void;
  onGenderChange: (gender: string) => void;
  onResetFilters: () => void;
}

export default function AdminCatalogFilters({
  filters,
  selectedCategories,
  selectedColors,
  selectedArchetypes,
  selectedGender,
  onCategoriesChange,
  onColorsChange,
  onArchetypesChange,
  onGenderChange,
  onResetFilters
}: AdminCatalogFiltersProps) {
  if (!filters) return null;

  const hasActiveFilters = selectedCategories.length > 0 || 
                          selectedColors.length > 0 || 
                          selectedArchetypes.length > 0 || 
                          selectedGender;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
        <div>
          <label className="text-sm font-medium mb-2 block">Категории</label>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {filters.categories.map(cat => (
              <label key={cat.id} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(Number(cat.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onCategoriesChange([...selectedCategories, Number(cat.id)]);
                    } else {
                      onCategoriesChange(selectedCategories.filter(id => id !== Number(cat.id)));
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
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {filters.colors.map(color => (
              <label key={color.id} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedColors.includes(Number(color.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onColorsChange([...selectedColors, Number(color.id)]);
                    } else {
                      onColorsChange(selectedColors.filter(id => id !== Number(color.id)));
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
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {filters.archetypes.map(arch => (
              <label key={arch.id} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedArchetypes.includes(Number(arch.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onArchetypesChange([...selectedArchetypes, Number(arch.id)]);
                    } else {
                      onArchetypesChange(selectedArchetypes.filter(id => id !== Number(arch.id)));
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
          <label className="text-sm font-medium mb-2 block">Пол</label>
          <select
            value={selectedGender}
            onChange={(e) => onGenderChange(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">Все</option>
            {filters.genders.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      {hasActiveFilters && (
        <Button 
          variant="outline" 
          size="sm"
          onClick={onResetFilters}
        >
          <Icon name="X" className="w-4 h-4 mr-2" />
          Сбросить фильтр
        </Button>
      )}
    </div>
  );
}
