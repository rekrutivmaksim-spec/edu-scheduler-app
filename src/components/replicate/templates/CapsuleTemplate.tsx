import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

import Icon from "@/components/ui/icon";
import { Link } from "react-router-dom";
import ReplicateImageUpload from "@/components/replicate/ReplicateImageUpload";
import ReplicateResultPanel from "@/components/replicate/ReplicateResultPanel";
import ReplicateSaveDialog from "@/components/replicate/ReplicateSaveDialog";
import ImageCropper from "@/components/ImageCropper";
import CapsuleClothingList from "./CapsuleClothingList";
import ClothingMultiSelect from "./ClothingMultiSelect";
import type { TemplateGarment } from "./ClothingMultiSelect";
import { useTemplateGeneration } from "@/hooks/useTemplateGeneration";
import { useData } from "@/context/DataContext";
import { validateImageFile } from "@/utils/fileValidation";
import { GENERATION_COST, MIN_TOPUP } from "@/config/prices";

const IMAGE_PROXY_API =
  "https://functions.poehali.dev/7f105c4b-f9e7-4df3-9f64-3d35895b8e90";
const DB_QUERY_API =
  "https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9";

interface CapsuleTemplateProps {
  user: { id: string; email: string; unlimited_access?: boolean } | null;
  hasInsufficientBalance: boolean;
  onRefetchHistory: () => Promise<void>;
}

const TEMPLATE_IMAGE_URL =
  "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/8e1367bc-f288-47c2-b6f0-c75aadb13558.jpg";

export default function CapsuleTemplate({
  user,
  hasInsufficientBalance,
  onRefetchHistory,
}: CapsuleTemplateProps) {
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [garments, setGarments] = useState<TemplateGarment[]>(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: `g-init-${i}`,
      image: undefined,
      hint: "",
    })),
  );
  const [prompt, setPrompt] = useState("");

  const [modelOutfit, setModelOutfit] = useState<number[]>([]);
  const [showCropper, setShowCropper] = useState(false);
  const [tempImageForCrop, setTempImageForCrop] = useState<string | null>(null);

  const {
    isGenerating,
    generationStatus,
    generatedImage,
    cdnImageUrl,
    hasTimedOut,
    generate,
    reset,
  } = useTemplateGeneration(user, onRefetchHistory);

  const { lookbooks, refetchLookbooks } = useData();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [selectedLookbookId, setSelectedLookbookId] = useState("");
  const [newLookbookName, setNewLookbookName] = useState("");
  const [newLookbookPersonName, setNewLookbookPersonName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const resizeImage = (
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

  const updateGarment = useCallback(
    (id: string, updates: Partial<TemplateGarment>) => {
      setGarments((prev) =>
        prev.map((g) => (g.id === id ? { ...g, ...updates } : g)),
      );
    },
    [],
  );

  const handleImageRemove = useCallback((id: string) => {
    setGarments((prev) =>
      prev.map((g) => (g.id === id ? { ...g, image: undefined } : g)),
    );
  }, []);

  const handleGarmentImageUpload = useCallback(
    async (id: string, file: File) => {
      const validation = validateImageFile(file);
      if (!validation.isValid) {
        toast.error(validation.error || "Неверный файл");
        return;
      }
      try {
        const resized = await resizeImage(file, 1024, 1024);
        updateGarment(id, { image: resized });
      } catch {
        toast.error("Ошибка загрузки изображения");
      }
    },
    [updateGarment],
  );

  const filledGarments = garments.filter((g) => g.image || g.hint);

  const handleGenerate = async () => {
    if (!personImage) {
      toast.error("Загрузите фото человека");
      return;
    }
    if (filledGarments.length === 0) {
      toast.error("Добавьте хотя бы одну вещь");
      return;
    }
    const hasPhotoWithoutHint = filledGarments.some((g) => g.image && !g.hint);
    if (hasPhotoWithoutHint) {
      toast.error("Добавьте описание ко всем вещам с фото");
      return;
    }
    if (modelOutfit.length === 0) {
      toast.error("Выберите одежду для модели слева");
      return;
    }

    await generate({
      mode: "capsule",
      person_image: personImage,
      template_image: TEMPLATE_IMAGE_URL,
      garments: filledGarments.map((g) => ({
        image: g.image || null,
        hint: g.hint,
      })),
      prompt,
      model_outfit: modelOutfit,
    });
  };

  const handleReset = () => {
    reset();
    setPersonImage(null);
    setGarments(
      Array.from({ length: 12 }, (_, i) => ({
        id: `g-reset-${i}-${Date.now()}`,
        image: undefined,
        hint: "",
      })),
    );
    setPrompt("");
    setModelOutfit([]);
  };

  const handleDownloadImage = async () => {
    if (!generatedImage) return;
    try {
      let blob: Blob;
      if (generatedImage.startsWith("data:")) {
        const response = await fetch(generatedImage);
        blob = await response.blob();
      } else {
        const proxyResponse = await fetch(
          `${IMAGE_PROXY_API}?url=${encodeURIComponent(generatedImage)}`,
        );
        if (!proxyResponse.ok) throw new Error("Failed to proxy image");
        const proxyData = await proxyResponse.json();
        const response = await fetch(proxyData.data_url);
        blob = await response.blob();
      }
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `capsule-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      toast.success("Скачано!");
    } catch {
      toast.error("Ошибка скачивания");
    }
  };

  const handleSaveToExistingLookbook = async () => {
    if (!selectedLookbookId || !user) return;
    if (!cdnImageUrl) {
      toast.error("Изображение ещё сохраняется, подождите...");
      return;
    }
    setIsSaving(true);
    try {
      const lookbook = lookbooks?.find(
        (lb: { id: string; photos?: string[] }) => lb.id === selectedLookbookId,
      );
      const updatedPhotos = [...(lookbook?.photos || []), cdnImageUrl];
      const response = await fetch(DB_QUERY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          table: "lookbooks",
          action: "update",
          where: { id: selectedLookbookId },
          data: { photos: updatedPhotos },
        }),
      });
      if (response.ok) {
        toast.success("Фото добавлено в лукбук!");
        setShowSaveDialog(false);
        setSelectedLookbookId("");
        await refetchLookbooks();
      } else {
        throw new Error("Failed to save");
      }
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToNewLookbook = async () => {
    if (!newLookbookName || !newLookbookPersonName || !user) return;
    if (!cdnImageUrl) {
      toast.error("Изображение ещё сохраняется, подождите...");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(DB_QUERY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          table: "lookbooks",
          action: "insert",
          data: {
            user_id: user.id,
            name: newLookbookName,
            person_name: newLookbookPersonName,
            photos: [cdnImageUrl],
            color_palette: [],
          },
        }),
      });
      if (response.ok) {
        toast.success("Лукбук создан!");
        setShowSaveDialog(false);
        setNewLookbookName("");
        setNewLookbookPersonName("");
        await refetchLookbooks();
      } else {
        throw new Error("Failed to create lookbook");
      }
    } catch {
      toast.error("Ошибка создания лукбука");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="grid lg:grid-cols-2 gap-8 mb-12">
        <Card className="animate-scale-in">
          <CardContent className="p-6 space-y-5">
            {!user && (
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <Icon
                    name="Info"
                    className="text-primary mt-0.5 flex-shrink-0"
                    size={20}
                  />
                  <div>
                    <p className="text-sm font-medium text-primary mb-1">
                      Требуется авторизация
                    </p>
                    <p className="text-sm text-muted-foreground mb-2">
                      Для генерации необходимо войти и пополнить баланс минимум
                      на {MIN_TOPUP}₽.
                    </p>
                    <div className="flex gap-2">
                      <Link to="/login">
                        <Button size="sm">Войти</Button>
                      </Link>
                      <Link to="/register">
                        <Button size="sm" variant="outline">
                          Регистрация
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {hasInsufficientBalance && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Icon
                    name="Wallet"
                    className="text-orange-600 mt-0.5"
                    size={20}
                  />
                  <div>
                    <p className="text-sm font-medium text-orange-700">
                      Пополните баланс
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Для генерации нужно минимум {GENERATION_COST}₽.
                    </p>
                    <Link to="/profile/wallet">
                      <Button size="sm" className="mt-2">
                        Пополнить
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            <ReplicateImageUpload
              uploadedImage={personImage}
              handleImageUpload={handlePersonUpload}
              isGenerating={isGenerating}
            />

            <CapsuleClothingList
              garments={garments}
              onUpdate={updateGarment}
              onImageUpload={handleGarmentImageUpload}
              onImageRemove={handleImageRemove}
              disabled={isGenerating}
            />

            {filledGarments.length > 0 && (
              <ClothingMultiSelect
                garments={filledGarments}
                selectedIndices={modelOutfit}
                onSelectionChange={setModelOutfit}
                label="Что надеть на модель (слева)"
              />
            )}

            <div>
              <Label className="text-sm font-semibold mb-1.5 block">
                Промт
              </Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Опишите образ модели и фон (напр: городская улица, нежные пастельные тона)"
                rows={3}
                disabled={isGenerating}
              />
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleGenerate}
                disabled={
                  !personImage ||
                  filledGarments.length === 0 ||
                  isGenerating ||
                  !user ||
                  (hasInsufficientBalance && !user?.unlimited_access)
                }
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Icon
                      name="Loader2"
                      className="mr-2 animate-spin"
                      size={20}
                    />
                    {generationStatus || "Генерация..."}
                  </>
                ) : (
                  <>
                    <Icon name="Sparkles" className="mr-2" size={20} />
                    Создать капсулу
                  </>
                )}
              </Button>

              {!user?.unlimited_access && !isGenerating && (
                <p className="text-sm text-muted-foreground text-center">
                  Стоимость генерации: {GENERATION_COST}₽
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <ReplicateResultPanel
          isGenerating={isGenerating}
          generatedImage={generatedImage}
          handleDownloadImage={handleDownloadImage}
          setShowSaveDialog={setShowSaveDialog}
          handleReset={handleReset}
          hasTimedOut={hasTimedOut}
        />
      </div>

      <ReplicateSaveDialog
        showSaveDialog={showSaveDialog}
        setShowSaveDialog={setShowSaveDialog}
        lookbooks={lookbooks || []}
        selectedLookbookId={selectedLookbookId}
        setSelectedLookbookId={setSelectedLookbookId}
        handleSaveToExistingLookbook={handleSaveToExistingLookbook}
        isSaving={isSaving}
        newLookbookName={newLookbookName}
        setNewLookbookName={setNewLookbookName}
        newLookbookPersonName={newLookbookPersonName}
        setNewLookbookPersonName={setNewLookbookPersonName}
        handleSaveToNewLookbook={handleSaveToNewLookbook}
      />

      {tempImageForCrop && (
        <ImageCropper
          image={tempImageForCrop}
          open={showCropper}
          onClose={() => {
            setShowCropper(false);
            setTempImageForCrop(null);
          }}
          onCropComplete={handleCropComplete}
          aspectRatio={3 / 4}
        />
      )}
    </>
  );
}