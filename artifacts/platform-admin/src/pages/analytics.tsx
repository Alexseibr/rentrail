import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface OverviewMetrics {
  totalCompanies: number;
  activeCompanies: number;
  totalAssets: number;
  totalRentals: number;
  totalUsers: number;
  pendingCompanies: number;
}

interface UsageMetrics {
  totalRentals: number;
  activeRentals: number;
  completedRentals: number;
  totalAssets: number;
  averageAssetsPerCompany: number;
}

interface RiskMetrics {
  blacklistedEntries: number;
  activeBlacklisted: number;
  blockedCompanies: number;
  suspendedCompanies: number;
  pastDueSubscriptions: number;
}

interface TopTenant {
  companyId: string;
  companyName: string;
  value: number;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount / 100);
}

export default function AnalyticsPage() {
  const overview = useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: () => api<OverviewMetrics>("/platform/analytics/overview"),
  });

  const usage = useQuery({
    queryKey: ["analytics", "usage"],
    queryFn: () => api<UsageMetrics>("/platform/analytics/usage"),
  });

  const risks = useQuery({
    queryKey: ["analytics", "risks"],
    queryFn: () => api<RiskMetrics>("/platform/analytics/risks"),
  });

  const topByRentals = useQuery({
    queryKey: ["analytics", "tenants", "rentals"],
    queryFn: () =>
      api<TopTenant[]>("/platform/analytics/tenants?metric=rentals&limit=10"),
  });

  const topByAssets = useQuery({
    queryKey: ["analytics", "tenants", "assets"],
    queryFn: () =>
      api<TopTenant[]>("/platform/analytics/tenants?metric=assets&limit=10"),
  });

  const billing = useQuery({
    queryKey: ["analytics", "billing"],
    queryFn: () => api<Record<string, unknown>>("/platform/analytics/billing"),
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Platform-wide metrics and insights</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {overview.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Active Companies</p>
                <p className="text-2xl font-bold">{overview.data?.activeCompanies ?? 0}</p>
                <p className="text-xs text-muted-foreground">
                  of {overview.data?.totalCompanies ?? 0} total
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Rentals</p>
                <p className="text-2xl font-bold">{usage.data?.totalRentals ?? 0}</p>
                <p className="text-xs text-muted-foreground">
                  {usage.data?.activeRentals ?? 0} active
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Assets</p>
                <p className="text-2xl font-bold">{usage.data?.totalAssets ?? 0}</p>
                <p className="text-xs text-muted-foreground">
                  ~{usage.data?.averageAssetsPerCompany ?? 0} per company
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">MRR</p>
                <p className="text-2xl font-bold">
                  {formatCurrency((billing.data?.totalMrr as number) ?? 0)}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {risks.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{risks.data.blacklistedEntries}</p>
                <p className="text-xs text-muted-foreground">Blacklist Entries</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{risks.data.activeBlacklisted}</p>
                <p className="text-xs text-muted-foreground">Active Blacklisted</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{risks.data.blockedCompanies}</p>
                <p className="text-xs text-muted-foreground">Blocked Companies</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{risks.data.suspendedCompanies}</p>
                <p className="text-xs text-muted-foreground">Suspended Companies</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{risks.data.pastDueSubscriptions}</p>
                <p className="text-xs text-muted-foreground">Past Due Subs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Tenants by Rentals</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topByRentals.isLoading ? (
              <div className="p-6">
                <Skeleton className="h-48 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead className="text-right">Rentals</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(topByRentals.data || []).map((t, i) => (
                    <TableRow key={t.companyId}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{t.companyName}</TableCell>
                      <TableCell className="text-right">{t.value}</TableCell>
                    </TableRow>
                  ))}
                  {topByRentals.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                        No data
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Tenants by Assets</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topByAssets.isLoading ? (
              <div className="p-6">
                <Skeleton className="h-48 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead className="text-right">Assets</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(topByAssets.data || []).map((t, i) => (
                    <TableRow key={t.companyId}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{t.companyName}</TableCell>
                      <TableCell className="text-right">{t.value}</TableCell>
                    </TableRow>
                  ))}
                  {topByAssets.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                        No data
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
