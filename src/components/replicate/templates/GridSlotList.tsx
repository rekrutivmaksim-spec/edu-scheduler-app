import GridSlot from "./GridSlot";
import type { GridSlotData } from "./GridSlot";
import type { TemplateGarment } from "./ClothingMultiSelect";

interface GridSlotListProps {
  slots: GridSlotData[];
  garments: TemplateGarment[];
  onUpdateSlot: (index: number, updates: Partial<GridSlotData>) => void;
  disabled?: boolean;
}

export default function GridSlotList({
  slots,
  garments,
  onUpdateSlot,
  disabled,
}: GridSlotListProps) {
  return (
    <div>
      <p className="text-sm font-semibold mb-2">
        Настройка ячеек ({slots.length})
      </p>
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {slots.map((slot, index) => (
          <GridSlot
            key={index}
            index={index}
            slot={slot}
            garments={garments}
            onUpdate={onUpdateSlot}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}
