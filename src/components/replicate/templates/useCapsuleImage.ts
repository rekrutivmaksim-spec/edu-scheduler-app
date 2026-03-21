import { useState } from "react";
import { toast } from "sonner";
import { validateImageFile } from "@/utils/fileValidation";

export const resizeImage = (
  file: File,
  maxW: number,
  maxH: number,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxW || h > maxH) {
          const r = Math.min(maxW / w, maxH / h);
          w = Math.floor(w * r);
          h = Math.floor(h * r);
        }
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) return reject(new Error("No canvas context"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", 0.9));
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
};

export function useCapsuleImage() {
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [tempImageForCrop, setTempImageForCrop] = useState<string | null>(null);

  const handlePersonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      toast.error(validation.error || "Неверный файл");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const ratio = img.width / img.height;
        if (Math.abs(ratio - 3 / 4) < 0.05) {
          resizeImage(file, 1024, 1024)
            .then(setPersonImage)
            .catch(() => {
              toast.error("Ошибка обработки");
            });
        } else {
          setTempImageForCrop(event.target?.result as string);
          setShowCropper(true);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (cropped: string) => {
    setPersonImage(cropped);
    setShowCropper(false);
    setTempImageForCrop(null);
    toast.success("Фото обрезано и загружено");
  };

  return {
    personImage,
    setPersonImage,
    showCropper,
    setShowCropper,
    tempImageForCrop,
    handlePersonUpload,
    handleCropComplete,
  };
}
