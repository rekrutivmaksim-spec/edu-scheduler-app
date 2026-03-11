import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { checkReplicateBalance, deductReplicateBalance, refundReplicateBalance } from '@/utils/replicateBalanceUtils';
import { validateImageFile } from '@/utils/fileValidation';

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

interface SelectedClothing {
  id: string;
  image: string;
  name?: string;
  category?: string;
  isFromCatalog?: boolean;
}

const CATALOG_API = 'https://functions.poehali.dev/e65f7df8-0a43-4921-8dbd-3dc0587255cc';
const NANOBANANAPRO_START_API = 'https://functions.poehali.dev/aac1d5d8-c9bd-43c6-822e-857c18f3c1f8';
const NANOBANANAPRO_STATUS_API = 'https://functions.poehali.dev/6d603f3d-bbe3-450d-863a-63d513ad5ba7';
const NANOBANANAPRO_WORKER_API = 'https://functions.poehali.dev/1f4c772e-0425-4fe4-98a6-baa3979ba94d';
const DB_QUERY_API = 'https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9';
const IMAGE_PROXY_API = 'https://functions.poehali.dev/7f105c4b-f9e7-4df3-9f64-3d35895b8e90';
const SAVE_IMAGE_FTP_API = 'https://functions.poehali.dev/56814ab9-6cba-4035-a63d-423ac0d301c8';

// Helper function to proxy fal.ai images through our backend
const proxyFalImage = async (falUrl: string): Promise<string> => {
  try {
    if (!falUrl.includes('fal.media') && !falUrl.includes('fal.ai')) {
      return falUrl;
    }
    
    console.log('[ImageProxy] Proxying fal.ai image:', falUrl);
    const response = await fetch(`${IMAGE_PROXY_API}?url=${encodeURIComponent(falUrl)}`);
    
    if (!response.ok) {
      console.error('[ImageProxy] Failed to proxy image:', response.status);
      return falUrl;
    }
    
    const data = await response.json();
    console.log('[ImageProxy] Successfully proxied image');
    return data.data_url;
  } catch (error) {
    console.error('[ImageProxy] Error proxying image:', error);
    return falUrl;
  }
};

export function useReplicateTryOn() {
  const { user } = useAuth();
  const { lookbooks, refetchLookbooks, refetchHistory } = useData();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedClothingItems, setSelectedClothingItems] = useState<SelectedClothing[]>([]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [cdnImageUrl, setCdnImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newLookbookName, setNewLookbookName] = useState('');
  const [newLookbookPersonName, setNewLookbookPersonName] = useState('');
  const [selectedLookbookId, setSelectedLookbookId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedColors, setSelectedColors] = useState<number[]>([]);
  const [selectedArchetypes, setSelectedArchetypes] = useState<number[]>([]);
  const [selectedGender, setSelectedGender] = useState<string>('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [tempImageForCrop, setTempImageForCrop] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [showCategoryError, setShowCategoryError] = useState(false);
  const isNanoBananaRequestInProgress = useRef(false);

  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
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

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.isValid) {
      toast.error(validation.error || 'Неверный файл');
      e.target.value = '';
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
          
          const isCorrectAspectRatio = Math.abs(aspectRatio - targetRatio) < tolerance;
          
          if (isCorrectAspectRatio) {
            resizeImage(file, 1024, 1024).then(resized => {
              setUploadedImage(resized);
              toast.success('Фото загружено');
            }).catch(error => {
              console.error('Image resize error:', error);
              toast.error('Ошибка обработки изображения');
            });
          } else {
            setTempImageForCrop(event.target?.result as string);
            setShowCropper(true);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error('Ошибка загрузки изображения');
    }
  };

  const handleCropComplete = async (croppedImage: string) => {
    setUploadedImage(croppedImage);
    setShowCropper(false);
    setTempImageForCrop(null);
    toast.success('Фото загружено');
  };

  const handleClothingSelect = (item: ClothingItem | SelectedClothing) => {
    const newItem: SelectedClothing = 'image_url' in item
      ? { 
          id: item.id, 
          image: item.image_url, 
          name: item.name,
          category: item.replicate_category,
          isFromCatalog: true
        }
      : item;

    const isDuplicate = selectedClothingItems.some(existing => existing.id === newItem.id);
    
    if (isDuplicate) {
      toast.error('Эта вещь уже добавлена');
      return;
    }

    const categoryExists = selectedClothingItems.some(
      existing => existing.category === newItem.category && newItem.category
    );

    if (categoryExists && newItem.category) {
      const categoryNames: { [key: string]: string } = {
        'upper_body': 'верхней одежды',
        'lower_body': 'нижней одежды',
        'dresses': 'платьев'
      };
      toast.error(`Можно добавить только одну вещь ${categoryNames[newItem.category] || 'этой категории'}`);
      return;
    }

    setSelectedClothingItems([...selectedClothingItems, newItem]);
    toast.success('Вещь добавлена');
  };

  const handleRemoveClothing = (id: string) => {
    setSelectedClothingItems(selectedClothingItems.filter(item => item.id !== id));
    toast.success('Вещь удалена');
  };

  const handleGenerate = async () => {
    if (!user) {
      toast.error('Необходимо войти в систему');
      return;
    }

    if (!uploadedImage) {
      toast.error('Загрузите фотографию');
      return;
    }

    if (selectedClothingItems.length === 0) {
      toast.error('Выберите хотя бы одну вещь из каталога');
      return;
    }

    const hasInvalidCategory = selectedClothingItems.some(item => !item.category);
    if (hasInvalidCategory) {
      setShowCategoryError(true);
      toast.error('Некоторые вещи имеют неопределенную категорию. Пожалуйста, удалите их.');
      return;
    }
    setShowCategoryError(false);

    const balanceCheck = await checkReplicateBalance(user, selectedClothingItems.length);
    if (!balanceCheck.canGenerate) {
      return;
    }

    try {
      setIsGenerating(true);
      setGenerationStatus('Подготовка запроса...');
      setHasTimedOut(false);

      await deductReplicateBalance(user, selectedClothingItems.length);

      const garmentDict: { [key: string]: string } = {};
      selectedClothingItems.forEach(item => {
        if (item.category) {
          garmentDict[item.category] = item.image;
        }
      });

      const garmentsArray = Object.entries(garmentDict).map(([category, image]) => ({
        category,
        image
      }));

      console.log('Starting NanoBananaPro generation with:', {
        person_image: uploadedImage,
        garments: garmentsArray,
        custom_prompt: customPrompt || undefined
      });

      const token = localStorage.getItem('session_token');
      
      if (!token) {
        throw new Error('Нет токена авторизации. Пожалуйста, перезайдите в систему.');
      }
      
      const startResponse = await fetch(NANOBANANAPRO_START_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': token
        },
        credentials: 'include',
        body: JSON.stringify({
          person_image: uploadedImage,
          garments: garmentsArray,
          custom_prompt: customPrompt || undefined
        }),
      });

      const startData = await startResponse.json();
      console.log('Start API response:', startData);

      if (!startResponse.ok) {
        throw new Error(startData.error || 'Ошибка запуска генерации');
      }

      const newTaskId = startData.task_id;
      setTaskId(newTaskId);
      setGenerationStatus('Задача создана, начинаем проверку...');

      const interval = setInterval(async () => {
        try {
          await pollTaskStatus(newTaskId);
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 3000);

      setPollingInterval(interval);

      setTimeout(() => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        setHasTimedOut(true);
        setIsGenerating(false);
        setGenerationStatus('Время ожидания истекло. Проверьте результат позже через кнопку "Проверить задачи".');
      }, 360000);

    } catch (error: unknown) {
      console.error('Generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Ошибка генерации';
      toast.error(errorMessage);
      setIsGenerating(false);
      setGenerationStatus('');
      
      if (user) {
        await refundReplicateBalance(user, selectedClothingItems.length);
      }
    }
  };

  const pollTaskStatus = async (currentTaskId: string) => {
    if (!user) return;

    try {
      const token = localStorage.getItem('session_token');
      
      if (!token) {
        console.error('[NanoBananaPro-POLL] Нет токена в localStorage!');
        return;
      }
      
      console.log('[NanoBananaPro-POLL] Отправка запроса с токеном:', token.substring(0, 20));
      
      const statusResponse = await fetch(`${NANOBANANAPRO_STATUS_API}?task_id=${currentTaskId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': token
        },
        credentials: 'include',
      });

      if (!statusResponse.ok) {
        console.error('[NanoBananaPro-POLL] HTTP error:', statusResponse.status);
        return;
      }

      const statusData = await statusResponse.json();
      console.log('Status check:', statusData);

      if (statusData.status === 'completed' && statusData.result_url) {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        
        const proxiedUrl = await proxyFalImage(statusData.result_url);
        setGeneratedImage(proxiedUrl);
        setCdnImageUrl(statusData.cdn_url || null);
        setIsGenerating(false);
        setGenerationStatus('Готово!');
        toast.success('Примерка готова!');
      } else if (statusData.status === 'failed') {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        setIsGenerating(false);
        setGenerationStatus('Ошибка генерации');
        toast.error('Ошибка генерации изображения');
        
        if (user) {
          await refundReplicateBalance(user, selectedClothingItems.length);
        }
      } else if (statusData.status === 'processing') {
        setGenerationStatus('Обработка изображения...');
      } else {
        setGenerationStatus(`Статус: ${statusData.status || 'неизвестно'}`);
      }
    } catch (error) {
      console.error('Status check error:', error);
    }
  };

  const checkExistingPendingTasks = async () => {
    if (!user) {
      toast.error('Необходимо войти в систему');
      return;
    }

    if (isNanoBananaRequestInProgress.current) {
      console.log('Request already in progress, skipping...');
      return;
    }

    try {
      isNanoBananaRequestInProgress.current = true;
      setIsGenerating(true);
      setGenerationStatus('Проверка существующих задач...');

      const token = localStorage.getItem('session_token');
      
      if (!token) {
        throw new Error('Нет токена авторизации');
      }
      
      const workerResponse = await fetch(NANOBANANAPRO_WORKER_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': token
        },
        credentials: 'include',
      });

      const workerData = await workerResponse.json();
      console.log('Worker response:', workerData);

      if (workerData.processed > 0) {
        toast.success(`Обработано задач: ${workerData.processed}`);
        await refetchHistory();
      } else {
        toast.info('Нет задач для обработки');
      }

      setIsGenerating(false);
      setGenerationStatus('');
    } catch (error: unknown) {
      console.error('Worker error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Ошибка проверки задач';
      toast.error(errorMessage);
      setIsGenerating(false);
      setGenerationStatus('');
    } finally {
      isNanoBananaRequestInProgress.current = false;
    }
  };

  const handleSaveTryOn = async (lookbookId: string, lookbookName?: string, personName?: string) => {
    if (!user || !generatedImage) return;

    setIsSaving(true);
    try {
      let finalLookbookId = lookbookId;
      
      if (lookbookId === 'new' && lookbookName) {
        const token = localStorage.getItem('session_token');
        const createResponse = await fetch(`${DB_QUERY_API}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'X-Session-Token': token } : {})
          },
          credentials: 'include',
          body: JSON.stringify({
            query: `INSERT INTO lookbooks (user_id, name, person_name) VALUES ('${user.id}', '${lookbookName}', '${personName || ''}') RETURNING id`
          })
        });

        if (!createResponse.ok) throw new Error('Ошибка создания лукбука');
        
        const createData = await createResponse.json();
        if (createData.results && createData.results.length > 0) {
          finalLookbookId = createData.results[0].id;
        } else {
          throw new Error('Не удалось получить ID нового лукбука');
        }
      }

      let imageToSave = generatedImage;
      
      if (cdnImageUrl) {
        imageToSave = cdnImageUrl;
      } else {
        const token = localStorage.getItem('session_token');
        const saveImageResponse = await fetch(SAVE_IMAGE_FTP_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'X-Session-Token': token } : {})
          },
          credentials: 'include',
          body: JSON.stringify({
            image_data: generatedImage,
            user_id: user.id,
            folder: 'tryon'
          })
        });

        if (!saveImageResponse.ok) throw new Error('Ошибка сохранения изображения');
        
        const saveImageData = await saveImageResponse.json();
        imageToSave = saveImageData.cdn_url;
      }

      const token2 = localStorage.getItem('session_token');
      
      if (!token2) {
        throw new Error('Нет токена авторизации');
      }
      
      const insertResponse = await fetch(`${DB_QUERY_API}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': token2
        },
        credentials: 'include',
        body: JSON.stringify({
          query: `INSERT INTO lookbook_items (lookbook_id, image_url, user_photo_url) VALUES ('${finalLookbookId}', '${imageToSave}', '${uploadedImage}')`
        })
      });

      if (!insertResponse.ok) throw new Error('Ошибка сохранения в лукбук');

      toast.success('Сохранено в лукбук!');
      setShowSaveDialog(false);
      resetForm();
      await refetchLookbooks();
    } catch (error: unknown) {
      console.error('Save error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Ошибка сохранения';
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setUploadedImage(null);
    setSelectedClothingItems([]);
    setGeneratedImage(null);
    setCdnImageUrl(null);
    setTaskId(null);
    setGenerationStatus('');
    setHasTimedOut(false);
    setCustomPrompt('');
    setShowCategoryError(false);
  };

  return {
    user,
    lookbooks,
    uploadedImage,
    selectedClothingItems,
    generatedImage,
    isGenerating,
    showSaveDialog,
    newLookbookName,
    newLookbookPersonName,
    selectedLookbookId,
    isSaving,
    selectedCategories,
    selectedColors,
    selectedArchetypes,
    selectedGender,
    generationStatus,
    hasTimedOut,
    showCropper,
    tempImageForCrop,
    customPrompt,
    showCategoryError,
    setUploadedImage,
    setSelectedClothingItems,
    setGeneratedImage,
    setShowSaveDialog,
    setNewLookbookName,
    setNewLookbookPersonName,
    setSelectedLookbookId,
    setSelectedCategories,
    setSelectedColors,
    setSelectedArchetypes,
    setSelectedGender,
    setCustomPrompt,
    handleImageUpload,
    handleCropComplete,
    handleClothingSelect,
    handleRemoveClothing,
    handleGenerate,
    checkExistingPendingTasks,
    handleSaveTryOn,
    resetForm,
  };
}