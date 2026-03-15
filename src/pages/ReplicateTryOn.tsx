import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Icon from "@/components/ui/icon";
import { Link } from "react-router-dom";
import ReplicateImageUpload from "@/components/replicate/ReplicateImageUpload";
import ReplicateClothingSelector from "@/components/replicate/ReplicateClothingSelector";
import ReplicateResultPanel from "@/components/replicate/ReplicateResultPanel";
import ReplicateSaveDialog from "@/components/replicate/ReplicateSaveDialog";
import TemplateModeTabs, {
  type TemplateMode,
} from "@/components/replicate/TemplateModeTabs";
import CapsuleTemplate from "@/components/replicate/templates/CapsuleTemplate";
import LookbookGridTemplate from "@/components/replicate/templates/LookbookGridTemplate";
import ImageCropper from "@/components/ImageCropper";
import {
  checkReplicateBalance,
  deductReplicateBalance,
  refundReplicateBalance,
} from "@/utils/replicateBalanceUtils";
import { validateImageFile } from "@/utils/fileValidation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useCatalogFilters, useCatalog } from "@/hooks/useCatalog";
import { useBalance } from "@/context/BalanceContext";
import { GENERATION_COST, MIN_TOPUP } from "@/config/prices";

interface ClothingItem {
  id: string;
  image_url: string;
  name: string;
  description: string;
  categories: string[];
  colors: string[];
  archetypes: string[];
  replicate_category?: string;
}

interface FilterOption {
  id: number | string;
  name: string;
}

interface Filters {
  categories: FilterOption[];
  colors: FilterOption[];
  archetypes: FilterOption[];
  genders: FilterOption[];
}

interface SelectedClothing {
  id: string;
  image: string;
  name?: string;
  category?: string;
  isFromCatalog?: boolean;
}

const CATALOG_API =
  "https://functions.poehali.dev/e65f7df8-0a43-4921-8dbd-3dc0587255cc";
const NANOBANANAPRO_START_API =
  "https://functions.poehali.dev/aac1d5d8-c9bd-43c6-822e-857c18f3c1f8";
const NANOBANANAPRO_STATUS_API =
  "https://functions.poehali.dev/6d603f3d-bbe3-450d-863a-63d513ad5ba7";
const NANOBANANAPRO_WORKER_API =
  "https://functions.poehali.dev/1f4c772e-0425-4fe4-98a6-baa3979ba94d";
const DB_QUERY_API =
  "https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9";
const IMAGE_PROXY_API =
  "https://functions.poehali.dev/7f105c4b-f9e7-4df3-9f64-3d35895b8e90";
const SAVE_IMAGE_FTP_API =
  "https://functions.poehali.dev/56814ab9-6cba-4035-a63d-423ac0d301c8";

const proxyFalImage = async (falUrl: string): Promise<string> => {
  try {
    if (!falUrl.includes("fal.media") && !falUrl.includes("fal.ai")) {
      return falUrl;
    }

    const response = await fetch(
      `${IMAGE_PROXY_API}?url=${encodeURIComponent(falUrl)}`,
    );

    if (!response.ok) {
      return falUrl;
    }

    const data = await response.json();
    return data.data_url;
  } catch {
    return falUrl;
  }
};

export default function ReplicateTryOn() {
  const { user } = useAuth();
  const { lookbooks, refetchLookbooks, refetchHistory } = useData();
  const { balanceInfo } = useBalance();

  const hasInsufficientBalance =
    user && !balanceInfo?.unlimited_access && !balanceInfo?.can_generate;

  const [activeMode, setActiveMode] = useState<TemplateMode>("standard");

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedClothingItems, setSelectedClothingItems] = useState<
    SelectedClothing[]
  >([]);

  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [cdnImageUrl, setCdnImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newLookbookName, setNewLookbookName] = useState("");
  const [newLookbookPersonName, setNewLookbookPersonName] = useState("");
  const [selectedLookbookId, setSelectedLookbookId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedColors, setSelectedColors] = useState<number[]>([]);
  const [selectedArchetypes, setSelectedArchetypes] = useState<number[]>([]);
  const [selectedGender, setSelectedGender] = useState<string>("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [generationStatus, setGenerationStatus] = useState<string>("");
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [tempImageForCrop, setTempImageForCrop] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [showCategoryError, setShowCategoryError] = useState(false);
  const isNanoBananaRequestInProgress = useRef(false);

  const { data: filters } = useCatalogFilters([
    "Обувь",
    "Аксессуары",
    "Головные уборы",
  ]);
  const { data: clothingCatalog } = useCatalog({
    categoryIds:
      selectedCategories?.length > 0 ? selectedCategories : undefined,
    colorIds: selectedColors?.length > 0 ? selectedColors : undefined,
    archetypeIds:
      selectedArchetypes?.length > 0 ? selectedArchetypes : undefined,
    gender: selectedGender || undefined,
    includeReplicateCategories: ["upper_body", "lower_body", "dresses"],
  });

  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const resizeImage = (
    file: File,
    maxWidth: number,
    maxHeight: number,
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.9));
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.isValid) {
      toast.error(validation.error || "Неверный файл");
      e.target.value = "";
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const aspectRatio = img.width / img.height;
          const targetRatio = 3 / 4;
          const tolerance = 0.05;

          const isCorrectAspectRatio =
            Math.abs(aspectRatio - targetRatio) < tolerance;

          if (isCorrectAspectRatio) {
            resizeImage(file, 1024, 1024)
              .then((resized) => {
                setUploadedImage(resized);
                toast.success("Фото загружено");
              })
              .catch((error) => {
                console.error("Image resize error:", error);
                toast.error("Ошибка обработки изображения");
              });
          } else {
            setTempImageForCrop(event.target?.result as string);
            setShowCropper(true);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Ошибка загрузки изображения");
    }
  };

  const handleCropComplete = async (croppedImage: string) => {
    try {
      setUploadedImage(croppedImage);
      setShowCropper(false);
      setTempImageForCrop(null);
      toast.success("Фото обрезано и загружено");
    } catch {
      toast.error("Ошибка обработки обрезанного изображения");
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setTempImageForCrop(null);
  };

  const handleCustomClothingUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const invalidFiles: string[] = [];
    Array.from(files).forEach((file) => {
      const validation = validateImageFile(file);
      if (!validation.isValid) {
        invalidFiles.push(`${file.name}: ${validation.error}`);
      }
    });

    if (invalidFiles.length > 0) {
      toast.error(invalidFiles[0]);
      e.target.value = "";
      return;
    }

    if (
      selectedClothingItems?.length >= 1 &&
      selectedClothingItems?.[0]?.category === "dresses"
    ) {
      toast.error(
        "Уже выбран полный образ. Удалите его, если хотите загрузить другую вещь",
      );
      e.target.value = "";
      return;
    }

    const remainingSlots = 2 - (selectedClothingItems?.length || 0);
    if (remainingSlots <= 0) {
      toast.error("Максимум 2 вещи можно выбрать");
      e.target.value = "";
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      toast.warning(`Можно добавить только ${remainingSlots} вещь(и)`);
    }

    try {
      const resizedImages = await Promise.all(
        filesToProcess.map(async (file) => {
          const resized = await resizeImage(file, 1024, 1024);
          return {
            id: `custom-${Date.now()}-${Math.random()}`,
            image: resized,
            name: file.name,
            category: "",
            isFromCatalog: false,
          };
        }),
      );

      setSelectedClothingItems((prev) => [...prev, ...resizedImages]);
    } catch {
      toast.error("Ошибка обработки изображений");
    }

    e.target.value = "";
  };

  const mapCategoryFromCatalog = (item: ClothingItem): string => {
    if (item.replicate_category) {
      return item.replicate_category;
    }

    const firstCategory = item.categories?.[0]?.toLowerCase() || "";

    if (firstCategory.includes("платье") || firstCategory.includes("сарафан")) {
      return "dresses";
    }
    if (
      firstCategory.includes("брюк") ||
      firstCategory.includes("джинс") ||
      firstCategory.includes("шорт") ||
      firstCategory.includes("юбк")
    ) {
      return "lower_body";
    }
    return "upper_body";
  };

  const toggleClothingSelection = (item: ClothingItem) => {
    const exists = selectedClothingItems?.find((i) => i.id === item.id);
    if (exists) {
      setSelectedClothingItems(
        (prev) => prev?.filter((i) => i.id !== item.id) || [],
      );
    } else {
      if (
        selectedClothingItems?.length >= 1 &&
        selectedClothingItems?.[0]?.category === "dresses"
      ) {
        toast.error(
          "Уже выбран полный образ. Удалите его, если хотите выбрать другую вещь",
        );
        return;
      }

      if ((selectedClothingItems?.length || 0) >= 2) {
        toast.error("Максимум 2 вещи можно выбрать");
        return;
      }

      const newCategory = mapCategoryFromCatalog(item);
      if (
        newCategory === "dresses" &&
        (selectedClothingItems?.length || 0) > 0
      ) {
        toast.error(
          "Полный образ нельзя комбинировать с другими вещами. Удалите уже выбранные вещи",
        );
        return;
      }

      setSelectedClothingItems((prev) => [
        ...prev,
        {
          id: item.id,
          image: item.image_url,
          name: item.name,
          category: newCategory,
          isFromCatalog: true,
        },
      ]);
    }
  };

  const removeClothingItem = (id: string) => {
    setSelectedClothingItems(
      (prev) => prev?.filter((item) => item.id !== id) || [],
    );
  };

  const updateClothingCategory = (id: string, category: string) => {
    setSelectedClothingItems(
      (prev) =>
        prev?.map((item) => (item.id === id ? { ...item, category } : item)) ||
        [],
    );
  };

  const handleGenerate = async () => {
    if (isNanoBananaRequestInProgress.current) {
      return;
    }

    isNanoBananaRequestInProgress.current = true;

    try {
      if (!uploadedImage) {
        toast.error("Загрузите фото модели");
        return;
      }

      if ((selectedClothingItems?.length || 0) === 0) {
        toast.error("Выберите хотя бы одну вещь");
        return;
      }

      if ((selectedClothingItems?.length || 0) > 2) {
        toast.error("Максимум 2 вещи можно выбрать");
        return;
      }

      if (!user) {
        toast.error("Требуется авторизация");
        return;
      }

      const itemsWithoutCategory =
        selectedClothingItems?.filter((item) => !item.category) || [];
      if (itemsWithoutCategory.length > 0) {
        setShowCategoryError(true);
        toast.error("Укажите категорию для всех выбранных вещей");
        return;
      }
      setShowCategoryError(false);

      if (selectedClothingItems?.length === 2) {
        const categories =
          selectedClothingItems?.map((item) => item.category) || [];
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
        selectedClothingItems?.length || 0,
      );
      if (!balanceCheck.canGenerate) {
        return;
      }

      const balanceDeducted = await deductReplicateBalance(
        user,
        selectedClothingItems?.length || 0,
      );
      if (!balanceDeducted) {
        return;
      }

      setIsGenerating(true);
      setGeneratedImage(null);
      setGenerationStatus("Запускаем генерацию...");
      setHasTimedOut(false);

      toast.info(
        "Обычно генерация занимает 30-90 секунд. Не закрывайте страницу!",
        {
          duration: 8000,
        },
      );

      const token = localStorage.getItem("session_token");

      if (!token) {
        throw new Error(
          "Нет токена авторизации. Пожалуйста, перезайдите в систему.",
        );
      }

      console.log(
        "[NanoBananaPro-START] Token first 20 chars:",
        token.substring(0, 20),
      );

      const response = await fetch(NANOBANANAPRO_START_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": token,
        },
        credentials: "include",
        body: JSON.stringify({
          person_image: uploadedImage,
          garments:
            selectedClothingItems?.map((item) => ({
              image: item.image,
              category: item.category || "upper_body",
            })) || [],
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
      toast.error(error.message || "Ошибка запуска генерации");
      setIsGenerating(false);
      setGenerationStatus("");

      if (user) {
        await refundReplicateBalance(user, selectedClothingItems?.length || 0);
        console.log("[NanoBananaPro] Balance refunded due to start error");
      }
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

        if (
          (data.status === "processing" || data.status === "pending") &&
          triggerWorker
        ) {
          console.log(
            "[NanoBananaPro] Triggering worker to check/advance task",
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
          setIsGenerating(false);
          setGenerationStatus("");
          setHasTimedOut(false);
          clearInterval(interval);
          setPollingInterval(null);
          toast.success("Образ готов!");

          console.log("[NanoBananaPro] Worker already saved to S3 and history");
          await refetchHistory();
        } else if (data.status === "failed") {
          console.error("[NanoBananaPro] FAILED:", data.error_message);
          setIsGenerating(false);
          setGenerationStatus("");
          setHasTimedOut(false);
          toast.error(data.error_message || "Ошибка генерации");
          clearInterval(interval);
          setPollingInterval(null);
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
    setUploadedImage(null);
    setSelectedClothingItems([]);
    setGeneratedImage(null);
    setCdnImageUrl(null);
    setCustomPrompt("");
    setTaskId(null);
    setIsGenerating(false);
    setGenerationStatus("");
    setHasTimedOut(false);
  };

  const handleSaveToExistingLookbook = async () => {
    if (!selectedLookbookId || !user) return;

    if (!cdnImageUrl) {
      toast.error("Изображение ещё сохраняется, подождите...");
      return;
    }

    setIsSaving(true);
    try {
      const lookbook = lookbooks?.find((lb) => lb.id === selectedLookbookId);
      const updatedPhotos = [...(lookbook?.photos || []), cdnImageUrl];

      const response = await fetch(DB_QUERY_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
    } catch (error) {
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
        headers: {
          "Content-Type": "application/json",
        },
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
    } catch (error) {
      toast.error("Ошибка создания лукбука");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!generatedImage) return;

    try {
      let blob: Blob;

      if (generatedImage.startsWith("data:")) {
        const response = await fetch(generatedImage);
        blob = await response.blob();
      } else {
        console.log("[Download] Using image proxy for Yandex Cloud URL");
        const proxyResponse = await fetch(
          `${IMAGE_PROXY_API}?url=${encodeURIComponent(generatedImage)}`,
        );

        if (!proxyResponse.ok) {
          throw new Error("Failed to proxy image for download");
        }

        const proxyData = await proxyResponse.json();
        const dataUrl = proxyData.data_url;

        const response = await fetch(dataUrl);
        blob = await response.blob();
      }

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `fitting-room-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

      toast.success("Изображение скачано!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Ошибка скачивания. Попробуйте ещё раз");
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Онлайн примерочная
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
              Примерьте одежду онлайн с помощью AI
            </p>

            <TemplateModeTabs
              activeMode={activeMode}
              onModeChange={setActiveMode}
              disabled={isGenerating}
            />
          </div>

          {activeMode === "standard" && (<>
          <div className="grid lg:grid-cols-2 gap-8 mb-12">
            <Card className="animate-scale-in">
              <CardContent className="p-8">
                {!user && (
                  <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
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
                          Для генерации изображений необходимо войти в аккаунт и
                          пополнить баланс минимум на {MIN_TOPUP} рублей.
                        </p>
                        <div className="flex gap-2">
                          <Link to="/login">
                            <Button size="sm" variant="default">
                              Войти
                            </Button>
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
                  <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Icon
                        name="Wallet"
                        className="text-orange-600 mt-0.5 flex-shrink-0"
                        size={20}
                      />
                      <div>
                        <p className="text-sm font-medium text-orange-700 mb-1">
                          Недостаточно средств
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          Пополните баланс для генерации. Стоимость: {GENERATION_COST}₽
                        </p>
                        <Link to="/profile/wallet">
                          <Button size="sm" variant="default">
                            Пополнить баланс
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <ReplicateImageUpload
                    uploadedImage={uploadedImage}
                    handleImageUpload={handleImageUpload}
                    isGenerating={isGenerating}
                  />

                  <ReplicateClothingSelector
                    selectedClothingItems={selectedClothingItems}
                    clothingCatalog={clothingCatalog}
                    filters={filters}
                    selectedCategories={selectedCategories}
                    selectedColors={selectedColors}
                    selectedArchetypes={selectedArchetypes}
                    selectedGender={selectedGender}
                    setSelectedCategories={setSelectedCategories}
                    setSelectedColors={setSelectedColors}
                    setSelectedArchetypes={setSelectedArchetypes}
                    setSelectedGender={setSelectedGender}
                    toggleClothingSelection={toggleClothingSelection}
                    removeClothingItem={removeClothingItem}
                    updateClothingCategory={updateClothingCategory}
                    handleCustomClothingUpload={handleCustomClothingUpload}
                    isGenerating={isGenerating}
                    showCategoryError={showCategoryError}
                  />

                  <div className="space-y-2">
                    <Label htmlFor="custom-prompt">
                      Дополнительные пожелания (опционально)
                    </Label>
                    <Textarea
                      id="custom-prompt"
                      placeholder="Например: студийное освещение или на фоне природы или на фоне городского пейзажа, цвет волос: (описание), прическа: (описание), обувь: (описание), аксессуары: (описание)"
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      maxLength={300}
                      rows={3}
                      disabled={isGenerating}
                      className="resize-none"
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div>
                        <Icon
                          name="AlertCircle"
                          className="inline mr-1"
                          size={12}
                        />
                        Если промпт будет слишком большой, есть вероятность, что
                        нейросеть не сгенерирует фото
                      </div>
                      <div
                        className={
                          customPrompt.length > 250 ? "text-orange-500" : ""
                        }
                      >
                        {customPrompt.length} / 300
                      </div>
                    </div>
                  </div>

                  {generationStatus && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Icon
                          name="Loader2"
                          className="animate-spin text-blue-600"
                          size={20}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-900">
                            {generationStatus}
                          </p>
                          <p className="text-xs text-blue-700 mt-1">
                            Не закрывайте страницу до завершения генерации
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleGenerate}
                    disabled={
                      !uploadedImage ||
                      (selectedClothingItems?.length || 0) === 0 ||
                      isGenerating ||
                      !user ||
                      !!hasInsufficientBalance
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
                        Создать образ
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

          <div className="max-w-5xl mx-auto mt-16 mb-12">
            <h2 className="text-3xl font-bold text-center mb-12">
              Как пользоваться примерочной
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                  <Icon name="Upload" className="text-purple-600" size={32} />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  1. Загрузите фото человека
                </h3>
                <p className="text-muted-foreground">
                  На которого хотите примерить одежду в полный рост
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                  <Icon name="Shirt" className="text-purple-600" size={32} />
                </div>
                <h3 className="text-xl font-semibold mb-2">2. Выберите вещи</h3>
                <p className="text-muted-foreground">
                  Выберите 1-2 вещи из каталога или загрузите свои фото
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                  <Icon name="Sparkles" className="text-purple-600" size={32} />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  3. Получите результат
                </h3>
                <p className="text-muted-foreground">
                  AI создаст реалистичное изображение с учётом ваших пожеланий
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-3xl mx-auto mt-16 mb-12">
            <h2 className="text-3xl font-bold text-center mb-8">
              Часто задаваемые вопросы
            </h2>
            <Card>
              <CardContent className="p-6">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1">
                    <AccordionTrigger>
                      Какие требования к фотографии?
                    </AccordionTrigger>
                    <AccordionContent>
                      Лучше всего использовать фотографии в полный рост с
                      хорошим освещением. Человек должен быть хорошо виден, без
                      сильных искажений. Рекомендуем вертикальный формат фото
                      (высота больше ширины).
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-2">
                    <AccordionTrigger>
                      Сколько вещей можно примерить одновременно?
                    </AccordionTrigger>
                    <AccordionContent>
                      Вы можете выбрать одну вещь любой категории (топы,
                      рубашки, жакеты, брюки, юбки, платья) или две вещи разных
                      категорий: одну для верха (топы, рубашки, жакеты) и одну
                      для низа (брюки, юбки, шорты).
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-3">
                    <AccordionTrigger>
                      Как работает технология?
                    </AccordionTrigger>
                    <AccordionContent>
                      Мы используем AI модель NanoBanana, которая анализирует
                      фото человека и одежды, затем создаёт реалистичное
                      изображение с учётом позы, освещения и формы тела. Вы
                      можете добавлять промпты для изменения фона и стиля.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-4">
                    <AccordionTrigger>
                      Можно ли использовать свою одежду?
                    </AccordionTrigger>
                    <AccordionContent>
                      Да! Вы можете загрузить фото своей одежды через кнопку
                      "Загрузить свою вещь". Лучше всего использовать фото на
                      белом фоне или на модели.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-5">
                    <AccordionTrigger>
                      Что делать, если результат неточный?
                    </AccordionTrigger>
                    <AccordionContent>
                      Попробуйте использовать другое фото модели или одежды.
                      Лучшие результаты получаются на фото с хорошим освещением,
                      где человек стоит прямо и хорошо видна вся фигура.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-6">
                    <AccordionTrigger>
                      Сколько времени занимает генерация?
                    </AccordionTrigger>
                    <AccordionContent>
                      Генерация занимает примерно 30 секунд независимо от
                      количества вещей. Время может увеличиться в зависимости от
                      нагрузки на серверы.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-8 pb-4">
            <p className="text-xs text-muted-foreground" style={{ display: 'none' }}>
              Powered by NanoBananaPro
            </p>
          </div>
          </>)}

          {activeMode === "capsule" && (
            <CapsuleTemplate
              user={user}
              hasInsufficientBalance={!!hasInsufficientBalance}
              onRefetchHistory={refetchHistory}
            />
          )}

          {activeMode === "lookbook_grid" && (
            <LookbookGridTemplate
              user={user}
              hasInsufficientBalance={!!hasInsufficientBalance}
              onRefetchHistory={refetchHistory}
            />
          )}
        </div>
      </div>

      <ReplicateSaveDialog
        showSaveDialog={showSaveDialog}
        setShowSaveDialog={setShowSaveDialog}
        lookbooks={lookbooks}
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
          onClose={handleCropCancel}
          onCropComplete={handleCropComplete}
          aspectRatio={3 / 4}
        />
      )}
    </Layout>
  );
}