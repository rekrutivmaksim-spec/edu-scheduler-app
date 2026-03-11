import { Capacitor } from '@capacitor/core';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let browserPlugin: any = null;
let browserChecked = false;

async function getBrowserPlugin() {
  if (browserChecked) return browserPlugin;
  browserChecked = true;
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const mod = await import('@capacitor/browser');
    browserPlugin = mod.Browser;
  } catch {
    browserPlugin = null;
  }
  return browserPlugin;
}

export async function safeOpenUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const Browser = await getBrowserPlugin();
      if (Browser) {
        await Browser.open({ url, presentationStyle: 'popover' });
        return;
      }
    } catch { /* fallback below */ }
  }

  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    window.location.href = url;
  }
}

export function setupBrowserReturnListener(callback: () => void): () => void {
  if (Capacitor.isNativePlatform()) {
    getBrowserPlugin().then(Browser => {
      if (Browser) {
        Browser.addListener('browserFinished', callback).catch(() => {});
      }
    }).catch(() => {});
  }

  const handleReturn = () => {
    if (document.visibilityState === 'visible') callback();
  };
  document.addEventListener('visibilitychange', handleReturn);
  window.addEventListener('focus', handleReturn);
  return () => {
    document.removeEventListener('visibilitychange', handleReturn);
    window.removeEventListener('focus', handleReturn);
  };
}

export default safeOpenUrl;
