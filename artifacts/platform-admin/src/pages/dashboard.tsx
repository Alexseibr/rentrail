import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Building2, Users, Bike, AlertTriangle, DollarSign,
  TrendingUp, ShieldAlert, PauseCircle, Clock, CheckCircle2,
  ArrowRight, RefreshCw, Activity, CreditCard,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

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
  services: Array<{ name: string; status: string; latencyMs?: number }>;
}

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount / 100);
}

function KpiCard({
  title, value, icon: Icon, description, accent, isLoading, onClick,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  accent: string;
  isLoading?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`relative overflow-hidden transition-all duration-200 ${onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""}`}
      onClick={onClick}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${accent}`} />
      <CardContent className="pt-5 pl-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">{title}</p>
            {isLoading ? (
              <Skeleton className="h-9 w-16 mt-1" />
            ) : (
              <p className="text-3xl font-bold tracking-tight mt-0.5">{value}</p>
            )}
            {description && !isLoading && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className={`p-2.5 rounded-xl shrink-0 ml-2`} style={{ background: "hsl(var(--muted))" }}>
            <Icon className={`h-5 w-5 ${accent.replace("bg-", "text-")}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

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
        "/platform/audit-logs?limit=8",
      ),
  });

  const isLoading = overview.isLoading || billing.isLoading;

  const tenantChartData = [
    { name: t("common.active"), value: overview.data?.activeCompanies ?? 0, color: "#22c55e" },
    { name: t("common.trial"), value: overview.data?.trialCompanies ?? 0, color: "#3b82f6" },
    { name: t("common.pending"), value: overview.data?.pendingCompanies ?? 0, color: "#eab308" },
    { name: t("common.suspended"), value: overview.data?.suspendedCompanies ?? 0, color: "#f97316" },
    { name: t("common.blocked"), value: overview.data?.blockedCompanies ?? 0, color: "#ef4444" },
  ].filter((d) => d.value > 0);

  const hasCritical = (health.data?.critical ?? 0) > 0;
  const hasDegraded = (health.data?.degraded ?? 0) > 0;
  const pastDue = billing.data?.pastDueSubscriptions ?? 0;
  const pending = overview.data?.pendingCompanies ?? 0;
  const unpaidCount = unpaidInvoices.data?.pagination?.total ?? 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground mt-0.5">{t("dashboard.subtitle")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => { overview.refetch(); billing.refetch(); health.refetch(); }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t("common.refresh", "Обновить")}
        </Button>
      </div>

      {(hasCritical || pastDue > 0 || pending > 0) && (
        <div className="space-y-2">
          {hasCritical && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <Activity className="h-5 w-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-800 flex-1">
                <span className="font-semibold">{health.data?.critical}</span> {t("dashboard.servicesDown", "сервисов недоступны")}
              </p>
              <Button size="sm" variant="outline" className="text-red-700 border-red-300 hover:bg-red-100 gap-1.5" onClick={() => navigate("/diagnostics")}>
                {t("common.view", "Просмотреть")} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {pastDue > 0 && (
            <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
              <CreditCard className="h-5 w-5 text-orange-500 shrink-0" />
              <p className="text-sm text-orange-800 flex-1">
                <span className="font-semibold">{pastDue}</span> {t("dashboard.pastDueAlert", "подписок просрочено")}
              </p>
              <Button size="sm" variant="outline" className="text-orange-700 border-orange-300 hover:bg-orange-100 gap-1.5" onClick={() => navigate("/billing")}>
                {t("common.view", "Просмотреть")} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {pending > 0 && (
            <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
              <p className="text-sm text-yellow-800 flex-1">
                <span className="font-semibold">{pending}</span> {t("dashboard.pendingAlert", "компаний ожидают одобрения")}
              </p>
              <Button size="sm" variant="outline" className="text-yellow-700 border-yellow-300 hover:bg-yellow-100 gap-1.5" onClick={() => navigate("/companies")}>
                {t("common.view", "Просмотреть")} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title={t("dashboard.totalCompanies")}
          value={overview.data?.totalCompanies ?? 0}
          icon={Building2}
          accent="bg-blue-500"
          description={t("dashboard.nActive", { count: overview.data?.activeCompanies ?? 0 })}
          isLoading={isLoading}
          onClick={() => navigate("/companies")}
        />
        <KpiCard
          title={t("dashboard.totalUsers")}
          value={overview.data?.totalUsers ?? 0}
          icon={Users}
          accent="bg-violet-500"
          isLoading={isLoading}
        />
        <KpiCard
          title={t("dashboard.totalAssets")}
          value={overview.data?.totalAssets ?? 0}
          icon={Bike}
          accent="bg-green-500"
          isLoading={isLoading}
        />
        <KpiCard
          title={t("dashboard.pendingApproval")}
          value={overview.data?.pendingCompanies ?? 0}
          icon={AlertTriangle}
          accent={pending > 0 ? "bg-orange-500" : "bg-gray-400"}
          isLoading={isLoading}
          onClick={() => navigate("/companies")}
        />
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title={t("dashboard.monthlyRevenue")}
          value={formatCurrency(billing.data?.totalMrr ?? 0, billing.data?.currency)}
          icon={DollarSign}
          accent="bg-emerald-500"
          isLoading={billing.isLoading}
          onClick={() => navigate("/analytics")}
        />
        <KpiCard
          title={t("dashboard.activeSubscriptions")}
          value={billing.data?.activeSubscriptions ?? 0}
          icon={TrendingUp}
          accent="bg-blue-500"
          isLoading={billing.isLoading}
          onClick={() => navigate("/billing")}
        />
        <KpiCard
          title={t("dashboard.trialSubscriptions")}
          value={billing.data?.trialSubscriptions ?? 0}
          icon={Clock}
          accent="bg-sky-500"
          description={t("dashboard.currentlyInTrial")}
          isLoading={billing.isLoading}
        />
        <KpiCard
          title={t("dashboard.pastDue")}
          value={pastDue}
          icon={AlertTriangle}
          accent={pastDue > 0 ? "bg-red-500" : "bg-gray-400"}
          description={pastDue > 0 ? t("dashboard.requireAttention") : undefined}
          isLoading={billing.isLoading}
          onClick={() => navigate("/billing")}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">{t("dashboard.tenantStatus")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : tenantChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t("common.noData")}</p>
            ) : (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tenantChartData} barSize={32}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis hide allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                      cursor={{ fill: "hsl(var(--muted))" }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {tenantChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">{t("common.active")}: <span className="font-semibold text-foreground">{overview.data?.activeCompanies ?? 0}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-blue-500" />
                <span className="text-xs text-muted-foreground">{t("common.trial")}: <span className="font-semibold text-foreground">{overview.data?.trialCompanies ?? 0}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <PauseCircle className="h-3 w-3 text-orange-500" />
                <span className="text-xs text-muted-foreground">{t("common.suspended")}: <span className="font-semibold text-foreground">{overview.data?.suspendedCompanies ?? 0}</span></span>
              </div>
            </div>
          </CardContent>
        </Card>

        {health.data && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">{t("dashboard.systemHealth")}</CardTitle>
                <div className="flex gap-1.5">
                  {health.data.healthy > 0 && (
                    <Badge className="bg-green-100 text-green-800 text-xs">{health.data.healthy} {t("dashboard.healthy")}</Badge>
                  )}
                  {health.data.degraded > 0 && (
                    <Badge className="bg-yellow-100 text-yellow-800 text-xs">{health.data.degraded} {t("dashboard.degraded")}</Badge>
                  )}
                  {health.data.critical > 0 && (
                    <Badge variant="destructive" className="text-xs">{health.data.critical} {t("dashboard.critical")}</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {health.data.services?.map((svc) => (
                  <div
                    key={svc.name}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      svc.status === "healthy"
                        ? "border-green-100 bg-green-50/50"
                        : svc.status === "degraded"
                          ? "border-yellow-100 bg-yellow-50/50"
                          : "border-red-100 bg-red-50/50"
                    }`}
                  >
                    <div
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        svc.status === "healthy"
                          ? "bg-green-500"
                          : svc.status === "degraded"
                            ? "bg-yellow-500"
                            : "bg-red-500"
                      }`}
                    />
                    <span className="capitalize text-xs font-medium truncate">{svc.name}</span>
                    {svc.latencyMs !== undefined && (
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">{svc.latencyMs}ms</span>
                    )}
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-3 text-xs text-muted-foreground gap-1.5"
                onClick={() => navigate("/diagnostics")}
              >
                {t("nav.diagnostics")} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                {t("dashboard.unpaidInvoices")}
                {unpaidCount > 0 && (
                  <Badge variant="destructive" className="ml-2 text-xs">{unpaidCount}</Badge>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1" onClick={() => navigate("/billing")}>
                {t("common.viewAll", "Все")} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">{t("common.company")}</TableHead>
                  <TableHead className="text-xs">{t("common.amount")}</TableHead>
                  <TableHead className="text-xs">{t("dashboard.due")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(unpaidInvoices.data?.items || []).map((inv) => (
                  <TableRow key={inv.id as string} className="hover:bg-muted/30">
                    <TableCell className="font-medium text-sm">{(inv.companyName as string) || "-"}</TableCell>
                    <TableCell className="text-sm font-mono">
                      {formatCurrency(inv.amount as number, inv.currency as string)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {inv.dueDate ? new Date(inv.dueDate as string).toLocaleDateString("ru-RU") : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {(unpaidInvoices.data?.items || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-6 w-6 mx-auto mb-1 text-green-500 opacity-60" />
                      {t("dashboard.noUnpaidInvoices")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                {t("dashboard.pendingSignups")}
                {(recentCompanies.data?.pagination?.total ?? 0) > 0 && (
                  <Badge className="bg-yellow-100 text-yellow-800 ml-2 text-xs">
                    {recentCompanies.data?.pagination?.total}
                  </Badge>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1" onClick={() => navigate("/companies")}>
                {t("common.viewAll", "Все")} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">{t("common.company")}</TableHead>
                  <TableHead className="text-xs">{t("dashboard.slug")}</TableHead>
                  <TableHead className="text-xs">{t("dashboard.registered")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recentCompanies.data?.items || []).map((c) => (
                  <TableRow
                    key={c.id as string}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => navigate(`/companies/${c.id}`)}
                  >
                    <TableCell className="font-medium text-sm">{c.name as string}</TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">{c.slug as string}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.createdAt ? new Date(c.createdAt as string).toLocaleDateString("ru-RU") : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {(recentCompanies.data?.items || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-6 w-6 mx-auto mb-1 text-green-500 opacity-60" />
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
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">{t("dashboard.recentActivity")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">{t("dashboard.actor")}</TableHead>
                <TableHead className="text-xs">{t("dashboard.action")}</TableHead>
                <TableHead className="text-xs">{t("dashboard.entity")}</TableHead>
                <TableHead className="text-xs">{t("dashboard.time")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(recentAudit.data?.items || []).map((log) => (
                <TableRow key={log.id as string} className="hover:bg-muted/30">
                  <TableCell className="text-sm font-medium">{log.actorEmail as string}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-mono">{log.action as string}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.entityType as string}
                    {log.entityId ? ` #${(log.entityId as string).slice(0, 8)}` : ""}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {log.createdAt ? new Date(log.createdAt as string).toLocaleString("ru-RU") : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {(recentAudit.data?.items || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-sm text-muted-foreground">
                    {t("dashboard.noRecentActivity")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
