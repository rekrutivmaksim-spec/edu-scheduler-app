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
  hit(path: string) {
    tmr({ type: "pageView", url: path });
  },

  event(name: string, params?: Record<string, unknown>) {
    tmr({ type: "reachGoal", goal: name, ...params });
  },

  register(method: 'phone' | 'vk' | 'guest') {
    tmr({ type: "reachGoal", goal: "registration_complete", method });
  },

  login(method: 'phone' | 'vk') {
    tmr({ type: "reachGoal", goal: "login", method });
  },

  onboardingStep(step: number, total: number) {
    tmr({ type: "reachGoal", goal: "onboarding_step", step, total });
  },

  onboardingComplete() {
    tmr({ type: "reachGoal", goal: "onboarding_complete" });
  },

  trialStart() {
    tmr({ type: "reachGoal", goal: "trial_start" });
  },

  pricingView(source?: string) {
    tmr({ type: "reachGoal", goal: "pricing_view", source });
  },

  purchaseClick(plan: string, price: number) {
    tmr({ type: "reachGoal", goal: "purchase_click", plan, price });
  },

  purchaseSuccess(plan: string, price: number) {
    tmr({ type: "reachGoal", goal: "purchase_success", plan, price });
  },

  assistantMessage(type: 'text' | 'voice' | 'photo') {
    tmr({ type: "reachGoal", goal: "assistant_message", msg_type: type });
  },

  limitReached(type: 'daily' | 'audio' | 'photo') {
    tmr({ type: "reachGoal", goal: "limit_reached", limit_type: type });
  },
};
