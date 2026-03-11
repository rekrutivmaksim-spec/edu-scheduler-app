import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  checkReplicateBalance,
  deductReplicateBalance,
  refundReplicateBalance,
} from "@/utils/replicateBalanceUtils";
import { useBalance } from "@/context/BalanceContext";

const TEMPLATE_START_API =
  "https://functions.poehali.dev/c2354e87-992d-4b18-a4c4-96e628773da2";
const TEMPLATE_WORKER_API =
  "https://functions.poehali.dev/7f57bfff-f742-4a66-b506-c2acb4e2cdd3";
const DB_QUERY_API =
  "https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9";
const IMAGE_PROXY_API =
  "https://functions.poehali.dev/7f105c4b-f9e7-4df3-9f64-3d35895b8e90";

interface User {
  id: string;
  email: string;
}

const proxyFalImage = async (falUrl: string): Promise<string> => {
  try {
    if (!falUrl.includes("fal.media") && !falUrl.includes("fal.ai")) {
      return falUrl;
    }
    const response = await fetch(
      `${IMAGE_PROXY_API}?url=${encodeURIComponent(falUrl)}`
    );
    if (!response.ok) return falUrl;
    const data = await response.json();
    return data.data_url;
  } catch {
    return falUrl;
  }
};

export function useTemplateGeneration(
  user: User | null,
  onRefetchHistory: () => Promise<void>
) {
  const { refreshBalance } = useBalance();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [cdnImageUrl, setCdnImageUrl] = useState<string | null>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(
    null
  );
  const requestInProgress = useRef(false);

  const startPolling = useCallback(
    (taskId: string) => {
      let checkCount = 0;
      const startTime = Date.now();
      const TIMEOUT_MS = 360000;

      const interval = setInterval(async () => {
        try {
          checkCount++;
          const elapsed = Date.now() - startTime;

          if (elapsed > TIMEOUT_MS) {
            setHasTimedOut(true);
            setGenerationStatus("");
            toast.info(
              "Генерация занимает больше времени. Результат появится в Истории.",
              { duration: 10000 }
            );
            clearInterval(interval);
            setPollingInterval(null);
            return;
          }

          const token = localStorage.getItem("session_token");
          if (!token) return;

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

          if (!response.ok) return;

          const dbResult = await response.json();
          const data = dbResult.data?.[0];
          if (!data) return;

          if (
            (data.status === "processing" || data.status === "pending") &&
            checkCount % 2 === 0
          ) {
            const workerToken = localStorage.getItem("session_token");
            if (workerToken) {
              fetch(`${TEMPLATE_WORKER_API}?task_id=${taskId}`, {
                headers: { "X-Session-Token": workerToken },
                credentials: "include",
              }).catch(() => {});
            }
          }

          if (data.status === "pending") {
            setGenerationStatus("В очереди...");
          } else if (data.status === "processing") {
            setGenerationStatus("Обрабатывается...");
          } else if (data.status === "completed") {
            setCdnImageUrl(data.result_url);

            let displayUrl = data.result_url;
            if (
              data.result_url?.includes("fal.media") ||
              data.result_url?.includes("fal.ai")
            ) {
              displayUrl = await proxyFalImage(data.result_url);
            }

            setGeneratedImage(displayUrl);
            setIsGenerating(false);
            setGenerationStatus("");
            setHasTimedOut(false);
            clearInterval(interval);
            setPollingInterval(null);
            toast.success("Готово!");

            await refreshBalance();
            await onRefetchHistory();
          } else if (data.status === "failed") {
            setIsGenerating(false);
            setGenerationStatus("");
            setHasTimedOut(false);
            toast.error(data.error_message || "Ошибка генерации");
            clearInterval(interval);
            setPollingInterval(null);
            await refreshBalance();
          }
        } catch (error) {
          console.error("[TemplateGen] Polling error:", error);
        }
      }, 30000);

      setPollingInterval(interval);
    },
    [onRefetchHistory, refreshBalance]
  );

  const generate = useCallback(
    async (payload: Record<string, unknown>) => {
      if (requestInProgress.current) return;
      requestInProgress.current = true;

      try {
        if (!user) {
          toast.error("Требуется авторизация");
          return;
        }

        const balanceCheck = await checkReplicateBalance(user, 1);
        if (!balanceCheck.canGenerate) return;

        const balanceDeducted = await deductReplicateBalance(user, 1);
        if (!balanceDeducted) return;

        setIsGenerating(true);
        setGeneratedImage(null);
        setCdnImageUrl(null);
        setGenerationStatus("Запускаем генерацию...");
        setHasTimedOut(false);

        toast.info("Генерация занимает 30-90 секунд. Не закрывайте страницу!", {
          duration: 8000,
        });

        const token = localStorage.getItem("session_token");
        if (!token) {
          throw new Error("Нет токена авторизации");
        }

        const response = await fetch(TEMPLATE_START_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Token": token,
          },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Ошибка запуска генерации");
        }

        const data = await response.json();
        setGenerationStatus(
          "В очереди... Обычно генерация занимает 30-90 секунд"
        );
        toast.success("Задача создана! Ожидайте результат...");

        const workerToken = localStorage.getItem("session_token");
        if (workerToken) {
          fetch(`${TEMPLATE_WORKER_API}?task_id=${data.task_id}`, {
            headers: { "X-Session-Token": workerToken },
            credentials: "include",
          }).catch(() => {});
        }

        startPolling(data.task_id);
      } catch (error: unknown) {
        const msg =
          error instanceof Error ? error.message : "Ошибка генерации";
        toast.error(msg);
        setIsGenerating(false);
        setGenerationStatus("");

        if (user) {
          await refundReplicateBalance(user, 1);
        }
      } finally {
        requestInProgress.current = false;
      }
    },
    [user, startPolling]
  );

  const reset = useCallback(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    setGeneratedImage(null);
    setCdnImageUrl(null);
    setIsGenerating(false);
    setGenerationStatus("");
    setHasTimedOut(false);
  }, [pollingInterval]);

  return {
    isGenerating,
    generationStatus,
    generatedImage,
    cdnImageUrl,
    hasTimedOut,
    generate,
    reset,
  };
}