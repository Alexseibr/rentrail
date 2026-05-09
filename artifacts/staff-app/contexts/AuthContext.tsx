import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  STORAGE_KEYS,
  storeTokens,
  clearAuth,
  getAccessToken,
  getCompanyId,
  setCompanyId as storeCompanyId,
  setBranchId as storeBranchId,
} from "@/services/api";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { unregisterPushToken } from "@/services/push";

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

interface Membership {
  companyId: string;
  companyName: string;
  roleCode: string;
}

interface User {
  id: string;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  companies?: Membership[];
  memberships?: Membership[];
  tokenType?: "staff" | "client";
  clientId?: string;
  companyId?: string;
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
  loginWithPhone: (phone: string, password: string) => Promise<void>;
  loginAsClient: (phone: string, password: string) => Promise<void>;
  requestOtp: (phone: string) => Promise<{ devCode?: string }>;
  verifyOtp: (
    phone: string,
    code: string,
  ) => Promise<{ needsPassword: boolean }>;
  setPhonePassword: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  setCompanyId: (id: string) => Promise<void>;
  setBranchId: (id: string | null) => Promise<void>;
  refreshUser: () => Promise<void>;
  isClient: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface TokenPayload {
  accessToken: string;
  refreshToken: string;
}

interface MeApiResponse {
  data: User;
}

interface LoginApiResponse {
  data: TokenPayload;
}

interface ClientLoginApiResponse {
  data: {
    accessToken: string;
    refreshToken?: string;
    user: {
      id: string;
      fullName?: string;
      phone?: string;
      email?: string;
      clientId?: string;
      companyId?: string;
    };
  };
}

interface OtpRequestApiResponse {
  data: { devCode?: string };
}

interface VerifyOtpApiResponse {
  data: TokenPayload & { needsPassword: boolean };
}

async function fetchWithAuth<T>(
  url: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...((options.headers as Record<string, string>) || {}),
    },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "Request failed");
  }
  return res.json() as Promise<T>;
}

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
        const user = JSON.parse(storedUser) as User;
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

  const applyAuthResult = useCallback(
    async (accessToken: string, refreshToken: string) => {
      await storeTokens(accessToken, refreshToken);
      const { data: userData } = await fetchWithAuth<MeApiResponse>(
        `${BASE_URL}/api/auth/me`,
        {},
        accessToken,
      );
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
      let companyId = await getCompanyId();
      if (!companyId && (userData.memberships?.length ?? 0) > 0) {
        companyId = userData.memberships![0].companyId;
        await storeCompanyId(companyId);
      }
      setState({
        user: userData,
        isAuthenticated: true,
        isLoading: false,
        companyId: companyId ?? null,
        branchId: null,
      });
    },
    [],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await fetchWithAuth<LoginApiResponse>(
        `${BASE_URL}/api/auth/login`,
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        },
      );
      await applyAuthResult(data.accessToken, data.refreshToken);
    },
    [applyAuthResult],
  );

  const loginWithPhone = useCallback(
    async (phone: string, password: string) => {
      const { data } = await fetchWithAuth<LoginApiResponse>(
        `${BASE_URL}/api/auth/phone/login`,
        {
          method: "POST",
          body: JSON.stringify({ phone, password }),
        },
      );
      await applyAuthResult(data.accessToken, data.refreshToken);
    },
    [applyAuthResult],
  );

  const loginAsClient = useCallback(async (phone: string, password: string) => {
    const { data } = await fetchWithAuth<ClientLoginApiResponse>(
      `${BASE_URL}/api/auth/client/login`,
      {
        method: "POST",
        body: JSON.stringify({ phone, password }),
      },
    );
    await storeTokens(data.accessToken, data.refreshToken ?? "");
    const user: User = {
      id: data.user.id,
      firstName: data.user.fullName?.split(" ")[0] || "",
      lastName: data.user.fullName?.split(" ").slice(1).join(" ") || "",
      fullName: data.user.fullName,
      phone: data.user.phone,
      email: data.user.email,
      tokenType: "client",
      clientId: data.user.clientId,
      companyId: data.user.companyId,
    };
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    if (data.user.companyId) {
      await storeCompanyId(data.user.companyId);
    }
    setState({
      user,
      isAuthenticated: true,
      isLoading: false,
      companyId: data.user.companyId || null,
      branchId: null,
    });
  }, []);

  const requestOtp = useCallback(
    async (phone: string): Promise<{ devCode?: string }> => {
      const { data } = await fetchWithAuth<OtpRequestApiResponse>(
        `${BASE_URL}/api/auth/phone/request-otp`,
        {
          method: "POST",
          body: JSON.stringify({ phone }),
        },
      );
      return { devCode: data.devCode };
    },
    [],
  );

  const verifyOtp = useCallback(
    async (
      phone: string,
      code: string,
    ): Promise<{ needsPassword: boolean }> => {
      const { data } = await fetchWithAuth<VerifyOtpApiResponse>(
        `${BASE_URL}/api/auth/phone/verify-otp`,
        {
          method: "POST",
          body: JSON.stringify({ phone, code }),
        },
      );
      await applyAuthResult(data.accessToken, data.refreshToken);
      return { needsPassword: data.needsPassword };
    },
    [applyAuthResult],
  );

  const setPhonePassword = useCallback(async (password: string) => {
    const token = await getAccessToken();
    await fetchWithAuth(`${BASE_URL}/api/auth/phone/set-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
      headers: { Authorization: `Bearer ${token}` },
    });
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
    const { data: userData } = await fetchWithAuth<MeApiResponse>(
      `${BASE_URL}/api/auth/me`,
      {},
      token,
    );
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
    setState((s) => ({ ...s, user: userData }));
  }, []);

  const isClient = state.user?.tokenType === "client";

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        loginWithPhone,
        loginAsClient,
        requestOtp,
        verifyOtp,
        setPhonePassword,
        logout,
        setCompanyId: setCompanyIdFn,
        setBranchId: setBranchIdFn,
        refreshUser,
        isClient,
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
