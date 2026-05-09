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
import { Bike, Hash, Tag, MapPin, Calendar, DollarSign } from "lucide-react";
import { PageBreadcrumb } from "@/components/page-breadcrumb";

interface AssetDetail {
  id: string;
  internalCode?: string;
  assetType?: string;
  status?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  qrCode?: string;
  branchId?: string;
  branchName?: string;
  notes?: string;
  purchasePrice?: number;
  currentValue?: number;
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
  available: "bg-green-100 text-green-800",
  rented: "bg-blue-100 text-blue-800",
  maintenance: "bg-yellow-100 text-yellow-800",
  charging: "bg-purple-100 text-purple-800",
  reserved: "bg-sky-100 text-sky-800",
  blocked: "bg-red-100 text-red-800",
  lost: "bg-red-200 text-red-900",
  overdue: "bg-orange-100 text-orange-800",
  draft: "bg-gray-50 text-gray-600",
  retired: "bg-gray-200 text-gray-600",
  stolen: "bg-red-200 text-red-900",
};

export default function AssetDetailPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const companyId = user?.memberships?.[0]?.companyId;
  const companyHeaders: Record<string, string> = companyId
    ? { "x-company-id": companyId }
    : {};

  const assetQuery = useQuery({
    queryKey: ["asset", params.id],
    queryFn: () =>
      api<AssetDetail>(`/assets/${params.id}`, { headers: companyHeaders }),
    enabled: !!companyId && !!params.id,
  });

  const historyQuery = useQuery({
    queryKey: ["asset-history", params.id],
    queryFn: () =>
      api<StatusHistoryEntry[]>(`/assets/${params.id}/status-history`, {
        headers: companyHeaders,
      }),
    enabled: !!companyId && !!params.id,
  });

  const asset = assetQuery.data;
  const history = historyQuery.data ?? [];

  if (assetQuery.isLoading) {
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

  if (!asset) {
    return (
      <div className="p-6 space-y-4">
        <PageBreadcrumb items={[{ label: t("nav.fleet"), href: "/fleet" }]} />
        <p className="text-muted-foreground">{t("common.noData")}</p>
      </div>
    );
  }

  const details = [
    { icon: Hash, label: t("fleet.code"), value: asset.internalCode },
    {
      icon: Bike,
      label: t("fleet.type"),
      value: t(`assetType.${asset.assetType}`, asset.assetType ?? ""),
    },
    {
      icon: Tag,
      label: t("fleet.brand"),
      value: `${asset.brand || "—"} ${asset.model || ""}`.trim(),
    },
    { icon: Hash, label: t("fleet.serial"), value: asset.serialNumber || "—" },
    { icon: Hash, label: t("fleet.qr"), value: asset.qrCode || "—" },
    {
      icon: MapPin,
      label: t("fleet.branch"),
      value: asset.branchName || asset.branchId?.slice(0, 8) || "—",
    },
    {
      icon: DollarSign,
      label: t("fleet.purchasePrice"),
      value: asset.purchasePrice ? `${asset.purchasePrice}` : "—",
    },
    {
      icon: DollarSign,
      label: t("fleet.currentValue"),
      value: asset.currentValue ? `${asset.currentValue}` : "—",
    },
    {
      icon: Calendar,
      label: t("fleet.createdAt"),
      value: asset.createdAt
        ? new Date(asset.createdAt).toLocaleDateString()
        : "—",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageBreadcrumb
        items={[
          { label: t("nav.fleet"), href: "/fleet" },
          { label: asset.internalCode ?? "" },
        ]}
      />
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {asset.internalCode}
          </h1>
          <p className="text-muted-foreground">
            {String(t(`assetType.${asset.assetType}`, asset.assetType ?? ""))} —{" "}
            {asset.brand} {asset.model}
          </p>
        </div>
        <Badge
          className={`text-sm px-3 py-1 ${STATUS_COLORS[asset.status ?? ""] || "bg-gray-100"}`}
        >
          {String(t(`status.${asset.status}`, asset.status ?? ""))}
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
            {asset.notes && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-1">
                  {t("fleet.notes")}
                </p>
                <p className="text-sm">{asset.notes}</p>
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
                {Array.from({ length: 3 }).map(
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (_: any, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ),
                )}
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
                <TableBody>
                  {history.map(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (entry: any, i: number) => (
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
                    ),
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
