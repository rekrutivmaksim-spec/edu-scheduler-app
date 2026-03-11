import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export async function openPaymentUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url, presentationStyle: 'popover' });
  } else {
    window.location.href = url;
  }
}

export function setupPaymentReturnListener(callback: () => void): () => void {
  if (Capacitor.isNativePlatform()) {
    const listener = Browser.addListener('browserFinished', () => {
      callback();
    });
    return () => { listener.then(l => l.remove()); };
  }
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') callback();
  };
  document.addEventListener('visibilitychange', handleVisibility);
  return () => document.removeEventListener('visibilitychange', handleVisibility);
}
