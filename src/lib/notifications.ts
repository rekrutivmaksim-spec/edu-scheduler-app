/**
 * Browser notification service for Studyfay.
 *
 * Uses the Notification API with setTimeout-based scheduling.
 * Designed to work while the PWA tab is open in the foreground --
 * no service worker registration is required.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LessonInfo {
  subject: string;
  time: string;       // "HH:MM" (24-hour)
  room?: string;
  day: number;         // 1 = Monday ... 7 = Sunday
}

export interface TaskInfo {
  title: string;
  deadline: string;    // ISO 8601 date-time string
  priority: string;    // "high" | "medium" | "low"
}

interface NotificationSettings {
  enabled: boolean;
  classReminderMinutes: number;
  taskDeadlineHoursBefore: number;
  taskMorningReminder: boolean;
  dismissed: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'studyfay_notification_settings';
const DISMISSED_KEY = 'studyfay_notification_banner_dismissed';

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  classReminderMinutes: 15,
  taskDeadlineHoursBefore: 1,
  taskMorningReminder: true,
  dismissed: false,
};

// ---------------------------------------------------------------------------
// Timer bookkeeping
// ---------------------------------------------------------------------------

let activeTimerIds: ReturnType<typeof setTimeout>[] = [];

function storeTimer(id: ReturnType<typeof setTimeout>): void {
  activeTimerIds.push(id);
}

// ---------------------------------------------------------------------------
// Settings persistence
// ---------------------------------------------------------------------------

function loadSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // corrupted data -- fall through
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: NotificationSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the JS day number (0 = Sun, 1 = Mon, ..., 6 = Sat) that
 * corresponds to the schedule's 1-based weekday (1 = Mon ... 7 = Sun).
 */
function scheduleWeekdayToJsDay(day: number): number {
  return day === 7 ? 0 : day;
}

/**
 * Compute how many milliseconds from `now` until the next occurrence of
 * `day` (1=Mon..7=Sun) at `HH:MM`.  If the resulting moment is in the
 * past for this week, it wraps to next week.  A negative `offsetMs` is
 * subtracted (e.g. 15 min before the class).
 */
function msUntilNext(
  day: number,
  timeStr: string,
  offsetMs: number,
  now: Date,
): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const targetJsDay = scheduleWeekdayToJsDay(day);

  const target = new Date(now);
  // Set to today first, then adjust day
  const currentJsDay = now.getDay();
  let dayDiff = targetJsDay - currentJsDay;
  if (dayDiff < 0) dayDiff += 7;

  target.setDate(target.getDate() + dayDiff);
  target.setHours(hours, minutes, 0, 0);

  let ms = target.getTime() - offsetMs - now.getTime();
  if (ms < 0) {
    // Already passed this week -- schedule for next week
    ms += 7 * 24 * 60 * 60 * 1000;
  }
  return ms;
}

function showNotification(title: string, body: string, tag?: string): void {
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: tag ?? undefined,
    });
  } catch (e) {
    console.warn('[notifications] Failed to show notification', e);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Ask the user for notification permission.
 * Resolves to the resulting permission state.
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('[notifications] Notification API not supported');
    return 'denied';
  }
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    const settings = loadSettings();
    settings.enabled = true;
    saveSettings(settings);
  }
  return result;
}

/**
 * Returns `true` when the browser has granted notification permission
 * **and** the user has not explicitly disabled them in our settings.
 */
export function isPermissionGranted(): boolean {
  if (!('Notification' in window)) return false;
  return Notification.permission === 'granted';
}

/**
 * Cancel every previously scheduled notification timer.
 */
export function cancelAllNotifications(): void {
  for (const id of activeTimerIds) {
    clearTimeout(id);
  }
  activeTimerIds = [];
}

/**
 * Schedule browser notifications 15 minutes before each lesson this week.
 * Existing lesson timers are cleared first so the function is idempotent.
 */
export function scheduleClassNotifications(lessons: LessonInfo[]): void {
  // Clear only to avoid duplicates -- we reschedule everything
  cancelAllNotifications();

  if (!isPermissionGranted()) return;
  const settings = loadSettings();
  if (!settings.enabled) return;

  const now = new Date();
  const offsetMs = settings.classReminderMinutes * 60 * 1000;

  for (const lesson of lessons) {
    if (!lesson.time || !lesson.day) continue;
    const ms = msUntilNext(lesson.day, lesson.time, offsetMs, now);
    // Only schedule if within the next 7 days
    if (ms > 7 * 24 * 60 * 60 * 1000) continue;

    const id = setTimeout(() => {
      const roomStr = lesson.room ? ` (${lesson.room})` : '';
      showNotification(
        `${lesson.subject} через ${settings.classReminderMinutes} мин`,
        `Начало в ${lesson.time}${roomStr}`,
        `class-${lesson.day}-${lesson.time}`,
      );
    }, ms);
    storeTimer(id);
  }
}

/**
 * Schedule browser notifications for tasks:
 *  - 1 hour before the deadline
 *  - At 09:00 on the day of the deadline (morning reminder)
 */
export function scheduleTaskNotifications(tasks: TaskInfo[]): void {
  if (!isPermissionGranted()) return;
  const settings = loadSettings();
  if (!settings.enabled) return;

  const now = new Date();

  for (const task of tasks) {
    if (!task.deadline) continue;

    const deadline = new Date(task.deadline);
    if (isNaN(deadline.getTime())) continue;

    // --- 1 hour before deadline ---
    const msBeforeDeadline =
      deadline.getTime() - settings.taskDeadlineHoursBefore * 60 * 60 * 1000 - now.getTime();
    if (msBeforeDeadline > 0) {
      const id = setTimeout(() => {
        const priorityLabel = task.priority === 'high' ? ' (важное!)' : '';
        showNotification(
          `Дедлайн через ${settings.taskDeadlineHoursBefore} ч${priorityLabel}`,
          task.title,
          `task-hour-${task.deadline}`,
        );
      }, msBeforeDeadline);
      storeTimer(id);
    }

    // --- Morning of the deadline (09:00) ---
    if (settings.taskMorningReminder) {
      const morning = new Date(deadline);
      morning.setHours(9, 0, 0, 0);
      const msMorning = morning.getTime() - now.getTime();
      if (msMorning > 0) {
        const id = setTimeout(() => {
          showNotification(
            'Сегодня дедлайн',
            task.title,
            `task-morning-${task.deadline}`,
          );
        }, msMorning);
        storeTimer(id);
      }
    }
  }
}

/**
 * Mark the notification banner as dismissed so it does not reappear.
 */
export function dismissBanner(): void {
  localStorage.setItem(DISMISSED_KEY, 'true');
}

/**
 * Returns `true` when the banner should be shown:
 * permission not yet granted AND user has not dismissed it.
 */
export function shouldShowBanner(): boolean {
  if (!('Notification' in window)) return false;
  if (Notification.permission !== 'default') return false;
  return localStorage.getItem(DISMISSED_KEY) !== 'true';
}

// ---------------------------------------------------------------------------
// Web Push (Service Worker + pushManager)
// ---------------------------------------------------------------------------

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function getVapidPublicKey(): Promise<string> {
  const { API } = await import('@/lib/api-urls');
  const res = await fetch(`${API.PUSH_NOTIFICATIONS}?action=vapid_key`);
  const data = await res.json();
  return data.vapid_public_key as string;
}

async function registerWebPush(token: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[push] serviceWorker or PushManager not supported');
    return;
  }

  try {
    const sw = await navigator.serviceWorker.ready;
    const { API } = await import('@/lib/api-urls');

    // Удаляем старую подписку если есть (могла быть с другим VAPID ключом)
    const existing = await sw.pushManager.getSubscription();
    if (existing) {
      await existing.unsubscribe();
    }

    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) return;

    const subscription = await sw.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const sub = subscription.toJSON();
    await fetch(API.PUSH_NOTIFICATIONS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        action: 'subscribe',
        endpoint: sub.endpoint,
        p256dh: sub.keys?.p256dh,
        auth: sub.keys?.auth,
      }),
    });
  } catch (e) {
    console.error('[push] registerWebPush failed:', e);
    throw e;
  }
}

async function unregisterWebPush(token: string): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const sw = await navigator.serviceWorker.ready;
  const subscription = await sw.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  const { API } = await import('@/lib/api-urls');
  await fetch(API.PUSH_NOTIFICATIONS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'unsubscribe', endpoint }),
  });
}

// ---------------------------------------------------------------------------
// Legacy compat -- the old service-worker-based notificationService object
// that other components still import.
// ---------------------------------------------------------------------------
export const notificationService = {
  async requestPermission(): Promise<NotificationPermission> {
    return requestPermission();
  },
  isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  },
  getPermission(): NotificationPermission {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission;
  },
  async getSubscription(): Promise<PushSubscription | null> {
    if (!('serviceWorker' in navigator)) return null;
    const sw = await navigator.serviceWorker.ready;
    return sw.pushManager.getSubscription();
  },
  async subscribe(token: string): Promise<void> {
    const permission = await requestPermission();
    if (permission !== 'granted') return;
    await registerWebPush(token);
  },
  async unsubscribe(token: string): Promise<void> {
    const settings = loadSettings();
    settings.enabled = false;
    saveSettings(settings);
    cancelAllNotifications();
    await unregisterWebPush(token);
  },
};

export default notificationService;