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
// Legacy compat -- the old service-worker-based notificationService object
// that other components still import.
// ---------------------------------------------------------------------------
export const notificationService = {
  async requestPermission(): Promise<NotificationPermission> {
    return requestPermission();
  },
  isSupported(): boolean {
    return 'Notification' in window;
  },
  getPermission(): NotificationPermission {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission;
  },
  // Stubs for methods that relied on service workers / push subscription.
  // Kept so existing components (NotificationPrompt, etc.) don't break.
  async getSubscription(): Promise<null> {
    return null;
  },
  async subscribe(_token: string): Promise<void> {
    await requestPermission();
  },
  async unsubscribe(_token: string): Promise<void> {
    const settings = loadSettings();
    settings.enabled = false;
    saveSettings(settings);
    cancelAllNotifications();
  },
};

export default notificationService;
