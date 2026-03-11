import { useState, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Icon from "@/components/ui/icon";
import ReplicateResultPanel from "@/components/replicate/ReplicateResultPanel";
import {
  checkReplicateBalance,
  deductReplicateBalance,
  refundReplicateBalance,
} from "@/utils/replicateBalanceUtils";
import { useBalance } from "@/context/BalanceContext";
import { GENERATION_COST } from "@/config/prices";

interface SelectedClothing {
  id: string;
  image: string;
  name?: string;
  category?: string;
  isFromCatalog?: boolean;
}

interface User {
  id: string;
  email: string;
  balance: number;
  unlimited_access: boolean;
}

interface ReplicateTryOnGeneratorProps {
  user: User | null;
  uploadedImage: string | null;
  selectedClothingItems: SelectedClothing[];
  onRefetchHistory: () => Promise<void>;
  onGeneratedImageChange?: (image: string | null) => void;
  onCdnImageUrlChange?: (url: string | null) => void;
}

const NANOBANANAPRO_START_API =
  "https://functions.poehali.dev/aac1d5d8-c9bd-43c6-822e-857c18f3c1f8";
const NANOBANANAPRO_WORKER_API =
  "https://functions.poehali.dev/1f4c772e-0425-4fe4-98a6-baa3979ba94d";
const DB_QUERY_API =
  "https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9";
const IMAGE_PROXY_API =
  "https://functions.poehali.dev/7f105c4b-f9e7-4df3-9f64-3d35895b8e90";

const proxyFalImage = async (falUrl: string): Promise<string> => {
  try {
    if (!falUrl.includes("fal.media") && !falUrl.includes("fal.ai")) {
      return falUrl;
    }

    console.log("[ImageProxy] Proxying fal.ai image:", falUrl);
    const response = await fetch(
      `${IMAGE_PROXY_API}?url=${encodeURIComponent(falUrl)}`,
    );

    if (!response.ok) {
      console.error("[ImageProxy] Failed to proxy image:", response.status);
      return falUrl;
    }

    const data = await response.json();
    console.log("[ImageProxy] Successfully proxied image");
    return data.data_url;
  } catch (error) {
    console.error("[ImageProxy] Error proxying image:", error);
    return falUrl;
  }
};

export default function ReplicateTryOnGenerator({
  user,
  uploadedImage,
  selectedClothingItems,
  onRefetchHistory,
  onGeneratedImageChange,
  onCdnImageUrlChange,
}: ReplicateTryOnGeneratorProps) {
  const { refreshBalance } = useBalance();
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [cdnImageUrl, setCdnImageUrl] = useState<string | null>(null);
  const isNanoBananaRequestInProgress = useRef(false);

  const handleGenerate = async () => {
    const callId = Math.random().toString(36).substring(7);
    console.log(
      `[NanoBananaPro-CALL-START] Function called, ID: ${callId}, isGenerating: ${isGenerating}, inProgress: ${isNanoBananaRequestInProgress.current}`,
    );

    if (isNanoBananaRequestInProgress.current) {
      console.log(
        `[NanoBananaPro-CALL-${callId}] BLOCKED: Request already in progress`,
      );
      return;
    }

    isNanoBananaRequestInProgress.current = true;
    console.log(`[NanoBananaPro-CALL-${callId}] Lock acquired, proceeding...`);

    try {
      if (!uploadedImage) {
        toast.error("Загрузите фото модели");
        return;
      }

      if (selectedClothingItems.length === 0) {
        toast.error("Выберите хотя бы одну вещь");
        return;
      }

      if (selectedClothingItems.length > 2) {
        toast.error("Максимум 2 вещи можно выбрать");
        return;
      }

      if (!user) {
        toast.error("Требуется авторизация");
        return;
      }

      const itemsWithoutCategory = selectedClothingItems.filter(
        (item) => !item.category,
      );
      if (itemsWithoutCategory.length > 0) {
        toast.error("Укажите категорию для всех выбранных вещей");
        return;
      }

      if (selectedClothingItems.length === 2) {
        const categories = selectedClothingItems.map((item) => item.category);
        const hasUpperAndLower =
          categories.includes("upper_body") &&
          categories.includes("lower_body");

        if (!hasUpperAndLower) {
          toast.error(
            'При выборе 2-х вещей одна должна быть "Верх", другая - "Низ"',
          );
          return;
        }
      }

      const balanceCheck = await checkReplicateBalance(
        user,
        selectedClothingItems.length,
      );
      if (!balanceCheck.canGenerate) {
        return;
      }

      const balanceDeducted = await deductReplicateBalance(
        user,
        selectedClothingItems.length,
      );
      if (!balanceDeducted) {
        return;
      }

      setIsGenerating(true);
      setGeneratedImage(null);
      onGeneratedImageChange?.(null);
      setGenerationStatus("Запускаем генерацию...");
      setHasTimedOut(false);

      toast.info(
        "Обычно генерация занимает 30-90 секунд. Не закрывайте страницу!",
        {
          duration: 8000,
        },
      );

      console.log(
        `[NanoBananaPro-CALL-${callId}] About to send fetch request...`,
      );
      const token = localStorage.getItem("session_token");

      if (!token) {
        throw new Error(
          "Нет токена авторизации. Пожалуйста, перезайдите в систему.",
        );
      }

      const response = await fetch(NANOBANANAPRO_START_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": token,
        },
        credentials: "include",
        body: JSON.stringify({
          person_image: uploadedImage,
          garments: selectedClothingItems.map((item) => ({
            image: item.image,
            category: item.category || "upper_body",
          })),
          custom_prompt: customPrompt,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ошибка запуска генерации");
      }

      const data = await response.json();
      setTaskId(data.task_id);
      setGenerationStatus(
        "В очереди... Обычно генерация занимает 30-90 секунд",
      );
      toast.success("Задача создана! Ожидайте результат...");

      const workerToken = localStorage.getItem("session_token");
      if (workerToken) {
        fetch(`${NANOBANANAPRO_WORKER_API}?task_id=${data.task_id}`, {
          headers: { "X-Session-Token": workerToken },
          credentials: "include",
        }).catch((err) => {
          console.log(
            "[NanoBananaPro] Worker trigger failed (non-critical):",
            err,
          );
        });
      }

      startPolling(data.task_id);
    } catch (error: unknown) {
      console.error("Generation error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Ошибка запуска генерации";
      toast.error(errorMessage);
      setIsGenerating(false);
      setGenerationStatus("");

      // Refund is now handled by backend worker automatically
      console.log("[NanoBananaPro] Backend will handle refund if needed");
    } finally {
      isNanoBananaRequestInProgress.current = false;
      console.log(`[NanoBananaPro-CALL-${callId}] Lock released`);
    }
  };

  const startPolling = (taskId: string) => {
    console.log("[NanoBananaPro] Starting polling for task:", taskId);
    let checkCount = 0;
    const startTime = Date.now();
    const TIMEOUT_MS = 360000;

    const interval = setInterval(async () => {
      try {
        checkCount++;
        const triggerWorker = true;

        const elapsedTime = Date.now() - startTime;
        if (elapsedTime > TIMEOUT_MS) {
          console.error("[NanoBananaPro] Timeout after 3 minutes");
          setHasTimedOut(true);
          setGenerationStatus("");
          toast.info(
            "Генерация занимает больше времени. Вы можете закрыть страницу — результат появится в Истории личного кабинета. Скорее всего нейросеть перегружена, результат может получиться чуть хуже. Лучше не запускать новые генерации сразу. Если изображение не будет сгенерировано — обратитесь в поддержку.",
            { duration: 10000 },
          );
          clearInterval(interval);
          setPollingInterval(null);

          console.log(
            "[NanoBananaPro] Timeout reached but worker continues processing",
          );
          return;
        }

        const token = localStorage.getItem("session_token");

        if (!token) {
          console.error(
            "[NanoBananaPro] КРИТИЧНО: Нет токена в localStorage при polling! Пропускаем запрос.",
          );
          return;
        }

        console.log("[NanoBananaPro] Polling request #" + checkCount);
        console.log("[NanoBananaPro] Full token from localStorage:", token);
        console.log(
          "[NanoBananaPro] Token first 20 chars:",
          token.substring(0, 20),
        );

        const response = await fetch(DB_QUERY_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Token": token,
          },
          credentials: "include",
          body: JSON.stringify({
            table: "nanobananapro_tasks",
            action: "select",
            where: { id: taskId },
            limit: 1,
          }),
        });

        if (!response.ok) {
          console.error(
            "[NanoBananaPro] Polling failed with status:",
            response.status,
          );
          throw new Error("Ошибка проверки статуса");
        }

        const dbResult = await response.json();
        const data =
          dbResult.success && dbResult.data && dbResult.data.length > 0
            ? dbResult.data[0]
            : null;

        if (!data) {
          console.error("[NanoBananaPro] Task not found in DB");
          return;
        }
        console.log("[NanoBananaPro] Status check result:", data);

        if (data.status === "processing" && triggerWorker) {
          console.log(
            "[NanoBananaPro] Triggering worker to check fal.ai status",
          );
          const workerToken = localStorage.getItem("session_token");
          if (workerToken) {
            fetch(`${NANOBANANAPRO_WORKER_API}?task_id=${taskId}`, {
              headers: { "X-Session-Token": workerToken },
              credentials: "include",
            }).catch((err) => {
              console.log(
                "[NanoBananaPro] Worker trigger failed (non-critical):",
                err,
              );
            });
          } else {
            console.warn("[NanoBananaPro] Нет токена для worker trigger");
          }
        }

        if (data.status === "pending") {
          setGenerationStatus("В очереди...");
        } else if (data.status === "processing") {
          setGenerationStatus("Обрабатывается...");
        } else if (data.status === "completed") {
          console.log(
            "[NanoBananaPro] COMPLETED! Result URL:",
            data.result_url,
          );

          setCdnImageUrl(data.result_url);
          onCdnImageUrlChange?.(data.result_url);

          let displayUrl = data.result_url;
          if (
            data.result_url.includes("fal.media") ||
            data.result_url.includes("fal.ai")
          ) {
            console.log("[NanoBananaPro] FAL URL detected, proxying...");
            displayUrl = await proxyFalImage(data.result_url);
          } else {
            console.log("[NanoBananaPro] CDN URL detected, using directly");
          }

          setGeneratedImage(displayUrl);
          onGeneratedImageChange?.(displayUrl);
          setIsGenerating(false);
          setGenerationStatus("");
          setHasTimedOut(false);
          clearInterval(interval);
          setPollingInterval(null);
          toast.success("Образ готов!");

          console.log("[NanoBananaPro] Worker already saved to S3 and history");
          await onRefetchHistory();
          await refreshBalance();
        } else if (data.status === "failed") {
          console.error("[NanoBananaPro] FAILED:", data.error_message);
          setIsGenerating(false);
          setGenerationStatus("");
          setHasTimedOut(false);
          toast.error(data.error_message || "Ошибка генерации");
          clearInterval(interval);
          setPollingInterval(null);

          // Refund is now handled by backend worker automatically
          console.log("[NanoBananaPro] Backend already handled refund");
        } else {
          console.log("[NanoBananaPro] Unknown status:", data.status);
        }
      } catch (error: unknown) {
        console.error("[NanoBananaPro] Polling error:", error);
      }
    }, 30000);

    setPollingInterval(interval);
  };

  const handleReset = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    setGeneratedImage(null);
    onGeneratedImageChange?.(null);
    setCdnImageUrl(null);
    onCdnImageUrlChange?.(null);
    setCustomPrompt("");
    setTaskId(null);
    setIsGenerating(false);
    setGenerationStatus("");
    setHasTimedOut(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">
              3. Настройте генерацию (опционально)
            </h3>

            <div>
              <Label htmlFor="custom-prompt">
                Дополнительные инструкции для AI
              </Label>
              <Textarea
                id="custom-prompt"
                placeholder="Например: добавь солнечные очки, измени цвет фона..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                disabled={isGenerating}
                className="mt-2"
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={
                isGenerating ||
                !uploadedImage ||
                selectedClothingItems.length === 0
              }
              className="w-full"
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
                  Сгенерировать образ
                </>
              )}
            </Button>

            {!user?.unlimited_access && !isGenerating && (
              <p className="text-sm text-muted-foreground text-center">
                Стоимость генерации: {GENERATION_COST}₽
              </p>
            )}

            {generationStatus && (
              <p className="text-sm text-muted-foreground text-center">
                {generationStatus}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {(generatedImage || hasTimedOut) && (
        <ReplicateResultPanel
          generatedImage={generatedImage}
          cdnImageUrl={cdnImageUrl}
          hasTimedOut={hasTimedOut}
          onReset={handleReset}
        />
      )}
    </div>
  );
}