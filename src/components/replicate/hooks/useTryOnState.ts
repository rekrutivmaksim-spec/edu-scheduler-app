import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { checkReplicateBalance, deductReplicateBalance } from '@/utils/replicateBalanceUtils';

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

const CATALOG_API = 'https://functions.poehali.dev/e65f7df8-0a43-4921-8dbd-3dc0587255cc';
const REPLICATE_START_API = 'https://functions.poehali.dev/c1cb3f04-f40a-4044-87fd-568d0271e1fe';
const REPLICATE_STATUS_API = 'https://functions.poehali.dev/cde034e8-99be-4910-9ea6-f06cc94a6377';

export function useTryOnState() {
  const { user } = useAuth();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedClothingItems, setSelectedClothingItems] = useState<SelectedClothing[]>([]);
  const [clothingCatalog, setClothingCatalog] = useState<ClothingItem[]>([]);

  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lookbooks, setLookbooks] = useState<any[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newLookbookName, setNewLookbookName] = useState('');
  const [newLookbookPersonName, setNewLookbookPersonName] = useState('');
  const [selectedLookbookId, setSelectedLookbookId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedColors, setSelectedColors] = useState<number[]>([]);
  const [selectedArchetypes, setSelectedArchetypes] = useState<number[]>([]);
  const [selectedGender, setSelectedGender] = useState<string>('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [intermediateResult, setIntermediateResult] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [totalSteps, setTotalSteps] = useState<number>(0);
  const [waitingContinue, setWaitingContinue] = useState<boolean>(false);
  const [checkerInterval, setCheckerInterval] = useState<NodeJS.Timeout | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [tempImageForCrop, setTempImageForCrop] = useState<string | null>(null);

  useEffect(() => {
    fetchFilters();
    if (user) {
      fetchLookbooks();
    }
  }, [user]);

  useEffect(() => {
    fetchCatalog();
  }, [selectedCategories, selectedColors, selectedArchetypes, selectedGender]);

  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      if (checkerInterval) {
        clearInterval(checkerInterval);
      }
    };
  }, [pollingInterval, checkerInterval]);

  const fetchFilters = async () => {
    try {
      const response = await fetch(`${CATALOG_API}?action=filters`);
      if (response.ok) {
        const data = await response.json();
        const filteredCategories = data.categories.filter((cat: FilterOption) => 
          !['Обувь', 'Аксессуары', 'Головные уборы'].includes(cat.name)
        );
        setFilters({
          ...data,
          categories: filteredCategories
        });
      }
    } catch (error) {
      console.error('Failed to fetch filters:', error);
    }
  };

  const fetchCatalog = async () => {
    try {
      const params = new URLSearchParams({ action: 'list' });
      if (selectedCategories.length > 0) {
        params.append('categories', selectedCategories.join(','));
      }
      if (selectedColors.length > 0) {
        params.append('colors', selectedColors.join(','));
      }
      if (selectedArchetypes.length > 0) {
        params.append('archetypes', selectedArchetypes.join(','));
      }
      if (selectedGender) {
        params.append('gender', selectedGender);
      }
      const response = await fetch(`${CATALOG_API}?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const filteredData = data.filter((item: ClothingItem) => {
          const category = mapCategoryFromCatalog(item);
          return category === 'upper_body' || category === 'lower_body' || category === 'dresses';
        });
        setClothingCatalog(filteredData);
      }
    } catch (error) {
      console.error('Failed to fetch catalog:', error);
    }
  };

  const fetchLookbooks = async () => {
    if (!user) return;
    
    try {
      const response = await fetch('https://functions.poehali.dev/69de81d7-5596-4e1d-bbd3-4b3e1a520d6b', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setLookbooks(data);
      }
    } catch (error) {
      console.error('Failed to fetch lookbooks:', error);
    }
  };

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
    if (file) {
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
                console.error('Error resizing image:', error);
                toast.error('Ошибка обработки фото');
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
        console.error('Error processing image:', error);
        toast.error('Ошибка загрузки фото');
      }
    }
  };

  const handleCropComplete = (croppedImage: string) => {
    setUploadedImage(croppedImage);
    setShowCropper(false);
    setTempImageForCrop(null);
    toast.success('Фото обрезано и загружено');
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setTempImageForCrop(null);
  };

  const mapCategoryFromCatalog = (item: ClothingItem): string => {
    const categoryMap: { [key: string]: string } = {
      'Верх': 'upper_body',
      'Низ': 'lower_body',
      'Платья': 'dresses'
    };

    for (const category of item.categories) {
      if (categoryMap[category]) {
        return categoryMap[category];
      }
    }
    return 'upper_body';
  };

  const handleSelectFromCatalog = (item: ClothingItem) => {
    const category = mapCategoryFromCatalog(item);

    setSelectedClothingItems(prev => {
      const existingIndex = prev.findIndex(clothing => 
        clothing.isFromCatalog && clothing.id === item.id
      );

      if (existingIndex !== -1) {
        const newItems = [...prev];
        newItems.splice(existingIndex, 1);
        return newItems;
      }

      const newItem: SelectedClothing = {
        id: item.id,
        image: item.image_url,
        name: item.name,
        category: category,
        isFromCatalog: true
      };
      return [...prev, newItem];
    });
  };

  const handleRemoveClothing = (clothingId: string) => {
    setSelectedClothingItems(prev => prev.filter(item => item.id !== clothingId));
  };

  const updateClothingCategory = (id: string, category: string) => {
    setSelectedClothingItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, category } : item
      )
    );
  };

  const handleCustomClothingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (selectedClothingItems.length >= 2) {
      toast.error('Можно выбрать максимум 2 вещи');
      return;
    }

    try {
      const resizedImage = await resizeImage(file, 1024, 1024);
      const newItem: SelectedClothing = {
        id: `custom-${Date.now()}`,
        image: resizedImage,
        name: file.name,
        isFromCatalog: false
      };
      
      setSelectedClothingItems(prev => [...prev, newItem]);
      toast.success('Фото одежды загружено');
    } catch (error) {
      console.error('Error uploading custom clothing:', error);
      toast.error('Ошибка загрузки фото одежды');
    }
  };

  const handleContinueGeneration = async () => {
    if (!taskId || !intermediateResult) {
      toast.error('Нет промежуточного результата для продолжения');
      return;
    }

    setWaitingContinue(false);
    setIsGenerating(true);
    setGenerationStatus('Продолжаем генерацию...');

    try {
      const response = await fetch('https://functions.poehali.dev/fdb150a0-d5ba-47ec-9d9a-e13595cd92d1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          task_id: taskId,
          user_choice: 'continue'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка продолжения генерации');
      }

      startPolling(taskId);

    } catch (error: any) {
      console.error('Error continuing generation:', error);
      setIsGenerating(false);
      setGenerationStatus('');
      toast.error(error.message || 'Ошибка продолжения генерации');
    }
  };

  const handleAcceptIntermediate = async () => {
    if (!intermediateResult) {
      toast.error('Нет промежуточного результата');
      return;
    }

    setWaitingContinue(false);
    setIsGenerating(false);
    setGeneratedImage(intermediateResult);
    setIntermediateResult(null);
    setGenerationStatus('');
    setTaskId(null);

    if (checkerInterval) {
      clearInterval(checkerInterval);
      setCheckerInterval(null);
    }

    toast.success('Результат сохранён');
  };

  const startPolling = (id: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${REPLICATE_STATUS_API}?task_id=${id}`, {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Ошибка проверки статуса');
        }

        const data = await response.json();

        if (data.status === 'completed') {
          clearInterval(interval);
          setPollingInterval(null);
          setIsGenerating(false);
          setGenerationStatus('');
          setGeneratedImage(data.output);
          setTaskId(null);
          toast.success('Примерка завершена!');

          if (!user) {
            deductReplicateBalance();
          }

          // History is saved automatically by backend (replicate-prediction-checker)
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setPollingInterval(null);
          setIsGenerating(false);
          setGenerationStatus('');
          toast.error('Ошибка генерации');
          setTaskId(null);
        } else if (data.status === 'processing') {
          if (data.current_step !== undefined && data.total_steps !== undefined) {
            setCurrentStep(data.current_step);
            setTotalSteps(data.total_steps);
            setGenerationStatus(`Обработка (${data.current_step}/${data.total_steps})...`);
          } else {
            setGenerationStatus('Обработка...');
          }
        } else if (data.status === 'waiting_user_input') {
          clearInterval(interval);
          setPollingInterval(null);
          setWaitingContinue(true);
          setIntermediateResult(data.intermediate_result);
          setGenerationStatus('Ожидание вашего решения');

          if (checkerInterval) {
            clearInterval(checkerInterval);
          }

          const checker = setInterval(async () => {
            try {
              const checkResponse = await fetch(`${REPLICATE_STATUS_API}?task_id=${id}`, {
                credentials: 'include'
              });

              if (checkResponse.ok) {
                const checkData = await checkResponse.json();
                if (checkData.status !== 'waiting_user_input') {
                  clearInterval(checker);
                  setCheckerInterval(null);
                  if (checkData.status === 'processing') {
                    setWaitingContinue(false);
                    setIntermediateResult(null);
                    startPolling(id);
                  }
                }
              }
            } catch (error) {
              console.error('Error checking status:', error);
            }
          }, 3000);

          setCheckerInterval(checker);
        }
      } catch (error) {
        console.error('Error polling status:', error);
        clearInterval(interval);
        setPollingInterval(null);
        setIsGenerating(false);
        setGenerationStatus('');
        toast.error('Ошибка проверки статуса');
      }
    }, 2000);

    setPollingInterval(interval);
  };

  const handleGenerate = async () => {
    if (!uploadedImage) {
      toast.error('Пожалуйста, загрузите фото');
      return;
    }

    if (selectedClothingItems.length === 0) {
      toast.error('Пожалуйста, выберите хотя бы один предмет одежды');
      return;
    }

    if (!user) {
      const hasBalance = await checkReplicateBalance();
      if (!hasBalance) {
        toast.error('У вас закончились бесплатные попытки. Пожалуйста, войдите в аккаунт.');
        return;
      }
    }

    setIsGenerating(true);
    setGenerationStatus('Запуск генерации...');
    setCurrentStep(0);
    setTotalSteps(0);

    try {
      const requestBody: any = {
        model_image: uploadedImage,
        clothing_images: selectedClothingItems.map(item => ({
          image: item.image,
          category: item.category || 'upper_body'
        }))
      };

      const response = await fetch(REPLICATE_START_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка запуска генерации');
      }

      const data = await response.json();
      setTaskId(data.task_id);
      setGenerationStatus('Генерация началась...');

      startPolling(data.task_id);

    } catch (error: any) {
      console.error('Error starting generation:', error);
      setIsGenerating(false);
      setGenerationStatus('');
      toast.error(error.message || 'Ошибка запуска генерации');
    }
  };

  const handleSaveImage = async () => {
    if (!generatedImage || !user) return;

    if (selectedLookbookId === 'new' && !newLookbookName.trim()) {
      toast.error('Введите название лукбука');
      return;
    }

    setIsSaving(true);

    try {
      let lookbookId = selectedLookbookId;

      if (selectedLookbookId === 'new') {
        const createResponse = await fetch('https://functions.poehali.dev/69de81d7-5596-4e1d-bbd3-4b3e1a520d6b', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            name: newLookbookName,
            person_name: newLookbookPersonName || null
          })
        });

        if (!createResponse.ok) {
          throw new Error('Не удалось создать лукбук');
        }

        const newLookbook = await createResponse.json();
        lookbookId = newLookbook.id;
        await fetchLookbooks();
      }

      const addImageResponse = await fetch('https://functions.poehali.dev/69de81d7-5596-4e1d-bbd3-4b3e1a520d6b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          lookbook_id: lookbookId,
          image_url: generatedImage
        })
      });

      if (!addImageResponse.ok) {
        throw new Error('Не удалось добавить изображение');
      }

      toast.success('Изображение сохранено в лукбук');
      setShowSaveDialog(false);
      setNewLookbookName('');
      setNewLookbookPersonName('');
      setSelectedLookbookId('');
    } catch (error: any) {
      console.error('Error saving image:', error);
      toast.error(error.message || 'Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    user,
    uploadedImage,
    setUploadedImage,
    selectedClothingItems,
    setSelectedClothingItems,
    clothingCatalog,
    generatedImage,
    isGenerating,
    lookbooks,
    showSaveDialog,
    setShowSaveDialog,
    newLookbookName,
    setNewLookbookName,
    newLookbookPersonName,
    setNewLookbookPersonName,
    selectedLookbookId,
    setSelectedLookbookId,
    isSaving,
    filters,
    selectedCategories,
    setSelectedCategories,
    selectedColors,
    setSelectedColors,
    selectedArchetypes,
    setSelectedArchetypes,
    selectedGender,
    setSelectedGender,
    generationStatus,
    intermediateResult,
    currentStep,
    totalSteps,
    waitingContinue,
    showCropper,
    tempImageForCrop,
    handleImageUpload,
    handleCropComplete,
    handleCropCancel,
    handleSelectFromCatalog,
    handleRemoveClothing,
    updateClothingCategory,
    handleCustomClothingUpload,
    handleGenerate,
    handleSaveImage,
    handleContinueGeneration,
    handleAcceptIntermediate
  };
}