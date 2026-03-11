import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface ReplicateSaveDialogProps {
  showSaveDialog: boolean;
  setShowSaveDialog: (show: boolean) => void;
  lookbooks: any[];
  selectedLookbookId: string;
  setSelectedLookbookId: (id: string) => void;
  handleSaveToExistingLookbook: () => void;
  isSaving: boolean;
  newLookbookName: string;
  setNewLookbookName: (name: string) => void;
  newLookbookPersonName: string;
  setNewLookbookPersonName: (name: string) => void;
  handleSaveToNewLookbook: () => void;
}

export default function ReplicateSaveDialog({
  showSaveDialog,
  setShowSaveDialog,
  lookbooks,
  selectedLookbookId,
  setSelectedLookbookId,
  handleSaveToExistingLookbook,
  isSaving,
  newLookbookName,
  setNewLookbookName,
  newLookbookPersonName,
  setNewLookbookPersonName,
  handleSaveToNewLookbook
}: ReplicateSaveDialogProps) {
  return (
    <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Сохранить в лукбук</DialogTitle>
          <DialogDescription>
            Добавьте сгенерированное изображение в существующий лукбук или создайте новый
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {lookbooks.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Выбрать существующий лукбук</Label>
              <RadioGroup value={selectedLookbookId} onValueChange={setSelectedLookbookId}>
                <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3 bg-muted/20">
                  {lookbooks.map((lookbook) => (
                    <div key={lookbook.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={lookbook.id} id={lookbook.id} />
                      <Label htmlFor={lookbook.id} className="flex-1 cursor-pointer">
                        {lookbook.name} ({lookbook.person_name})
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
              <Button 
                onClick={handleSaveToExistingLookbook}
                disabled={!selectedLookbookId || isSaving}
                className="w-full"
              >
                {isSaving ? 'Сохранение...' : 'Добавить в выбранный лукбук'}
              </Button>
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Или создать новый
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="lookbook-name">Название лукбука</Label>
              <Input
                id="lookbook-name"
                placeholder="Например: Осенний стиль 2024"
                value={newLookbookName}
                onChange={(e) => setNewLookbookName(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div>
              <Label htmlFor="person-name">Имя персоны</Label>
              <Input
                id="person-name"
                placeholder="Например: Анна"
                value={newLookbookPersonName}
                onChange={(e) => setNewLookbookPersonName(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <Button
              onClick={handleSaveToNewLookbook}
              disabled={!newLookbookName || !newLookbookPersonName || isSaving}
              className="w-full"
            >
              {isSaving ? 'Создание...' : 'Создать новый лукбук'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}