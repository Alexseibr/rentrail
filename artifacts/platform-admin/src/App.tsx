import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/app-layout";
import LoginPage from "@/pages/login";
import AccessDeniedPage from "@/pages/access-denied";
import DashboardPage from "@/pages/dashboard";
import CompaniesPage from "@/pages/companies";
import CompanyDetailPage from "@/pages/company-detail";
import BillingPage from "@/pages/billing";
import BlacklistPage from "@/pages/blacklist";
import DiagnosticsPage from "@/pages/diagnostics";
import AnalyticsPage from "@/pages/analytics";
import WhiteLabelPage from "@/pages/white-label";
import NotFound from "@/pages/not-found";
import { Spinner } from "@/components/ui/spinner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function AuthenticatedApp() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/companies" component={CompaniesPage} />
        <Route path="/companies/:id" component={CompanyDetailPage} />
        <Route path="/billing" component={BillingPage} />
        <Route path="/blacklist" component={BlacklistPage} />
        <Route path="/diagnostics" component={DiagnosticsPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route path="/white-label" component={WhiteLabelPage} />
        <Route component={NotFound} />
      </Switch>
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
