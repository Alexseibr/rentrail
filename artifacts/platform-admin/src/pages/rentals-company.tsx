import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { Plus, Play, CheckCircle, XCircle, RotateCcw, Search, ClipboardList, AlertCircle, Clock, AlertTriangle } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { useRolePermissions } from "@/hooks/use-role-permissions";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  overdue: "bg-red-100 text-red-800",
  awaiting_pickup: "bg-blue-100 text-blue-800",
  draft: "bg-gray-50 text-gray-600",
  canceled: "bg-orange-100 text-orange-800",
  approved: "bg-sky-100 text-sky-800",
};

const KPI_CONFIG = [
  { key: "active", accent: "bg-green-500", icon: ClipboardList },
  { key: "overdue", accent: "bg-red-500", icon: AlertCircle },
  { key: "completed", accent: "bg-gray-400", icon: CheckCircle },
  { key: "canceled", accent: "bg-orange-400", icon: XCircle },
] as const;

export default function RentalsCompanyPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { canWriteRental } = useRolePermissions();
  const companyId = user?.memberships?.[0]?.companyId;
  const companyHeaders: Record<string, string> = companyId ? { "x-company-id": companyId } : {};

  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [actionDialog, setActionDialog] = useState<{ id: string; action: string; rental: any } | null>(null);
  const [returnNotes, setReturnNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [form, setForm] = useState({ clientId: "", assetId: "", startAt: "", plannedEndAt: "", notes: "" });

  const clientsQuery = useQuery({
    queryKey: ["clients", companyId],
    queryFn: () => api<any>("/clients", { headers: companyHeaders }),
    enabled: !!companyId,
  });
  const clients = clientsQuery.data ?? [];

  const assetsQuery = useQuery({
    queryKey: ["assets-available", companyId],
    queryFn: () => api<any>("/assets?status=available", { headers: companyHeaders }),
    enabled: !!companyId && showCreate,
  });
  const availableAssets = assetsQuery.data ?? [];

  const rentalsQuery = useQuery({
    queryKey: ["rentals", companyId, statusFilter],
    queryFn: () => {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      return api<any>(`/rentals${params}`, { headers: companyHeaders });
    },
    enabled: !!companyId,
  });
  const allItems = rentalsQuery.data ?? [];
  const items = search
    ? allItems.filter((r: any) =>
        (r.clientName?.toLowerCase() || "").includes(search.toLowerCase()) ||
        (r.assetCode?.toLowerCase() || "").includes(search.toLowerCase())
      )
    : allItems;

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/rentals", { method: "POST", body: JSON.stringify(body), headers: companyHeaders }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      setShowCreate(false);
      setForm({ clientId: "", assetId: "", startAt: "", plannedEndAt: "", notes: "" });
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action, body }: { id: string; action: string; body?: Record<string, unknown> }) =>
      api(`/rentals/${id}/${action}`, {
        method: "POST",
        body: body ? JSON.stringify(body) : JSON.stringify({}),
        headers: companyHeaders,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      setActionDialog(null);
      setReturnNotes("");
      setCancelReason("");
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { clientId: form.clientId, assetId: form.assetId };
    if (form.startAt) body.startAt = form.startAt;
    if (form.plannedEndAt) body.plannedEndAt = form.plannedEndAt;
    if (form.notes) body.notes = form.notes;
    createMutation.mutate(body);
  }

  function executeAction() {
    if (!actionDialog) return;
    const { id, action } = actionDialog;
    let body: Record<string, unknown> | undefined;
    if (action === "return" && returnNotes) body = { notes: returnNotes };
    if (action === "cancel" && cancelReason) body = { reason: cancelReason };
    actionMutation.mutate({ id, action, body });
  }

  const countByStatus = (s: string) => allItems.filter((r: any) => r.status === s).length;

  const getAvailableActions = (rental: any) => {
    const actions: { key: string; label: string; icon: any; variant?: string }[] = [];
    if (rental.status === "draft") {
      actions.push({ key: "approve", label: t("rentals.approve", "Одобрить"), icon: CheckCircle });
    }
    if (rental.status === "approved" || rental.status === "awaiting_pickup") {
      actions.push({ key: "start", label: t("rentals.start", "Начать"), icon: Play });
    }
    if (rental.status === "active" || rental.status === "overdue") {
      actions.push({ key: "return", label: t("rentals.return", "Возврат"), icon: RotateCcw });
    }
    if (rental.status !== "completed" && rental.status !== "canceled") {
      actions.push({ key: "cancel", label: t("rentals.cancel", "Отмена"), icon: XCircle, variant: "destructive" });
    }
    return actions;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("nav.rentals")}</h1>
          <p className="text-muted-foreground mt-0.5">{t("rentals.subtitle", "Все аренды компании")}</p>
        </div>
        {canWriteRental && (
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("rentals.create", "Новая аренда")}
          </Button>
        )}
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {KPI_CONFIG.map(({ key, accent, icon: Icon }) => {
          const count = countByStatus(key);
          const isActive = statusFilter === key;
          return (
            <Card
              key={key}
              className={`relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${isActive ? "ring-2 ring-primary" : ""}`}
              onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
            >
              <div className={`absolute inset-y-0 left-0 w-1 ${accent}`} />
              <CardContent className="pt-4 pl-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">{rentalsQuery.isLoading ? <Skeleton className="h-7 w-10" /> : count}</div>
                    <p className={`text-sm mt-0.5 ${isActive ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                      {String(t(`status.${key}`, key))}
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
              {t("nav.rentals")}
              <span className="ml-2 text-sm font-normal text-muted-foreground">({items.length})</span>
            </CardTitle>
            <div className="flex-1" />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("common.search", "Поиск...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-48"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder={t("common.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all", "Все")}</SelectItem>
                {["draft", "approved", "awaiting_pickup", "active", "overdue", "completed", "canceled"].map((s) => (
                  <SelectItem key={s} value={s}>{String(t(`status.${s}`, s))}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {rentalsQuery.isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">{t("rentals.client", "Клиент")}</TableHead>
                  <TableHead className="text-xs">{t("rentals.asset", "Транспорт")}</TableHead>
                  <TableHead className="text-xs">{t("rentals.start", "Начало")}</TableHead>
                  <TableHead className="text-xs">{t("rentals.end", "Окончание")}</TableHead>
                  <TableHead className="text-xs">{t("common.status")}</TableHead>
                  {canWriteRental && <TableHead className="text-xs">{t("common.actions", "Действия")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((rental: any) => {
                  const isOverdue = rental.status === "overdue";
                  const isActive = rental.status === "active";
                  return (
                  <TableRow
                    key={rental.id}
                    className={`cursor-pointer hover:bg-muted/30 ${isOverdue ? "bg-red-50/60" : ""}`}
                    onClick={() => navigate(`/rentals/${rental.id}`)}
                  >
                    <TableCell className="font-medium text-sm">{rental.clientName || rental.clientId?.slice(0, 8) || "—"}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{rental.assetCode || rental.assetId?.slice(0, 8) || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {rental.startDate || rental.startAt
                        ? new Date(rental.startDate || rental.startAt).toLocaleDateString("ru-RU")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {rental.endDate || rental.plannedEndAt
                        ? new Date(rental.endDate || rental.plannedEndAt).toLocaleDateString("ru-RU")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs gap-1 ${STATUS_COLORS[rental.status] || "bg-gray-100"}`}>
                        {isOverdue && <AlertTriangle className="h-3 w-3" />}
                        {isActive && <Clock className="h-3 w-3" />}
                        {String(t(`status.${rental.status}`, rental.status))}
                      </Badge>
                    </TableCell>
                    {canWriteRental && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          {getAvailableActions(rental).map((act) => (
                            <Button
                              key={act.key}
                              size="sm"
                              variant={act.variant === "destructive" ? "destructive" : "outline"}
                              className="h-7 text-xs px-2 gap-1"
                              onClick={() => setActionDialog({ id: rental.id, action: act.key, rental })}
                            >
                              <act.icon className="h-3 w-3" />
                              {act.label}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                  );
                })}
                {items.length === 0 && allItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6">
                      <Empty className="border-0">
                        <EmptyHeader>
                          <EmptyMedia variant="icon"><ClipboardList className="h-5 w-5" /></EmptyMedia>
                          <EmptyTitle>{t("rentals.emptyTitle")}</EmptyTitle>
                          <EmptyDescription>{t("rentals.emptyDescription")}</EmptyDescription>
                        </EmptyHeader>
                        {canWriteRental && (
                          <EmptyContent>
                            <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
                              <Plus className="h-3.5 w-3.5" />
                              {t("rentals.create")}
                            </Button>
                          </EmptyContent>
                        )}
                      </Empty>
                    </TableCell>
                  </TableRow>
                )}
                {items.length === 0 && allItems.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6">
                      <Empty className="border-0">
                        <EmptyHeader>
                          <EmptyMedia variant="icon"><Search className="h-5 w-5" /></EmptyMedia>
                          <EmptyTitle>{t("common.noResults")}</EmptyTitle>
                          <EmptyDescription>{t("common.noResultsDescription")}</EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rentals.create", "Новая аренда")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("rentals.client", "Клиент")}</Label>
              <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                <SelectTrigger><SelectValue placeholder={t("rentals.selectClient", "Выберите клиента")} /></SelectTrigger>
                <SelectContent>
                  {clients.filter((c: any) => c.status === "active").map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.fullName} ({c.phone || c.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("rentals.asset", "Транспорт")}</Label>
              <Select value={form.assetId} onValueChange={(v) => setForm({ ...form, assetId: v })}>
                <SelectTrigger><SelectValue placeholder={t("rentals.selectAsset", "Выберите транспорт")} /></SelectTrigger>
                <SelectContent>
                  {availableAssets.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.internalCode} — {a.brand} {a.model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("rentals.start", "Начало")}</Label>
                <Input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t("rentals.end", "Окончание")}</Label>
                <Input type="datetime-local" value={form.plannedEndAt} onChange={(e) => setForm({ ...form, plannedEndAt: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("rentals.notes", "Заметки")}</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>{t("common.cancel", "Отмена")}</Button>
              <Button type="submit" disabled={createMutation.isPending || !form.clientId || !form.assetId}>
                {createMutation.isPending ? t("common.saving", "Сохранение...") : t("rentals.create", "Создать")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === "approve" && t("rentals.approve", "Одобрить аренду")}
              {actionDialog?.action === "start" && t("rentals.start", "Начать аренду")}
              {actionDialog?.action === "return" && t("rentals.return", "Возврат транспорта")}
              {actionDialog?.action === "cancel" && t("rentals.cancel", "Отменить аренду")}
            </DialogTitle>
            <DialogDescription>
              {t("rentals.client", "Клиент")}: <span className="font-medium">{actionDialog?.rental?.clientName || "—"}</span>
            </DialogDescription>
          </DialogHeader>
          {actionDialog?.action === "return" && (
            <div className="space-y-2">
              <Label>{t("rentals.notes", "Заметки")}</Label>
              <Input value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} placeholder={t("fleet.reasonPlaceholder", "Необязательно")} />
            </div>
          )}
          {actionDialog?.action === "cancel" && (
            <div className="space-y-2">
              <Label>{t("fleet.reason", "Причина")}</Label>
              <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder={t("fleet.reasonPlaceholder", "Необязательно")} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>{t("common.cancel", "Отмена")}</Button>
            <Button
              variant={actionDialog?.action === "cancel" ? "destructive" : "default"}
              disabled={actionMutation.isPending}
              onClick={executeAction}
            >
              {actionMutation.isPending ? t("common.processing", "Обработка...") : t("common.confirm", "Подтвердить")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
