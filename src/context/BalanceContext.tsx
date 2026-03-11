import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';

const USER_BALANCE_API = 'https://functions.poehali.dev/68409278-10ab-4733-b48d-b1b4360620a1';

interface BalanceInfo {
  balance: number;
  free_tries_remaining: number;
  paid_tries_available: number;
  unlimited_access: boolean;
  can_generate: boolean;
}

interface BalanceContextType {
  balanceInfo: BalanceInfo | null;
  isLoading: boolean;
  refreshBalance: () => Promise<void>;
}

const BalanceContext = createContext<BalanceContextType | undefined>(undefined);

export function BalanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [balanceInfo, setBalanceInfo] = useState<BalanceInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUserId, setLastUserId] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!user) {
      setBalanceInfo(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(USER_BALANCE_API, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setBalanceInfo(data);
      } else {
        console.error('Failed to fetch balance:', response.status);
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && user.id !== lastUserId) {
      setLastUserId(user.id);
      fetchBalance();
    } else if (!user) {
      setBalanceInfo(null);
      setLastUserId(null);
    }
  }, [user, lastUserId, fetchBalance]);

  const refreshBalance = useCallback(async () => {
    await fetchBalance();
  }, [fetchBalance]);

  return (
    <BalanceContext.Provider value={{ balanceInfo, isLoading, refreshBalance }}>
      {children}
    </BalanceContext.Provider>
  );
}

export function useBalance() {
  const context = useContext(BalanceContext);
  if (context === undefined) {
    throw new Error('useBalance must be used within a BalanceProvider');
  }
  return context;
}
