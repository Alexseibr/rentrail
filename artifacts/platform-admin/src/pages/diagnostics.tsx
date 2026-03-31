import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ServiceStatus {
  name: string;
  status: string;
  latency?: number;
  message?: string;
  lastChecked?: string;
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
}

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

export default function DiagnosticsPage() {
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
    queryFn: () => api<TenantHealth[]>("/platform/health/tenants"),
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
          <h1 className="text-2xl font-bold tracking-tight">Diagnostics</h1>
          <p className="text-muted-foreground">System health and service status</p>
        </div>
        <Button variant="outline" onClick={refetchAll}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
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
                  <p className="text-2xl font-bold">{healthQuery.data.healthy}</p>
                  <p className="text-sm text-muted-foreground">Healthy</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{healthQuery.data.degraded}</p>
                  <p className="text-sm text-muted-foreground">Degraded</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <XCircle className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{healthQuery.data.critical}</p>
                  <p className="text-sm text-muted-foreground">Critical</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Services</CardTitle>
        </CardHeader>
        <CardContent>
          {servicesQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(servicesQuery.data || []).map((svc) => (
                <div
                  key={svc.name}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <StatusIcon status={svc.status} />
                    <div>
                      <p className="font-medium capitalize">{svc.name}</p>
                      {svc.message && (
                        <p className="text-sm text-muted-foreground">{svc.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {svc.latency !== undefined && (
                      <span className="text-sm text-muted-foreground">{svc.latency}ms</span>
                    )}
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
                </div>
              ))}
              {servicesQuery.data?.length === 0 && (
                <p className="text-center py-4 text-muted-foreground">No services configured</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tenant Health</CardTitle>
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
                    {tenant.issues.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {tenant.issues.length} issue{tenant.issues.length !== 1 ? "s" : ""}
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
                <p className="text-center py-4 text-muted-foreground">No tenant data available</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
