import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Server,
  Mail,
  HardDrive,
  Radio,
  Activity,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ServiceStatus {
  name: string;
  status: string;
  latency?: number;
  message?: string;
  lastChecked?: string;
  version?: string;
}

interface TenantHealth {
  companyId: string;
  companyName: string;
  status: string;
  issues: string[];
}

interface HealthSummary {
  healthy: number;
  degraded: number;
  critical: number;
  services: ServiceStatus[];
  buildVersion?: string;
  uptime?: number;
}

const SERVICE_ICONS: Record<string, typeof Server> = {
  database: Server,
  email: Mail,
  storage: HardDrive,
  queues: Radio,
  telemetry: Activity,
  push: Bell,
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "healthy":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "degraded":
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    default:
      return <XCircle className="h-5 w-5 text-red-500" />;
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function DiagnosticsPage() {
  const { t } = useTranslation();

  const healthQuery = useQuery({
    queryKey: ["health", "summary"],
    queryFn: () => api<HealthSummary>("/platform/health/summary"),
    refetchInterval: 30000,
  });

  const servicesQuery = useQuery({
    queryKey: ["health", "services"],
    queryFn: () => api<ServiceStatus[]>("/platform/health/services"),
    refetchInterval: 30000,
  });

  const tenantsQuery = useQuery({
    queryKey: ["health", "tenants"],
    queryFn: async () => {
      const res = await api<Record<string, unknown>[]>(
        "/platform/health/tenants",
      );
      const items = res ?? [];
      return items.map(
        (t): TenantHealth => ({
          companyId: String(t.companyId ?? t.id ?? ""),
          companyName: String(t.companyName ?? t.name ?? ""),
          status: String(t.status ?? t.healthStatus ?? "healthy"),
          issues: Array.isArray(t.issues) ? (t.issues as string[]) : [],
        }),
      );
    },
    refetchInterval: 60000,
  });

  const refetchAll = () => {
    healthQuery.refetch();
    servicesQuery.refetch();
    tenantsQuery.refetch();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("diagnostics.title")}
          </h1>
          <p className="text-muted-foreground">{t("diagnostics.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {healthQuery.data?.buildVersion && (
            <Badge variant="outline" className="text-xs">
              {t("diagnostics.build")}: {healthQuery.data.buildVersion}
            </Badge>
          )}
          {healthQuery.data?.uptime !== undefined && (
            <Badge variant="outline" className="text-xs">
              {t("diagnostics.uptime")}: {formatUptime(healthQuery.data.uptime)}
            </Badge>
          )}
          <Button variant="outline" onClick={refetchAll}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("diagnostics.refresh")}
          </Button>
        </div>
      </div>

      {healthQuery.isLoading ? (
        <div className="grid gap-4 grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : healthQuery.data ? (
        <div className="grid gap-4 grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {healthQuery.data.healthy}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("diagnostics.healthy")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {healthQuery.data.degraded}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("diagnostics.degraded")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <XCircle className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {healthQuery.data.critical}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("diagnostics.critical")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div>
        <h2 className="text-lg font-semibold mb-3">
          {t("diagnostics.serviceStatus")}
        </h2>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {servicesQuery.isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))
            : (servicesQuery.data || []).map((svc) => {
                const SvcIcon = SERVICE_ICONS[svc.name.toLowerCase()] || Server;
                return (
                  <Card key={svc.name}>
                    <CardContent className="pt-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <SvcIcon className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium capitalize">
                            {svc.name}
                          </span>
                        </div>
                        <Badge
                          variant="secondary"
                          className={
                            svc.status === "healthy"
                              ? "bg-green-100 text-green-800"
                              : svc.status === "degraded"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                          }
                        >
                          {svc.status}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        {svc.latency !== undefined && (
                          <p className="text-xs text-muted-foreground">
                            {t("diagnostics.latency")}: {svc.latency}ms
                          </p>
                        )}
                        {svc.version && (
                          <p className="text-xs text-muted-foreground">
                            {t("diagnostics.version")}: {svc.version}
                          </p>
                        )}
                        {svc.message && (
                          <p className="text-xs text-muted-foreground">
                            {svc.message}
                          </p>
                        )}
                        {svc.lastChecked && (
                          <p className="text-xs text-muted-foreground">
                            {t("diagnostics.checked")}:{" "}
                            {new Date(svc.lastChecked).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("diagnostics.tenantHealth")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tenantsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(tenantsQuery.data || []).map((tenant) => (
                <div
                  key={tenant.companyId}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <StatusIcon status={tenant.status} />
                    <span className="font-medium">{tenant.companyName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(tenant.issues || []).length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {(tenant.issues || []).length} issue
                        {(tenant.issues || []).length !== 1 ? "s" : ""}
                      </span>
                    )}
                    <Badge
                      variant="secondary"
                      className={
                        tenant.status === "healthy"
                          ? "bg-green-100 text-green-800"
                          : tenant.status === "degraded"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }
                    >
                      {tenant.status}
                    </Badge>
                  </div>
                </div>
              ))}
              {tenantsQuery.data?.length === 0 && (
                <p className="text-center py-4 text-muted-foreground">
                  {t("common.noData")}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
