import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
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
import { Plus, Pencil, Archive, RotateCcw, RefreshCw, Search } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-100 text-green-800",
  rented: "bg-blue-100 text-blue-800",
  maintenance: "bg-yellow-100 text-yellow-800",
  charging: "bg-purple-100 text-purple-800",
  reserved: "bg-sky-100 text-sky-800",
  blocked: "bg-red-100 text-red-800",
  lost: "bg-red-200 text-red-900",
  overdue: "bg-orange-100 text-orange-800",
  draft: "bg-gray-100 text-gray-800",
  stolen: "bg-red-300 text-red-900",
  retired: "bg-gray-200 text-gray-600",
};

const ASSET_TYPES = ["bike", "ebike", "scooter", "escooter"] as const;
const STATUS_VALUES = [
  "draft", "available", "reserved", "awaiting_pickup", "rented",
  "overdue", "charging", "maintenance", "blocked", "lost", "stolen", "retired",
] as const;

const emptyForm = {
  assetType: "escooter" as string,
  brand: "",
  model: "",
  serialNumber: "",
  internalCode: "",
  qrCode: "",
  branchId: "",
  notes: "",
};

export default function FleetPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const companyId = user?.memberships?.[0]?.companyId;
  const companyHeaders = companyId ? { "x-company-id": companyId } : {};

  const [showCreate, setShowCreate] = useState(false);
  const [editAsset, setEditAsset] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [statusChange, setStatusChange] = useState<{ id: string; current: string } | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [archiveConfirm, setArchiveConfirm] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const branchesQuery = useQuery({
    queryKey: ["branches", companyId],
    queryFn: () => api<any>("/branches", { headers: companyHeaders }),
    enabled: !!companyId,
  });
  const branches = Array.isArray(branchesQuery.data) ? branchesQuery.data : (branchesQuery.data as any)?.items || [];

  const assetsQuery = useQuery({
    queryKey: ["assets", companyId, statusFilter],
    queryFn: () => {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      return api<any>(`/assets${params}`, { headers: companyHeaders });
    },
    enabled: !!companyId,
  });
  const allItems = Array.isArray(assetsQuery.data) ? assetsQuery.data : (assetsQuery.data as any)?.items || [];
  const items = search
    ? allItems.filter((a: any) =>
        (a.internalCode?.toLowerCase() || "").includes(search.toLowerCase()) ||
        (a.brand?.toLowerCase() || "").includes(search.toLowerCase()) ||
        (a.model?.toLowerCase() || "").includes(search.toLowerCase()) ||
        (a.serialNumber?.toLowerCase() || "").includes(search.toLowerCase())
      )
    : allItems;

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/assets", { method: "POST", body: JSON.stringify(body), headers: companyHeaders }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      setShowCreate(false);
      setForm({ ...emptyForm });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api(`/assets/${id}`, { method: "PATCH", body: JSON.stringify(body), headers: companyHeaders }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      setEditAsset(null);
      setForm({ ...emptyForm });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      api(`/assets/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status, ...(reason ? { reason } : {}) }),
        headers: companyHeaders,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      setStatusChange(null);
      setNewStatus("");
      setStatusReason("");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, restore }: { id: string; restore: boolean }) =>
      api(`/assets/${id}/${restore ? "restore" : "archive"}`, { method: "POST", headers: companyHeaders }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      setArchiveConfirm(null);
    },
  });

  function openCreate() {
    setEditAsset(null);
    setForm({ ...emptyForm, branchId: branches[0]?.id || "" });
    setShowCreate(true);
  }

  function openEdit(asset: any) {
    setShowCreate(false);
    setEditAsset(asset);
    setForm({
      assetType: asset.assetType || "escooter",
      brand: asset.brand || "",
      model: asset.model || "",
      serialNumber: asset.serialNumber || "",
      internalCode: asset.internalCode || "",
      qrCode: asset.qrCode || "",
      branchId: asset.branchId || "",
      notes: asset.notes || "",
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { assetType: form.assetType, branchId: form.branchId };
    if (form.brand) body.brand = form.brand;
    if (form.model) body.model = form.model;
    if (form.serialNumber) body.serialNumber = form.serialNumber;
    if (form.internalCode) body.internalCode = form.internalCode;
    if (form.qrCode) body.qrCode = form.qrCode;
    if (form.notes) body.notes = form.notes;

    if (editAsset) {
      updateMutation.mutate({ id: editAsset.id, body });
    } else {
      createMutation.mutate(body);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const countByStatus = (s: string) => allItems.filter((a: any) => a.status === s).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("nav.fleet")}</h1>
          <p className="text-muted-foreground">{t("fleet.subtitle", "Транспортные средства компании")}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t("fleet.addAsset", "Добавить")}
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {["available", "rented", "maintenance", "overdue"].map((s) => (
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
            <CardTitle className="text-base">{t("nav.fleet")} ({items.length})</CardTitle>
            <div className="flex-1" />
            <div className="relative max-w-xs">
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
                {STATUS_VALUES.map((s) => (
                  <SelectItem key={s} value={s}>{t(`status.${s}`, s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {assetsQuery.isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fleet.code", "Код")}</TableHead>
                  <TableHead>{t("fleet.type", "Тип")}</TableHead>
                  <TableHead>{t("fleet.brand", "Марка")}</TableHead>
                  <TableHead>{t("fleet.model", "Модель")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("common.actions", "Действия")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((asset: any) => (
                  <TableRow key={asset.id} className="cursor-pointer" onClick={() => navigate(`/fleet/${asset.id}`)}>
                    <TableCell className="font-mono text-sm">{asset.internalCode}</TableCell>
                    <TableCell>{t(`assetType.${asset.assetType}`, asset.assetType)}</TableCell>
                    <TableCell>{asset.brand}</TableCell>
                    <TableCell>{asset.model}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[asset.status] || "bg-gray-100"}>{t(`status.${asset.status}`, asset.status)}</Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(asset)} title={t("common.edit")}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setStatusChange({ id: asset.id, current: asset.status }); setNewStatus(""); }} title={t("fleet.changeStatus", "Сменить статус")}>
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        {asset.status === "retired" ? (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setArchiveConfirm({ ...asset, restore: true })} title={t("fleet.restore", "Восстановить")}>
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => setArchiveConfirm(asset)} title={t("fleet.archive", "Архивировать")}>
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {t("common.noData", "Нет данных")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate || !!editAsset} onOpenChange={() => { setShowCreate(false); setEditAsset(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editAsset ? t("fleet.editAsset", "Редактировать") : t("fleet.addAsset", "Добавить транспорт")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("fleet.type", "Тип")}</Label>
                <Select value={form.assetType} onValueChange={(v) => setForm({ ...form, assetType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map((at) => <SelectItem key={at} value={at}>{t(`assetType.${at}`, at)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("fleet.branch", "Филиал")}</Label>
                <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v })}>
                  <SelectTrigger><SelectValue placeholder={t("fleet.selectBranch", "Выберите филиал")} /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("fleet.brand", "Марка")}</Label>
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t("fleet.model", "Модель")}</Label>
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("fleet.code", "Внутренний код")}</Label>
                <Input value={form.internalCode} onChange={(e) => setForm({ ...form, internalCode: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t("fleet.serial", "Серийный номер")}</Label>
                <Input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("fleet.qr", "QR-код")}</Label>
              <Input value={form.qrCode} onChange={(e) => setForm({ ...form, qrCode: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("fleet.notes", "Заметки")}</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowCreate(false); setEditAsset(null); }}>
                {t("common.cancel", "Отмена")}
              </Button>
              <Button type="submit" disabled={isSaving || !form.branchId}>
                {isSaving ? t("common.saving", "Сохранение...") : editAsset ? t("common.save", "Сохранить") : t("fleet.addAsset", "Добавить")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!statusChange} onOpenChange={() => setStatusChange(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("fleet.changeStatus", "Сменить статус")}</DialogTitle>
            <DialogDescription>{t("fleet.currentStatus", "Текущий статус")}: {statusChange?.current}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("fleet.newStatus", "Новый статус")}</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue placeholder={t("fleet.selectStatus", "Выберите статус")} /></SelectTrigger>
                <SelectContent>
                  {STATUS_VALUES.filter((s) => s !== statusChange?.current).map((s) => (
                    <SelectItem key={s} value={s}>{t(`status.${s}`, s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("fleet.reason", "Причина")}</Label>
              <Input value={statusReason} onChange={(e) => setStatusReason(e.target.value)} placeholder={t("fleet.reasonPlaceholder", "Необязательно")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusChange(null)}>{t("common.cancel", "Отмена")}</Button>
            <Button disabled={!newStatus || statusMutation.isPending} onClick={() => {
              if (statusChange && newStatus) {
                statusMutation.mutate({ id: statusChange.id, status: newStatus, reason: statusReason || undefined });
              }
            }}>
              {statusMutation.isPending ? t("common.processing", "Обработка...") : t("common.confirm", "Подтвердить")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!archiveConfirm} onOpenChange={() => setArchiveConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {archiveConfirm?.restore ? t("fleet.restore", "Восстановить") : t("fleet.archive", "Архивировать")}
            </DialogTitle>
            <DialogDescription>
              {archiveConfirm?.restore
                ? t("fleet.restoreConfirm", "Восстановить транспорт {{code}}?", { code: archiveConfirm?.internalCode })
                : t("fleet.archiveConfirm", "Архивировать транспорт {{code}}? Он будет скрыт из активного списка.", { code: archiveConfirm?.internalCode })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveConfirm(null)}>{t("common.cancel", "Отмена")}</Button>
            <Button
              variant={archiveConfirm?.restore ? "default" : "destructive"}
              disabled={archiveMutation.isPending}
              onClick={() => {
                if (archiveConfirm) {
                  archiveMutation.mutate({ id: archiveConfirm.id, restore: !!archiveConfirm.restore });
                }
              }}
            >
              {archiveMutation.isPending ? t("common.processing", "Обработка...") : archiveConfirm?.restore ? t("fleet.restore", "Восстановить") : t("fleet.archive", "Архивировать")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
