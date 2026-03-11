import Icon from "@/components/ui/icon";
import CapsuleClothingSlot from "./CapsuleClothingSlot";
import type { TemplateGarment } from "./ClothingMultiSelect";

interface CapsuleClothingListProps {
  garments: TemplateGarment[];
  onUpdate: (id: string, updates: Partial<TemplateGarment>) => void;
  onImageUpload: (id: string, file: File) => void;
  onImageRemove: (id: string) => void;
  disabled?: boolean;
}

export default function CapsuleClothingList({
  garments,
  onUpdate,
  onImageUpload,
  onImageRemove,
  disabled,
}: CapsuleClothingListProps) {
  const filledCount = garments.filter((g) => g.image || g.hint).length;

  return (
    <div>
      <p className="text-sm font-semibold mb-3">
        <Icon name="Shirt" className="inline mr-1.5" size={16} />
        Одежда ({filledCount}/{garments.length})
      </p>

      <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
        {garments.map((garment, index) => (
          <CapsuleClothingSlot
            key={garment.id}
            garment={garment}
            index={index}
            onUpdate={onUpdate}
            onImageUpload={onImageUpload}
            onImageRemove={onImageRemove}
            disabled={disabled}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        Добавьте фото и/или описание. Фото без описания не допускается.
      </p>
    </div>
  );
}
