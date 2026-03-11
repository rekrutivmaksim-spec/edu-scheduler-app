import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import ImageCropper from '@/components/ImageCropper';
import { validateImageFile } from '@/utils/fileValidation';

interface ReplicateTryOnImageUploadProps {
  uploadedImage: string | null;
  onImageChange: (image: string | null) => void;
  disabled?: boolean;
}

export default function ReplicateTryOnImageUpload({ 
  uploadedImage, 
  onImageChange,
  disabled = false 
}: ReplicateTryOnImageUploadProps) {
  const [showCropper, setShowCropper] = useState(false);
  const [tempImageForCrop, setTempImageForCrop] = useState<string | null>(null);

  const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.isValid) {
      toast.error(validation.error || 'Неверный файл');
      e.target.value = '';
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const aspectRatio = img.width / img.height;
          const targetRatio = 3 / 4;
          const tolerance = 0.05;
          
          const isCorrectAspectRatio = Math.abs(aspectRatio - targetRatio) < tolerance;
          
          if (isCorrectAspectRatio) {
            resizeImage(file, 1024, 1024).then(resized => {
              onImageChange(resized);
              toast.success('Фото загружено');
            }).catch(error => {
              console.error('Image resize error:', error);
              toast.error('Ошибка обработки изображения');
            });
          } else {
            setTempImageForCrop(event.target?.result as string);
            setShowCropper(true);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error('Ошибка загрузки изображения');
    }
  };

  const handleCropComplete = async (croppedImage: string) => {
    try {
      onImageChange(croppedImage);
      setShowCropper(false);
      setTempImageForCrop(null);
      toast.success('Фото обрезано и загружено');
    } catch (error) {
      console.error('Crop processing error:', error);
      toast.error('Ошибка обработки обрезанного изображения');
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setTempImageForCrop(null);
  };

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">1. Загрузите фото модели</h3>
              {uploadedImage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onImageChange(null)}
                  disabled={disabled}
                >
                  <Icon name="X" size={16} className="mr-1" />
                  Удалить
                </Button>
              )}
            </div>

            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary transition-colors">
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                onChange={handleImageUpload}
                className="hidden"
                id="model-upload"
                disabled={disabled}
              />
              <label htmlFor="model-upload" className={`cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {uploadedImage ? (
                  <img 
                    src={uploadedImage} 
                    alt="Модель" 
                    className="max-h-64 mx-auto rounded-lg" 
                  />
                ) : (
                  <div className="space-y-3 py-8">
                    <Icon name="Upload" className="mx-auto text-muted-foreground" size={48} />
                    <p className="text-muted-foreground">
                      Нажмите для загрузки фото модели
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Соотношение сторон 3:4 (портрет)
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {showCropper && tempImageForCrop && (
        <ImageCropper
          image={tempImageForCrop}
          open={showCropper}
          onClose={handleCropCancel}
          onCropComplete={handleCropComplete}
          aspectRatio={3 / 4}
        />
      )}
    </>
  );
}
