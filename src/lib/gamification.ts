import { authService } from '@/lib/auth';

const GAMIFICATION_URL = 'https://functions.poehali.dev/0559fb04-cd62-4e50-bb12-dfd6941a7080';

type ActivityType = 'tasks_completed' | 'pomodoro_minutes' | 'ai_questions_asked' | 'materials_uploaded' | 'schedule_views';

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

export default { trackActivity, dailyCheckin };
