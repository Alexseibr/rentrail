import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { api, setTokens, clearTokens, setAuthExpiredHandler } from "./api";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuperAdmin: boolean;
  platformRoles?: string[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPlatformAccess: boolean;
}

const PLATFORM_ROLES = ["superAdmin", "platformAdmin", "platformSupport", "platformFinance", "platformRisk"];

const AuthContext = createContext<AuthContextType | null>(null);

function checkPlatformAccess(user: User | null): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return (user.platformRoles || []).some((r) => PLATFORM_ROLES.includes(r));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleLogout = useCallback(() => {
    clearTokens();
    setUser(null);
    try { sessionStorage.removeItem("pa_session"); } catch {}
  }, []);

  useEffect(() => {
    setAuthExpiredHandler(handleLogout);
    try {
      const saved = sessionStorage.getItem("pa_session");
      if (saved) {
        const session = JSON.parse(saved);
        setTokens(session.accessToken, session.refreshToken);
        setUser(session.user);
      }
    } catch {
      sessionStorage.removeItem("pa_session");
    }
    setIsLoading(false);
  }, [handleLogout]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<{
      accessToken: string;
      refreshToken: string;
      user: User;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setTokens(result.accessToken, result.refreshToken);
    setUser(result.user);
    try {
      sessionStorage.setItem(
        "pa_session",
        JSON.stringify({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          user: result.user,
        }),
      );
    } catch {}
  }, []);

  const logout = useCallback(() => {
    api("/auth/logout", { method: "POST" }).catch(() => {});
    handleLogout();
  }, [handleLogout]);

  const hasPlatformAccess = checkPlatformAccess(user);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasPlatformAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
