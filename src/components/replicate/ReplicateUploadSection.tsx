import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ReplicateImageUpload from '@/components/replicate/ReplicateImageUpload';
import Icon from '@/components/ui/icon';

interface ReplicateUploadSectionProps {
  uploadedImage: string | null;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCheckTasks: () => void;
  isGenerating: boolean;
}

export default function ReplicateUploadSection({
  uploadedImage,
  onImageUpload,
  onCheckTasks,
  isGenerating,
}: ReplicateUploadSectionProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Загрузите фото</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Загрузите фотографию в полный рост (соотношение 3:4)
            </p>
            <ReplicateImageUpload
              uploadedImage={uploadedImage}
              onImageUpload={onImageUpload}
            />
          </div>

          <Button
            onClick={onCheckTasks}
            disabled={isGenerating}
            variant="outline"
            className="w-full"
          >
            <Icon name="RefreshCw" className="mr-2 h-4 w-4" />
            Проверить задачи
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
