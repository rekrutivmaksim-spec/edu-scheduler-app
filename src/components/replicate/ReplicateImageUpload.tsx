import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import ImageViewer from '@/components/ImageViewer';
import { Button } from '@/components/ui/button';
import { useRef } from 'react';

interface ReplicateImageUploadProps {
  uploadedImage: string | null;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isGenerating: boolean;
}

export default function ReplicateImageUpload({
  uploadedImage,
  handleImageUpload,
  isGenerating
}: ReplicateImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleImageUpload(e);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <Label className="text-lg font-semibold mb-4 block">
        <Icon name="User" className="inline mr-2" size={20} />
        1. Загрузите фото человека
      </Label>
      <p className="text-sm text-muted-foreground mb-3">
        На которого хотите примерить одежду
      </p>
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
          id="model-upload"
          disabled={isGenerating}
        />
        <label
          htmlFor="model-upload"
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors ${
            uploadedImage
              ? 'border-primary bg-primary/5'
              : 'border-gray-300 hover:border-primary'
          } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {uploadedImage ? (
            <div className="relative w-full">
              <ImageViewer src={uploadedImage} alt="Uploaded" className="rounded-lg" />
              <div className="mt-4 text-center">
                <span className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                  <Icon name="Upload" className="mr-2" size={16} />
                  Заменить фото
                </span>
              </div>
            </div>
          ) : (
            <>
              <Icon name="Upload" size={48} className="text-gray-400 mb-4" />
              <p className="text-sm text-gray-600 text-center font-medium">
                Нажмите для загрузки фото
              </p>
              <p className="text-xs text-gray-500 text-center mt-2">
                Модель в полный рост на светлом фоне
              </p>
            </>
          )}
        </label>
      </div>
    </div>
  );
}