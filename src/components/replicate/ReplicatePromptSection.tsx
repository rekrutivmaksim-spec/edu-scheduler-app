import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { GENERATION_COST } from '@/config/prices';

interface ReplicatePromptSectionProps {
  customPrompt: string;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  generationStatus: string;
  uploadedImage: string | null;
  selectedClothingCount: number;
}

export default function ReplicatePromptSection({
  customPrompt,
  onPromptChange,
  onGenerate,
  isGenerating,
  generationStatus,
  uploadedImage,
  selectedClothingCount,
}: ReplicatePromptSectionProps) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <Label htmlFor="custom-prompt" className="text-base font-semibold">
            Дополнительные пожелания (необязательно)
          </Label>
          <p className="text-sm text-muted-foreground mb-2">
            Опишите особенности примерки: позу, освещение, окружение
          </p>
          <Textarea
            id="custom-prompt"
            placeholder="Например: standing pose, studio lighting, plain background"
            value={customPrompt}
            onChange={(e) => onPromptChange(e.target.value)}
            className="min-h-[100px]"
          />
        </div>

        <Button
          onClick={onGenerate}
          disabled={isGenerating || !uploadedImage || selectedClothingCount === 0}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Icon name="Loader2" className="mr-2 h-5 w-5 animate-spin" />
              Генерация...
            </>
          ) : (
            <>
              <Icon name="Sparkles" className="mr-2 h-5 w-5" />
              Примерить ({GENERATION_COST} ₽)
            </>
          )}
        </Button>

        {generationStatus && (
          <div className="text-sm text-center text-muted-foreground">
            {generationStatus}
          </div>
        )}
      </CardContent>
    </Card>
  );
}