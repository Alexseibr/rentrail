import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import {
  Building2,
  Bike,
  ClipboardList,
  DollarSign,
  ShieldAlert,
  TrendingUp,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

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
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

function KpiCard({
  title,
  value,
  icon: Icon,
  sub,
  accent,
  isLoading,
  onClick,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
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
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            {isLoading ? (
              <Skeleton className="h-9 w-20 mt-1" />
            ) : (
              <p className="text-3xl font-bold tracking-tight mt-0.5">
                {value}
              </p>
            )}
            {sub && !isLoading && (
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            )}
          </div>
          <div className="p-2.5 rounded-xl bg-muted shrink-0 ml-2">
            <Icon className={`h-5 w-5 ${accent.replace("bg-", "text-")}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const CHART_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#a855f7",
  "#0ea5e9",
  "#eab308",
];

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

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
      const res = await api<any>(
        "/platform/analytics/tenants?metric=rentals&limit=8",
      );
      const items = Array.isArray(res) ? res : (res?.items ?? []);
      return items.map(
        (t: any): TopTenant => ({
          companyId: t.companyId ?? t.id,
          companyName: t.companyName ?? t.name,
          value: t.value ?? t.count ?? 0,
        }),
      );
    },
  });

  const topByAssets = useQuery({
    queryKey: ["analytics", "tenants", "assets"],
    queryFn: async () => {
      const res = await api<any>(
        "/platform/analytics/tenants?metric=assets&limit=8",
      );
      const items = Array.isArray(res) ? res : (res?.items ?? []);
      return items.map(
        (t: any): TopTenant => ({
          companyId: t.companyId ?? t.id,
          companyName: t.companyName ?? t.name,
          value: t.value ?? t.count ?? 0,
        }),
      );
    },
  });

  const rentalStatusData = [
    {
      name: t("common.active"),
      value: usage.data?.activeRentals ?? 0,
      color: "#22c55e",
    },
    {
      name: t("status.completed"),
      value: usage.data?.completedRentals ?? 0,
      color: "#9ca3af",
    },
  ].filter((d) => d.value > 0);

  const subscriptionData = [
    {
      name: t("common.active"),
      value: billing.data?.activeSubscriptions ?? 0,
      color: "#22c55e",
    },
    {
      name: t("common.trial"),
      value: billing.data?.trialSubscriptions ?? 0,
      color: "#3b82f6",
    },
    {
      name: t("dashboard.pastDue"),
      value: billing.data?.pastDueSubscriptions ?? 0,
      color: "#ef4444",
    },
  ].filter((d) => d.value > 0);

  const planData = (billing.data?.planDistribution ?? []).map((p, i) => ({
    name: p.planName,
    value: p.count,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("analytics.title")}
          </h1>
          <p className="text-muted-foreground mt-0.5">
            {t("analytics.subtitle")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            overview.refetch();
            usage.refetch();
            billing.refetch();
            risks.refetch();
            topByRentals.refetch();
            topByAssets.refetch();
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t("common.refresh", "Обновить")}
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title={t("analytics.activeCompanies")}
          value={overview.data?.activeCompanies ?? 0}
          icon={Building2}
          sub={`${t("common.total")} ${overview.data?.totalCompanies ?? 0}`}
          accent="bg-blue-500"
          isLoading={overview.isLoading}
          onClick={() => navigate("/companies")}
        />
        <KpiCard
          title={t("analytics.totalRentals")}
          value={usage.data?.totalRentals ?? 0}
          icon={ClipboardList}
          sub={`${usage.data?.activeRentals ?? 0} ${t("common.active").toLowerCase()}`}
          accent="bg-green-500"
          isLoading={usage.isLoading}
        />
        <KpiCard
          title={t("analytics.totalAssets")}
          value={usage.data?.totalAssets ?? 0}
          icon={Bike}
          sub={`~${usage.data?.averageAssetsPerCompany ?? 0} / компания`}
          accent="bg-violet-500"
          isLoading={usage.isLoading}
        />
        <KpiCard
          title={t("analytics.mrr")}
          value={formatCurrency(
            billing.data?.totalMrr ?? 0,
            billing.data?.currency,
          )}
          icon={DollarSign}
          sub={`${t("analytics.totalRevenue")}: ${formatCurrency(billing.data?.totalRevenue ?? 0, billing.data?.currency)}`}
          accent="bg-emerald-500"
          isLoading={billing.isLoading}
          onClick={() => navigate("/billing")}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              {t("analytics.revenueSubscriptions")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {billing.isLoading ? (
              <Skeleton className="h-44 w-full" />
            ) : (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={subscriptionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={76}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {subscriptionData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 justify-center pt-1">
                  {subscriptionData.map((d) => (
                    <div
                      key={d.name}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="text-muted-foreground">
                        {d.name}:{" "}
                        <span className="font-semibold text-foreground">
                          {d.value}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              {t("analytics.planDistribution")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {billing.isLoading ? (
              <Skeleton className="h-44 w-full" />
            ) : planData.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">
                {t("common.noData")}
              </div>
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={planData} layout="vertical" barSize={18}>
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      width={80}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                      cursor={{ fill: "hsl(var(--muted))" }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {planData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {risks.data && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  {t("analytics.riskOverview")}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground gap-1"
                  onClick={() => navigate("/blacklist")}
                >
                  {t("nav.blacklist")} <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border p-3 text-center space-y-0.5">
                  <p className="text-2xl font-bold">
                    {risks.data.blacklistedEntries}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("nav.blacklist")}
                  </p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center space-y-0.5">
                  <p className="text-2xl font-bold text-red-600">
                    {risks.data.activeBlacklisted}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("common.active")}
                  </p>
                </div>
                <div className="rounded-xl border border-red-100 bg-red-50/50 p-3 text-center space-y-0.5">
                  <p className="text-2xl font-bold text-red-700">
                    {risks.data.blockedCompanies}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("common.blocked")}
                  </p>
                </div>
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-center space-y-0.5">
                  <p className="text-2xl font-bold text-orange-600">
                    {risks.data.suspendedCompanies}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("common.suspended")}
                  </p>
                </div>
              </div>
              {risks.data.pastDueSubscriptions > 0 && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-100 px-3 py-2">
                  <ShieldAlert className="h-4 w-4 text-orange-500 shrink-0" />
                  <p className="text-xs text-orange-800">
                    <span className="font-semibold">
                      {risks.data.pastDueSubscriptions}
                    </span>{" "}
                    {t("dashboard.pastDue").toLowerCase()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              {t("analytics.topByRentals")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topByRentals.isLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : (topByRentals.data?.length ?? 0) === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
                {t("common.noData")}
              </div>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(topByRentals.data ?? []).map(
                      (item: TopTenant, i: number) => ({
                        name: item.companyName,
                        value: item.value,
                        color: CHART_COLORS[i % CHART_COLORS.length],
                      }),
                    )}
                    layout="vertical"
                    barSize={18}
                  >
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      width={100}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                      cursor={{ fill: "hsl(var(--muted))" }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {(topByRentals.data ?? []).map(
                        (_: TopTenant, i: number) => (
                          <Cell
                            key={i}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ),
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              {t("analytics.topByAssets")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topByAssets.isLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : (topByAssets.data?.length ?? 0) === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
                {t("common.noData")}
              </div>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(topByAssets.data ?? []).map(
                      (item: TopTenant, i: number) => ({
                        name: item.companyName,
                        value: item.value,
                        color: CHART_COLORS[i % CHART_COLORS.length],
                      }),
                    )}
                    layout="vertical"
                    barSize={18}
                  >
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      width={100}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                      cursor={{ fill: "hsl(var(--muted))" }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {(topByAssets.data ?? []).map(
                        (_: TopTenant, i: number) => (
                          <Cell
                            key={i}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ),
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
