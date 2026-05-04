import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Bike, ClipboardList, Users, MapPin,
  TrendingUp, AlertCircle, CheckCircle2, Wrench,
  ArrowRight, RefreshCw, Plus, Sparkles,
} from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { useRolePermissions } from "@/hooks/use-role-permissions";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-100 text-green-800",
  rented: "bg-blue-100 text-blue-800",
  maintenance: "bg-yellow-100 text-yellow-800",
  charging: "bg-purple-100 text-purple-800",
  reserved: "bg-sky-100 text-sky-800",
  blocked: "bg-red-100 text-red-800",
  lost: "bg-red-200 text-red-900",
  overdue: "bg-orange-100 text-orange-800",
  active: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  draft: "bg-gray-50 text-gray-600",
  canceled: "bg-orange-100 text-orange-800",
  awaiting_pickup: "bg-blue-100 text-blue-800",
  approved: "bg-sky-100 text-sky-800",
};

const PIE_COLORS: Record<string, string> = {
  available: "#22c55e",
  rented: "#3b82f6",
  maintenance: "#eab308",
  charging: "#a855f7",
  reserved: "#0ea5e9",
  blocked: "#ef4444",
  lost: "#dc2626",
  overdue: "#f97316",
  draft: "#9ca3af",
  retired: "#6b7280",
  stolen: "#b91c1c",
};

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  sub,
  isLoading,
  onClick,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  accent: string;
  sub?: string;
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
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            {isLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className="text-3xl font-bold tracking-tight">{value}</p>
            )}
            {sub && !isLoading && (
              <p className="text-xs text-muted-foreground">{sub}</p>
            )}
          </div>
          <div className={`p-2.5 rounded-xl ${accent.replace("bg-", "bg-").replace("-500", "-100")} mt-0.5`}>
            <Icon className={`h-5 w-5 ${accent.replace("bg-", "text-")}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CompanyDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { canWriteAsset, canWriteBranch } = useRolePermissions();
  const companyId = user?.memberships?.[0]?.companyId;
  const companyName = user?.memberships?.[0]?.companyName;
  const companyHeaders: Record<string, string> = companyId ? { "x-company-id": companyId } : {};

  const assetsQuery = useQuery({
    queryKey: ["assets", companyId],
    queryFn: () => api<any>("/assets", { headers: companyHeaders }),
    enabled: !!companyId,
  });

  const rentalsQuery = useQuery({
    queryKey: ["rentals", companyId],
    queryFn: () => api<any>("/rentals", { headers: companyHeaders }),
    enabled: !!companyId,
  });

  const clientsQuery = useQuery({
    queryKey: ["clients", companyId],
    queryFn: () => api<any>("/clients", { headers: companyHeaders }),
    enabled: !!companyId,
  });

  const branchesQuery = useQuery({
    queryKey: ["branches", companyId],
    queryFn: () => api<any>("/branches", { headers: companyHeaders }),
    enabled: !!companyId,
  });

  const assets = assetsQuery.data ?? [];
  const rentals = rentalsQuery.data ?? [];
  const clients = clientsQuery.data ?? [];
  const branches = branchesQuery.data ?? [];

  const isLoading = assetsQuery.isLoading || rentalsQuery.isLoading || clientsQuery.isLoading || branchesQuery.isLoading;

  const activeRentals = rentals.filter((r: any) => r.status === "active" || r.status === "overdue");
  const overdueRentals = rentals.filter((r: any) => r.status === "overdue");
  const recentRentals = [...rentals]
    .sort((a: any, b: any) => new Date(b.createdAt || b.startDate || 0).getTime() - new Date(a.createdAt || a.startDate || 0).getTime())
    .slice(0, 6);

  const assetStatusCounts: Record<string, number> = {};
  assets.forEach((a: any) => {
    assetStatusCounts[a.status] = (assetStatusCounts[a.status] || 0) + 1;
  });

  const availableCount = assetStatusCounts["available"] || 0;
  const rentedCount = assetStatusCounts["rented"] || 0;
  const maintenanceCount = assetStatusCounts["maintenance"] || 0;

  const pieData = Object.entries(assetStatusCounts)
    .map(([status, count]) => ({
      name: String(t(`status.${status}`, status)),
      value: count,
      color: PIE_COLORS[status] || "#9ca3af",
    }))
    .sort((a, b) => b.value - a.value);

  const utilizationRate = assets.length > 0 ? Math.round((rentedCount / assets.length) * 100) : 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{companyName || t("companyDashboard.title")}</h1>
          <p className="text-muted-foreground mt-0.5">{t("companyDashboard.subtitle")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            assetsQuery.refetch();
            rentalsQuery.refetch();
            clientsQuery.refetch();
            branchesQuery.refetch();
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t("common.refresh", "Обновить")}
        </Button>
      </div>

      {!isLoading && assets.length === 0 && (
        <Card className="border-dashed border-2 border-primary/20 bg-primary/[0.02]">
          <CardContent className="pt-6">
            <Empty className="border-0 p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Sparkles className="h-5 w-5" /></EmptyMedia>
                <EmptyTitle>{t("companyDashboard.welcomeTitle")}</EmptyTitle>
                <EmptyDescription>{t("companyDashboard.welcomeDescription")}</EmptyDescription>
              </EmptyHeader>
              {(canWriteBranch || canWriteAsset) && (
                <EmptyContent>
                  <div className="flex gap-3">
                    {canWriteBranch && branches.length === 0 && (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/branches")}>
                        <MapPin className="h-3.5 w-3.5" />
                        {t("companyDashboard.addFirstBranch")}
                      </Button>
                    )}
                    {canWriteAsset && (
                      <Button size="sm" className="gap-1.5" onClick={() => navigate("/fleet")}>
                        <Plus className="h-3.5 w-3.5" />
                        {t("companyDashboard.addFirstVehicle")}
                      </Button>
                    )}
                  </div>
                </EmptyContent>
              )}
            </Empty>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t("companyDashboard.totalAssets")}
          value={assets.length}
          icon={Bike}
          accent="bg-blue-500"
          sub={`${utilizationRate}% ${t("companyDashboard.utilization", "загрузка")}`}
          isLoading={isLoading}
          onClick={() => navigate("/fleet")}
        />
        <KpiCard
          label={t("companyDashboard.activeRentals")}
          value={activeRentals.length}
          icon={ClipboardList}
          accent="bg-green-500"
          sub={overdueRentals.length > 0 ? `${overdueRentals.length} ${t("status.overdue")}` : undefined}
          isLoading={isLoading}
          onClick={() => navigate("/rentals")}
        />
        <KpiCard
          label={t("companyDashboard.totalClients")}
          value={clients.length}
          icon={Users}
          accent="bg-violet-500"
          isLoading={isLoading}
          onClick={() => navigate("/clients")}
        />
        <KpiCard
          label={t("companyDashboard.totalBranches")}
          value={branches.length}
          icon={MapPin}
          accent="bg-orange-500"
          isLoading={isLoading}
          onClick={() => navigate("/branches")}
        />
      </div>

      {overdueRentals.length > 0 && (
        <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <AlertCircle className="h-5 w-5 text-orange-500 shrink-0" />
          <p className="text-sm text-orange-800 flex-1">
            <span className="font-semibold">{overdueRentals.length}</span> {t("companyDashboard.overdueAlert", "аренд просрочено — требуют внимания")}
          </p>
          <Button size="sm" variant="outline" className="text-orange-700 border-orange-300 hover:bg-orange-100 gap-1.5" onClick={() => navigate("/rentals")}>
            {t("common.view", "Просмотреть")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">{t("companyDashboard.assetsByStatus")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : pieData.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Bike className="h-10 w-10 opacity-20" />
                <p className="text-sm">{t("common.noData")}</p>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex-1 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: number, name: string) => [`${val} (${Math.round((val / assets.length) * 100)}%)`, name]}
                        contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 min-w-0">
                  {pieData.slice(0, 6).map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2 text-sm">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="text-muted-foreground truncate">{entry.name}</span>
                      <span className="font-semibold ml-auto pl-2">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">{t("companyDashboard.fleetHealth", "Состояние парка")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-green-50 border border-green-100 p-3 flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    <div>
                      <p className="text-xl font-bold text-green-700">{availableCount}</p>
                      <p className="text-xs text-green-600">{String(t("status.available"))}</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-blue-500 shrink-0" />
                    <div>
                      <p className="text-xl font-bold text-blue-700">{rentedCount}</p>
                      <p className="text-xs text-blue-600">{String(t("status.rented"))}</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-yellow-50 border border-yellow-100 p-3 flex items-center gap-3">
                    <Wrench className="h-5 w-5 text-yellow-500 shrink-0" />
                    <div>
                      <p className="text-xl font-bold text-yellow-700">{maintenanceCount}</p>
                      <p className="text-xs text-yellow-600">{String(t("status.maintenance"))}</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-orange-50 border border-orange-100 p-3 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-orange-500 shrink-0" />
                    <div>
                      <p className="text-xl font-bold text-orange-700">{overdueRentals.length}</p>
                      <p className="text-xs text-orange-600">{String(t("status.overdue"))}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t("companyDashboard.utilization", "Загрузка парка")}</span>
                    <span className="font-semibold">{utilizationRate}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${utilizationRate}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">{t("companyDashboard.recentRentals")}</CardTitle>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={() => navigate("/rentals")}>
            {t("common.viewAll", "Все аренды")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : recentRentals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <ClipboardList className="h-10 w-10 opacity-20" />
              <p className="text-sm">{t("companyDashboard.noRentals")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">{t("rentals.client")}</TableHead>
                  <TableHead className="text-xs">{t("rentals.asset")}</TableHead>
                  <TableHead className="text-xs">{t("rentals.start")}</TableHead>
                  <TableHead className="text-xs">{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRentals.map((rental: any) => (
                  <TableRow key={rental.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium text-sm">{rental.clientName || rental.clientId?.slice(0, 8) || "—"}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{rental.assetCode || rental.assetId?.slice(0, 8) || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {rental.startDate || rental.startAt
                        ? new Date(rental.startDate || rental.startAt).toLocaleDateString("ru-RU")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${STATUS_COLORS[rental.status] || "bg-gray-100"}`}>
                        {String(t(`status.${rental.status}`, rental.status))}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
