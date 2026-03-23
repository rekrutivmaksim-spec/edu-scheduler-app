import { useState, useEffect, useCallback } from 'react';
import { useLimits } from '@/hooks/useLimits';

const MAX_HEARTS = 5;
const REFILL_MS = 60 * 60 * 1000; // 1 час
const STORAGE_KEY = 'studyfay_hearts';

interface HeartsState {
  hearts: number;
  lastLostAt: number | null;
}

function loadState(): HeartsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* stored state parse */ }
  return { hearts: MAX_HEARTS, lastLostAt: null };
}

function saveState(state: HeartsState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getRefilled(state: HeartsState): HeartsState {
  if (state.hearts >= MAX_HEARTS || !state.lastLostAt) return state;
  const elapsed = Date.now() - state.lastLostAt;
  const refilled = Math.floor(elapsed / REFILL_MS);
  if (refilled <= 0) return state;
  const newHearts = Math.min(MAX_HEARTS, state.hearts + refilled);
  return {
    hearts: newHearts,
    lastLostAt: newHearts >= MAX_HEARTS ? null : state.lastLostAt + refilled * REFILL_MS,
  };
}

export function useHearts() {
  const limits = useLimits();
  const [state, setState] = useState<HeartsState>(() => getRefilled(loadState()));

  useEffect(() => {
    if (state.hearts >= MAX_HEARTS || !state.lastLostAt) return;
    const remaining = REFILL_MS - (Date.now() - state.lastLostAt);
    const timer = setTimeout(() => {
      const updated = getRefilled(state);
      setState(updated);
      saveState(updated);
    }, Math.max(remaining, 1000));
    return () => clearTimeout(timer);
  }, [state]);

  const loseHeart = useCallback(() => {
    if (limits.isPremium) return;
    setState(prev => {
      const next = { hearts: Math.max(0, prev.hearts - 1), lastLostAt: Date.now() };
      saveState(next);
      return next;
    });
  }, [limits.isPremium]);

  const refillAll = useCallback(() => {
    const next = { hearts: MAX_HEARTS, lastLostAt: null };
    setState(next);
    saveState(next);
  }, []);

  const nextRefillIn = state.lastLostAt && state.hearts < MAX_HEARTS
    ? Math.max(0, REFILL_MS - (Date.now() - state.lastLostAt))
    : 0;

  return {
    hearts: limits.isPremium ? MAX_HEARTS : state.hearts,
    maxHearts: MAX_HEARTS,
    isPremium: limits.isPremium,
    isAlive: limits.isPremium || state.hearts > 0,
    nextRefillIn,
    loseHeart,
    refillAll,
  };
}

export default useHearts;