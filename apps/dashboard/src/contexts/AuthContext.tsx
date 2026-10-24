import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Developer } from '@hookrelay/shared';
import { authApi } from '../lib/api.js';

interface AuthContextValue {
  developer: Developer | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string, companyName?: string): Promise<void>;
  refreshDeveloper(): Promise<Developer>;
  logout(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    if (!localStorage.getItem('hookrelay_token')) {
      setIsLoading(false);
      return () => {
        isActive = false;
      };
    }

    void authApi
      .getMe()
      .then((currentDeveloper) => {
        if (isActive) setDeveloper(currentDeveloper);
      })
      .catch(() => {
        localStorage.removeItem('hookrelay_token');
        if (isActive) setDeveloper(null);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    setDeveloper(result.developer);
  }, []);

  const register = useCallback(async (email: string, password: string, companyName?: string) => {
    const result = await authApi.register(email, password, companyName);
    setDeveloper(result.developer);
  }, []);

  const refreshDeveloper = useCallback(async () => {
    const currentDeveloper = await authApi.getMe();
    setDeveloper(currentDeveloper);
    return currentDeveloper;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('hookrelay_token');
    setDeveloper(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      developer,
      isAuthenticated: developer !== null,
      isLoading,
      login,
      register,
      refreshDeveloper,
      logout,
    }),
    [developer, isLoading, login, register, refreshDeveloper, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
