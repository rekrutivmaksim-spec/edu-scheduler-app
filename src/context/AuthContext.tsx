import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  email_verified?: boolean;
  balance?: number;
  unlimited_access?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  updateUser: (userData: User) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_API = 'https://functions.poehali.dev/589c58eb-91b4-4f2a-923c-6a91ed722a82';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    // Проверяем сессию только один раз при загрузке приложения
    if (sessionChecked) return;

    const validateSession = async () => {
      try {
        const response = await fetch(AUTH_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action: 'validate' })
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.session_token) {
            localStorage.setItem('session_token', data.session_token);
          }
          
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Session validation failed:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
        setSessionChecked(true);
      }
    };

    validateSession();
  }, [sessionChecked]);

  const login = async (email: string, password: string) => {
    const response = await fetch(AUTH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'login', email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    if (data.session_token) {
      localStorage.setItem('session_token', data.session_token);
    }

    setUser(data.user);
    setSessionChecked(true);
  };

  const register = async (email: string, password: string, name: string) => {
    const response = await fetch(AUTH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'register', email, password, name })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }
  };

  const logout = async () => {
    try {
      await fetch(AUTH_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'logout' })
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
    localStorage.removeItem('session_token');
    setUser(null);
    setSessionChecked(false);
  };

  const updateUser = (userData: User) => {
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}