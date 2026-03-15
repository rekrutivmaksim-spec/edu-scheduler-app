import { toast } from 'sonner';
import { GENERATION_COST } from '@/config/prices';

interface User {
  id: string;
  email: string;
  name: string;
}

export interface BalanceCheckResult {
  canGenerate: boolean;
  steps: number;
  totalCost: number;
}

export const checkReplicateBalance = async (
  user: User | null,
  garmentCount: number
): Promise<BalanceCheckResult> => {
  if (!user) {
    toast.error('Для генерации изображений необходимо войти в аккаунт');
    return { canGenerate: false, steps: 0, totalCost: 0 };
  }

  const steps = garmentCount;
  const costPerStep = GENERATION_COST;
  const totalCost = steps * costPerStep;

  try {
    const balanceCheck = await fetch('https://functions.poehali.dev/68409278-10ab-4733-b48d-b1b4360620a1', {
      credentials: 'include'
    });

    if (balanceCheck.ok) {
      const balanceData = await balanceCheck.json();
      
      if (!balanceData.can_generate) {
        toast.error(`Недостаточно средств. Требуется ${totalCost}₽ (${steps} шаг${steps > 1 ? 'а' : ''}). Пополните баланс в личном кабинете.`);
        return { canGenerate: false, steps, totalCost };
      }

      return { canGenerate: true, steps, totalCost };
    } else {
      toast.error('Ошибка проверки баланса');
      return { canGenerate: false, steps, totalCost };
    }
  } catch (error) {
    toast.error('Ошибка проверки баланса');
    return { canGenerate: false, steps, totalCost };
  }
};

export const deductReplicateBalance = async (
  user: User | null,
  steps: number
): Promise<boolean> => {
  if (!user) {
    return false;
  }

  const costPerStep = GENERATION_COST;
  const totalCost = steps * costPerStep;

  try {
    const deductResponse = await fetch('https://functions.poehali.dev/68409278-10ab-4733-b48d-b1b4360620a1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        action: 'deduct',
        steps: steps
      })
    });

    if (!deductResponse.ok) {
      const errorData = await deductResponse.json();
      toast.error(errorData.error || 'Ошибка списания средств');
      return false;
    }

    const deductData = await deductResponse.json();
    
    if (deductData.free_try) {
      toast.info(`Бесплатная примерка! Осталось: ${deductData.remaining_free}`);
    } else if (deductData.paid_try) {
      toast.info(`Списано ${totalCost}₽ (${steps} шаг${steps > 1 ? 'а' : ''}). Баланс: ${deductData.new_balance.toFixed(2)}₽`);
    } else if (deductData.unlimited) {
      toast.info('Безлимитный доступ активен');
    }

    return true;
  } catch (error) {
    toast.error('Ошибка списания средств');
    return false;
  }
};

export const refundReplicateBalance = async (
  user: User | null,
  steps: number
): Promise<boolean> => {
  if (!user) {
    return false;
  }

  try {
    const refundResponse = await fetch('https://functions.poehali.dev/68409278-10ab-4733-b48d-b1b4360620a1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        action: 'refund',
        steps: steps
      })
    });

    if (!refundResponse.ok) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};