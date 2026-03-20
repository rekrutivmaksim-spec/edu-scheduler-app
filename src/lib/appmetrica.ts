const COUNTER_ID = "3751314";

declare global {
  interface Window {
    _tmr: Array<Record<string, unknown>>;
  }
}

function tmr(event: Record<string, unknown>) {
  window._tmr = window._tmr || [];
  window._tmr.push({ id: COUNTER_ID, ...event });
}

export const am = {
  // Просмотр экрана
  hit(path: string) {
    tmr({ type: "pageView", url: path });
  },

  // Произвольное событие
  event(name: string, params?: Record<string, unknown>) {
    tmr({ type: "reachGoal", goal: name, ...params });
  },

  // Регистрация
  register(method: 'phone' | 'vk' | 'guest') {
    tmr({ type: "reachGoal", goal: "registration_complete", method });
  },

  // Вход
  login(method: 'phone' | 'vk') {
    tmr({ type: "reachGoal", goal: "login", method });
  },

  // Онбординг: шаг (step=0..N, name — название шага)
  onboardingStep(step: number, total: number, name: string) {
    tmr({ type: "reachGoal", goal: "onboarding_step", step, total, step_name: name });
  },

  // Онбординг завершён
  onboardingComplete(goal: string, companion: string) {
    tmr({ type: "reachGoal", goal: "onboarding_complete", user_goal: goal, companion });
  },

  // Начало триала
  trialStart() {
    tmr({ type: "reachGoal", goal: "trial_start" });
  },

  // Открытие страницы оплаты (source — откуда пришёл)
  pricingView(source: string) {
    tmr({ type: "reachGoal", goal: "pricing_view", source });
  },

  // Клик на кнопку оплаты
  purchaseClick(plan: string) {
    tmr({ type: "reachGoal", goal: "purchase_click", plan });
  },

  // Успешная оплата
  purchaseSuccess(plan: string) {
    tmr({ type: "reachGoal", goal: "purchase_success", plan });
  },

  // Сообщение в ассистенте
  assistantMessage(msg_type: 'text' | 'voice' | 'photo') {
    tmr({ type: "reachGoal", goal: "assistant_message", msg_type });
  },

  // Достигнут лимит (пользователь упёрся в ограничение)
  limitReached(limit_type: 'daily' | 'audio' | 'photo') {
    tmr({ type: "reachGoal", goal: "limit_reached", limit_type });
  },

  // Клик на кнопку Premium из любого места
  premiumClick(source: string) {
    tmr({ type: "reachGoal", goal: "premium_click", source });
  },

  // Клик на кнопку ассистента с главной
  assistantOpen(source: string) {
    tmr({ type: "reachGoal", goal: "assistant_open", source });
  },

  // UTM параметры при первом входе
  utmCapture(params: Record<string, string>) {
    tmr({ type: "reachGoal", goal: "utm_capture", ...params });
  },
};
