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
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Pencil, Power, PowerOff, MapPin } from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { useRolePermissions } from "@/hooks/use-role-permissions";
import { toast } from "@/hooks/use-toast";

interface Branch {
  id: string;
  name?: string;
  city?: string;
  country?: string;
  address?: string;
  phone?: string;
  email?: string;
  timezone?: string;
  status?: string;
  activate?: boolean;
  createdAt?: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-200 text-gray-600",
};

const emptyForm = {
  name: "",
  city: "",
  country: "",
  address: "",
  phone: "",
  email: "",
  timezone: "",
};

export default function BranchesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { canWriteBranch } = useRolePermissions();
  const companyId = user?.memberships?.[0]?.companyId;
  const companyHeaders: Record<string, string> = companyId
    ? { "x-company-id": companyId }
    : {};

  const [showCreate, setShowCreate] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [toggleConfirm, setToggleConfirm] = useState<Branch | null>(null);

  const branchesQuery = useQuery({
    queryKey: ["branches", companyId],
    queryFn: () => api<Branch[]>("/branches", { headers: companyHeaders }),
    enabled: !!companyId,
  });
  const items = branchesQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/branches", {
        method: "POST",
        body: JSON.stringify(body),
        headers: companyHeaders,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setShowCreate(false);
      setForm({ ...emptyForm });
      toast({ title: t("toast.branchCreated") });
    },
    onError: () => {
      toast({
        title: t("toast.error"),
        description: t("toast.saveFailed"),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api(`/branches/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: companyHeaders,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setEditBranch(null);
      setForm({ ...emptyForm });
      toast({ title: t("toast.branchUpdated") });
    },
    onError: () => {
      toast({
        title: t("toast.error"),
        description: t("toast.saveFailed"),
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, activate }: { id: string; activate: boolean }) =>
      api(`/branches/${id}/${activate ? "activate" : "deactivate"}`, {
        method: "POST",
        headers: companyHeaders,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setToggleConfirm(null);
      toast({
        title: variables.activate
          ? t("toast.branchActivated")
          : t("toast.branchDeactivated"),
      });
    },
    onError: () => {
      toast({
        title: t("toast.error"),
        description: t("toast.actionFailed"),
        variant: "destructive",
      });
    },
  });

  function openCreate() {
    setEditBranch(null);
    setForm({ ...emptyForm });
    setShowCreate(true);
  }

  function openEdit(branch: Branch) {
    setShowCreate(false);
    setEditBranch(branch);
    setForm({
      name: branch.name || "",
      city: branch.city || "",
      country: branch.country || "",
      address: branch.address || "",
      phone: branch.phone || "",
      email: branch.email || "",
      timezone: branch.timezone || "",
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { name: form.name };
    if (form.city) body.city = form.city;
    if (form.country) body.country = form.country;
    if (form.address) body.address = form.address;
    if (form.phone) body.phone = form.phone;
    if (form.email) body.email = form.email;
    if (form.timezone) body.timezone = form.timezone;

    if (editBranch) {
      updateMutation.mutate({ id: editBranch.id, body });
    } else {
      createMutation.mutate(body);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("nav.branches")}
          </h1>
          <p className="text-muted-foreground">
            {t("branches.subtitle", "Филиалы и станции")}
          </p>
        </div>
        {canWriteBranch && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t("branches.add", "Добавить филиал")}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("nav.branches")} ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {branchesQuery.isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("branches.city", "Город")}</TableHead>
                  <TableHead>{t("branches.address", "Адрес")}</TableHead>
                  <TableHead>{t("common.phone")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  {canWriteBranch && (
                    <TableHead>{t("common.actions", "Действия")}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">{branch.name}</TableCell>
                    <TableCell>{branch.city || "—"}</TableCell>
                    <TableCell className="max-w-48 truncate">
                      {branch.address || "—"}
                    </TableCell>
                    <TableCell>{branch.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          STATUS_COLORS[branch.status ?? ""] ||
                          "bg-green-100 text-green-800"
                        }
                      >
                        {String(
                          t(
                            `status.${branch.status || "active"}`,
                            branch.status || "active",
                          ),
                        )}
                      </Badge>
                    </TableCell>
                    {canWriteBranch && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => openEdit(branch)}
                            title={t("common.edit")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {branch.status === "inactive" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-green-600"
                              onClick={() =>
                                setToggleConfirm({ ...branch, activate: true })
                              }
                              title={t("branches.activate", "Активировать")}
                            >
                              <Power className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive"
                              onClick={() =>
                                setToggleConfirm({ ...branch, activate: false })
                              }
                              title={t("branches.deactivate", "Деактивировать")}
                            >
                              <PowerOff className="h-3.5 w-3.5" />
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
                          <EmptyMedia variant="icon">
                            <MapPin className="h-5 w-5" />
                          </EmptyMedia>
                          <EmptyTitle>{t("branches.emptyTitle")}</EmptyTitle>
                          <EmptyDescription>
                            {t("branches.emptyDescription")}
                          </EmptyDescription>
                        </EmptyHeader>
                        {canWriteBranch && (
                          <EmptyContent>
                            <Button
                              size="sm"
                              className="gap-1.5"
                              onClick={() => setShowCreate(true)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              {t("branches.addFirst")}
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

      <Dialog
        open={showCreate || !!editBranch}
        onOpenChange={() => {
          setShowCreate(false);
          setEditBranch(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editBranch
                ? t("branches.edit", "Редактировать филиал")
                : t("branches.add", "Добавить филиал")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("common.name")} *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("branches.city", "Город")}</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("branches.country", "Страна")}</Label>
                <Input
                  value={form.country}
                  onChange={(e) =>
                    setForm({ ...form, country: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("branches.address", "Адрес")}</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("common.phone")}</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
            </div>
            <div className="space-y-2">
              <Label>{t("branches.timezone", "Часовой пояс")}</Label>
              <Input
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                placeholder="Europe/Minsk"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreate(false);
                  setEditBranch(null);
                }}
              >
                {t("common.cancel", "Отмена")}
              </Button>
              <Button type="submit" disabled={isSaving || !form.name}>
                {isSaving
                  ? t("common.saving", "Сохранение...")
                  : editBranch
                    ? t("common.save", "Сохранить")
                    : t("branches.add", "Добавить")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!toggleConfirm}
        onOpenChange={() => setToggleConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {toggleConfirm?.activate
                ? t("branches.activate", "Активировать")
                : t("branches.deactivate", "Деактивировать")}
            </DialogTitle>
            <DialogDescription>
              {toggleConfirm?.activate
                ? t(
                    "branches.activateConfirm",
                    "Активировать филиал «{{name}}»?",
                    { name: toggleConfirm?.name },
                  )
                : t(
                    "branches.deactivateConfirm",
                    "Деактивировать филиал «{{name}}»? Он будет недоступен для новых операций.",
                    { name: toggleConfirm?.name },
                  )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToggleConfirm(null)}>
              {t("common.cancel", "Отмена")}
            </Button>
            <Button
              variant={toggleConfirm?.activate ? "default" : "destructive"}
              disabled={toggleMutation.isPending}
              onClick={() => {
                if (toggleConfirm)
                  toggleMutation.mutate({
                    id: toggleConfirm.id,
                    activate: !!toggleConfirm.activate,
                  });
              }}
            >
              {toggleMutation.isPending
                ? t("common.processing", "Обработка...")
                : toggleConfirm?.activate
                  ? t("branches.activate", "Активировать")
                  : t("branches.deactivate", "Деактивировать")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
