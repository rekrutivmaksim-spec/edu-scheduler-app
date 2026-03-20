const API_KEY = 'f1d7dd79-7a82-4e32-9218-d04df31b7a15';

function sendEvent(name: string, params?: Record<string, unknown>) {
  try {
    navigator.sendBeacon(
      `https://report.appmetrica.yandex.net/report?api_key=${API_KEY}`,
      JSON.stringify({ event_name: name, event_params: params || {}, timestamp: Date.now() })
    );
  } catch (e) {
    console.debug('AppMetrica', e);
  }
}

export const am = {
  hit(path: string) {
    sendEvent('screen_view', { path });
  },

  event(name: string, params?: Record<string, unknown>) {
    sendEvent(name, params);
  },

  register(method: 'phone' | 'vk' | 'guest') {
    sendEvent('registration_complete', { method });
  },

  login(method: 'phone' | 'vk') {
    sendEvent('login', { method });
  },

  onboardingStep(step: number, total: number) {
    sendEvent('onboarding_step', { step, total });
  },

  onboardingComplete() {
    sendEvent('onboarding_complete');
  },

  trialStart() {
    sendEvent('trial_start');
  },

  pricingView(source?: string) {
    sendEvent('pricing_view', { source });
  },

  purchaseClick(plan: string, price: number) {
    sendEvent('purchase_click', { plan, price });
  },

  purchaseSuccess(plan: string, price: number) {
    sendEvent('purchase_success', { plan, price });
  },

  assistantMessage(type: 'text' | 'voice' | 'photo') {
    sendEvent('assistant_message', { type });
  },

  limitReached(type: 'daily' | 'audio' | 'photo') {
    sendEvent('limit_reached', { type });
  },
};
