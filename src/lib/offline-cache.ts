const CACHE_PREFIX = 'studyfay_';

export const offlineCache = {
  save(key: string, data: unknown): void {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) { /* quota exceeded */ }
  },

  load<T>(key: string, maxAgeMs = 24 * 60 * 60 * 1000): T | null {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp > maxAgeMs) return null;
      return parsed.data as T;
    } catch {
      return null;
    }
  },

  clear(key: string): void {
    localStorage.removeItem(CACHE_PREFIX + key);
  }
};

export default offlineCache;