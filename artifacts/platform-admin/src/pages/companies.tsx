import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Plus, ChevronLeft, ChevronRight, CheckCircle, Ban,
  Building2, Clock, ShieldOff, Activity,
} from "lucide-react";

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

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  blocked: "bg-red-100 text-red-800",
  suspended: "bg-orange-100 text-orange-800",
  canceled: "bg-gray-100 text-gray-800",
};

const KPI_CONFIG = [
  { key: "active",    label: "common.active",    accent: "bg-green-500",  icon: Activity },
  { key: "pending",   label: "common.pending",   accent: "bg-yellow-500", icon: Clock },
  { key: "blocked",   label: "common.blocked",   accent: "bg-red-500",    icon: ShieldOff },
  { key: "suspended", label: "common.suspended", accent: "bg-orange-500", icon: Ban },
] as const;

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

  const allQuery = useQuery({
    queryKey: ["companies-all"],
    queryFn: () =>
      api<{ items: Company[]; pagination: { total: number; totalPages: number } }>(
        `/platform/companies?page=1&limit=500`
      ),
  });
  const allItems: Company[] = allQuery.data?.items ?? [];
  const countByStatus = (s: string) => allItems.filter((c) => c.status === s).length;

  const { data, isLoading } = useQuery({
    queryKey: ["companies", search, statusFilter, planFilter, page, sortBy, sortOrder],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (planFilter !== "all") params.set("plan", planFilter);
      if (sortBy) params.set("sortBy", sortBy);
      if (sortOrder) params.set("sortOrder", sortOrder);
      return api<{ items: Company[]; pagination: { total: number; totalPages: number } }>(
        `/platform/companies?${params}`
      );
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) =>
      api("/companies", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["companies-all"] });
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
      queryClient.invalidateQueries({ queryKey: ["companies-all"] });
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
      queryClient.invalidateQueries({ queryKey: ["companies-all"] });
      toast({ title: `Company ${action}d` });
    },
  });

  const totalPages = data?.pagination?.totalPages ?? 0;
  const items = data?.items ?? [];

  return (
    <div className="p-6 space-y-6 max-w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("companies.title")}</h1>
          <p className="text-muted-foreground mt-0.5">{t("companies.subtitle")}</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("companies.addCompany")}
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {KPI_CONFIG.map(({ key, label, accent, icon: Icon }) => {
          const count = countByStatus(key);
          const isActive = statusFilter === key;
          return (
            <Card
              key={key}
              className={`relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${isActive ? "ring-2 ring-primary" : ""}`}
              onClick={() => { setStatusFilter(statusFilter === key ? "all" : key); setPage(1); }}
            >
              <div className={`absolute inset-y-0 left-0 w-1 ${accent}`} />
              <CardContent className="pt-4 pl-5">
                <div className="flex items-center justify-between">
                  <div>
                    {allQuery.isLoading ? (
                      <Skeleton className="h-7 w-10" />
                    ) : (
                      <div className="text-2xl font-bold">{count}</div>
                    )}
                    <p className={`text-sm mt-0.5 ${isActive ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                      {String(t(label))}
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-muted">
                    <Icon className={`h-4 w-4 ${accent.replace("bg-", "text-")}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <CardTitle className="text-base font-semibold">
              {t("companies.title")}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({data?.pagination?.total ?? 0})
              </span>
            </CardTitle>
            <div className="flex-1" />
            <div className="relative flex-shrink-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("companies.searchPlaceholder")}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 w-52"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
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
            <Select value={planFilter} onValueChange={(v) => { setPlanFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t("companies.plan")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("companies.allPlans")}</SelectItem>
                {(plans.data || []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
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
                  <TableRow className="hover:bg-transparent">
                    {[
                      { key: "name",      labelKey: "common.name" },
                      { key: "slug",      labelKey: "dashboard.slug" },
                      { key: "status",    labelKey: "common.status" },
                      { key: "",          labelKey: "companies.plan" },
                      { key: "",          labelKey: "companies.assets" },
                      { key: "",          labelKey: "companies.users" },
                      { key: "country",   labelKey: "companies.country" },
                      { key: "createdAt", labelKey: "companies.created" },
                    ].map(({ key, labelKey }) => (
                      <TableHead
                        key={labelKey}
                        className={`text-xs ${key ? "cursor-pointer select-none hover:text-foreground" : ""}`}
                        onClick={() => {
                          if (!key) return;
                          if (sortBy === key) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                          else { setSortBy(key); setSortOrder("asc"); }
                          setPage(1);
                        }}
                      >
                        {String(t(labelKey))}
                        {sortBy === key && <span className="ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                      </TableHead>
                    ))}
                    <TableHead className="text-xs">{String(t("common.actions"))}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((company) => (
                    <TableRow key={company.id} className="hover:bg-muted/30">
                      <TableCell
                        className="font-medium cursor-pointer hover:underline text-sm"
                        onClick={() => navigate(`/companies/${company.id}`)}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          {company.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm font-mono">{company.slug}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[company.status] || ""}`}>
                          {String(t(`status.${company.status}`, company.status))}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{company.planName || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground text-center">{company.assetCount ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground text-center">{company.userCount ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{company.country || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(company.createdAt).toLocaleDateString("ru-RU")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {company.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={(e) => { e.stopPropagation(); quickActionMutation.mutate({ id: company.id, action: "approve" }); }}
                              disabled={quickActionMutation.isPending}
                            >
                              <CheckCircle className="h-3 w-3" />
                              {t("companies.approve")}
                            </Button>
                          )}
                          {(company.status === "active" || company.status === "pending") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive hover:text-destructive gap-1"
                              onClick={(e) => { e.stopPropagation(); quickActionMutation.mutate({ id: company.id, action: "block" }); }}
                              disabled={quickActionMutation.isPending}
                            >
                              <Ban className="h-3 w-3" />
                              {t("companies.block")}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={(e) => { e.stopPropagation(); setSetPlanTarget({ id: company.id, name: company.name }); setSelectedPlanId(""); }}
                          >
                            {t("companies.setPlan")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="py-14 text-center">
                        <Building2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-20" />
                        <p className="text-sm text-muted-foreground">{t("companies.noCompanies")}</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
                  <p className="text-sm text-muted-foreground">
                    {t("companies.totalCompanies", { count: data?.pagination?.total ?? 0 })}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground px-1">
                      {String(t("common.page", { page, totalPages }))}
                    </span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
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
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>{t("companies.companyName")} *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("dashboard.slug")} *</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                required
                placeholder="my-company"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("common.email")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("companies.country")}</Label>
                <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="RU" />
              </div>
              <div className="space-y-2">
                <Label>{t("companies.currency")}</Label>
                <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="USD" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !form.name || !form.slug}>
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
                    <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
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
