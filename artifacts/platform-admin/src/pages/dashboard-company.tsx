import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bike, ClipboardList, Users, MapPin } from "lucide-react";

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

export default function CompanyDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const companyId = user?.memberships?.[0]?.companyId;
  const companyName = user?.memberships?.[0]?.companyName;
  const companyHeaders = companyId ? { "x-company-id": companyId } : {};

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

  const assets = Array.isArray(assetsQuery.data) ? assetsQuery.data : (assetsQuery.data as any)?.items || [];
  const rentals = Array.isArray(rentalsQuery.data) ? rentalsQuery.data : (rentalsQuery.data as any)?.items || [];
  const clients = Array.isArray(clientsQuery.data) ? clientsQuery.data : (clientsQuery.data as any)?.items || [];
  const branches = Array.isArray(branchesQuery.data) ? branchesQuery.data : (branchesQuery.data as any)?.items || [];

  const isLoading = assetsQuery.isLoading || rentalsQuery.isLoading || clientsQuery.isLoading || branchesQuery.isLoading;

  const activeRentals = rentals.filter((r: any) => r.status === "active" || r.status === "overdue");
  const recentRentals = [...rentals].sort((a: any, b: any) => new Date(b.createdAt || b.startDate || 0).getTime() - new Date(a.createdAt || a.startDate || 0).getTime()).slice(0, 5);

  const assetStatusCounts: Record<string, number> = {};
  assets.forEach((a: any) => {
    assetStatusCounts[a.status] = (assetStatusCounts[a.status] || 0) + 1;
  });

  const rentalStatusCounts: Record<string, number> = {};
  rentals.forEach((r: any) => {
    rentalStatusCounts[r.status] = (rentalStatusCounts[r.status] || 0) + 1;
  });

  const metrics = [
    { label: t("companyDashboard.totalAssets"), value: assets.length, icon: Bike, color: "text-blue-600" },
    { label: t("companyDashboard.activeRentals"), value: activeRentals.length, icon: ClipboardList, color: "text-green-600" },
    { label: t("companyDashboard.totalClients"), value: clients.length, icon: Users, color: "text-violet-600" },
    { label: t("companyDashboard.totalBranches"), value: branches.length, icon: MapPin, color: "text-orange-600" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{companyName || t("companyDashboard.title")}</h1>
        <p className="text-muted-foreground">{t("companyDashboard.subtitle")}</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  {isLoading ? (
                    <Skeleton className="h-8 w-12" />
                  ) : (
                    <div className="text-3xl font-bold">{m.value}</div>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">{m.label}</p>
                </div>
                <m.icon className={`h-8 w-8 ${m.color} opacity-50`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("companyDashboard.assetsByStatus")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
            ) : Object.keys(assetStatusCounts).length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("common.noData")}</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(assetStatusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={STATUS_COLORS[status] || "bg-gray-100"}>{t(`status.${status}`, status)}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2"
                          style={{ width: `${Math.min((count / assets.length) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("companyDashboard.rentalsByStatus")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
            ) : Object.keys(rentalStatusCounts).length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("common.noData")}</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(rentalStatusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={STATUS_COLORS[status] || "bg-gray-100"}>{t(`status.${status}`, status)}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2"
                          style={{ width: `${Math.min((count / rentals.length) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("companyDashboard.recentRentals")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : recentRentals.length === 0 ? (
            <p className="p-6 text-muted-foreground text-sm">{t("companyDashboard.noRentals")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("rentals.client")}</TableHead>
                  <TableHead>{t("rentals.asset")}</TableHead>
                  <TableHead>{t("rentals.start")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRentals.map((rental: any) => (
                  <TableRow key={rental.id}>
                    <TableCell>{rental.clientName || rental.clientId?.slice(0, 8)}</TableCell>
                    <TableCell className="font-mono text-sm">{rental.assetCode || rental.assetId?.slice(0, 8)}</TableCell>
                    <TableCell className="text-sm">{rental.startDate || rental.startAt ? new Date(rental.startDate || rental.startAt).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[rental.status] || "bg-gray-100"}>{t(`status.${rental.status}`, rental.status)}</Badge>
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
