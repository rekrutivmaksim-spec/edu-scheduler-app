export function safeOpenUrl(url: string): void {
  const isAndroidWebView = /wv|Android.*Version\/[\d.]+/.test(navigator.userAgent);
   
  const isCapacitor = !!(window as unknown as Record<string, unknown>).Capacitor;
   
  const isCordova = !!(window as unknown as Record<string, unknown>).cordova;

  if (isAndroidWebView || isCapacitor || isCordova) {
    window.location.href = url;
    return;
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    window.location.href = url;
  }
}

export function setupBrowserReturnListener(callback: () => void): () => void {
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