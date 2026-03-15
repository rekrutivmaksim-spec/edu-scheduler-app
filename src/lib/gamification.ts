import { authService } from '@/lib/auth';
import { API } from '@/lib/api-urls';

const GAMIFICATION_URL = API.GAMIFICATION;

type ActivityType = 'tasks_completed' | 'pomodoro_minutes' | 'ai_questions_asked' | 'materials_uploaded' | 'schedule_views' | 'exam_tasks_done';

// Стоимость репетитора: 1500₽/ч, ~10 мин на задание => 250₽ за задание
export const TUTOR_SAVINGS_PER_TASK = 250;

interface TrackResult {
  success: boolean;
  xp_gained: number;
  total_xp: number;
  level: number;
  new_achievements: Array<{
    code: string;
    title: string;
    description: string;
    icon: string;
    xp_reward: number;
    category: string;
  }>;
}

export async function trackActivity(type: ActivityType, value: number = 1): Promise<TrackResult | null> {
  try {
    const token = authService.getToken();
    if (!token) return null;

    const response = await fetch(GAMIFICATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ action: 'track', type, value })
    });

    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}

export async function dailyCheckin(): Promise<TrackResult | null> {
  try {
    const token = authService.getToken();
    if (!token) return null;

    const response = await fetch(GAMIFICATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ action: 'checkin' })
    });

    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}

export interface DailyLoginBonusResult {
  success: boolean;
  already_claimed: boolean;
  bonus: number;
  xp_earned: number;
  streak_day: number;
  message: string;
}

export async function claimDailyLoginBonus(): Promise<DailyLoginBonusResult | null> {
  try {
    const token = authService.getToken();
    if (!token) return null;

    const response = await fetch(GAMIFICATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ action: 'daily_login_bonus' })
    });

    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}

export default { trackActivity, dailyCheckin, claimDailyLoginBonus };