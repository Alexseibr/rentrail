import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, ChevronLeft, ChevronRight, CheckCircle, Ban } from "lucide-react";

interface Company {
  id: string;
  name: string;
  slug: string;
  status: string;
  email?: string;
  phone?: string;
  country?: string;
  currency?: string;
  planName?: string;
  assetCount?: number;
  userCount?: number;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  blocked: "bg-red-100 text-red-800",
  suspended: "bg-orange-100 text-orange-800",
  canceled: "bg-gray-100 text-gray-800",
};

export default function CompaniesPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", email: "", country: "", currency: "USD" });
  const [setPlanTarget, setSetPlanTarget] = useState<{ id: string; name: string } | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const limit = 20;

  const plans = useQuery({
    queryKey: ["billing", "plans-list"],
    queryFn: () => api<Array<{ id: string; name: string }>>("/platform/billing/plans"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["companies", search, statusFilter, planFilter, page, sortBy, sortOrder],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (planFilter !== "all") params.set("plan", planFilter);
      if (sortBy) params.set("sortBy", sortBy);
      if (sortOrder) params.set("sortOrder", sortOrder);
      return api<{ items: Company[]; pagination: { total: number; totalPages: number } }>(`/platform/companies?${params}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) =>
      api("/companies", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setShowCreate(false);
      setForm({ name: "", slug: "", email: "", country: "", currency: "USD" });
      toast({ title: t("companies.companyCreated") });
    },
  });

  const setPlanMutation = useMutation({
    mutationFn: ({ companyId, planId }: { companyId: string; planId: string }) =>
      api(`/platform/companies/${companyId}/set-plan`, {
        method: "POST",
        body: JSON.stringify({ planId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setSetPlanTarget(null);
      setSelectedPlanId("");
      toast({ title: t("companies.planAssigned") });
    },
  });

  const quickActionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api(`/platform/companies/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ reasonCode: "admin_action", reasonText: `Quick ${action} from list` }),
      }),
    onSuccess: (_data, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: `Company ${action}d successfully` });
    },
  });

  const totalPages = data?.pagination?.totalPages ?? 0;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("companies.title")}</h1>
          <p className="text-muted-foreground">{t("companies.subtitle")}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t("companies.addCompany")}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("companies.searchPlaceholder")}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
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
                <SelectItem value="all">{t("companies.allStatuses")}</SelectItem>
                <SelectItem value="active">{t("common.active")}</SelectItem>
                <SelectItem value="pending">{t("common.pending")}</SelectItem>
                <SelectItem value="blocked">{t("common.blocked")}</SelectItem>
                <SelectItem value="suspended">{t("common.suspended")}</SelectItem>
                <SelectItem value="canceled">{t("common.canceled")}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={planFilter}
              onValueChange={(v) => {
                setPlanFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t("companies.plan")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("companies.allPlans")}</SelectItem>
                {(plans.data || []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      { key: "name", labelKey: "common.name" },
                      { key: "slug", labelKey: "dashboard.slug" },
                      { key: "status", labelKey: "common.status" },
                      { key: "", labelKey: "companies.plan" },
                      { key: "", labelKey: "companies.assets" },
                      { key: "", labelKey: "companies.users" },
                      { key: "country", labelKey: "companies.country" },
                      { key: "createdAt", labelKey: "companies.created" },
                    ].map(({ key, labelKey }) => (
                      <TableHead
                        key={labelKey}
                        className={key ? "cursor-pointer select-none hover:text-foreground" : ""}
                        onClick={() => {
                          if (!key) return;
                          if (sortBy === key) {
                            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                          } else {
                            setSortBy(key);
                            setSortOrder("asc");
                          }
                          setPage(1);
                        }}
                      >
                        {t(labelKey)}
                        {sortBy === key && (
                          <span className="ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>
                        )}
                      </TableHead>
                    ))}
                    <TableHead>{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell
                        className="font-medium cursor-pointer hover:underline"
                        onClick={() => navigate(`/companies/${company.id}`)}
                      >
                        {company.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{company.slug}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={statusColors[company.status] || ""}
                        >
                          {company.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {company.planName || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {company.assetCount ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {company.userCount ?? "-"}
                      </TableCell>
                      <TableCell>{company.country || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(company.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {company.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                quickActionMutation.mutate({ id: company.id, action: "approve" });
                              }}
                              disabled={quickActionMutation.isPending}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {t("companies.approve")}
                            </Button>
                          )}
                          {(company.status === "active" || company.status === "pending") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                quickActionMutation.mutate({ id: company.id, action: "block" });
                              }}
                              disabled={quickActionMutation.isPending}
                            >
                              <Ban className="h-3 w-3 mr-1" />
                              {t("companies.block")}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSetPlanTarget({ id: company.id, name: company.name });
                              setSelectedPlanId("");
                            }}
                          >
                            {t("companies.setPlan")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data?.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {t("companies.noCompanies")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    {t("companies.totalCompanies", { count: data?.pagination?.total ?? 0 })}
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
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("companies.createCompany")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(form);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>{t("companies.companyName")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("dashboard.slug")}</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("common.email")}</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("companies.country")}</Label>
                <Input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("companies.currency")}</Label>
                <Input
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? t("common.creating") : t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!setPlanTarget} onOpenChange={() => setSetPlanTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("companies.setPlanFor", { name: setPlanTarget?.name })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("companies.selectPlan")}</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("companies.choosePlan")} />
                </SelectTrigger>
                <SelectContent>
                  {(plans.data || []).map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSetPlanTarget(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                disabled={!selectedPlanId || setPlanMutation.isPending}
                onClick={() => {
                  if (setPlanTarget && selectedPlanId) {
                    setPlanMutation.mutate({ companyId: setPlanTarget.id, planId: selectedPlanId });
                  }
                }}
              >
                {setPlanMutation.isPending ? t("common.saving") : t("companies.assignPlan")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
