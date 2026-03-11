import { cn } from "@/lib/utils";
import Icon from "@/components/ui/icon";
import { Checkbox } from "@/components/ui/checkbox";

export interface TemplateGarment {
  id: string;
  image?: string;
  hint: string;
}

interface ClothingMultiSelectProps {
  garments: TemplateGarment[];
  selectedIndices: number[];
  onSelectionChange: (indices: number[]) => void;
  label?: string;
}

export default function ClothingMultiSelect({
  garments,
  selectedIndices,
  onSelectionChange,
  label = "Выберите одежду для модели",
}: ClothingMultiSelectProps) {
  const toggleIndex = (index: number) => {
    if (selectedIndices.includes(index)) {
      onSelectionChange(selectedIndices.filter((i) => i !== index));
    } else {
      onSelectionChange([...selectedIndices, index]);
    }
  };

  if (garments.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic py-2">
        Сначала добавьте одежду
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium mb-2">{label}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[240px] overflow-y-auto pr-1">
        {garments.map((g, index) => (
          <button
            key={g.id}
            type="button"
            onClick={() => toggleIndex(index)}
            className={cn(
              "flex items-center gap-2 p-2 rounded-lg border text-left transition-colors text-sm",
              selectedIndices.includes(index)
                ? "border-purple-500 bg-purple-50"
                : "border-gray-200 hover:border-gray-300"
            )}
          >
            <Checkbox
              checked={selectedIndices.includes(index)}
              className="pointer-events-none flex-shrink-0"
            />
            {g.image ? (
              <img
                src={g.image}
                alt={g.hint || `Вещь ${index + 1}`}
                className="w-8 h-8 object-cover rounded flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                <Icon name="Shirt" size={14} className="text-gray-400" />
              </div>
            )}
            <span className="truncate">
              {g.hint || `Вещь ${index + 1}`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}