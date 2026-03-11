import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import ImageCropper from "@/components/ImageCropper";
import EyeColorSelector from "@/components/EyeColorSelector";
import { validateImageFile } from "@/utils/fileValidation";
import { useAuth } from "@/context/AuthContext";
import { COLORTYPE_COST, MIN_TOPUP } from "@/config/prices";
import { useData } from "@/context/DataContext";
import { useBalance } from "@/context/BalanceContext";
import { useNavigate, Link } from "react-router-dom";
import { colorTypeRules, ColorTypeName } from "@/data/colorTypeRules";
import { seasonalPalettes } from "@/data/seasonalPalettes";

const COLORTYPE_START_API =
  "https://functions.poehali.dev/f5ab39bd-a682-44d8-ac47-d7b9d035013b";
const COLORTYPE_STATUS_API =
  "https://functions.poehali.dev/7f1395ac-bddc-45ec-b997-b39497110680";

const COST = COLORTYPE_COST;
const POLLING_INTERVAL = 20000; // 20 seconds
const TIMEOUT_DURATION = 180000; // 3 minutes

// Eye colors mapping (Russian → English) - grouped by similarity, light → bright → dark
const eyeColors: Record<string, string> = {
  // Голубые (светлые → яркие → тёмные)
  "Голубые (светлые)": "light blue",
  "Голубые (мягкие)": "soft blue",
  Голубые: "blue",
  "Голубые (тёплые)": "warm blue",
  "Голубые (яркие)": "bright blue",
  "Голубые (холодные)": "cool blue",
  "Голубые (бирюзово-голубые)": "cyan",

  // Бирюзовые / Лазурные
  Бирюзовые: "turquoise",
  "Бирюзовые голубые": "turquoise blue",
  "Лазурные (светлые)": "light turquoise",
  Лазурные: "azure",

  // Серо-голубые / Сине-серые
  "Серо-голубые (мягкие)": "soft gray-blue",
  "Серо-голубые": "gray-blue",
  "Серо-голубые (яркие)": "bright gray-blue",
  "Сине-серые": "blue-gray",

  // Серые (светлые → тёмные)
  "Серые (светлые)": "light grey",
  "Серые (мягкие)": "soft gray",
  Серые: "gray",
  "Серые (тёмные)": "dark grey",

  // Зелёные (светлые → яркие → тёмные)
  "Зелёные (светлые)": "light green",
  Зелёные: "green",
  "Зелёные (тёплые)": "warm green",
  "Зелёные (яркие)": "bright green",
  "Зелёные (изумрудные)": "emerald green",
  "Зелёные (тёмные)": "dark green",
  Нефритовые: "jade",

  // Сине-зелёные
  "Сине-зелёные (светлые)": "light blue-green",
  "Сине-зелёные": "blue-green",
  "Сине-зелёные (яркие)": "bright blue-green",

  // Серо-зелёные / Оливковые
  "Серо-зелёные (мягкие)": "soft gray-green",
  "Серо-зелёные": "gray-green",
  "Оливково-зелёные": "olive green",
  "Оливковые (тёмные)": "dark olive",

  // Карие (светлые → тёмные)
  "Карие (светлые)": "light brown",
  Карие: "brown",
  "Карие (яркие)": "bright brown",
  "Карие (холодные)": "cool brown",
  "Карие (тёмные)": "dark brown",

  // Ореховые (светлые → тёмные)
  "Ореховые (ледяные)": "icy hazel",
  "Ореховые (светлые)": "light hazel",
  "Ореховые (золотистые)": "hazel",
  "Ореховые (тёмные)": "dark hazel",

  // Серо-карие / Коричнево-зелёные
  "Серо-карие (светлые)": "light grey brown",
  "Коричнево-зелёные": "brown-green",
  "Коричнево-зелёные (яркие)": "bright brown-green",

  // Золотистые / Янтарные / Топазовые
  Золотистые: "golden",
  "Золотисто-карие": "golden brown",
  Янтарные: "amber",
  Топазовые: "topaz",

  // Шоколадные / Какао
  Шоколадные: "chocolate",
  "Цвета какао": "cocoa",

  // Тёмные / Чёрные
  "Коричнево-чёрные": "brown-black",
  "Чёрно-карие": "black-brown",
  Чёрные: "black",

  // Другие
  Приглушённые: "muted",
  Холодные: "cool",
  Тёмные: "dark",
};

// Mapping English color types to Russian
const colorTypeNames: Record<string, string> = {
  "SOFT WINTER": "Мягкая Зима",
  "BRIGHT WINTER": "Яркая Зима",
  "VIVID WINTER": "Тёмная Зима",
  "SOFT SUMMER": "Светлое Лето",
  "DUSTY SUMMER": "Мягкое (Пыльное) Лето",
  "VIVID SUMMER": "Яркое Лето",
  "GENTLE AUTUMN": "Нежная Осень",
  "FIERY AUTUMN": "Огненная Осень",
  "VIVID AUTUMN": "Тёмная Осень",
  "GENTLE SPRING": "Нежная Весна",
  "BRIGHT SPRING": "Тёплая Весна",
  "VIBRANT SPRING": "Яркая Весна",
};

const colorTypeToEnum: Record<string, ColorTypeName> = {
  "Мягкая Зима": "SOFT_WINTER",
  "Яркая Зима": "BRIGHT_WINTER",
  "Тёмная Зима": "VIVID_WINTER",
  "Светлое Лето": "SOFT_SUMMER",
  "Мягкое (Пыльное) Лето": "DUSTY_SUMMER",
  "Яркое Лето": "VIVID_SUMMER",
  "Нежная Осень": "GENTLE_AUTUMN",
  "Огненная Осень": "FIERY_AUTUMN",
  "Тёмная Осень": "VIVID_AUTUMN",
  "Нежная Весна": "GENTLE_SPRING",
  "Тёплая Весна": "BRIGHT_SPRING",
  "Яркая Весна": "VIBRANT_SPRING",
};

export default function ColorType() {
  const { user } = useAuth();
  const { refetchColorTypeHistory } = useData();
  const { refreshBalance, balanceInfo } = useBalance();
  const navigate = useNavigate();

  const hasInsufficientBalance = user && !balanceInfo?.unlimited_access && !balanceInfo?.can_generate;

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [tempImageForCrop, setTempImageForCrop] = useState<string | null>(null);
  const [eyeColor, setEyeColor] = useState<string>("");

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  const [result, setResult] = useState<{
    colorType: string;
    colorTypeAi: string | null;
    description: string;
  } | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const resizeImage = (
    base64Str: string,
    maxWidth: number,
    maxHeight: number,
  ): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;
          if (width > height) {
            width = maxWidth;
            height = width / aspectRatio;
          } else {
            height = maxHeight;
            width = height * aspectRatio;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.src = base64Str;
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

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result as string;
      const resized = await resizeImage(base64Image, 1024, 1024);

      // Check aspect ratio and trigger cropper if needed
      const img = new Image();
      img.onload = () => {
        const aspectRatio = img.width / img.height;
        const targetAspectRatio = 3 / 4;
        const tolerance = 0.05;

        if (Math.abs(aspectRatio - targetAspectRatio) > tolerance) {
          setTempImageForCrop(resized);
          setShowCropper(true);
        } else {
          setUploadedImage(resized);
        }
      };
      img.src = resized;
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedImage: string) => {
    setShowCropper(false);
    setTempImageForCrop(null);
    const resized = await resizeImage(croppedImage, 1024, 1024);
    setUploadedImage(resized);
  };

  const pollTaskStatus = async (id: string) => {
    try {
      const response = await fetch(
        `${COLORTYPE_STATUS_API}?task_id=${id}&force_check=true`,
      );
      const data = await response.json();

      console.log("[ColorType] Poll status:", data);

      if (data.status === "completed") {
        if (pollingIntervalRef.current)
          clearInterval(pollingIntervalRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        // Check if GPT couldn't determine color type (bad photo)
        if (!data.color_type) {
          setIsAnalyzing(false);
          setAnalysisStatus("");
          toast.error(
            "Не удалось определить цветотип по этому фото. Попробуйте другое фото с хорошим освещением и чёткими чертами лица. Деньги не возвращаются, т.к. анализ был выполнен.",
          );
          return;
        }

        const colorTypeName =
          colorTypeNames[data.color_type] || data.color_type;
        const colorTypeAiName = data.color_type_ai
          ? colorTypeNames[data.color_type_ai] || data.color_type_ai
          : null;

        setResult({
          colorType: colorTypeName,
          colorTypeAi: colorTypeAiName,
          description: data.result_text || "",
        });
        setIsAnalyzing(false);
        setAnalysisStatus("");
        toast.success("Цветотип определён!");
        refetchColorTypeHistory();
        refreshBalance();
      } else if (data.status === "failed") {
        if (pollingIntervalRef.current)
          clearInterval(pollingIntervalRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        setIsAnalyzing(false);
        setAnalysisStatus("");
        toast.error(
          data.result_text || "Ошибка анализа. Деньги возвращены на баланс.",
        );
      } else if (data.status === "processing") {
        setAnalysisStatus("Анализ изображения на нейросети...");
      } else if (data.status === "pending") {
        setAnalysisStatus("Подготовка к анализу...");
      }
    } catch (error) {
      console.error("[ColorType] Polling error:", error);
    }
  };

  const handleAnalyze = async () => {
    if (!user) {
      toast.error("Войдите в аккаунт");
      navigate("/login");
      return;
    }

    const imageToAnalyze = uploadedImage;
    if (!imageToAnalyze) {
      toast.error("Загрузите портретное фото");
      return;
    }

    if (!eyeColor) {
      toast.error("Выберите цвет глаз");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStatus("Запуск анализа...");
    setHasTimedOut(false);
    setResult(null);

    try {
      const response = await fetch(COLORTYPE_START_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify({
          person_image: imageToAnalyze,
          eye_color: eyeColor,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 402) {
          toast.error(`Недостаточно средств. Требуется ${COST} руб`);
          navigate("/profile/wallet");
          return;
        }
        throw new Error(data.error || "Failed to start analysis");
      }

      const newTaskId = data.task_id;
      setTaskId(newTaskId);
      setAnalysisStatus("Обработка начата...");

      // Start polling
      pollingIntervalRef.current = setInterval(() => {
        pollTaskStatus(newTaskId);
      }, POLLING_INTERVAL);

      // Set timeout
      timeoutRef.current = setTimeout(() => {
        if (pollingIntervalRef.current)
          clearInterval(pollingIntervalRef.current);
        setHasTimedOut(true);
        setIsAnalyzing(false);
        setAnalysisStatus("");
        toast.error(
          "Не удалось получить результат анализа. Попробуйте повторить запрос с другим фото. Если фото отвечает критериям, но результат не получен, обратитесь в техподдержку.",
          { duration: 10000 },
        );
      }, TIMEOUT_DURATION);
    } catch (error) {
      setIsAnalyzing(false);
      setAnalysisStatus("");
      toast.error(
        error instanceof Error ? error.message : "Ошибка запуска анализа",
      );
    }
  };

  return (
    <Layout>
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-5xl md:text-6xl font-light mb-4">
              Определение цветотипа
            </h2>
            <p className="text-muted-foreground text-lg">
              Узнайте свой цветотип внешности с помощью AI
            </p>
          </div>

          {/* Recommendations */}
          <div className="max-w-3xl mx-auto mb-12">
            <Card className="bg-muted/50 border-primary/20">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Icon
                      name="Info"
                      className="text-primary mt-0.5 flex-shrink-0"
                      size={20}
                    />
                    <div className="space-y-2 text-sm">
                      <p className="font-medium">
                        Рекомендации для точного результата:
                      </p>
                      <ul className="space-y-1.5 text-muted-foreground">
                        <li>• Хорошее качество фото при дневном освещении</li>
                        <li>• Естественный цвет волос (без окрашивания)</li>
                        <li>• Без макияжа или с минимальным макияжем</li>
                        <li>• Волосы и глаза хорошо видны</li>
                        <li>• На фото не применены фильтры</li>
                      </ul>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 pt-2 border-t border-border/50">
                    <Icon
                      name="Lightbulb"
                      className="text-primary mt-0.5 flex-shrink-0"
                      size={20}
                    />
                    <div className="text-sm text-muted-foreground">
                      <p className="mb-2">
                        <span className="font-medium text-foreground">
                          Совет:
                        </span>{" "}
                        Проверьте результат на 2-3 разных фото, чтобы сравнить и
                        выбрать наиболее подходящий цветотип.
                      </p>
                      <p>
                        Если результаты различаются, возможно, вам подходят
                        цвета из обоих цветотипов, но в разной степени.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 pt-2 border-t border-border/50">
                    <Icon
                      name="Info"
                      className="text-primary mt-0.5 flex-shrink-0"
                      size={20}
                    />
                    <div className="text-sm text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">
                          Важно:
                        </span>{" "}
                        Цветотип — это художественное определение. ИИ и математическая формула могут по-разному интерпретировать один и тот же снимок из-за нюансов внешности. Общая точность системы составляет ~90%.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Left Panel - Upload */}
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
                          Для генерации изображений необходимо войти в аккаунт и пополнить баланс минимум на {MIN_TOPUP} рублей.
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
                          Пополните баланс для генерации. Стоимость: {COST}₽
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
                  <div>
                    <label className="block text-sm font-medium mb-3">
                      Загрузите портретное фото
                    </label>
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="portrait-upload"
                        disabled={isAnalyzing}
                      />
                      <label
                        htmlFor="portrait-upload"
                        className="cursor-pointer"
                      >
                        {uploadedImage ? (
                          <img
                            src={uploadedImage}
                            alt="Uploaded"
                            className="max-h-64 mx-auto rounded-lg"
                          />
                        ) : (
                          <div className="space-y-3">
                            <Icon
                              name="Upload"
                              className="mx-auto text-muted-foreground"
                              size={48}
                            />
                            <p className="text-muted-foreground">
                              Нажмите для загрузки портрета
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Фото при естественном освещении, хорошо видны
                              волосы и глаза
                            </p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  {uploadedImage && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-foreground">
                        Цвет глаз
                      </label>
                      
                      {/* Custom selector with eye images */}
                      <EyeColorSelector
                        value={eyeColor}
                        onChange={setEyeColor}
                        disabled={isAnalyzing}
                        options={eyeColors}
                      />

                      {/* Old select - kept for backup, hidden by default */}
                      {/* 
                      <select
                        id="eye-color"
                        value={
                          eyeColor
                            ? Object.keys(eyeColors).find(
                                (key) => eyeColors[key] === eyeColor,
                              ) || ""
                            : ""
                        }
                        onChange={(e) =>
                          setEyeColor(
                            e.target.value ? eyeColors[e.target.value] : "",
                          )
                        }
                        className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        disabled={isAnalyzing}
                        required
                      >
                        <option value="">Выберите цвет глаз</option>
                        {Object.keys(eyeColors).map((colorRu) => (
                          <option key={colorRu} value={colorRu}>
                            {colorRu}
                          </option>
                        ))}
                      </select>
                      */}
                      
                      <p className="text-xs text-muted-foreground mt-1">
                        💡 Для более точного результата укажите ваш реальный цвет глаз — ИИ не всегда правильно определяет этот параметр автоматически.
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !uploadedImage || !eyeColor || !user || !!hasInsufficientBalance}
                    className="w-full h-12 text-base"
                    size="lg"
                  >
                    {isAnalyzing ? (
                      <>
                        <Icon
                          name="Loader2"
                          className="mr-2 animate-spin"
                          size={20}
                        />
                        {analysisStatus || "Анализ..."}
                      </>
                    ) : (
                      <>
                        <Icon name="Palette" className="mr-2" size={20} />
                        Определить цветотип
                      </>
                    )}
                  </Button>

                  {!user?.unlimited_access && !isAnalyzing && (
                    <p className="text-sm text-muted-foreground text-center">
                      Стоимость генерации: {COST}₽
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Right Panel - Result */}
            <Card
              className="animate-scale-in"
              style={{ animationDelay: "0.1s" }}
            >
              <CardContent className="p-8">
                <div className="min-h-[500px] flex items-center justify-center">
                  {result ? (
                    <div className="w-full space-y-6 animate-fade-in">
                      <div className="text-center">
                        <h3 className="text-3xl font-light mb-4">
                          {result.colorType}
                        </h3>
                        <div className="bg-muted rounded-lg p-6 text-sm">
                          <p className="whitespace-pre-wrap">
                            {result.description}
                          </p>
                        </div>
                      </div>

                      {/* Palettes */}
                      {(() => {
                        const hasTwoResults = result.colorTypeAi && result.colorTypeAi !== result.colorType;

                        const renderPalette = (colorTypeName: string, label?: string) => {
                          const colorTypeEnum = colorTypeToEnum[colorTypeName];
                          if (!colorTypeEnum) return null;

                          const rule = colorTypeRules[colorTypeEnum];
                          if (!rule) return null;

                          const palettes = seasonalPalettes[rule.season];
                          if (!palettes) return null;

                          return (
                            <div className="space-y-4">
                              <h4 className="text-lg font-medium text-center">
                                {label || 'Ваша палитра'}
                              </h4>
                              
                              {Object.entries(palettes).map(([paletteKey, palette]) => (
                                <div key={paletteKey} className="space-y-2">
                                  <div className="grid grid-cols-5 gap-2">
                                    {Object.entries(palette).map(([colorName, colorValue]) => (
                                      <div
                                        key={colorName}
                                        className="aspect-square rounded-lg border border-border/50"
                                        style={{
                                          backgroundColor: colorValue,
                                          filter: rule.filter || 'none',
                                        }}
                                        title={colorName}
                                      />
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        };

                        if (hasTwoResults) {
                          return (
                            <div className="space-y-6">
                              {renderPalette(result.colorType, `Результат формулы: ${result.colorType}`)}
                              <div className="border-t border-border/50 pt-2" />
                              {renderPalette(result.colorTypeAi!, `Результат ИИ: ${result.colorTypeAi}`)}
                            </div>
                          );
                        }

                        return renderPalette(result.colorType);
                      })()}

                      <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground text-center">
                        <p>
                          Просмотр и редактирование палитр доступен в личном кабинете в разделе «История цветотипов»
                        </p>
                      </div>

                      <Button
                        onClick={() => navigate("/profile/history-colortypes")}
                        variant="outline"
                        className="w-full"
                      >
                        <Icon name="History" className="mr-2" size={20} />
                        Перейти в историю
                      </Button>
                    </div>
                  ) : isAnalyzing ? (
                    <div className="text-center space-y-4">
                      <Icon
                        name="Loader2"
                        className="mx-auto text-primary animate-spin"
                        size={48}
                      />
                      <p className="text-muted-foreground">
                        {analysisStatus || "Анализируем ваш цветотип..."}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Это может занять до 2 минут
                      </p>
                    </div>
                  ) : hasTimedOut ? (
                    <div className="text-center space-y-3">
                      <Icon
                        name="Clock"
                        className="mx-auto text-muted-foreground"
                        size={48}
                      />
                      <p className="text-muted-foreground">
                        Анализ занял слишком много времени
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Результат сохранится в истории, когда будет готов
                      </p>
                    </div>
                  ) : (
                    <div className="text-center space-y-3">
                      <Icon
                        name="Palette"
                        className="mx-auto text-muted-foreground"
                        size={48}
                      />
                      <p className="text-muted-foreground">
                        Здесь появится ваш цветотип
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Image Cropper Dialog */}
      {showCropper && tempImageForCrop && (
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

      <footer className="border-t border-border py-12 px-4">
        <div className="container mx-auto text-center text-muted-foreground">
          <p className="text-sm">
            © 2025 Virtual Fitting. Технология определения цветотипа на базе AI
          </p>
        </div>
      </footer>
    </Layout>
  );
}