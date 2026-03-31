import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Users, Bike, AlertTriangle, DollarSign, TrendingUp } from "lucide-react";

interface OverviewMetrics {
  totalCompanies: number;
  activeCompanies: number;
  totalAssets: number;
  totalRentals: number;
  totalUsers: number;
  pendingCompanies: number;
}

interface BillingMetrics {
  totalMrr: number;
  totalRevenue: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  pastDueSubscriptions: number;
  currency: string;
}

interface HealthSummary {
  healthy: number;
  degraded: number;
  critical: number;
  services: Array<{ name: string; status: string }>;
}

function MetricCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);
}

export default function DashboardPage() {
  const overview = useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: () => api<OverviewMetrics>("/platform/analytics/overview"),
  });

  const billing = useQuery({
    queryKey: ["analytics", "billing"],
    queryFn: () => api<BillingMetrics>("/platform/analytics/billing"),
  });

  const health = useQuery({
    queryKey: ["health", "summary"],
    queryFn: () => api<HealthSummary>("/platform/health/summary"),
  });

  const isLoading = overview.isLoading || billing.isLoading;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Platform overview and key metrics</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Companies"
              value={overview.data?.totalCompanies ?? 0}
              icon={Building2}
              description={`${overview.data?.activeCompanies ?? 0} active`}
            />
            <MetricCard
              title="Total Users"
              value={overview.data?.totalUsers ?? 0}
              icon={Users}
            />
            <MetricCard
              title="Total Assets"
              value={overview.data?.totalAssets ?? 0}
              icon={Bike}
            />
            <MetricCard
              title="Pending Approval"
              value={overview.data?.pendingCompanies ?? 0}
              icon={AlertTriangle}
            />
            <MetricCard
              title="Monthly Revenue"
              value={formatCurrency(billing.data?.totalMrr ?? 0, billing.data?.currency)}
              icon={DollarSign}
            />
            <MetricCard
              title="Active Subscriptions"
              value={billing.data?.activeSubscriptions ?? 0}
              icon={TrendingUp}
            />
            <MetricCard
              title="Trial Subscriptions"
              value={billing.data?.trialSubscriptions ?? 0}
              icon={TrendingUp}
              description="Currently in trial"
            />
            <MetricCard
              title="Past Due"
              value={billing.data?.pastDueSubscriptions ?? 0}
              icon={AlertTriangle}
              description="Require attention"
            />
          </div>

          {health.data && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">System Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {health.data.healthy} Healthy
                  </Badge>
                  {health.data.degraded > 0 && (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                      {health.data.degraded} Degraded
                    </Badge>
                  )}
                  {health.data.critical > 0 && (
                    <Badge variant="destructive">{health.data.critical} Critical</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {health.data.services?.map((svc) => (
                    <div
                      key={svc.name}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <div
                        className={`h-2 w-2 rounded-full ${
                          svc.status === "healthy"
                            ? "bg-green-500"
                            : svc.status === "degraded"
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                      />
                      <span className="capitalize">{svc.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
