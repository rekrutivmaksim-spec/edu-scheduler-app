const STORAGE_KEY = 'studyfay_review_prompt';

export interface ReviewState {
  promptShownAt?: number;
  reviewed?: boolean;
  dismissedAt?: number;
  sessionsCount: number;
  lastSessionAt?: number;
}

export function loadReviewState(): ReviewState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('review state load:', e);
  }
  return { sessionsCount: 0 };
}

export function saveReviewState(s: ReviewState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function trackSession() {
  const s = loadReviewState();
  const lastDay = s.lastSessionAt ? new Date(s.lastSessionAt).toDateString() : null;
  const today = new Date().toDateString();
  if (lastDay !== today) {
    s.sessionsCount = (s.sessionsCount || 0) + 1;
    s.lastSessionAt = Date.now();
    saveReviewState(s);
  }
}
