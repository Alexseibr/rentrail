import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const STORAGE_KEY = "@prefs/company_slug";

export interface CompanyInfo {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
}

interface CompanyContextValue {
  company: CompanyInfo | null;
  isLoading: boolean;
  resolveAndSelectCompany: (slug: string) => Promise<void>;
  clearCompany: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

async function fetchCompanyBySlug(slug: string): Promise<CompanyInfo> {
  const res = await fetch(
    `${BASE_URL}/api/companies/resolve/${encodeURIComponent(slug)}`,
  );
  if (!res.ok) {
    throw new Error(res.status === 404 ? "not_found" : "fetch_error");
  }
  const json = (await res.json()) as { data: CompanyInfo };
  return json.data;
}

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const slug = await AsyncStorage.getItem(STORAGE_KEY);
        if (slug && !cancelled) {
          const info = await fetchCompanyBySlug(slug);
          if (!cancelled) setCompany(info);
        }
      } catch {
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolveAndSelectCompany = useCallback(async (slug: string) => {
    const info = await fetchCompanyBySlug(slug);
    await AsyncStorage.setItem(STORAGE_KEY, slug);
    setCompany(info);
  }, []);

  const clearCompany = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setCompany(null);
  }, []);

  return (
    <CompanyContext.Provider
      value={{ company, isLoading, resolveAndSelectCompany, clearCompany }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany(): CompanyContextValue {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}
