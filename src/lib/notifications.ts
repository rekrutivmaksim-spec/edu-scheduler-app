const VAPID_PUBLIC_KEY = 'BNxPVqJ9YHzQz9rN8K7fM3LdT6vY5Xw8GhJkLmNpQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWxYzA1234567890';

export const notificationService = {
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('Браузер не поддерживает уведомления');
    }

    const permission = await Notification.requestPermission();
    return permission;
  },

  async registerServiceWorker(): Promise<ServiceWorkerRegistration> {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker не поддерживается');
    }

    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return registration;
  },

  async subscribe(token: string): Promise<PushSubscription> {
    const registration = await this.registerServiceWorker();
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    await this.sendSubscriptionToServer(subscription, token);
    return subscription;
  },

  async sendSubscriptionToServer(subscription: PushSubscription, token: string): Promise<void> {
    const NOTIFICATIONS_URL = 'https://functions.poehali.dev/710399d8-fbc7-4df6-8c6c-200b2828678f';
    
    const response = await fetch(NOTIFICATIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'subscribe',
        subscription: subscription.toJSON()
      })
    });

    if (!response.ok) {
      throw new Error('Не удалось подписаться на уведомления');
    }
  },

  async unsubscribe(token: string): Promise<void> {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await subscription.unsubscribe();
    
    const NOTIFICATIONS_URL = 'https://functions.poehali.dev/710399d8-fbc7-4df6-8c6c-200b2828678f';
    await fetch(NOTIFICATIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'unsubscribe'
      })
    });
  },

  async getSubscription(): Promise<PushSubscription | null> {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return null;
    return await registration.pushManager.getSubscription();
  },

  urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  },

  isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  },

  getPermission(): NotificationPermission {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission;
  }
};