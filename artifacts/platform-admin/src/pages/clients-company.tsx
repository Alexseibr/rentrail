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
import { Plus, Pencil, Archive, RotateCcw, Search, Users, UserCheck, UserX } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { useRolePermissions } from "@/hooks/use-role-permissions";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  suspended: "bg-yellow-100 text-yellow-800",
  blocked: "bg-red-100 text-red-800",
  archived: "bg-gray-200 text-gray-600",
};

const emptyForm = {
  fullName: "",
  phone: "",
  email: "",
  birthday: "",
  documentType: "",
  documentNumber: "",
  notes: "",
};

export default function ClientsCompanyPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { canWriteClient } = useRolePermissions();
  const companyId = user?.memberships?.[0]?.companyId;
  const companyHeaders: Record<string, string> = companyId ? { "x-company-id": companyId } : {};

  const [showCreate, setShowCreate] = useState(false);
  const [editClient, setEditClient] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [archiveConfirm, setArchiveConfirm] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const clientsQuery = useQuery({
    queryKey: ["clients", companyId],
    queryFn: () => api<any>("/clients", { headers: companyHeaders }),
    enabled: !!companyId,
  });
  const allItems = clientsQuery.data ?? [];
  const filtered = statusFilter !== "all" ? allItems.filter((c: any) => c.status === statusFilter) : allItems;
  const items = search
    ? filtered.filter((c: any) =>
        (c.fullName?.toLowerCase() || "").includes(search.toLowerCase()) ||
        (c.phone || "").includes(search) ||
        (c.email?.toLowerCase() || "").includes(search.toLowerCase())
      )
    : filtered;

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/clients", { method: "POST", body: JSON.stringify(body), headers: companyHeaders }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setShowCreate(false);
      setForm({ ...emptyForm });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api(`/clients/${id}`, { method: "PATCH", body: JSON.stringify(body), headers: companyHeaders }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setEditClient(null);
      setForm({ ...emptyForm });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, restore }: { id: string; restore: boolean }) =>
      api(`/clients/${id}/${restore ? "restore" : "archive"}`, { method: "POST", headers: companyHeaders }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setArchiveConfirm(null);
    },
  });

  function openCreate() {
    setEditClient(null);
    setForm({ ...emptyForm });
    setShowCreate(true);
  }

  function openEdit(client: any) {
    setShowCreate(false);
    setEditClient(client);
    setForm({
      fullName: client.fullName || "",
      phone: client.phone || "",
      email: client.email || "",
      birthday: client.birthday || "",
      documentType: client.documentType || "",
      documentNumber: client.documentNumber || "",
      notes: client.notes || "",
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { fullName: form.fullName };
    if (form.phone) body.phone = form.phone;
    if (form.email) body.email = form.email;
    if (form.birthday) body.birthday = form.birthday;
    if (form.documentType) body.documentType = form.documentType;
    if (form.documentNumber) body.documentNumber = form.documentNumber;
    if (form.notes) body.notes = form.notes;

    if (editClient) {
      updateMutation.mutate({ id: editClient.id, body });
    } else {
      createMutation.mutate(body);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const activeCount = allItems.filter((c: any) => c.status === "active").length;
  const suspendedCount = allItems.filter((c: any) => c.status === "suspended").length;
  const blockedCount = allItems.filter((c: any) => c.status === "blocked").length;

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("nav.clients")}</h1>
          <p className="text-muted-foreground mt-0.5">{t("clients.subtitle", "Клиенты компании")}</p>
        </div>
        {canWriteClient && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("clients.add", "Добавить клиента")}
          </Button>
        )}
      </div>

      <div className="grid gap-4 grid-cols-3">
        {[
          { key: "active", label: t("common.active"), count: activeCount, accent: "bg-green-500", icon: UserCheck },
          { key: "suspended", label: t("common.suspended"), count: suspendedCount, accent: "bg-yellow-500", icon: Users },
          { key: "blocked", label: t("common.blocked"), count: blockedCount, accent: "bg-red-500", icon: UserX },
        ].map(({ key, label, count, accent, icon: Icon }) => (
          <Card
            key={key}
            className={`relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${statusFilter === key ? "ring-2 ring-primary" : ""}`}
            onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
          >
            <div className={`absolute inset-y-0 left-0 w-1 ${accent}`} />
            <CardContent className="pt-4 pl-5">
              <div className="flex items-center justify-between">
                <div>
                  {clientsQuery.isLoading ? (
                    <Skeleton className="h-7 w-10" />
                  ) : (
                    <div className="text-2xl font-bold">{count}</div>
                  )}
                  <p className={`text-sm mt-0.5 ${statusFilter === key ? "font-semibold text-primary" : "text-muted-foreground"}`}>{label}</p>
                </div>
                <div className="p-2 rounded-xl bg-muted">
                  <Icon className={`h-4 w-4 ${accent.replace("bg-", "text-")}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <CardTitle className="text-base font-semibold">
              {t("nav.clients")}
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
                <SelectItem value="active">{t("common.active", "Активные")}</SelectItem>
                <SelectItem value="suspended">{t("clients.suspended", "Приостановлены")}</SelectItem>
                <SelectItem value="blocked">{t("clients.blocked", "Заблокированы")}</SelectItem>
                <SelectItem value="archived">{t("status.archived", "В архиве")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {clientsQuery.isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">{t("clients.name", "Имя")}</TableHead>
                  <TableHead className="text-xs">{t("common.phone")}</TableHead>
                  <TableHead className="text-xs">{t("common.email")}</TableHead>
                  <TableHead className="text-xs">{t("clients.document", "Документ")}</TableHead>
                  <TableHead className="text-xs">{t("common.status")}</TableHead>
                  {canWriteClient && <TableHead className="text-xs">{t("common.actions", "Действия")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((client: any) => (
                  <TableRow key={client.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium text-sm">{client.fullName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{client.phone || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{client.email || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {client.documentType ? `${client.documentType}: ${client.documentNumber || "—"}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${STATUS_COLORS[client.status] || "bg-gray-100"}`}>
                        {String(t(`status.${client.status}`, client.status))}
                      </Badge>
                    </TableCell>
                    {canWriteClient && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => openEdit(client)}
                            title={t("common.edit")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {client.status === "archived" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground"
                              onClick={() => setArchiveConfirm({ ...client, restore: true })}
                              title={t("clients.restore", "Восстановить")}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive"
                              onClick={() => setArchiveConfirm(client)}
                              title={t("clients.archive", "Архивировать")}
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6">
                      <Empty className="border-0">
                        <EmptyHeader>
                          <EmptyMedia variant="icon"><Users className="h-5 w-5" /></EmptyMedia>
                          <EmptyTitle>{t("clients.emptyTitle")}</EmptyTitle>
                          <EmptyDescription>{t("clients.emptyDescription")}</EmptyDescription>
                        </EmptyHeader>
                        {canWriteClient && (
                          <EmptyContent>
                            <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
                              <Plus className="h-3.5 w-3.5" />
                              {t("clients.addFirst")}
                            </Button>
                          </EmptyContent>
                        )}
                      </Empty>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate || !!editClient} onOpenChange={() => { setShowCreate(false); setEditClient(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editClient ? t("clients.edit", "Редактировать клиента") : t("clients.add", "Добавить клиента")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("clients.name", "ФИО")} *</Label>
              <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("common.phone")}</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+375..." />
              </div>
              <div className="space-y-2">
                <Label>{t("common.email")}</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("clients.birthday", "Дата рождения")}</Label>
              <Input type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("clients.docType", "Тип документа")}</Label>
                <Select value={form.documentType} onValueChange={(v) => setForm({ ...form, documentType: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("clients.selectDocType", "Выберите")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passport">{t("clients.passport", "Паспорт")}</SelectItem>
                    <SelectItem value="id_card">{t("clients.idCard", "Удостоверение")}</SelectItem>
                    <SelectItem value="driver_license">{t("clients.driverLicense", "Водительское удостоверение")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("clients.docNumber", "Номер документа")}</Label>
                <Input value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("clients.notes", "Заметки")}</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowCreate(false); setEditClient(null); }}>
                {t("common.cancel", "Отмена")}
              </Button>
              <Button type="submit" disabled={isSaving || !form.fullName}>
                {isSaving ? t("common.saving", "Сохранение...") : editClient ? t("common.save", "Сохранить") : t("clients.add", "Добавить")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!archiveConfirm} onOpenChange={() => setArchiveConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {archiveConfirm?.restore ? t("clients.restore", "Восстановить") : t("clients.archive", "Архивировать")}
            </DialogTitle>
            <DialogDescription>
              {archiveConfirm?.restore
                ? t("clients.restoreConfirm", "Восстановить клиента {{name}}?", { name: archiveConfirm?.fullName })
                : t("clients.archiveConfirm", "Архивировать клиента {{name}}?", { name: archiveConfirm?.fullName })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveConfirm(null)}>
              {t("common.cancel", "Отмена")}
            </Button>
            <Button
              variant={archiveConfirm?.restore ? "default" : "destructive"}
              disabled={archiveMutation.isPending}
              onClick={() => {
                if (archiveConfirm) archiveMutation.mutate({ id: archiveConfirm.id, restore: !!archiveConfirm.restore });
              }}
            >
              {archiveMutation.isPending
                ? t("common.processing", "Обработка...")
                : archiveConfirm?.restore
                  ? t("clients.restore", "Восстановить")
                  : t("clients.archive", "Архивировать")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
