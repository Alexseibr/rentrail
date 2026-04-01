import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function BranchesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const companyId = user?.memberships?.[0]?.companyId;

  const branchesQuery = useQuery({
    queryKey: ["branches", companyId],
    queryFn: () => api<any>("/branches", {
      headers: companyId ? { "x-company-id": companyId } : {},
    }),
    enabled: !!companyId,
  });

  const items = Array.isArray(branchesQuery.data) ? branchesQuery.data : (branchesQuery.data as any)?.items || [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("nav.branches")}</h1>
        <p className="text-muted-foreground">{t("branches.subtitle", "Филиалы и станции")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("nav.branches")} ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {branchesQuery.isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("branches.createdAt", "Создан")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((branch: any) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">{branch.name}</TableCell>
                    <TableCell className="text-sm">{branch.createdAt ? new Date(branch.createdAt).toLocaleDateString() : "—"}</TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
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
