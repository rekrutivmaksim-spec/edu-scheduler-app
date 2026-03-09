interface RuStoreBillingBridge {
  isAvailable(): boolean;
  purchase(productId: string): void;
  getProducts(productIdsJson: string): string;
  getPurchases(): string;
  confirmPurchase(purchaseId: string): void;
}

export interface RuStoreProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  priceAmount: number;
}

export interface RuStorePurchase {
  purchaseId: string;
  productId: string;
  purchaseToken: string;
  purchaseState: number;
}

export interface PurchaseResult {
  success: boolean;
  purchaseToken?: string;
  productId?: string;
  error?: string;
}

const RUSTORE_PRODUCT_MAP: Record<string, string> = {
  '1month': 'premium_1month',
  '6months': 'premium_6months',
  '1year': 'premium_1year',
  'questions_20': 'questions_20',
  'questions_15': 'questions_15',
  'questions_30': 'questions_30',
  'questions_100': 'questions_100',
};

const getBridge = (): RuStoreBillingBridge | null => {
  try {
    const w = window as unknown as Record<string, unknown>;
    const bridge = w.RuStoreBilling as RuStoreBillingBridge | undefined;
    if (bridge && typeof bridge.isAvailable === 'function') {
      return bridge;
    }
  } catch (_e) { /* bridge not injected */ }
  return null;
};

export const isAndroidApp = (): boolean => {
  try {
    const ua = navigator.userAgent;
    return /Android/.test(ua) && /wv|Capacitor/.test(ua);
  } catch (_e) {
    return false;
  }
};

export const isRuStoreAvailable = (): boolean => {
  const bridge = getBridge();
  if (!bridge) return false;
  try {
    return bridge.isAvailable();
  } catch (_e) {
    return false;
  }
};

export const getRuStoreProductId = (planId: string): string => {
  return RUSTORE_PRODUCT_MAP[planId] || `premium_${planId}`;
};

let purchaseResolver: ((result: PurchaseResult) => void) | null = null;

export const purchaseSubscription = (planId: string): Promise<PurchaseResult> => {
  return new Promise((resolve) => {
    const bridge = getBridge();
    if (!bridge) {
      resolve({ success: false, error: 'RuStore Billing недоступен' });
      return;
    }

    purchaseResolver = resolve;
    const productId = getRuStoreProductId(planId);

    try {
      bridge.purchase(productId);
    } catch (error) {
      purchaseResolver = null;
      resolve({ success: false, error: String(error) });
    }

    setTimeout(() => {
      if (purchaseResolver === resolve) {
        purchaseResolver = null;
        resolve({ success: false, error: 'Время ожидания оплаты истекло' });
      }
    }, 5 * 60 * 1000);
  });
};

const w = window as unknown as Record<string, unknown>;
w.onRuStorePurchaseResult = (resultJson: string) => {
  try {
    const result = JSON.parse(resultJson);
    if (purchaseResolver) {
      purchaseResolver({
        success: result.success === true,
        purchaseToken: result.purchaseToken,
        productId: result.productId,
        error: result.error,
      });
      purchaseResolver = null;
    }
  } catch (e) {
    console.error('[RuStore] Failed to parse purchase result:', e);
    if (purchaseResolver) {
      purchaseResolver({ success: false, error: 'Ошибка обработки результата' });
      purchaseResolver = null;
    }
  }
};

export const validatePurchaseOnServer = async (
  paymentsUrl: string,
  authToken: string,
  purchaseToken: string,
  planType: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch(paymentsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        action: 'rustore_validate',
        purchase_token: purchaseToken,
        plan_type: planType,
      }),
    });

    const data = await response.json();

    if (data.success && data.status === 'activated') {
      return { success: true };
    }
    return { success: false, error: data.error || `Статус: ${data.status}` };
  } catch (_error) {
    return { success: false, error: 'Ошибка связи с сервером' };
  }
};

export default {
  isAndroidApp,
  isRuStoreAvailable,
  purchaseSubscription,
  validatePurchaseOnServer,
  getRuStoreProductId,
};