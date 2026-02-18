const API_URL = 'https://functions.poehali.dev/0c04829e-3c05-40bd-a560-5dcd6c554dd5';

export interface User {
  id: number;
  email: string;
  full_name: string;
  university?: string;
  faculty?: string;
  course?: string;
}

export const authService = {
  getToken: (): string | null => {
    return localStorage.getItem('token');
  },

  setToken: (token: string): void => {
    localStorage.setItem('token', token);
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

    // Для гостевого режима не проверяем токен на бэкенде
    if (token === 'guest_token') {
      return authService.getUser();
    }

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