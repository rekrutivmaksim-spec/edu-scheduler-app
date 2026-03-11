import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import ReplicateImageUpload from './ReplicateImageUpload';
import ImageCropper from '@/components/ImageCropper';

interface TryOnImageUploadSectionProps {
  uploadedImage: string | null;
  setUploadedImage: (image: string | null) => void;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showCropper: boolean;
  tempImageForCrop: string | null;
  handleCropComplete: (croppedImage: string) => void;
  handleCropCancel: () => void;
}

export default function TryOnImageUploadSection({
  uploadedImage,
  setUploadedImage,
  handleImageUpload,
  showCropper,
  tempImageForCrop,
  handleCropComplete,
  handleCropCancel
}: TryOnImageUploadSectionProps) {
  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <Label className="text-lg font-semibold mb-4 block">
            Загрузите фото модели
          </Label>
          <ReplicateImageUpload
            uploadedImage={uploadedImage}
            onImageUpload={handleImageUpload}
            onImageRemove={() => setUploadedImage(null)}
          />
        </CardContent>
      </Card>

      {showCropper && tempImageForCrop && (
        <ImageCropper
          image={tempImageForCrop}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          aspectRatio={3 / 4}
        />
      )}
    </>
  );
}
