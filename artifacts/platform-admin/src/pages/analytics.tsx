import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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

interface BillingMetrics {
  totalMrr: number;
  totalRevenue: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  pastDueSubscriptions: number;
  currency: string;
  planDistribution?: Array<{ planName: string; count: number }>;
}

interface TopTenant {
  companyId: string;
  companyName: string;
  value: number;
}

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);
}

function BarSegment({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value} ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { t } = useTranslation();

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

  const billing = useQuery({
    queryKey: ["analytics", "billing"],
    queryFn: () => api<BillingMetrics>("/platform/analytics/billing"),
  });

  const topByRentals = useQuery({
    queryKey: ["analytics", "tenants", "rentals"],
    queryFn: async () => {
      const res = await api<any>("/platform/analytics/tenants?metric=rentals&limit=10");
      const items = Array.isArray(res) ? res : res?.items ?? [];
      return items.map((t: any): TopTenant => ({
        companyId: t.companyId ?? t.id,
        companyName: t.companyName ?? t.name,
        value: t.value ?? t.count ?? 0,
      }));
    },
  });

  const topByAssets = useQuery({
    queryKey: ["analytics", "tenants", "assets"],
    queryFn: async () => {
      const res = await api<any>("/platform/analytics/tenants?metric=assets&limit=10");
      const items = Array.isArray(res) ? res : res?.items ?? [];
      return items.map((t: any): TopTenant => ({
        companyId: t.companyId ?? t.id,
        companyName: t.companyName ?? t.name,
        value: t.value ?? t.count ?? 0,
      }));
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("analytics.title")}</h1>
        <p className="text-muted-foreground">{t("analytics.subtitle")}</p>
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
                <p className="text-sm text-muted-foreground">{t("analytics.activeCompanies")}</p>
                <p className="text-2xl font-bold">{overview.data?.activeCompanies ?? 0}</p>
                <p className="text-xs text-muted-foreground">
                  of {overview.data?.totalCompanies ?? 0} {t("common.total")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{t("analytics.totalRentals")}</p>
                <p className="text-2xl font-bold">{usage.data?.totalRentals ?? 0}</p>
                <p className="text-xs text-muted-foreground">
                  {usage.data?.activeRentals ?? 0} {t("common.active").toLowerCase()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{t("analytics.totalAssets")}</p>
                <p className="text-2xl font-bold">{usage.data?.totalAssets ?? 0}</p>
                <p className="text-xs text-muted-foreground">
                  ~{usage.data?.averageAssetsPerCompany ?? 0} per company
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{t("analytics.mrr")}</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(billing.data?.totalMrr ?? 0, billing.data?.currency)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("analytics.totalRevenue")}: {formatCurrency(billing.data?.totalRevenue ?? 0, billing.data?.currency)}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("analytics.revenueSubscriptions")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {billing.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{billing.data?.activeSubscriptions ?? 0}</p>
                    <p className="text-xs text-muted-foreground">{t("common.active")}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{billing.data?.trialSubscriptions ?? 0}</p>
                    <p className="text-xs text-muted-foreground">{t("common.trial")}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-orange-600">{billing.data?.pastDueSubscriptions ?? 0}</p>
                    <p className="text-xs text-muted-foreground">{t("dashboard.pastDue")}</p>
                  </div>
                </div>
                {billing.data?.planDistribution && billing.data.planDistribution.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-sm font-medium">{t("analytics.planDistribution")}</p>
                    {billing.data.planDistribution.map((p) => {
                      const total = billing.data!.activeSubscriptions + billing.data!.trialSubscriptions;
                      return (
                        <BarSegment
                          key={p.planName}
                          label={p.planName}
                          value={p.count}
                          total={total}
                          color="bg-primary"
                        />
                      );
                    })}
                  </div>
                )}
                {(!billing.data?.planDistribution || billing.data.planDistribution.length === 0) && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-sm font-medium">{t("analytics.planDistribution")}</p>
                    <BarSegment
                      label={t("common.active")}
                      value={billing.data?.activeSubscriptions ?? 0}
                      total={(billing.data?.activeSubscriptions ?? 0) + (billing.data?.trialSubscriptions ?? 0) + (billing.data?.pastDueSubscriptions ?? 0)}
                      color="bg-green-500"
                    />
                    <BarSegment
                      label={t("common.trial")}
                      value={billing.data?.trialSubscriptions ?? 0}
                      total={(billing.data?.activeSubscriptions ?? 0) + (billing.data?.trialSubscriptions ?? 0) + (billing.data?.pastDueSubscriptions ?? 0)}
                      color="bg-blue-500"
                    />
                    <BarSegment
                      label={t("dashboard.pastDue")}
                      value={billing.data?.pastDueSubscriptions ?? 0}
                      total={(billing.data?.activeSubscriptions ?? 0) + (billing.data?.trialSubscriptions ?? 0) + (billing.data?.pastDueSubscriptions ?? 0)}
                      color="bg-orange-500"
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {risks.data && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("analytics.riskOverview")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{risks.data.blacklistedEntries}</p>
                  <p className="text-xs text-muted-foreground">{t("nav.blacklist")}</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{risks.data.activeBlacklisted}</p>
                  <p className="text-xs text-muted-foreground">{t("common.active")}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{risks.data.blockedCompanies}</p>
                  <p className="text-xs text-muted-foreground">{t("common.blocked")}</p>
                </div>
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-center">
                  <p className="text-2xl font-bold text-orange-600">{risks.data.suspendedCompanies}</p>
                  <p className="text-xs text-muted-foreground">{t("common.suspended")}</p>
                </div>
              </div>
              <BarSegment
                label={t("dashboard.pastDue")}
                value={risks.data.pastDueSubscriptions}
                total={(billing.data?.activeSubscriptions ?? 0) + (billing.data?.trialSubscriptions ?? 0) + risks.data.pastDueSubscriptions}
                color="bg-red-500"
              />
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("analytics.topByRentals")}</CardTitle>
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
                    <TableHead>{t("common.company")}</TableHead>
                    <TableHead className="text-right">{t("analytics.totalRentals")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(topByRentals.data || []).map((tenant, i) => (
                    <TableRow key={tenant.companyId}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{tenant.companyName}</TableCell>
                      <TableCell className="text-right">{tenant.value}</TableCell>
                    </TableRow>
                  ))}
                  {topByRentals.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                        {t("common.noData")}
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
            <CardTitle className="text-base">{t("analytics.topByAssets")}</CardTitle>
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
                    <TableHead>{t("common.company")}</TableHead>
                    <TableHead className="text-right">{t("analytics.totalAssets")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(topByAssets.data || []).map((tenant, i) => (
                    <TableRow key={tenant.companyId}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{tenant.companyName}</TableCell>
                      <TableCell className="text-right">{tenant.value}</TableCell>
                    </TableRow>
                  ))}
                  {topByAssets.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                        {t("common.noData")}
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
