import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { api, setTokens, clearTokens, setAuthExpiredHandler, hasStoredToken } from "./api";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuperAdmin: boolean;
  platformRoles: string[];
  memberships?: Array<{ companyId: string; roleCode: string }>;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPlatformAccess: boolean;
  hasTenantMemberships: boolean;
}

const PLATFORM_ROLES = ["superAdmin", "platformAdmin", "platformSupport", "platformFinance", "platformRisk"];

const AuthContext = createContext<AuthContextType | null>(null);

function checkPlatformAccess(user: User | null): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return (user.platformRoles || []).some((r) => PLATFORM_ROLES.includes(r));
}

function parseUser(profile: Record<string, unknown>): User {
  return {
    id: profile.id as string,
    email: profile.email as string,
    firstName: profile.firstName as string,
    lastName: profile.lastName as string,
    isSuperAdmin: profile.isSuperAdmin as boolean,
    platformRoles: (profile.platformRoles as string[]) || [],
    memberships: profile.memberships as User["memberships"],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(() => hasStoredToken());

  const handleLogout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  useEffect(() => {
    setAuthExpiredHandler(handleLogout);
  }, [handleLogout]);

  useEffect(() => {
    if (!hasStoredToken()) return;
    let cancelled = false;
    api<Record<string, unknown>>("/auth/me")
      .then((profile) => {
        if (!cancelled) setUser(parseUser(profile));
      })
      .catch(() => {
        if (!cancelled) handleLogout();
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [handleLogout]);

  const login = useCallback(async (email: string, password: string) => {
    const loginResult = await api<{
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string; firstName: string; lastName: string; isSuperAdmin: boolean };
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setTokens(loginResult.accessToken, loginResult.refreshToken);

    const profile = await api<Record<string, unknown>>("/auth/me");
    setUser(parseUser(profile));
  }, []);

  const logout = useCallback(() => {
    api("/auth/logout", { method: "POST" }).catch(() => {});
    handleLogout();
  }, [handleLogout]);

  const hasPlatformAccess = checkPlatformAccess(user);
  const hasTenantMemberships = (user?.memberships || []).length > 0;

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasPlatformAccess, hasTenantMemberships }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
