import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import { Link } from 'react-router-dom';
import ReplicateResultPanel from './ReplicateResultPanel';
import ReplicateSaveDialog from './ReplicateSaveDialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface TryOnControlsSectionProps {
  isGenerating: boolean;
  generationStatus: string;
  currentStep: number;
  totalSteps: number;
  waitingContinue: boolean;
  intermediateResult: string | null;
  generatedImage: string | null;
  user: any;
  showSaveDialog: boolean;
  lookbooks: any[];
  selectedLookbookId: string;
  newLookbookName: string;
  newLookbookPersonName: string;
  isSaving: boolean;
  handleGenerate: () => void;
  handleContinueGeneration: () => void;
  handleAcceptIntermediate: () => void;
  setShowSaveDialog: (show: boolean) => void;
  setSelectedLookbookId: (id: string) => void;
  setNewLookbookName: (name: string) => void;
  setNewLookbookPersonName: (name: string) => void;
  handleSaveImage: () => void;
}

export default function TryOnControlsSection({
  isGenerating,
  generationStatus,
  currentStep,
  totalSteps,
  waitingContinue,
  intermediateResult,
  generatedImage,
  user,
  showSaveDialog,
  lookbooks,
  selectedLookbookId,
  newLookbookName,
  newLookbookPersonName,
  isSaving,
  handleGenerate,
  handleContinueGeneration,
  handleAcceptIntermediate,
  setShowSaveDialog,
  setSelectedLookbookId,
  setNewLookbookName,
  setNewLookbookPersonName,
  handleSaveImage
}: TryOnControlsSectionProps) {
  return (
    <>
      <Card className="bg-blue-50/50 border-blue-200">
        <CardContent className="pt-6">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="hints" className="border-none">
              <AccordionTrigger className="hover:no-underline py-2">
                <div className="flex items-center gap-2">
                  <Icon name="Lightbulb" className="text-blue-600" size={20} />
                  <span className="font-semibold text-blue-900">Как получить лучший результат?</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-sm text-blue-800 pt-2">
                  <div className="flex gap-2">
                    <Icon name="Check" className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                    <p>
                      <strong>Фото модели:</strong> Используйте фото в полный рост на нейтральном фоне. 
                      Избегайте сложных поз и загроможденного фона.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Icon name="Check" className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                    <p>
                      <strong>Фото одежды:</strong> Выбирайте четкие фото предметов одежды на белом фоне 
                      или на модели. Избегайте размытых или темных изображений.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Icon name="Check" className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                    <p>
                      <strong>Комбинирование:</strong> Можно примерить несколько предметов одновременно 
                      (верх + низ), но избегайте перегрузки сложными сочетаниями.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Icon name="AlertCircle" className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                    <p>
                      <strong>Совет:</strong> Если результат не устраивает, попробуйте другое фото модели 
                      или одежды с более четкими контурами.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Button 
          onClick={handleGenerate}
          disabled={isGenerating}
          size="lg"
          className="w-full text-lg py-6"
        >
          {isGenerating ? (
            <>
              <Icon name="Loader2" className="mr-2 h-5 w-5 animate-spin" />
              {generationStatus || 'Генерация...'}
              {totalSteps > 0 && ` (${currentStep}/${totalSteps})`}
            </>
          ) : (
            <>
              <Icon name="Sparkles" className="mr-2 h-5 w-5" />
              Примерить
            </>
          )}
        </Button>

        {waitingContinue && intermediateResult && (
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <Icon name="Info" className="text-blue-600 flex-shrink-0 mt-1" size={20} />
              <div className="space-y-2 flex-1">
                <p className="text-sm font-medium text-blue-900">
                  Промежуточный результат готов
                </p>
                <p className="text-sm text-blue-700">
                  Вы можете принять текущий результат или продолжить улучшение изображения
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={handleAcceptIntermediate}
                    variant="default"
                    size="sm"
                  >
                    Принять результат
                  </Button>
                  <Button
                    onClick={handleContinueGeneration}
                    variant="outline"
                    size="sm"
                  >
                    Продолжить улучшение
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <img 
                src={intermediateResult} 
                alt="Промежуточный результат" 
                className="w-full rounded-lg border border-blue-200"
              />
            </div>
          </div>
        )}

        {!user && (
          <div className="text-center space-y-2 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-sm text-purple-800">
              <Icon name="Info" className="inline mr-1" size={16} />
              У вас осталось <strong>5 бесплатных попыток</strong>
            </p>
            <Link to="/register">
              <Button variant="link" className="text-purple-700 hover:text-purple-900">
                Зарегистрируйтесь для неограниченного доступа →
              </Button>
            </Link>
          </div>
        )}
      </div>

      {generatedImage && (
        <ReplicateResultPanel
          generatedImage={generatedImage}
          onSave={() => setShowSaveDialog(true)}
          user={user}
        />
      )}

      <ReplicateSaveDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        lookbooks={lookbooks}
        selectedLookbookId={selectedLookbookId}
        onLookbookSelect={setSelectedLookbookId}
        newLookbookName={newLookbookName}
        onNewLookbookNameChange={setNewLookbookName}
        newLookbookPersonName={newLookbookPersonName}
        onNewLookbookPersonNameChange={setNewLookbookPersonName}
        onSave={handleSaveImage}
        isSaving={isSaving}
      />
    </>
  );
}
