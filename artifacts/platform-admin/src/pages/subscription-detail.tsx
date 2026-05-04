import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBreadcrumb } from "@/components/page-breadcrumb";

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  trial: "bg-blue-100 text-blue-800",
  past_due: "bg-red-100 text-red-800",
  canceled: "bg-gray-100 text-gray-800",
};

export default function SubscriptionDetailPage() {
  const { t } = useTranslation();
  const [, params] = useRoute("/billing/subscriptions/:id");
  const queryClient = useQueryClient();
  const subId = params?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["subscription", subId],
    queryFn: () => api<Record<string, unknown>>(`/platform/billing/subscriptions/${subId}`),
    enabled: !!subId,
  });

  const actionMutation = useMutation({
    mutationFn: ({ action, reason }: { action: string; reason?: string }) =>
      api(`/platform/billing/subscriptions/${subId}/${action}`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscription", subId] }),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 space-y-4">
        <PageBreadcrumb items={[{ label: t("nav.billing"), href: "/billing" }]} />
        <p className="text-muted-foreground">{t("subscriptionDetail.notFound")}</p>
      </div>
    );
  }

  const status = data.status as string;

  return (
    <div className="p-6 space-y-6">
      <PageBreadcrumb items={[
        { label: t("nav.billing"), href: "/billing" },
        { label: t("subscriptionDetail.title") },
      ]} />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">{t("common.status")}</p>
            <Badge variant="secondary" className={statusColors[status] || ""}>
              {status}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">{t("common.company")}</p>
            <p className="font-medium">{(data.companyName as string) || (data.companyId as string)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">{t("common.plan")}</p>
            <p className="font-medium">{(data.planName as string) || (data.planId as string)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">{t("subscriptionDetail.periodEnd")}</p>
            <p className="font-medium">
              {data.currentPeriodEnd
                ? new Date(data.currentPeriodEnd as string).toLocaleDateString()
                : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("subscriptionDetail.details")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{t("common.id")}:</span>{" "}
              <span className="font-mono text-xs">{data.id as string}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t("subscriptionDetail.created")}:</span>{" "}
              {data.createdAt ? new Date(data.createdAt as string).toLocaleString() : "-"}
            </div>
            <div>
              <span className="text-muted-foreground">{t("subscriptionDetail.periodStart")}:</span>{" "}
              {data.currentPeriodStart ? new Date(data.currentPeriodStart as string).toLocaleDateString() : "-"}
            </div>
            <div>
              <span className="text-muted-foreground">{t("subscriptionDetail.trialEnds")}:</span>{" "}
              {data.trialEndsAt ? new Date(data.trialEndsAt as string).toLocaleDateString() : "-"}
            </div>
            {data.notes ? (
              <div className="col-span-2">
                <span className="text-muted-foreground">{t("subscriptionDetail.notes")}:</span>{" "}
                {String(data.notes)}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("subscriptionDetail.actions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {status === "trial" && (
              <Button
                size="sm"
                onClick={() => actionMutation.mutate({ action: "activate" })}
                disabled={actionMutation.isPending}
              >
                {t("subscriptionDetail.activate")}
              </Button>
            )}
            {status === "active" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => actionMutation.mutate({ action: "past-due", reason: "Manual mark" })}
                disabled={actionMutation.isPending}
              >
                {t("subscriptionDetail.markPastDue")}
              </Button>
            )}
            {status !== "canceled" && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => actionMutation.mutate({ action: "cancel", reason: "Admin cancellation" })}
                disabled={actionMutation.isPending}
              >
                {t("subscriptionDetail.cancel")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
