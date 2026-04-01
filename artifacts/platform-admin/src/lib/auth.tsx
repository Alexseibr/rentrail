import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { api, setTokens, clearTokens, setAuthExpiredHandler, hasStoredToken } from "./api";

interface User {
  id: string;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  isSuperAdmin: boolean;
  platformRoles: string[];
  memberships?: Array<{ companyId: string; companyName?: string; roleCode: string; roleName?: string }>;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithPhone: (phone: string, password: string) => Promise<void>;
  requestOtp: (phone: string) => Promise<{ devCode?: string }>;
  verifyOtp: (phone: string, code: string) => Promise<{ needsPassword: boolean }>;
  setPhonePassword: (password: string) => Promise<void>;
  logout: () => void;
  hasPlatformAccess: boolean;
  hasTenantMemberships: boolean;
}

const PLATFORM_ROLES = ["superAdmin", "platformAdmin", "platformSupport", "platformFinance", "platformRisk"];

const AuthContext = createContext<AuthContextType | null>(null);

function checkPlatformAccess(user: User | null): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  if ((user.platformRoles || []).some((r) => PLATFORM_ROLES.includes(r))) return true;
  if ((user.memberships || []).length > 0) return true;
  return false;
}

function parseUser(profile: Record<string, unknown>): User {
  return {
    id: profile.id as string,
    email: profile.email as string | undefined,
    phone: profile.phone as string | undefined,
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

  const loginWithPhone = useCallback(async (phone: string, password: string) => {
    const result = await api<{
      accessToken: string;
      refreshToken: string;
      user: object;
    }>("/auth/phone/login", {
      method: "POST",
      body: JSON.stringify({ phone, password }),
    });
    setTokens(result.accessToken, result.refreshToken);
    const profile = await api<Record<string, unknown>>("/auth/me");
    setUser(parseUser(profile));
  }, []);

  const requestOtp = useCallback(async (phone: string): Promise<{ devCode?: string }> => {
    const result = await api<{ sent: boolean; devCode?: string }>("/auth/phone/request-otp", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
    return { devCode: result.devCode };
  }, []);

  const verifyOtp = useCallback(async (phone: string, code: string): Promise<{ needsPassword: boolean }> => {
    const result = await api<{
      accessToken: string;
      refreshToken: string;
      needsPassword: boolean;
    }>("/auth/phone/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    });
    setTokens(result.accessToken, result.refreshToken);
    const profile = await api<Record<string, unknown>>("/auth/me");
    setUser(parseUser(profile));
    return { needsPassword: result.needsPassword };
  }, []);

  const setPhonePassword = useCallback(async (password: string) => {
    await api("/auth/phone/set-password", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  }, []);

  const logout = useCallback(() => {
    api("/auth/logout", { method: "POST" }).catch(() => {});
    handleLogout();
  }, [handleLogout]);

  const hasPlatformAccess = checkPlatformAccess(user);
  const hasTenantMemberships = (user?.memberships || []).length > 0;

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginWithPhone, requestOtp, verifyOtp, setPhonePassword, logout, hasPlatformAccess, hasTenantMemberships }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
