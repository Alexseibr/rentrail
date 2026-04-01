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
  suspended: "bg-yellow-100 text-yellow-800",
  blocked: "bg-red-100 text-red-800",
};

export default function ClientsCompanyPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const companyId = user?.memberships?.[0]?.companyId;

  const clientsQuery = useQuery({
    queryKey: ["clients", companyId],
    queryFn: () => api<any>("/clients", {
      headers: companyId ? { "x-company-id": companyId } : {},
    }),
    enabled: !!companyId,
  });

  const items = Array.isArray(clientsQuery.data) ? clientsQuery.data : (clientsQuery.data as any)?.items || [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("nav.clients")}</h1>
        <p className="text-muted-foreground">{t("clients.subtitle", "Клиенты компании")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("nav.clients")} ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {clientsQuery.isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("clients.name", "Имя")}</TableHead>
                  <TableHead>{t("common.phone")}</TableHead>
                  <TableHead>{t("common.email")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((client: any) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.fullName}</TableCell>
                    <TableCell>{client.phone}</TableCell>
                    <TableCell>{client.email || "—"}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[client.status] || "bg-gray-100"}>
                        {client.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
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
