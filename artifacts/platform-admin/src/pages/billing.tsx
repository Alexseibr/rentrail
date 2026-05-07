import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { useLocation } from "wouter";

interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount / 100,
  );
}

const subStatusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  trial: "bg-blue-100 text-blue-800",
  past_due: "bg-red-100 text-red-800",
  canceled: "bg-gray-100 text-gray-800",
};

const invStatusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  issued: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  void: "bg-red-100 text-red-800",
};

function PlansTab() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [editPlanId, setEditPlanId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    price: "",
    billingInterval: "monthly",
    currency: "USD",
  });

  const { data: plans, isLoading } = useQuery({
    queryKey: ["billing", "plans"],
    queryFn: () =>
      api<Array<Record<string, unknown>>>("/platform/billing/plans"),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/platform/billing/plans", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "plans"] });
      setShowCreate(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api(`/platform/billing/plans/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "plans"] });
      setEditPlanId(null);
    },
  });

  function openEdit(plan: Record<string, unknown>) {
    setEditPlanId(plan.id as string);
    setForm({
      name: (plan.name as string) || "",
      code: (plan.code as string) || "",
      price: String(((plan.price as number) || 0) / 100),
      billingInterval: (plan.billingInterval as string) || "monthly",
      currency: (plan.currency as string) || "USD",
    });
  }

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          {t("billing.createPlan")}
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("billing.code")}</TableHead>
                <TableHead>{t("billing.price")}</TableHead>
                <TableHead>{t("billing.interval")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(plans || []).map((plan) => (
                <TableRow key={plan.id as string}>
                  <TableCell className="font-medium">
                    {plan.name as string}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {plan.code as string}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(
                      plan.price as number,
                      plan.currency as string,
                    )}
                  </TableCell>
                  <TableCell>{plan.billingInterval as string}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        plan.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }
                    >
                      {plan.isActive
                        ? t("common.active")
                        : t("common.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => openEdit(plan)}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      {t("common.edit")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {plans?.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {t("billing.noPlans")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("billing.createPlan")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({
                ...form,
                price: parseInt(form.price) * 100,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>{t("billing.planName")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("billing.code")}</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("billing.priceUnits")}</Label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t("billing.billingInterval")}</Label>
                <Select
                  value={form.billingInterval}
                  onValueChange={(v) =>
                    setForm({ ...form, billingInterval: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">
                      {t("billing.monthly")}
                    </SelectItem>
                    <SelectItem value="quarterly">
                      {t("billing.quarterly")}
                    </SelectItem>
                    <SelectItem value="yearly">
                      {t("billing.yearly")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreate(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? t("common.creating")
                  : t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editPlanId} onOpenChange={() => setEditPlanId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("billing.editPlan")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editPlanId) {
                updateMutation.mutate({
                  id: editPlanId,
                  body: {
                    name: form.name,
                    price: parseInt(form.price) * 100,
                    billingInterval: form.billingInterval,
                  },
                });
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>{t("billing.planName")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("billing.priceUnits")}</Label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t("billing.billingInterval")}</Label>
                <Select
                  value={form.billingInterval}
                  onValueChange={(v) =>
                    setForm({ ...form, billingInterval: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">
                      {t("billing.monthly")}
                    </SelectItem>
                    <SelectItem value="quarterly">
                      {t("billing.quarterly")}
                    </SelectItem>
                    <SelectItem value="yearly">
                      {t("billing.yearly")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditPlanId(null)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending
                  ? t("common.saving")
                  : t("billing.saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SubscriptionsTab() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["billing", "subscriptions", statusFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      return api<PaginatedResponse<Record<string, unknown>>>(
        `/platform/billing/subscriptions?${params}`,
      );
    },
  });

  const totalPages = data?.pagination?.totalPages ?? 0;

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("common.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            <SelectItem value="active">{t("common.active")}</SelectItem>
            <SelectItem value="trial">{t("common.trial")}</SelectItem>
            <SelectItem value="past_due">{t("dashboard.pastDue")}</SelectItem>
            <SelectItem value="canceled">{t("common.canceled")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.company")}</TableHead>
                <TableHead>{t("companies.plan")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("billing.periodEnd")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items || []).map((sub) => (
                <TableRow
                  key={sub.id as string}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/billing/subscriptions/${sub.id}`)}
                >
                  <TableCell className="font-medium">
                    {(sub.companyName as string) || (sub.companyId as string)}
                  </TableCell>
                  <TableCell>
                    {(sub.planName as string) || (sub.planId as string)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={subStatusColors[sub.status as string] || ""}
                    >
                      {sub.status as string}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {sub.currentPeriodEnd
                      ? new Date(
                          sub.currentPeriodEnd as string,
                        ).toLocaleDateString()
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {data?.items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {t("billing.noSubscriptions")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                {data?.pagination?.total ?? 0} {t("common.total")}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  {t("common.page", { page, totalPages })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function InvoicesTab() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["billing", "invoices", statusFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      return api<PaginatedResponse<Record<string, unknown>>>(
        `/platform/billing/invoices?${params}`,
      );
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      api(`/platform/billing/invoices/${id}/mark-paid`, {
        method: "POST",
        body: JSON.stringify({ amount, method: "manual" }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices"] }),
  });

  const voidMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/platform/billing/invoices/${id}/void`, { method: "POST" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices"] }),
  });

  const totalPages = data?.pagination?.totalPages ?? 0;

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("common.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            <SelectItem value="draft">{t("billing.draft")}</SelectItem>
            <SelectItem value="issued">{t("billing.issued")}</SelectItem>
            <SelectItem value="paid">{t("billing.paid")}</SelectItem>
            <SelectItem value="void">{t("billing.void")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.company")}</TableHead>
                <TableHead>{t("common.amount")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("common.dueDate")}</TableHead>
                <TableHead>{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items || []).map((inv) => (
                <TableRow
                  key={inv.id as string}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/billing/invoices/${inv.id}`)}
                >
                  <TableCell className="font-medium">
                    {(inv.companyName as string) || (inv.companyId as string)}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(
                      inv.amount as number,
                      inv.currency as string,
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={invStatusColors[inv.status as string] || ""}
                    >
                      {inv.status as string}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {inv.dueDate
                      ? new Date(inv.dueDate as string).toLocaleDateString()
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {inv.status === "issued" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              markPaidMutation.mutate({
                                id: inv.id as string,
                                amount: inv.amount as number,
                              })
                            }
                            disabled={markPaidMutation.isPending}
                          >
                            {t("billing.markPaid")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() =>
                              voidMutation.mutate(inv.id as string)
                            }
                            disabled={voidMutation.isPending}
                          >
                            {t("billing.void")}
                          </Button>
                        </>
                      )}
                      {inv.status === "draft" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => voidMutation.mutate(inv.id as string)}
                          disabled={voidMutation.isPending}
                        >
                          {t("billing.void")}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {data?.items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {t("billing.noInvoices")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                {data?.pagination?.total ?? 0} {t("common.total")}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  {t("common.page", { page, totalPages })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function PaymentsTab() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [companyFilter, setCompanyFilter] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState("");
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["billing", "payments", companyFilter, invoiceFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (companyFilter) params.set("companyId", companyFilter);
      if (invoiceFilter) params.set("invoiceId", invoiceFilter);
      return api<PaginatedResponse<Record<string, unknown>>>(
        `/platform/billing/payments?${params}`,
      );
    },
  });

  const items = data?.items || [];
  const total = data?.pagination?.total ?? 0;
  const totalPages = data?.pagination?.totalPages ?? 0;

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <Input
          placeholder={t("billing.filterByCompanyId")}
          value={companyFilter}
          onChange={(e) => {
            setCompanyFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <Input
          placeholder={t("billing.filterByInvoiceId")}
          value={invoiceFilter}
          onChange={(e) => {
            setInvoiceFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.company")}</TableHead>
                <TableHead>{t("common.amount")}</TableHead>
                <TableHead>{t("billing.method")}</TableHead>
                <TableHead>{t("billing.reference")}</TableHead>
                <TableHead>{t("billing.date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((payment) => (
                <TableRow key={payment.id as string}>
                  <TableCell className="font-medium">
                    {(payment.companyName as string) ||
                      (payment.companyId as string) ||
                      "-"}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(
                      payment.amount as number,
                      payment.currency as string,
                    )}
                  </TableCell>
                  <TableCell className="capitalize">
                    {(payment.method as string) || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {(payment.reference as string) || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {payment.createdAt
                      ? new Date(
                          payment.createdAt as string,
                        ).toLocaleDateString()
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {t("billing.noPayments")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                {total} {t("common.total")}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  {t("common.page", { page, totalPages })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default function BillingPage() {
  const { t } = useTranslation();

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("billing.title")}
        </h1>
        <p className="text-muted-foreground">{t("billing.title")}</p>
      </div>

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">{t("billing.plans")}</TabsTrigger>
          <TabsTrigger value="subscriptions">
            {t("billing.subscriptions")}
          </TabsTrigger>
          <TabsTrigger value="invoices">{t("billing.invoices")}</TabsTrigger>
          <TabsTrigger value="payments">{t("billing.payments")}</TabsTrigger>
        </TabsList>
        <TabsContent value="plans">
          <PlansTab />
        </TabsContent>
        <TabsContent value="subscriptions">
          <SubscriptionsTab />
        </TabsContent>
        <TabsContent value="invoices">
          <InvoicesTab />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
