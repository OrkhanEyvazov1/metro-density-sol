import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  AUTH_TOKEN_KEY,
  AUTH_TOKEN_VALUE,
} from "@/constants";

interface AuthContextValue {
  isAuthenticated: boolean;
  /** Returns true on success, false on bad credentials. */
  login(username: string, password: string): boolean;
  logout(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * sessionStorage-backed auth context.
 *
 * No real backend auth — credentials are hardcoded for the hackathon. The
 * token lives only for the tab session so closing the browser logs the
 * operator out automatically.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(AUTH_TOKEN_KEY) === AUTH_TOKEN_VALUE;
    } catch {
      return false;
    }
  });

  // Cross-tab logout: react to other tabs clearing storage.
  useEffect(() => {
    function handler(e: StorageEvent) {
      if (e.key === AUTH_TOKEN_KEY && e.newValue == null) {
        setIsAuthenticated(false);
      }
    }
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const login = useCallback((username: string, password: string): boolean => {
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      try {
        sessionStorage.setItem(AUTH_TOKEN_KEY, AUTH_TOKEN_VALUE);
      } catch {
        /* storage might be disabled — auth still works for this tab */
      }
      setIsAuthenticated(true);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
      /* noop */
    }
    setIsAuthenticated(false);
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated, login, logout }),
    [isAuthenticated, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
