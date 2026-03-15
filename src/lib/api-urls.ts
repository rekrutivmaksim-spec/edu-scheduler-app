import urls from '../../backend/func2url.json';

export const API = {
  AUTH: urls['auth'],
  AI_ASSISTANT: urls['ai-assistant'],
  SUBSCRIPTION: urls['subscription'],
  VK_AUTH: urls['vk-auth'],
  PAYMENTS: urls['payments'],
  GAMIFICATION: urls['gamification'],
  MATERIALS: urls['materials'],
  SCHEDULE: urls['schedule'],
  UNIVERSITIES: urls['universities'],
  SESSION_DATA: urls['session-data'],
  FLASHCARDS: urls['flashcards'],
  STUDY_PLAN: urls['study-plan'],
  STATS: urls['stats'],
  SHARING: urls['sharing'],
  NOTIFICATIONS: urls['notifications'],
  PUSH_NOTIFICATIONS: urls['push-notifications'],
  MOCK_EXAM_GEN: urls['mock-exam-gen'],
  GRADE_TRACKER: urls['grade-tracker'],
  STUDY_GROUPS: urls['study-groups'],
  POMODORO: urls['scheduler'],
  PARENT_DASHBOARD: urls['parent-dashboard'],
  SMS_AUTH: urls['sms-auth'],
  TRIAL_REMINDER: urls['trial-reminder'],
  AUTO_CHARGE: urls['auto-charge'],
} as const;

export default API;
