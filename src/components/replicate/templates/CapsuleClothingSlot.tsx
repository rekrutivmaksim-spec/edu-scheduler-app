import { useRef } from "react";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import type { TemplateGarment } from "./ClothingMultiSelect";

interface CapsuleClothingSlotProps {
  garment: TemplateGarment;
  index: number;
  onUpdate: (id: string, updates: Partial<TemplateGarment>) => void;
  onImageUpload: (id: string, file: File) => void;
  onImageRemove: (id: string) => void;
  disabled?: boolean;
}

export default function CapsuleClothingSlot({
  garment,
  index,
  onUpdate,
  onImageUpload,
  onImageRemove,
  disabled,
}: CapsuleClothingSlotProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageUpload(garment.id, file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isEmpty = !garment.image && !garment.hint;

  return (
    <div
      className={`flex gap-3 items-center p-2.5 border rounded-lg transition-colors ${
        isEmpty ? "bg-gray-50/50 border-gray-100" : "bg-white border-gray-200"
      }`}
    >
      <div className="flex-shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
          id={`garment-upload-${garment.id}`}
          disabled={disabled}
        />
        {garment.image ? (
          <div className="relative group">
            <label
              htmlFor={`garment-upload-${garment.id}`}
              className="block w-12 h-12 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
            >
              <img
                src={garment.image}
                alt={garment.hint || `Вещь ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </label>
            <button
              type="button"
              onClick={() => onImageRemove(garment.id)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              disabled={disabled}
            >
              <Icon name="X" size={10} />
            </button>
          </div>
        ) : (
          <label
            htmlFor={`garment-upload-${garment.id}`}
            className="flex items-center justify-center w-12 h-12 bg-gray-50 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-purple-400 transition-colors"
          >
            <Icon name="ImagePlus" size={16} className="text-gray-300" />
          </label>
        )}
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className="text-xs font-medium text-gray-400 flex-shrink-0 w-4 text-right">
          {index + 1}
        </span>
        <Input
          value={garment.hint}
          onChange={(e) => onUpdate(garment.id, { hint: e.target.value })}
          placeholder={
            garment.image
              ? "Описание вещи, которую взять с фото (обязательно)"
              : "Описание (напр: белая базовая футболка)"
          }
          className={`h-8 text-xs ${garment.image && !garment.hint ? "border-red-300" : ""}`}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
