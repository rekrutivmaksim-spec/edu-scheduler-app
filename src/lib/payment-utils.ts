import { safeOpenUrl, setupBrowserReturnListener } from '@/lib/safe-browser';

export async function openPaymentUrl(url: string): Promise<void> {
  await safeOpenUrl(url);
}

export function setupPaymentReturnListener(callback: () => void): () => void {
  return setupBrowserReturnListener(callback);
}
