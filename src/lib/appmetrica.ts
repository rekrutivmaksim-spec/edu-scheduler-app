const COUNTER = 108174568;

declare global {
  interface Window {
    ym: (id: number, action: string, target?: string, params?: Record<string, unknown>) => void;
  }
}

function ym(action: string, target?: string, params?: Record<string, unknown>) {
  if (typeof window.ym !== 'function') return;
  if (target) {
    window.ym(COUNTER, action, target, params);
  } else {
    window.ym(COUNTER, action);
  }
}

export const am = {
  hit(path: string) {
    ym('hit', path);
  },

  event(name: string, params?: Record<string, unknown>) {
    ym('reachGoal', name, params);
  },

  register(method: 'phone' | 'vk' | 'guest') {
    ym('reachGoal', 'registration_complete', { method });
  },

  login(method: 'phone' | 'vk') {
    ym('reachGoal', 'login', { method });
  },

  onboardingStep(step: number, total: number) {
    ym('reachGoal', 'onboarding_step', { step, total });
  },

  onboardingComplete() {
    ym('reachGoal', 'onboarding_complete');
  },

  trialStart() {
    ym('reachGoal', 'trial_start');
  },

  pricingView(source?: string) {
    ym('reachGoal', 'pricing_view', { source });
  },

  purchaseClick(plan: string, price: number) {
    ym('reachGoal', 'purchase_click', { plan, price });
  },

  purchaseSuccess(plan: string, price: number) {
    ym('reachGoal', 'purchase_success', { plan, price });
  },

  assistantMessage(type: 'text' | 'voice' | 'photo') {
    ym('reachGoal', 'assistant_message', { type });
  },

  limitReached(type: 'daily' | 'audio' | 'photo') {
    ym('reachGoal', 'limit_reached', { type });
  },
};
