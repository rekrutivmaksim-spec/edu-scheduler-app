import { API } from '@/lib/api-urls';

const API_URL = API.AUTH;

export interface User {
  id: number;
  email: string;
  full_name: string;
  university?: string;
  faculty?: string;
  course?: string;
  subscription_type?: string;
  subscription_expires_at?: string;
  onboarding_completed?: boolean;
  grade?: string;
  goal?: string;
  exam_type?: string;
  exam_subject?: string;
  exam_date?: string;
}

export const authService = {
  getToken: (): string | null => {
    return localStorage.getItem('token');
  },

  setToken: (token: string): void => {
    localStorage.setItem('token', token);
    try {
      const w = window as unknown as { RuStorePush?: { saveAuthToken: (t: string) => void } };
      if (w.RuStorePush?.saveAuthToken) {
        w.RuStorePush.saveAuthToken(token);
      }
    } catch (e) {
      console.warn('RuStorePush.saveAuthToken failed', e);
    }
  },

  getUser: (): User | null => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  setUser: (user: User): void => {
    localStorage.setItem('user', JSON.stringify(user));
  },

  isAuthenticated: (): boolean => {
    return !!authService.getToken();
  },

  logout: (): void => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  verifyToken: async (): Promise<User | null> => {
    const token = authService.getToken();
    if (!token) return null;

    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('user', JSON.stringify(data.user));
        return data.user;
      } else {
        authService.logout();
        return null;
      }
    } catch {
      return null;
    }
  }
};