import { Textarea } from "@/components/ui/textarea";
import Icon from "@/components/ui/icon";
import ClothingMultiSelect from "./ClothingMultiSelect";
import type { TemplateGarment } from "./ClothingMultiSelect";

export type SlotType = "outfit" | "other";

export interface GridSlotData {
  type: SlotType;
  outfit: number[];
  prompt: string;
}

interface GridSlotProps {
  index: number;
  slot: GridSlotData;
  garments: TemplateGarment[];
  onUpdate: (index: number, updates: Partial<GridSlotData>) => void;
  disabled?: boolean;
}

const slotTypes: { value: SlotType; label: string; icon: string }[] = [
  { value: "outfit", label: "Образ", icon: "User" },
  { value: "other", label: "Другое", icon: "LayoutGrid" },
];

export default function GridSlot({
  index,
  slot,
  garments,
  onUpdate,
  disabled,
}: GridSlotProps) {
  return (
    <div className="border rounded-lg p-3 bg-white space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-purple-600">
          Ячейка {index + 1}
        </span>
        <div className="flex gap-1">
          {slotTypes.map((st) => (
            <button
              key={st.value}
              type="button"
              onClick={() =>
                onUpdate(index, { type: st.value, outfit: [], prompt: "" })
              }
              disabled={disabled}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                slot.type === st.value
                  ? "bg-purple-100 text-purple-700 font-semibold"
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}
            >
              <Icon name={st.icon} size={12} />
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {slot.type === "outfit" && (
        <>
          <ClothingMultiSelect
            garments={garments}
            selectedIndices={slot.outfit}
            onSelectionChange={(indices) => onUpdate(index, { outfit: indices })}
            label="Одежда для этого образа"
          />
          <Textarea
            value={slot.prompt}
            onChange={(e) => onUpdate(index, { prompt: e.target.value })}
            placeholder="Доп. описание: фон, стиль, поза..."
            rows={2}
            className="text-xs"
            disabled={disabled}
          />
        </>
      )}

      {slot.type === "other" && (
        <Textarea
          value={slot.prompt}
          onChange={(e) => onUpdate(index, { prompt: e.target.value })}
          placeholder="Опишите что разместить: палитра цветов, текст, декоративный элемент..."
          rows={2}
          className="text-xs"
          disabled={disabled}
        />
      )}
    </div>
  );
}