import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-100 text-green-800",
  rented: "bg-blue-100 text-blue-800",
  maintenance: "bg-yellow-100 text-yellow-800",
  charging: "bg-purple-100 text-purple-800",
  reserved: "bg-sky-100 text-sky-800",
  blocked: "bg-red-100 text-red-800",
  lost: "bg-red-200 text-red-900",
  overdue: "bg-orange-100 text-orange-800",
  draft: "bg-gray-100 text-gray-800",
};

export default function FleetPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const companyId = user?.memberships?.[0]?.companyId;

  const assetsQuery = useQuery({
    queryKey: ["assets", companyId],
    queryFn: () => api<any>("/assets", {
      headers: companyId ? { "x-company-id": companyId } : {},
    }),
    enabled: !!companyId,
  });

  const items = Array.isArray(assetsQuery.data) ? assetsQuery.data : (assetsQuery.data as any)?.items || [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("nav.fleet")}</h1>
        <p className="text-muted-foreground">{t("fleet.subtitle", "Транспортные средства компании")}</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {["available", "rented", "maintenance", "overdue"].map((s) => (
          <Card key={s}>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{items.filter((a: any) => a.status === s).length}</div>
              <p className="text-sm text-muted-foreground capitalize">{s}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("nav.fleet")} ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {assetsQuery.isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fleet.code", "Код")}</TableHead>
                  <TableHead>{t("fleet.type", "Тип")}</TableHead>
                  <TableHead>{t("fleet.brand", "Марка")}</TableHead>
                  <TableHead>{t("fleet.model", "Модель")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((asset: any) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-mono text-sm">{asset.internalCode}</TableCell>
                    <TableCell>{asset.assetType}</TableCell>
                    <TableCell>{asset.brand}</TableCell>
                    <TableCell>{asset.model}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[asset.status] || "bg-gray-100"}>
                        {asset.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {t("common.noData", "Нет данных")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
