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

interface CatalogFiltersProps {
  filters: Filters | null;
  selectedCatalogCategories: number[];
  setSelectedCatalogCategories: (categories: number[]) => void;
  selectedCatalogColors: number[];
  setSelectedCatalogColors: (colors: number[]) => void;
  selectedCatalogArchetypes: number[];
  setSelectedCatalogArchetypes: (archetypes: number[]) => void;
  selectedCatalogGender: string;
  setSelectedCatalogGender: (gender: string) => void;
}

export default function CatalogFilters({
  filters,
  selectedCatalogCategories,
  setSelectedCatalogCategories,
  selectedCatalogColors,
  setSelectedCatalogColors,
  selectedCatalogArchetypes,
  setSelectedCatalogArchetypes,
  selectedCatalogGender,
  setSelectedCatalogGender,
}: CatalogFiltersProps) {
  if (!filters) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
      <div>
        <label className="text-sm font-medium mb-2 block">Категории</label>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {filters.categories.map(cat => (
            <label key={cat.id} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedCatalogCategories.includes(Number(cat.id))}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedCatalogCategories([...selectedCatalogCategories, Number(cat.id)]);
                  } else {
                    setSelectedCatalogCategories(selectedCatalogCategories.filter(id => id !== Number(cat.id)));
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
                checked={selectedCatalogColors.includes(Number(color.id))}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedCatalogColors([...selectedCatalogColors, Number(color.id)]);
                  } else {
                    setSelectedCatalogColors(selectedCatalogColors.filter(id => id !== Number(color.id)));
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
                checked={selectedCatalogArchetypes.includes(Number(arch.id))}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedCatalogArchetypes([...selectedCatalogArchetypes, Number(arch.id)]);
                  } else {
                    setSelectedCatalogArchetypes(selectedCatalogArchetypes.filter(id => id !== Number(arch.id)));
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
          value={selectedCatalogGender}
          onChange={(e) => setSelectedCatalogGender(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="">Все</option>
          {filters.genders.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
