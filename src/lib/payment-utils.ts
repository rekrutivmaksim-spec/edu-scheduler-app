import { safeOpenUrl, setupBrowserReturnListener } from '@/lib/safe-browser';

export function openPaymentUrl(url: string): void {
  safeOpenUrl(url);
}

export function setupPaymentReturnListener(callback: () => void): () => void {
  return setupBrowserReturnListener(callback);
}
