export const isAndroidApp = (): boolean => {
  try {
    const ua = navigator.userAgent;
    return /Android/.test(ua) && /wv|Capacitor/.test(ua);
  } catch (_e) {
    return false;
  }
};

export default { isAndroidApp };
