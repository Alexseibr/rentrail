import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2, Users, Bike, AlertTriangle, DollarSign, TrendingUp, ShieldAlert, PauseCircle, Clock } from "lucide-react";

interface OverviewMetrics {
  totalCompanies: number;
  activeCompanies: number;
  totalAssets: number;
  totalRentals: number;
  totalUsers: number;
  pendingCompanies: number;
  blockedCompanies: number;
  suspendedCompanies: number;
  trialCompanies: number;
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
  const { t } = useTranslation();

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

  const unpaidInvoices = useQuery({
    queryKey: ["dashboard", "unpaid-invoices"],
    queryFn: () =>
      api<{ items: Array<Record<string, unknown>>; pagination: { total: number; totalPages: number } }>(
        "/platform/billing/invoices?status=issued&limit=5",
      ),
  });

  const recentCompanies = useQuery({
    queryKey: ["dashboard", "recent-companies"],
    queryFn: () =>
      api<{ items: Array<Record<string, unknown>>; pagination: { total: number; totalPages: number } }>(
        "/platform/companies?status=pending&limit=5",
      ),
  });

  const recentAudit = useQuery({
    queryKey: ["dashboard", "recent-audit"],
    queryFn: () =>
      api<{ items: Array<Record<string, unknown>>; pagination: Record<string, unknown> }>(
        "/platform/audit-logs?limit=10",
      ),
  });

  const isLoading = overview.isLoading || billing.isLoading;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
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
              title={t("dashboard.totalCompanies")}
              value={overview.data?.totalCompanies ?? 0}
              icon={Building2}
              description={t("dashboard.nActive", { count: overview.data?.activeCompanies ?? 0 })}
            />
            <MetricCard
              title={t("dashboard.totalUsers")}
              value={overview.data?.totalUsers ?? 0}
              icon={Users}
            />
            <MetricCard
              title={t("dashboard.totalAssets")}
              value={overview.data?.totalAssets ?? 0}
              icon={Bike}
            />
            <MetricCard
              title={t("dashboard.pendingApproval")}
              value={overview.data?.pendingCompanies ?? 0}
              icon={AlertTriangle}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("dashboard.tenantStatus")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t("common.active")}</p>
                    <p className="text-xl font-bold">{overview.data?.activeCompanies ?? 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t("common.trial")}</p>
                    <p className="text-xl font-bold">{overview.data?.trialCompanies ?? 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t("common.pending")}</p>
                    <p className="text-xl font-bold">{overview.data?.pendingCompanies ?? 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <PauseCircle className="h-4 w-4 text-orange-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t("common.suspended")}</p>
                    <p className="text-xl font-bold">{overview.data?.suspendedCompanies ?? 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t("common.blocked")}</p>
                    <p className="text-xl font-bold">{overview.data?.blockedCompanies ?? 0}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title={t("dashboard.monthlyRevenue")}
              value={formatCurrency(billing.data?.totalMrr ?? 0, billing.data?.currency)}
              icon={DollarSign}
            />
            <MetricCard
              title={t("dashboard.activeSubscriptions")}
              value={billing.data?.activeSubscriptions ?? 0}
              icon={TrendingUp}
            />
            <MetricCard
              title={t("dashboard.trialSubscriptions")}
              value={billing.data?.trialSubscriptions ?? 0}
              icon={TrendingUp}
              description={t("dashboard.currentlyInTrial")}
            />
            <MetricCard
              title={t("dashboard.pastDue")}
              value={billing.data?.pastDueSubscriptions ?? 0}
              icon={AlertTriangle}
              description={t("dashboard.requireAttention")}
            />
          </div>

          {health.data && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("dashboard.systemHealth")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {health.data.healthy} {t("dashboard.healthy")}
                  </Badge>
                  {health.data.degraded > 0 && (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                      {health.data.degraded} {t("dashboard.degraded")}
                    </Badge>
                  )}
                  {health.data.critical > 0 && (
                    <Badge variant="destructive">{health.data.critical} {t("dashboard.critical")}</Badge>
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

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("dashboard.unpaidInvoices")}
                  {(unpaidInvoices.data?.pagination?.total ?? 0) > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {unpaidInvoices.data?.pagination?.total}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.company")}</TableHead>
                      <TableHead>{t("common.amount")}</TableHead>
                      <TableHead>{t("dashboard.due")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(unpaidInvoices.data?.items || []).map((inv) => (
                      <TableRow key={inv.id as string}>
                        <TableCell className="font-medium text-sm">
                          {(inv.companyName as string) || "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatCurrency(inv.amount as number, inv.currency as string)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {inv.dueDate
                            ? new Date(inv.dueDate as string).toLocaleDateString()
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(unpaidInvoices.data?.items || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-4 text-sm text-muted-foreground">
                          {t("dashboard.noUnpaidInvoices")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("dashboard.pendingSignups")}
                  {(recentCompanies.data?.pagination?.total ?? 0) > 0 && (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 ml-2">
                      {recentCompanies.data?.pagination?.total}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.company")}</TableHead>
                      <TableHead>{t("dashboard.slug")}</TableHead>
                      <TableHead>{t("dashboard.registered")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(recentCompanies.data?.items || []).map((c) => (
                      <TableRow key={c.id as string}>
                        <TableCell className="font-medium text-sm">{c.name as string}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.slug as string}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.createdAt
                            ? new Date(c.createdAt as string).toLocaleDateString()
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(recentCompanies.data?.items || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-4 text-sm text-muted-foreground">
                          {t("dashboard.noPendingSignups")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("dashboard.recentActivity")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("dashboard.actor")}</TableHead>
                    <TableHead>{t("dashboard.action")}</TableHead>
                    <TableHead>{t("dashboard.entity")}</TableHead>
                    <TableHead>{t("dashboard.time")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(recentAudit.data?.items || []).map((log) => (
                    <TableRow key={log.id as string}>
                      <TableCell className="text-sm">
                        {log.actorEmail as string}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {log.action as string}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.entityType as string}
                        {log.entityId ? ` #${(log.entityId as string).slice(0, 8)}` : ""}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.createdAt
                          ? new Date(log.createdAt as string).toLocaleString()
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(recentAudit.data?.items || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-sm text-muted-foreground">
                        {t("dashboard.noRecentActivity")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
