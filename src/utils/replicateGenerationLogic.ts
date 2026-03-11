import { toast } from 'sonner';
import { checkReplicateBalance, deductReplicateBalance, refundReplicateBalance } from './replicateBalanceUtils';
import { checkCategoryCompatibility } from './replicateCategoryMapping';

interface SelectedClothing {
  id: string;
  image: string;
  name?: string;
  category?: string;
  isFromCatalog?: boolean;
}

interface GenerationParams {
  user: any;
  uploadedImage: string | null;
  selectedClothingItems: SelectedClothing[];
  activeFittingRoom: 'replicate' | 'seedream' | 'nanobananapro';
  customPrompt: string;
  setIsGenerating: (value: boolean) => void;
  setGenerationStatus: (status: string) => void;
  setTaskId: (id: string | null) => void;
  setPollingInterval: (interval: NodeJS.Timeout | null) => void;
  setGeneratedImage: (image: string | null) => void;
  setIntermediateResult: (image: string | null) => void;
  setCurrentStep: (step: number) => void;
  setTotalSteps: (steps: number) => void;
  setWaitingContinue: (waiting: boolean) => void;
  setCheckerInterval: (interval: NodeJS.Timeout | null) => void;
  setShowBalanceModal: (show: boolean) => void;
  isNanoBananaRequestInProgress: React.MutableRefObject<boolean>;
  setShowCategoryError: (show: boolean) => void;
}

const REPLICATE_START_API = 'https://functions.poehali.dev/c1cb3f04-f40a-4044-87fd-568d0271e1fe';
const REPLICATE_STATUS_API = 'https://functions.poehali.dev/cde034e8-99be-4910-9ea6-f06cc94a6377';
const SEEDREAM_START_API = 'https://functions.poehali.dev/4bb70873-fda7-4a2d-a0a8-ee558a3b50e7';
const SEEDREAM_STATUS_API = 'https://functions.poehali.dev/ffebd367-227e-4e12-a5f1-64db84bddc81';
const NANOBANANAPRO_START_API = 'https://functions.poehali.dev/aac1d5d8-c9bd-43c6-822e-857c18f3c1f8';
const NANOBANANAPRO_STATUS_API = 'https://functions.poehali.dev/6d603f3d-bbe3-450d-863a-63d513ad5ba7';

export async function startGeneration(params: GenerationParams) {
  const {
    user,
    uploadedImage,
    selectedClothingItems,
    activeFittingRoom,
    customPrompt,
    setIsGenerating,
    setGenerationStatus,
    setTaskId,
    setPollingInterval,
    setGeneratedImage,
    setIntermediateResult,
    setCurrentStep,
    setTotalSteps,
    setWaitingContinue,
    setCheckerInterval,
    setShowBalanceModal,
    isNanoBananaRequestInProgress,
    setShowCategoryError,
  } = params;

  if (!uploadedImage || selectedClothingItems.length === 0) {
    toast.error('Загрузите фото и выберите одежду');
    return;
  }

  if (!checkCategoryCompatibility(selectedClothingItems)) {
    setShowCategoryError(true);
    return;
  }

  if (!user) {
    toast.error('Войдите в аккаунт');
    return;
  }

  const costMap = {
    replicate: 6,
    seedream: 3,
    nanobananapro: 3
  };
  const requiredBalance = costMap[activeFittingRoom];

  const balanceCheck = await checkReplicateBalance(user.id, requiredBalance);
  if (!balanceCheck.hasEnough) {
    setShowBalanceModal(true);
    return;
  }

  setIsGenerating(true);
  setGenerationStatus('Подготовка...');
  setGeneratedImage(null);
  setIntermediateResult(null);
  setCurrentStep(0);
  setTotalSteps(0);
  setWaitingContinue(false);

  try {
    await deductReplicateBalance(user.id, requiredBalance);

    const garmentCategories = selectedClothingItems.reduce((acc, item) => {
      const category = item.category || 'upper_body';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item.image);
      return acc;
    }, {} as Record<string, string[]>);

    const requestBody: any = {
      human_img: uploadedImage,
      cloth: garmentCategories,
    };

    if (customPrompt && customPrompt.trim() !== '') {
      requestBody.prompt = customPrompt.trim();
    }

    let startApiUrl = REPLICATE_START_API;
    let statusApiUrl = REPLICATE_STATUS_API;
    
    if (activeFittingRoom === 'seedream') {
      startApiUrl = SEEDREAM_START_API;
      statusApiUrl = SEEDREAM_STATUS_API;
    } else if (activeFittingRoom === 'nanobananapro') {
      startApiUrl = NANOBANANAPRO_START_API;
      statusApiUrl = NANOBANANAPRO_STATUS_API;
    }

    if (activeFittingRoom === 'nanobananapro') {
      if (isNanoBananaRequestInProgress.current) {
        toast.error('Дождитесь завершения текущего запроса');
        setIsGenerating(false);
        setGenerationStatus('');
        await refundReplicateBalance(user.id, requiredBalance);
        return;
      }
      isNanoBananaRequestInProgress.current = true;
    }

    const startResponse = await fetch(startApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!startResponse.ok) {
      throw new Error('Failed to start generation');
    }

    const startData = await startResponse.json();
    const newTaskId = startData.task_id;
    setTaskId(newTaskId);

    if (activeFittingRoom === 'nanobananapro') {
      setGenerationStatus('Генерация...');
      setCurrentStep(1);
      setTotalSteps(2);

      const checkStatus = async () => {
        try {
          const statusResponse = await fetch(`${statusApiUrl}?task_id=${newTaskId}`);
          if (!statusResponse.ok) {
            throw new Error('Failed to check status');
          }

          const statusData = await statusResponse.json();

          if (statusData.status === 'pending' || statusData.status === 'processing') {
            return;
          }

          if (statusData.status === 'completed') {
            if (statusData.intermediate_result) {
              setIntermediateResult(statusData.intermediate_result);
              setCurrentStep(1);
              setWaitingContinue(true);
              setGenerationStatus('Промежуточный результат готов');
              if (params.setCheckerInterval) {
                clearInterval(params.setCheckerInterval as any);
              }
            } else if (statusData.result) {
              setGeneratedImage(statusData.result);
              setIsGenerating(false);
              setGenerationStatus('');
              setCurrentStep(0);
              setTotalSteps(0);
              setTaskId(null);
              if (params.setCheckerInterval) {
                clearInterval(params.setCheckerInterval as any);
              }
              isNanoBananaRequestInProgress.current = false;
              toast.success('Готово!');
            }
          } else if (statusData.status === 'failed') {
            throw new Error(statusData.error || 'Generation failed');
          }
        } catch (error) {
          console.error('Status check error:', error);
          setIsGenerating(false);
          setGenerationStatus('');
          setTaskId(null);
          if (params.setCheckerInterval) {
            clearInterval(params.setCheckerInterval as any);
          }
          isNanoBananaRequestInProgress.current = false;
          await refundReplicateBalance(user.id, requiredBalance);
          toast.error('Ошибка генерации');
        }
      };

      const intervalId = setInterval(checkStatus, 3000);
      setCheckerInterval(intervalId);
      checkStatus();

    } else {
      setGenerationStatus('Ожидание результата...');

      const pollStatus = async () => {
        try {
          const statusResponse = await fetch(`${statusApiUrl}?task_id=${newTaskId}`);
          if (!statusResponse.ok) {
            throw new Error('Failed to check status');
          }

          const statusData = await statusResponse.json();

          if (statusData.status === 'pending' || statusData.status === 'processing') {
            setGenerationStatus(statusData.status === 'pending' ? 'В очереди...' : 'Генерация...');
            return;
          }

          if (statusData.status === 'completed') {
            if (params.setPollingInterval) {
              clearInterval(params.setPollingInterval as any);
            }
            setPollingInterval(null);
            setGeneratedImage(statusData.result);
            setIsGenerating(false);
            setGenerationStatus('');
            setTaskId(null);
            toast.success('Готово!');
          } else if (statusData.status === 'failed') {
            throw new Error(statusData.error || 'Generation failed');
          }
        } catch (error) {
          console.error('Polling error:', error);
          if (params.setPollingInterval) {
            clearInterval(params.setPollingInterval as any);
          }
          setPollingInterval(null);
          setIsGenerating(false);
          setGenerationStatus('');
          setTaskId(null);
          await refundReplicateBalance(user.id, requiredBalance);
          toast.error('Ошибка генерации');
        }
      };

      const intervalId = setInterval(pollStatus, 2000);
      setPollingInterval(intervalId);
      pollStatus();
    }

  } catch (error) {
    console.error('Generation error:', error);
    setIsGenerating(false);
    setGenerationStatus('');
    const costMap = {
      replicate: 6,
      seedream: 3,
      nanobananapro: 3
    };
    await refundReplicateBalance(user.id, costMap[activeFittingRoom]);
    toast.error('Ошибка генерации');
    if (activeFittingRoom === 'nanobananapro') {
      isNanoBananaRequestInProgress.current = false;
    }
  }
}

export async function continueGeneration(params: GenerationParams & { taskId: string | null }) {
  const {
    user,
    taskId,
    activeFittingRoom,
    setIsGenerating,
    setGenerationStatus,
    setWaitingContinue,
    setIntermediateResult,
    setGeneratedImage,
    setCurrentStep,
    setTotalSteps,
    setTaskId,
    setCheckerInterval,
    isNanoBananaRequestInProgress,
  } = params;

  if (!taskId) {
    toast.error('Нет активной задачи');
    return;
  }

  setWaitingContinue(false);
  setIsGenerating(true);
  setGenerationStatus('Продолжение генерации...');
  setCurrentStep(2);

  try {
    const continueResponse = await fetch(NANOBANANAPRO_START_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task_id: taskId,
        continue: true,
      }),
    });

    if (!continueResponse.ok) {
      throw new Error('Failed to continue generation');
    }

    const checkStatus = async () => {
      try {
        const statusResponse = await fetch(`${NANOBANANAPRO_STATUS_API}?task_id=${taskId}`);
        if (!statusResponse.ok) {
          throw new Error('Failed to check status');
        }

        const statusData = await statusResponse.json();

        if (statusData.status === 'pending' || statusData.status === 'processing') {
          return;
        }

        if (statusData.status === 'completed' && statusData.result) {
          setGeneratedImage(statusData.result);
          setIsGenerating(false);
          setGenerationStatus('');
          setIntermediateResult(null);
          setCurrentStep(0);
          setTotalSteps(0);
          setTaskId(null);
          if (params.setCheckerInterval) {
            clearInterval(params.setCheckerInterval as any);
          }
          isNanoBananaRequestInProgress.current = false;
          toast.success('Готово!');
        } else if (statusData.status === 'failed') {
          throw new Error(statusData.error || 'Generation failed');
        }
      } catch (error) {
        console.error('Status check error:', error);
        setIsGenerating(false);
        setGenerationStatus('');
        setTaskId(null);
        if (params.setCheckerInterval) {
          clearInterval(params.setCheckerInterval as any);
        }
        isNanoBananaRequestInProgress.current = false;
        const costMap = {
          replicate: 6,
          seedream: 3,
          nanobananapro: 3
        };
        await refundReplicateBalance(user.id, costMap[activeFittingRoom]);
        toast.error('Ошибка генерации');
      }
    };

    const intervalId = setInterval(checkStatus, 3000);
    setCheckerInterval(intervalId);
    checkStatus();

  } catch (error) {
    console.error('Continue generation error:', error);
    setIsGenerating(false);
    setGenerationStatus('');
    const costMap = {
      replicate: 6,
      seedream: 3,
      nanobananapro: 3
    };
    await refundReplicateBalance(user.id, costMap[activeFittingRoom]);
    toast.error('Ошибка продолжения генерации');
    isNanoBananaRequestInProgress.current = false;
  }
}

export function cancelGeneration(params: GenerationParams & { taskId: string | null }) {
  const {
    setIsGenerating,
    setGenerationStatus,
    setWaitingContinue,
    setIntermediateResult,
    setGeneratedImage,
    setCurrentStep,
    setTotalSteps,
    setTaskId,
    setPollingInterval,
    setCheckerInterval,
    isNanoBananaRequestInProgress,
  } = params;

  setIsGenerating(false);
  setGenerationStatus('');
  setWaitingContinue(false);
  setTaskId(null);
  setCurrentStep(0);
  setTotalSteps(0);
  
  if (params.setPollingInterval) {
    clearInterval(params.setPollingInterval as any);
  }
  setPollingInterval(null);
  
  if (params.setCheckerInterval) {
    clearInterval(params.setCheckerInterval as any);
  }
  setCheckerInterval(null);
  
  isNanoBananaRequestInProgress.current = false;
  
  toast.info('Генерация отменена');
}
