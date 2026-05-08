import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useParams } from "wouter";
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
import { User, Bike, Calendar, Clock, FileText } from "lucide-react";
import { PageBreadcrumb } from "@/components/page-breadcrumb";

interface RentalDetail {
  id: string;
  clientId?: string;
  clientName?: string;
  assetId?: string;
  assetCode?: string;
  rentalType?: string;
  status?: string;
  startAt?: string;
  startDate?: string;
  plannedEndAt?: string;
  endDate?: string;
  actualEndAt?: string;
  returnedAt?: string;
  totalAmount?: number;
  totalPrice?: number;
  notes?: string;
  createdAt?: string;
}

interface StatusHistoryEntry {
  id: string;
  oldStatus?: string;
  toStatus?: string;
  newStatus?: string;
  status?: string;
  reason?: string;
  notes?: string;
  changedBy?: string;
  createdAt?: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  overdue: "bg-red-100 text-red-800",
  awaiting_pickup: "bg-blue-100 text-blue-800",
  draft: "bg-gray-50 text-gray-600",
  canceled: "bg-orange-100 text-orange-800",
  approved: "bg-sky-100 text-sky-800",
};

export default function RentalDetailPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const companyId = user?.memberships?.[0]?.companyId;
  const companyHeaders: Record<string, string> = companyId
    ? { "x-company-id": companyId }
    : {};

      api(`/rentals/${params.id}`, { headers: companyHeaders }),
    enabled: !!companyId && !!params.id,
  });

      api(`/rentals/${params.id}/status-history`, {
        headers: companyHeaders,
      }),
    enabled: !!companyId && !!params.id,
  });

  const rental = rentalQuery.data;
  const history = historyQuery.data ?? [];

  if (rentalQuery.isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!rental) {
    return (
      <div className="p-6 space-y-4">
        <PageBreadcrumb
          items={[{ label: t("nav.rentals"), href: "/rentals" }]}
        />
        <p className="text-muted-foreground">{t("common.noData")}</p>
      </div>
    );
  }

  const formatDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleString() : "—";

  const details = [
    {
      icon: User,
      label: t("rentals.client"),
      value: rental.clientName || rental.clientId?.slice(0, 8) || "—",
    },
    {
      icon: Bike,
      label: t("rentals.asset"),
      value: rental.assetCode || rental.assetId?.slice(0, 8) || "—",
    },
    {
      icon: FileText,
      label: t("rentals.type"),
      value: rental.rentalType || "—",
    },
    {
      icon: Calendar,
      label: t("rentals.start"),
      value: formatDate(rental.startDate || rental.startAt),
    },
    {
      icon: Calendar,
      label: t("rentals.end"),
      value: formatDate(rental.endDate || rental.plannedEndAt),
    },
    {
      icon: Clock,
      label: t("common.date", "Возврат"),
      value: formatDate(rental.actualEndAt || rental.returnedAt),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageBreadcrumb
        items={[
          { label: t("nav.rentals"), href: "/rentals" },
          {
            label:
              rental.clientName ||
              rental.assetCode ||
              `#${params.id?.slice(0, 8)}`,
          },
        ]}
      />
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {t("nav.rentals")} —{" "}
            {rental.clientName || rental.clientId?.slice(0, 8)}
          </h1>
          <p className="text-muted-foreground">
            {rental.assetCode || rental.assetId?.slice(0, 8)}
          </p>
        </div>
        <Badge
          className={`text-sm px-3 py-1 ${STATUS_COLORS[rental.status ?? ""] || "bg-gray-100"}`}
        >
          {String(t(`status.${rental.status}`, rental.status ?? ""))}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("common.details", "Подробности")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {details.map((d) => (
                <div key={d.label} className="flex items-start gap-3">
                  <d.icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{d.label}</dt>
                    <dd className="text-sm font-medium break-all">{d.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
            {rental.notes && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-1">
                  {t("rentals.notes")}
                </p>
                <p className="text-sm">{rental.notes}</p>
              </div>
            )}
            {(rental.totalPrice || rental.totalAmount) && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-1">
                  {t("common.total", "Сумма")}
                </p>
                <p className="text-lg font-bold">
                  {rental.totalPrice || rental.totalAmount}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("fleet.statusHistory")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {historyQuery.isLoading ? (
              <div className="p-6 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                {t("common.noData")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.date", "Дата")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead>{t("fleet.reason")}</TableHead>
                  </TableRow>
                </TableHeader>
                  {history.map((entry: any, i: number) => (  // eslint-disable-line @typescript-eslint/no-explicit-any
                    <TableRow key={entry.id || i}>
                      <TableCell className="text-sm">
                        {entry.createdAt
                          ? new Date(entry.createdAt).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            STATUS_COLORS[
                              entry.newStatus ||
                                entry.toStatus ||
                                entry.status ||
                                ""
                            ] || "bg-gray-100"
                          }
                        >
                          {String(
                            t(
                              `status.${entry.newStatus || entry.toStatus || entry.status || "draft"}`,
                              entry.newStatus ||
                                entry.toStatus ||
                                entry.status ||
                                "—",
                            ),
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.reason || entry.notes || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
