export function safeOpenUrl(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_system';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try { document.body.removeChild(a); } catch { /* ok */ }
  }, 200);
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
