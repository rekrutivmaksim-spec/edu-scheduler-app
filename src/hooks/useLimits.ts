import { useState, useEffect, useCallback } from 'react';
import { authService } from '@/lib/auth';

const SUBSCRIPTION_URL = 'https://functions.poehali.dev/7fe183c2-49af-4817-95f3-6ab4912778c4';

export interface LimitItem {
  used: number;
  max: number | null;
  unlimited: boolean;
}

export interface Limits {
  ai_questions: LimitItem & { daily_limit?: number; bonus_available?: number };
  sessions: LimitItem;
  materials: LimitItem;
  exam_predictions: { unlimited: boolean; available?: boolean };
  schedule: LimitItem;
  tasks: LimitItem;
}

export interface LimitsData {
  is_premium: boolean;
  is_trial: boolean;
  is_soft_landing: boolean;
  soft_landing_days_left?: number;
  subscription_type: 'free' | 'premium';
  subscription_expires_at: string | null;
  trial_ends_at: string | null;
  limits: Limits;
}

const DEFAULT_LIMITS: LimitsData = {
  is_premium: false,
  is_trial: false,
  is_soft_landing: false,
  subscription_type: 'free',
  subscription_expires_at: null,
  trial_ends_at: null,
  limits: {
    ai_questions: { used: 0, max: 3, unlimited: false },
    sessions: { used: 0, max: 1, unlimited: false },
    materials: { used: 0, max: 1, unlimited: false },
    exam_predictions: { unlimited: false, available: false },
    schedule: { used: 0, max: 7, unlimited: false },
    tasks: { used: 0, max: 10, unlimited: false },
  },
};

export function useLimits() {
  const [data, setData] = useState<LimitsData>(DEFAULT_LIMITS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const token = authService.getToken();
      if (!token) return;
      const res = await fetch(`${SUBSCRIPTION_URL}?action=limits`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const canUseAI = (): boolean => {
    const ai = data.limits.ai_questions;
    if (ai.unlimited) return true;
    return (ai.used ?? 0) < (ai.max ?? 3);
  };

  const canStartSession = (): boolean => {
    const s = data.limits.sessions;
    if (s.unlimited) return true;
    return (s.used ?? 0) < (s.max ?? 1);
  };

  const canUploadMaterial = (): boolean => {
    const m = data.limits.materials;
    if (m.unlimited) return true;
    return (m.used ?? 0) < (m.max ?? 1);
  };

  const canUseExam = (): boolean => {
    return data.limits.exam_predictions?.unlimited || data.is_premium || data.is_trial;
  };

  const aiRemaining = (): number => {
    const ai = data.limits.ai_questions;
    if (ai.unlimited) return 999;
    return Math.max(0, (ai.max ?? 3) - (ai.used ?? 0));
  };

  const sessionsRemaining = (): number => {
    const s = data.limits.sessions;
    if (s.unlimited) return 999;
    return Math.max(0, (s.max ?? 1) - (s.used ?? 0));
  };

  const materialsRemaining = (): number => {
    const m = data.limits.materials;
    if (m.unlimited) return 999;
    return Math.max(0, (m.max ?? 1) - (m.used ?? 0));
  };

  return {
    data,
    loading,
    reload: load,
    canUseAI,
    canStartSession,
    canUploadMaterial,
    canUseExam,
    aiRemaining,
    sessionsRemaining,
    materialsRemaining,
    isPremium: data.is_premium,
    isTrial: data.is_trial,
  };
}
