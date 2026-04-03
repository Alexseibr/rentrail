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
import { Plus, Play, CheckCircle, XCircle, RotateCcw, Search } from "lucide-react";
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

export default function RentalsCompanyPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { canWriteRental } = useRolePermissions();
  const companyId = user?.memberships?.[0]?.companyId;
  const companyHeaders = companyId ? { "x-company-id": companyId } : {};

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
  const clients = Array.isArray(clientsQuery.data) ? clientsQuery.data : (clientsQuery.data as any)?.items || [];

  const assetsQuery = useQuery({
    queryKey: ["assets-available", companyId],
    queryFn: () => api<any>("/assets?status=available", { headers: companyHeaders }),
    enabled: !!companyId && showCreate,
  });
  const availableAssets = Array.isArray(assetsQuery.data) ? assetsQuery.data : (assetsQuery.data as any)?.items || [];

  const rentalsQuery = useQuery({
    queryKey: ["rentals", companyId, statusFilter],
    queryFn: () => {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      return api<any>(`/rentals${params}`, { headers: companyHeaders });
    },
    enabled: !!companyId,
  });
  const allItems = Array.isArray(rentalsQuery.data) ? rentalsQuery.data : (rentalsQuery.data as any)?.items || [];
  const items = search
    ? allItems.filter((r: any) =>
        (r.clientName?.toLowerCase() || "").includes(search.toLowerCase()) ||
        (r.rentalType?.toLowerCase() || "").includes(search.toLowerCase())
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("nav.rentals")}</h1>
          <p className="text-muted-foreground">{t("rentals.subtitle", "Все аренды компании")}</p>
        </div>
        {canWriteRental && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t("rentals.create", "Новая аренда")}
          </Button>
        )}
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {["active", "overdue", "completed", "canceled"].map((s) => (
          <Card key={s} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{countByStatus(s)}</div>
              <p className={`text-sm ${statusFilter === s ? "font-semibold text-primary" : "text-muted-foreground"}`}>{t(`status.${s}`, s)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">{t("nav.rentals")} ({items.length})</CardTitle>
            <div className="flex-1" />
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={t("common.search", "Поиск...")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-48" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all", "Все")}</SelectItem>
                {["draft", "approved", "awaiting_pickup", "active", "overdue", "completed", "canceled"].map((s) => (
                  <SelectItem key={s} value={s}>{t(`status.${s}`, s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {rentalsQuery.isLoading ? (
            <div className="p-6 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("rentals.client", "Клиент")}</TableHead>
                  <TableHead>{t("rentals.asset", "Транспорт")}</TableHead>
                  <TableHead>{t("rentals.start", "Начало")}</TableHead>
                  <TableHead>{t("rentals.end", "Окончание")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  {canWriteRental && <TableHead>{t("common.actions", "Действия")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((rental: any) => (
                  <TableRow key={rental.id} className="cursor-pointer" onClick={() => navigate(`/rentals/${rental.id}`)}>
                    <TableCell>{rental.clientName || rental.clientId?.slice(0, 8)}</TableCell>
                    <TableCell className="font-mono text-sm">{rental.assetCode || rental.assetId?.slice(0, 8)}</TableCell>
                    <TableCell className="text-sm">{rental.startDate || rental.startAt ? new Date(rental.startDate || rental.startAt).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="text-sm">{rental.endDate || rental.plannedEndAt ? new Date(rental.endDate || rental.plannedEndAt).toLocaleDateString() : "—"}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[rental.status] || "bg-gray-100"}>{t(`status.${rental.status}`, rental.status)}</Badge></TableCell>
                    {canWriteRental && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          {getAvailableActions(rental).map((act) => (
                            <Button
                              key={act.key}
                              size="sm"
                              variant={act.variant === "destructive" ? "destructive" : "outline"}
                              className="h-7 text-xs"
                              onClick={() => setActionDialog({ id: rental.id, action: act.key, rental })}
                            >
                              <act.icon className="h-3 w-3 mr-1" />
                              {act.label}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("common.noData", "Нет данных")}</TableCell>
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
              {t("rentals.client", "Клиент")}: {actionDialog?.rental?.clientName || "—"}
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
