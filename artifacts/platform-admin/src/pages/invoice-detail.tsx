import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  issued: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  void: "bg-red-100 text-red-800",
  overdue: "bg-orange-100 text-orange-800",
};

export default function InvoiceDetailPage() {
  const { t } = useTranslation();
  const [, params] = useRoute("/billing/invoices/:id");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const invoiceId = params?.id;
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [paidForm, setPaidForm] = useState({ amount: "", method: "", reference: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => api<Record<string, unknown>>(`/platform/billing/invoices/${invoiceId}`),
    enabled: !!invoiceId,
  });

  const issueMutation = useMutation({
    mutationFn: () =>
      api(`/platform/billing/invoices/${invoiceId}/issue`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] }),
  });

  const markPaidMutation = useMutation({
    mutationFn: (body: { amount: number; method: string; reference?: string }) =>
      api(`/platform/billing/invoices/${invoiceId}/mark-paid`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      setShowMarkPaid(false);
    },
  });

  const voidMutation = useMutation({
    mutationFn: () =>
      api(`/platform/billing/invoices/${invoiceId}/void`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] }),
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
      <div className="p-6">
        <p className="text-muted-foreground">{t("invoiceDetail.notFound")}</p>
      </div>
    );
  }

  const status = data.status as string;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/billing")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("common.back")}
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{t("invoiceDetail.title")}</h1>
      </div>

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
            <p className="text-sm text-muted-foreground">{t("common.amount")}</p>
            <p className="text-xl font-bold">
              {formatCurrency(data.amount as number, data.currency as string)}
            </p>
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
            <p className="text-sm text-muted-foreground">{t("common.dueDate")}</p>
            <p className="font-medium">
              {data.dueDate ? new Date(data.dueDate as string).toLocaleDateString() : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("common.details")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{t("common.id")}:</span>{" "}
              <span className="font-mono text-xs">{data.id as string}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t("common.created")}:</span>{" "}
              {data.createdAt ? new Date(data.createdAt as string).toLocaleString() : "-"}
            </div>
            {data.subscriptionId ? (
              <div>
                <span className="text-muted-foreground">{t("common.subscription")}:</span>{" "}
                <span className="font-mono text-xs">{String(data.subscriptionId)}</span>
              </div>
            ) : null}
            {data.paidAt ? (
              <div>
                <span className="text-muted-foreground">{t("common.paidAt")}:</span>{" "}
                {new Date(data.paidAt as string).toLocaleString()}
              </div>
            ) : null}
            {data.notes ? (
              <div className="col-span-2">
                <span className="text-muted-foreground">{t("common.notes")}:</span>{" "}
                {String(data.notes)}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("common.actions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {status === "draft" && (
              <Button
                size="sm"
                onClick={() => issueMutation.mutate()}
                disabled={issueMutation.isPending}
              >
                {t("invoiceDetail.issueInvoice")}
              </Button>
            )}
            {(status === "issued" || status === "overdue") && (
              <Button
                size="sm"
                onClick={() => {
                  setPaidForm({ amount: String((data.amount as number) || 0), method: "", reference: "" });
                  setShowMarkPaid(true);
                }}
              >
                {t("invoiceDetail.markPaid")}
              </Button>
            )}
            {status !== "void" && status !== "paid" && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => voidMutation.mutate()}
                disabled={voidMutation.isPending}
              >
                {t("invoiceDetail.void")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showMarkPaid} onOpenChange={setShowMarkPaid}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("invoiceDetail.markInvoicePaid")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              markPaidMutation.mutate({
                amount: parseInt(paidForm.amount),
                method: paidForm.method,
                reference: paidForm.reference || undefined,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>{t("invoiceDetail.amountCents")}</Label>
              <Input
                type="number"
                value={paidForm.amount}
                onChange={(e) => setPaidForm({ ...paidForm, amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("invoiceDetail.paymentMethod")}</Label>
              <Input
                value={paidForm.method}
                onChange={(e) => setPaidForm({ ...paidForm, method: e.target.value })}
                placeholder="e.g. bank_transfer, card"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("invoiceDetail.reference")}</Label>
              <Input
                value={paidForm.reference}
                onChange={(e) => setPaidForm({ ...paidForm, reference: e.target.value })}
                placeholder={t("invoiceDetail.transactionRef")}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowMarkPaid(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={markPaidMutation.isPending}>
                {markPaidMutation.isPending ? t("common.processing") : t("invoiceDetail.confirmPayment")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
