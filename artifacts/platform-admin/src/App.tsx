import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/app-layout";
import { canAccessRoute } from "@/lib/permissions";
import LoginPage from "@/pages/login";
import AccessDeniedPage from "@/pages/access-denied";
import DashboardPage from "@/pages/dashboard";
import CompaniesPage from "@/pages/companies";
import CompanyDetailPage from "@/pages/company-detail";
import BillingPage from "@/pages/billing";
import SubscriptionDetailPage from "@/pages/subscription-detail";
import InvoiceDetailPage from "@/pages/invoice-detail";
import BlacklistPage from "@/pages/blacklist";
import DiagnosticsPage from "@/pages/diagnostics";
import AnalyticsPage from "@/pages/analytics";
import WhiteLabelPage from "@/pages/white-label";
import CompanyDashboardPage from "@/pages/dashboard-company";
import FleetPage from "@/pages/fleet";
import RentalsCompanyPage from "@/pages/rentals-company";
import ClientsCompanyPage from "@/pages/clients-company";
import BranchesPage from "@/pages/branches";
import SettingsCompanyPage from "@/pages/settings-company";
import AssetDetailPage from "@/pages/asset-detail";
import RentalDetailPage from "@/pages/rental-detail";
import ServicePage from "@/pages/service";
import FleetMapPage from "@/pages/fleet-map";
import NoAccessPage from "@/pages/no-access";
import NotFound from "@/pages/not-found";
import { Spinner } from "@/components/ui/spinner";
import { useMemo, type ReactNode } from "react";

const PLATFORM_ROLES = ["superAdmin", "platformAdmin", "platformSupport", "platformFinance", "platformRisk"];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function PlatformRoutes() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/companies" component={CompaniesPage} />
      <Route path="/companies/:id" component={CompanyDetailPage} />
      <Route path="/billing" component={BillingPage} />
      <Route path="/billing/subscriptions/:id" component={SubscriptionDetailPage} />
      <Route path="/billing/invoices/:id" component={InvoiceDetailPage} />
      <Route path="/blacklist" component={BlacklistPage} />
      <Route path="/diagnostics" component={DiagnosticsPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/white-label" component={WhiteLabelPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function RoleGuard({ children, guardPath }: { children: ReactNode; guardPath: string }) {
  const { user } = useAuth();
  const roleCode = user?.memberships?.[0]?.roleCode;
  if (!canAccessRoute(roleCode, guardPath)) {
    return <NoAccessPage />;
  }
  return <>{children}</>;
}

function CompanyRoutes() {
  return (
    <Switch>
      <Route path="/">{() => <RoleGuard guardPath="/"><CompanyDashboardPage /></RoleGuard>}</Route>
      <Route path="/fleet">{() => <RoleGuard guardPath="/fleet"><FleetPage /></RoleGuard>}</Route>
      <Route path="/fleet/:id">{() => <RoleGuard guardPath="/fleet"><AssetDetailPage /></RoleGuard>}</Route>
      <Route path="/map">{() => <RoleGuard guardPath="/map"><FleetMapPage /></RoleGuard>}</Route>
      <Route path="/service">{() => <RoleGuard guardPath="/service"><ServicePage /></RoleGuard>}</Route>
      <Route path="/rentals">{() => <RoleGuard guardPath="/rentals"><RentalsCompanyPage /></RoleGuard>}</Route>
      <Route path="/rentals/:id">{() => <RoleGuard guardPath="/rentals"><RentalDetailPage /></RoleGuard>}</Route>
      <Route path="/clients">{() => <RoleGuard guardPath="/clients"><ClientsCompanyPage /></RoleGuard>}</Route>
      <Route path="/branches">{() => <RoleGuard guardPath="/branches"><BranchesPage /></RoleGuard>}</Route>
      <Route path="/settings">{() => <RoleGuard guardPath="/settings"><SettingsCompanyPage /></RoleGuard>}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const { user } = useAuth();

  const isPlatformUser = useMemo(() => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    return (user.platformRoles || []).some((r) => PLATFORM_ROLES.includes(r));
  }, [user]);

  return (
    <AppLayout>
      {isPlatformUser ? <PlatformRoutes /> : <CompanyRoutes />}
    </AppLayout>
  );
}

function AppRouter() {
  const { user, isLoading, hasPlatformAccess } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (!hasPlatformAccess) {
    return <AccessDeniedPage />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRouter />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
