import { useState, useRef } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';

interface ImageCropperProps {
  image: string;
  open: boolean;
  onClose: () => void;
  onCropComplete: (croppedImage: string) => void;
  aspectRatio?: number;
}

export default function ImageCropper({
  image,
  open,
  onClose,
  onCropComplete,
  aspectRatio
}: ImageCropperProps) {
  const [crop, setCrop] = useState<Crop | undefined>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isHorizontal, setIsHorizontal] = useState(false);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const isHoriz = img.naturalWidth > img.naturalHeight;
    setIsHorizontal(isHoriz);
    setImageLoaded(true);

    if (aspectRatio && imgRef.current) {
      const { width, height } = imgRef.current;
      
      let cropWidth = width * 0.9;
      let cropHeight = cropWidth / aspectRatio;
      
      if (cropHeight > height * 0.9) {
        cropHeight = height * 0.9;
        cropWidth = cropHeight * aspectRatio;
      }
      
      const x = (width - cropWidth) / 2;
      const y = (height - cropHeight) / 2;
      
      const newCrop: Crop = {
        unit: 'px',
        x,
        y,
        width: cropWidth,
        height: cropHeight
      };
      
      setCrop(newCrop);
      setCompletedCrop({
        x,
        y,
        width: cropWidth,
        height: cropHeight
      });
    }
  };

  const handleCropComplete = async () => {
    if (!imgRef.current || !completedCrop) {
      console.error('Missing imgRef or completedCrop');
      return;
    }

    if (!imgRef.current.complete || imgRef.current.naturalWidth === 0) {
      console.error('Image not loaded properly');
      return;
    }

    if (completedCrop.width <= 0 || completedCrop.height <= 0) {
      console.error('Invalid crop dimensions');
      return;
    }

    setIsProcessing(true);

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Failed to get canvas context');
        setIsProcessing(false);
        return;
      }

      const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

      canvas.width = Math.floor(completedCrop.width * scaleX);
      canvas.height = Math.floor(completedCrop.height * scaleY);

      ctx.drawImage(
        imgRef.current,
        Math.floor(completedCrop.x * scaleX),
        Math.floor(completedCrop.y * scaleY),
        Math.floor(completedCrop.width * scaleX),
        Math.floor(completedCrop.height * scaleY),
        0,
        0,
        canvas.width,
        canvas.height
      );

      const croppedImage = canvas.toDataURL('image/jpeg', 0.95);
      console.log('Crop complete, calling callback');
      onCropComplete(croppedImage);
      setIsProcessing(false);
      onClose();
    } catch (error) {
      console.error('Error cropping image:', error);
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Обрезка изображения</DialogTitle>
          <DialogDescription>
            Выберите область изображения для обрезки
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {imageLoaded && isHorizontal && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Icon name="Info" className="text-blue-600 mt-0.5 flex-shrink-0" size={18} />
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-1">Рекомендация по формату</p>
                  <p className="text-blue-700">
                    Для корректной работы примерочной используйте вертикальные фото (высота больше ширины). 
                    Обрежьте изображение так, чтобы получился вертикальный формат.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-center">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspectRatio}
              className="max-h-[600px]"
            >
              <img
                ref={imgRef}
                src={image}
                alt="Crop preview"
                className="max-w-full h-auto"
                onLoad={handleImageLoad}
                crossOrigin="anonymous"
              />
            </ReactCrop>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
              Отмена
            </Button>
            <Button onClick={handleCropComplete} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Icon name="Loader2" className="mr-2 animate-spin" size={16} />
                  Обработка...
                </>
              ) : (
                <>
                  <Icon name="Check" className="mr-2" size={16} />
                  Применить
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}