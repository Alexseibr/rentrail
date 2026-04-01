import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  overdue: "bg-red-100 text-red-800",
  awaiting_pickup: "bg-blue-100 text-blue-800",
  draft: "bg-gray-50 text-gray-600",
  canceled: "bg-orange-100 text-orange-800",
};

export default function RentalsCompanyPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const companyId = user?.memberships?.[0]?.companyId;

  const rentalsQuery = useQuery({
    queryKey: ["rentals", companyId],
    queryFn: () => api<any>("/rentals", {
      headers: companyId ? { "x-company-id": companyId } : {},
    }),
    enabled: !!companyId,
  });

  const items = Array.isArray(rentalsQuery.data) ? rentalsQuery.data : (rentalsQuery.data as any)?.items || [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("nav.rentals")}</h1>
        <p className="text-muted-foreground">{t("rentals.subtitle", "Все аренды компании")}</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {["active", "overdue", "completed", "canceled"].map((s) => (
          <Card key={s}>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{items.filter((r: any) => r.status === s).length}</div>
              <p className="text-sm text-muted-foreground capitalize">{s}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("nav.rentals")} ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rentalsQuery.isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("rentals.client", "Клиент")}</TableHead>
                  <TableHead>{t("rentals.type", "Тип")}</TableHead>
                  <TableHead>{t("rentals.start", "Начало")}</TableHead>
                  <TableHead>{t("rentals.end", "Окончание")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((rental: any) => (
                  <TableRow key={rental.id}>
                    <TableCell>{rental.clientName || rental.clientId?.slice(0, 8)}</TableCell>
                    <TableCell>{rental.rentalType}</TableCell>
                    <TableCell className="text-sm">{rental.startDate ? new Date(rental.startDate).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="text-sm">{rental.endDate ? new Date(rental.endDate).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[rental.status] || "bg-gray-100"}>
                        {rental.status}
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
