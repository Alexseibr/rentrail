import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS, storeTokens, clearAuth, getAccessToken, getCompanyId, setCompanyId as storeCompanyId, setBranchId as storeBranchId } from "@/services/api";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { unregisterPushToken } from "@/services/push";

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companies?: Array<{ companyId: string; companyName: string; roleCode: string }>;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  companyId: string | null;
  branchId: string | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setCompanyId: (id: string) => Promise<void>;
  setBranchId: (id: string | null) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    companyId: null,
    branchId: null,
  });

  useEffect(() => {
    setAuthTokenGetter(() => getAccessToken());
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const token = await getAccessToken();
      const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      const companyId = await getCompanyId();
      const branchId = await AsyncStorage.getItem(STORAGE_KEYS.BRANCH_ID);

      if (token && storedUser) {
        const user = JSON.parse(storedUser);
        setState({
          user,
          isAuthenticated: true,
          isLoading: false,
          companyId,
          branchId,
        });
      } else {
        setState((s) => ({ ...s, isLoading: false }));
      }
    } catch {
      setState((s) => ({ ...s, isLoading: false }));
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Login failed");
    }

    const { data } = await res.json();
    await storeTokens(data.accessToken, data.refreshToken);

    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${data.accessToken}` },
    });

    if (meRes.ok) {
      const { data: userData } = await meRes.json();
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));

      let companyId = await getCompanyId();
      if (!companyId && userData.companies?.length > 0) {
        companyId = userData.companies[0].companyId;
        await storeCompanyId(companyId);
      }

      setState({
        user: userData,
        isAuthenticated: true,
        isLoading: false,
        companyId,
        branchId: null,
      });
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await unregisterPushToken();
      const token = await getAccessToken();
      if (token) {
        await fetch(`${BASE_URL}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    } finally {
      await clearAuth();
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        companyId: null,
        branchId: null,
      });
    }
  }, []);

  const setCompanyIdFn = useCallback(async (id: string) => {
    await storeCompanyId(id);
    setState((s) => ({ ...s, companyId: id }));
  }, []);

  const setBranchIdFn = useCallback(async (id: string | null) => {
    await storeBranchId(id);
    setState((s) => ({ ...s, branchId: id }));
  }, []);

  const refreshUser = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (meRes.ok) {
      const { data: userData } = await meRes.json();
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
      setState((s) => ({ ...s, user: userData }));
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        setCompanyId: setCompanyIdFn,
        setBranchId: setBranchIdFn,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
