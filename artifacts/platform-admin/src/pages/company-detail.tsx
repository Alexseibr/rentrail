import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle, Ban, Pause, XCircle } from "lucide-react";
import { useState } from "react";

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  blocked: "bg-red-100 text-red-800",
  suspended: "bg-orange-100 text-orange-800",
  canceled: "bg-gray-100 text-gray-800",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  available: "bg-green-500",
  active: "bg-green-500",
  rented: "bg-blue-500",
  awaiting_pickup: "bg-blue-400",
  maintenance: "bg-amber-500",
  charging: "bg-amber-400",
  reserved: "bg-violet-500",
  overdue: "bg-red-500",
  blocked: "bg-red-400",
  lost: "bg-red-600",
  stolen: "bg-red-700",
  completed: "bg-gray-400",
  draft: "bg-gray-400",
  canceled: "bg-gray-400",
  pending_approval: "bg-amber-500",
  awaiting_payment: "bg-amber-400",
};

const STATUS_BAR_COLORS: Record<string, string> = {
  available: "bg-green-500",
  active: "bg-green-500",
  rented: "bg-blue-500",
  awaiting_pickup: "bg-blue-400",
  maintenance: "bg-amber-500",
  charging: "bg-amber-400",
  reserved: "bg-violet-500",
  overdue: "bg-red-500",
  blocked: "bg-red-400",
  lost: "bg-red-600",
  stolen: "bg-red-700",
  completed: "bg-gray-400",
  draft: "bg-gray-300",
  canceled: "bg-gray-300",
  pending_approval: "bg-amber-500",
  awaiting_payment: "bg-amber-400",
};

function statusDotColor(status: string): string {
  return STATUS_DOT_COLORS[status] ?? "bg-gray-400";
}

function statusBarColor(status: string): string {
  return STATUS_BAR_COLORS[status] ?? "bg-gray-400";
}

interface ModerationForm {
  action: string;
  reasonCode: string;
  reasonText: string;
}

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);
}

export default function CompanyDetailPage() {
  const { t } = useTranslation();
  const [, params] = useRoute("/companies/:id");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const companyId = params?.id;
  const [modForm, setModForm] = useState<ModerationForm | null>(null);
  const [showSetPlan, setShowSetPlan] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => api<Record<string, unknown>>(`/platform/companies/${companyId}`),
    enabled: !!companyId,
  });

  const { data: usage } = useQuery({
    queryKey: ["company", companyId, "usage"],
    queryFn: () => api<Record<string, unknown>>(`/platform/companies/${companyId}/usage`),
    enabled: !!companyId,
  });

  const { data: health } = useQuery({
    queryKey: ["company", companyId, "health"],
    queryFn: () => api<Record<string, unknown>>(`/platform/companies/${companyId}/health`),
    enabled: !!companyId,
  });

  const { data: subscriptions } = useQuery({
    queryKey: ["company", companyId, "subscriptions"],
    queryFn: () =>
      api<{ items: Array<Record<string, unknown>>; pagination: { total: number; totalPages: number } }>(
        `/platform/billing/subscriptions?companyId=${companyId}`,
      ),
    enabled: !!companyId,
  });

  const { data: invoices } = useQuery({
    queryKey: ["company", companyId, "invoices"],
    queryFn: () =>
      api<{ items: Array<Record<string, unknown>>; pagination: { total: number; totalPages: number } }>(
        `/platform/billing/invoices?companyId=${companyId}&limit=10`,
      ),
    enabled: !!companyId,
  });

  const { data: auditData } = useQuery({
    queryKey: ["company", companyId, "audit"],
    queryFn: () =>
      api<{ items: Array<Record<string, unknown>>; pagination: Record<string, unknown> }>(
        `/platform/support/tenants/${companyId}/audit?limit=20`,
      ),
    enabled: !!companyId,
  });

  const { data: wlSettings } = useQuery({
    queryKey: ["company", companyId, "whitelabel"],
    queryFn: () =>
      api<Record<string, unknown>>(`/platform/companies/${companyId}/white-label`).catch(() => null),
    enabled: !!companyId,
  });

  const plans = useQuery({
    queryKey: ["billing", "plans-all"],
    queryFn: () => api<Array<Record<string, unknown>>>("/platform/billing/plans"),
  });

  const moderationMutation = useMutation({
    mutationFn: (form: ModerationForm) =>
      api(`/platform/companies/${companyId}/${form.action}`, {
        method: "POST",
        body: JSON.stringify({
          reasonCode: form.reasonCode,
          reasonText: form.reasonText,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });
      setModForm(null);
    },
  });

  const setPlanMutation = useMutation({
    mutationFn: (planId: string) =>
      api(`/platform/companies/${companyId}/set-plan`, {
        method: "POST",
        body: JSON.stringify({ planId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });
      setShowSetPlan(false);
      setSelectedPlanId("");
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">{t("companyDetail.notFound")}</p>
      </div>
    );
  }

  const status = company.status as string;

  const moderationActions = [
    { action: "approve", label: t("companyDetail.approve"), icon: CheckCircle, show: status === "pending", variant: "default" as const },
    { action: "block", label: t("companyDetail.block"), icon: Ban, show: status === "active" || status === "pending", variant: "destructive" as const },
    { action: "suspend", label: t("companyDetail.suspend"), icon: Pause, show: status === "active", variant: "outline" as const },
    { action: "unblock", label: t("companyDetail.unblock"), icon: CheckCircle, show: status === "blocked" || status === "suspended", variant: "default" as const },
    { action: "cancel", label: t("common.cancel"), icon: XCircle, show: status !== "canceled", variant: "destructive" as const },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/companies")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{company.name as string}</h1>
            <Badge variant="secondary" className={statusColors[status] || ""}>
              {status}
            </Badge>
          </div>
          <p className="text-muted-foreground">{company.slug as string}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSetPlan(true)}>
            {t("companies.setPlan")}
          </Button>
          {moderationActions
            .filter((a) => a.show)
            .map((a) => (
              <Button
                key={a.action}
                variant={a.variant}
                size="sm"
                onClick={() =>
                  setModForm({ action: a.action, reasonCode: "", reasonText: "" })
                }
              >
                <a.icon className="h-4 w-4 mr-1" />
                {a.label}
              </Button>
            ))}
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">{t("companyDetail.details")}</TabsTrigger>
          <TabsTrigger value="modules">{t("companyDetail.modules")}</TabsTrigger>
          <TabsTrigger value="subscription">{t("companyDetail.subscription")}</TabsTrigger>
          <TabsTrigger value="billing">{t("companyDetail.billing")}</TabsTrigger>
          <TabsTrigger value="usage">{t("companyDetail.usage")}</TabsTrigger>
          <TabsTrigger value="health">{t("companyDetail.health")}</TabsTrigger>
          <TabsTrigger value="whitelabel">{t("companyDetail.whiteLabel")}</TabsTrigger>
          <TabsTrigger value="audit">{t("companyDetail.auditTrail")}</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("companyDetail.companyInfo")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                {[
                  [t("common.name"), company.name],
                  ["Slug", company.slug],
                  [t("common.legalName"), company.legalName],
                  [t("common.email"), company.email],
                  [t("common.phone"), company.phone],
                  [t("common.country"), company.country],
                  [t("common.currency"), company.currency],
                  [t("common.timezone"), company.timezone],
                  [t("common.created"), company.createdAt ? new Date(company.createdAt as string).toLocaleString() : null],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-muted-foreground">{label as string}</dt>
                    <dd className="font-medium mt-0.5">{(value as string) || "-"}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("companyDetail.enabledModules")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.module")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead>{t("companyDetail.enabledAt")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(company.modules as Array<{ moduleCode: string; enabled: boolean; enabledAt: string }> || []).map(
                    (mod) => (
                      <TableRow key={mod.moduleCode}>
                        <TableCell className="font-medium capitalize">
                          {mod.moduleCode.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={mod.enabled ? "default" : "secondary"}>
                            {mod.enabled ? t("common.enabled") : t("common.disabled")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {mod.enabledAt ? new Date(mod.enabledAt).toLocaleDateString() : "-"}
                        </TableCell>
                      </TableRow>
                    ),
                  )}
                  {(!company.modules || (company.modules as Array<unknown>).length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                        {t("companyDetail.noModules")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("billing.subscriptions")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.plan")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead>{t("subscriptionDetail.periodStart")}</TableHead>
                    <TableHead>{t("subscriptionDetail.trialEnds")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(subscriptions?.items || []).map((sub) => (
                    <TableRow key={sub.id as string}>
                      <TableCell className="font-medium">{(sub.planName as string) || (sub.planId as string)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{sub.status as string}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sub.currentPeriodStart
                          ? `${new Date(sub.currentPeriodStart as string).toLocaleDateString()} - ${new Date(sub.currentPeriodEnd as string).toLocaleDateString()}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sub.trialEndsAt ? new Date(sub.trialEndsAt as string).toLocaleDateString() : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(subscriptions?.items || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                        {t("companyDetail.noSubscriptions")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("companyDetail.recentInvoices")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.amount")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead>{t("common.dueDate")}</TableHead>
                    <TableHead>{t("common.created")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(invoices?.items || []).map((inv) => (
                    <TableRow key={inv.id as string}>
                      <TableCell className="font-medium">
                        {formatCurrency(inv.amount as number, inv.currency as string)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{inv.status as string}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {inv.dueDate ? new Date(inv.dueDate as string).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {inv.createdAt ? new Date(inv.createdAt as string).toLocaleDateString() : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(invoices?.items || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                        {t("common.noInvoices")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("companyDetail.usageStats")}</CardTitle>
            </CardHeader>
            <CardContent>
              {usage ? (
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {Object.entries(usage).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-muted-foreground capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </dt>
                      <dd className="text-lg font-semibold mt-0.5">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-muted-foreground">{t("companyDetail.noUsageData")}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          {health ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-5 pb-4 px-5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("companyDetail.healthSummary")}</p>
                    <p className="text-2xl font-bold mt-1">{(health as Record<string, unknown>).companyName as string}</p>
                    <Badge className="mt-1">{(health as Record<string, unknown>).status as string}</Badge>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t("companyDetail.healthAssets")} — {t("companyDetail.healthByStatus")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const assets = (health as Record<string, Record<string, Record<string, number>>>).assets;
                      if (!assets?.byStatus) return <p className="text-muted-foreground text-sm">{t("companyDetail.noHealthData")}</p>;
                      const total = Object.values(assets.byStatus).reduce((s, v) => s + v, 0);
                      return (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm font-medium mb-2">
                            <span>{t("companyDetail.healthTotal")}</span>
                            <span className="text-lg font-bold">{total}</span>
                          </div>
                          {Object.entries(assets.byStatus).sort(([,a],[,b]) => b - a).map(([status, count]) => (
                            <div key={status} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${statusDotColor(status)}`} />
                                <span className="text-sm capitalize">{status.replace(/_/g, " ")}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="h-2 rounded-full bg-muted overflow-hidden" style={{ width: 80 }}>
                                  <div className={`h-full rounded-full ${statusBarColor(status)}`} style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }} />
                                </div>
                                <span className="text-sm font-semibold w-6 text-right">{count}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t("companyDetail.healthRentals")} — {t("companyDetail.healthByStatus")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const rentals = (health as Record<string, Record<string, Record<string, number>>>).rentals;
                      if (!rentals?.byStatus) return <p className="text-muted-foreground text-sm">{t("companyDetail.noHealthData")}</p>;
                      const total = Object.values(rentals.byStatus).reduce((s, v) => s + v, 0);
                      return (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm font-medium mb-2">
                            <span>{t("companyDetail.healthTotal")}</span>
                            <span className="text-lg font-bold">{total}</span>
                          </div>
                          {Object.entries(rentals.byStatus).sort(([,a],[,b]) => b - a).map(([status, count]) => (
                            <div key={status} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${statusDotColor(status)}`} />
                                <span className="text-sm capitalize">{status.replace(/_/g, " ")}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="h-2 rounded-full bg-muted overflow-hidden" style={{ width: 80 }}>
                                  <div className={`h-full rounded-full ${statusBarColor(status)}`} style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }} />
                                </div>
                                <span className="text-sm font-semibold w-6 text-right">{count}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t("companyDetail.healthAssets")} — {t("companyDetail.healthIssues")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const assets = (health as Record<string, Record<string, Record<string, number>>>).assets;
                      if (!assets?.issues) return <p className="text-muted-foreground text-sm">{t("companyDetail.noHealthData")}</p>;
                      return (
                        <div className="grid grid-cols-2 gap-3">
                          {Object.entries(assets.issues).map(([key, count]) => (
                            <div key={key} className={`rounded-xl p-3 ${count > 0 ? "bg-destructive/10" : "bg-muted"}`}>
                              <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                              <p className={`text-xl font-bold mt-0.5 ${count > 0 ? "text-destructive" : ""}`}>{count}</p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t("companyDetail.healthIncidents")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const incidents = (health as Record<string, Record<string, number>>).incidents;
                      if (!incidents) return <p className="text-muted-foreground text-sm">{t("companyDetail.noHealthData")}</p>;
                      const items = [
                        { label: t("companyDetail.healthActiveBlacklist"), value: incidents.activeBlacklistEntries },
                        { label: t("companyDetail.healthLostStolen"), value: incidents.lostOrStolenAssets },
                        { label: t("companyDetail.healthOverdueRentals"), value: incidents.overdueRentals },
                        { label: t("companyDetail.healthDisputedRentals"), value: incidents.disputedRentals },
                      ];
                      return (
                        <div className="grid grid-cols-2 gap-3">
                          {items.map((item) => (
                            <div key={item.label} className={`rounded-xl p-3 ${(item.value ?? 0) > 0 ? "bg-warning/10" : "bg-muted"}`}>
                              <p className="text-xs text-muted-foreground">{item.label}</p>
                              <p className={`text-xl font-bold mt-0.5 ${(item.value ?? 0) > 0 ? "text-warning" : ""}`}>{item.value ?? 0}</p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground">{t("companyDetail.noHealthData")}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="whitelabel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("whiteLabel.settings")}</CardTitle>
            </CardHeader>
            <CardContent>
              {wlSettings ? (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  {Object.entries(wlSettings).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-muted-foreground capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </dt>
                      <dd className="font-medium mt-0.5">
                        {typeof value === "object" ? JSON.stringify(value) : String(value || "-")}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-muted-foreground">{t("companyDetail.noWlSettings")}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("companyDetail.auditTrail")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("dashboard.action")}</TableHead>
                    <TableHead>{t("dashboard.entity")}</TableHead>
                    <TableHead>{t("common.details")}</TableHead>
                    <TableHead>{t("dashboard.time")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(auditData?.items || []).map((log) => (
                    <TableRow key={log.id as string}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {log.action as string}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.entityType as string}
                        {log.entityId ? ` #${(log.entityId as string).slice(0, 8)}` : ""}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {log.reasonText
                          ? (log.reasonText as string)
                          : log.after
                            ? t("companyDetail.dataUpdated")
                            : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.createdAt
                          ? new Date(log.createdAt as string).toLocaleString()
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(auditData?.items || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                        {t("companyDetail.noAuditRecords")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!modForm} onOpenChange={() => setModForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{t("companyDetail.actionCompany", { action: modForm?.action })}</DialogTitle>
          </DialogHeader>
          {modForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                moderationMutation.mutate(modForm);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>{t("companyDetail.reasonCode")}</Label>
                <Input
                  value={modForm.reasonCode}
                  onChange={(e) => setModForm({ ...modForm, reasonCode: e.target.value })}
                  placeholder="e.g. policy_violation"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t("companyDetail.reasonText")}</Label>
                <Textarea
                  value={modForm.reasonText}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setModForm({ ...modForm, reasonText: e.target.value })}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setModForm(null)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  variant={modForm.action === "approve" || modForm.action === "unblock" ? "default" : "destructive"}
                  disabled={moderationMutation.isPending}
                >
                  {moderationMutation.isPending ? t("common.processing", "Обработка...") : t("companyDetail.confirmModeration", { action: modForm.action })}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showSetPlan} onOpenChange={setShowSetPlan}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("companies.setPlanFor", { name: company.name as string })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("companies.selectPlan")}</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("companies.choosePlan")} />
                </SelectTrigger>
                <SelectContent>
                  {(plans.data || []).map((p) => (
                    <SelectItem key={p.id as string} value={p.id as string}>
                      {p.name as string}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSetPlan(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                disabled={!selectedPlanId || setPlanMutation.isPending}
                onClick={() => setPlanMutation.mutate(selectedPlanId)}
              >
                {setPlanMutation.isPending ? t("common.processing", "Обработка...") : t("companies.assignPlan")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
