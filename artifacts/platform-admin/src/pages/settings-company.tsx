import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { useRolePermissions } from "@/hooks/use-role-permissions";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Pencil,
  Building2,
  User,
  QrCode,
  Copy,
  Check,
  Key,
  AlertTriangle,
  Trash2,
} from "lucide-react";

const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

interface Company {
  id: string;
  name?: string;
  slug?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  address?: string;
  status?: string;
  createdAt?: string;
  members?: unknown[];
}

interface ApiKey {
  id: string;
  companyId: string;
  provider: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

interface CreatedKey extends ApiKey {
  rawKey: string;
}

function isKeyStale(lastUsedAt: string | null): boolean {
  if (!lastUsedAt) return true;
  return Date.now() - new Date(lastUsedAt).getTime() > STALE_THRESHOLD_MS;
}

function StaleBadge({ lastUsedAt }: { lastUsedAt: string | null }) {
  const { t } = useTranslation();

  const tooltipText =
    lastUsedAt === null
      ? t("settings.keyNeverUsedTooltip")
      : t("settings.keyStaleTooltip");

  const label =
    lastUsedAt === null ? t("settings.keyNeverUsed") : t("settings.keyStale");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className="border-amber-400 text-amber-700 bg-amber-50 gap-1 cursor-default"
        >
          <AlertTriangle className="h-3 w-3" />
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-center">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}

export default function SettingsCompanyPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { canWriteSettings } = useRolePermissions();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const membership = user?.memberships?.[0];
  const companyId = membership?.companyId;
  const companyHeaders: Record<string, string> = companyId
    ? { "x-company-id": companyId }
    : {};

  const [editCompany, setEditCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    name: "",
    contactEmail: "",
    contactPhone: "",
    website: "",
    address: "",
  });

  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [keyForm, setKeyForm] = useState({ name: "", provider: "" });
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  const companyQuery = useQuery<Company>({
    queryKey: ["company-detail", companyId],
    queryFn: () =>
      api<Company>(`/companies/${companyId}`, { headers: companyHeaders }),
    enabled: !!companyId,
  });
  const company = companyQuery.data;

  const apiKeysQuery = useQuery<ApiKey[]>({
    queryKey: ["provider-api-keys", companyId],
    queryFn: () =>
      api<ApiKey[]>("/provider-api-keys", { headers: companyHeaders }),
    enabled: !!companyId,
  });
  const apiKeys = apiKeysQuery.data ?? [];

  const handleCopyLink = useCallback(() => {
    const slug = company?.slug;
    if (!slug) return;
    void navigator.clipboard.writeText(`staff-app://company/${slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [company?.slug]);

  const handleCopyKey = useCallback(() => {
    if (!createdKey?.rawKey) return;
    void navigator.clipboard.writeText(createdKey.rawKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }, [createdKey?.rawKey]);

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/companies/${companyId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: companyHeaders,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-detail"] });
      setEditCompany(false);
    },
  });

  const createKeyMutation = useMutation({
    mutationFn: (body: { name: string; provider: string }) =>
      api<CreatedKey>("/provider-api-keys", {
        method: "POST",
        body: JSON.stringify(body),
        headers: companyHeaders,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["provider-api-keys"] });
      setCreateKeyOpen(false);
      setKeyForm({ name: "", provider: "" });
      setCreatedKey(data);
    },
    onError: () => {
      toast({ title: t("settings.keyCreateError"), variant: "destructive" });
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/provider-api-keys/${id}`, {
        method: "DELETE",
        headers: companyHeaders,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-api-keys"] });
      setRevokeTarget(null);
      toast({ title: t("settings.keyRevoked") });
    },
    onError: () => {
      toast({ title: t("settings.keyRevokedError"), variant: "destructive" });
    },
  });

  function openEditCompany() {
    setCompanyForm({
      name: company?.name || "",
      contactEmail: company?.contactEmail || "",
      contactPhone: company?.contactPhone || "",
      website: company?.website || "",
      address: company?.address || "",
    });
    setEditCompany(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {};
    if (companyForm.name) body.name = companyForm.name;
    if (companyForm.contactEmail) body.contactEmail = companyForm.contactEmail;
    if (companyForm.contactPhone) body.contactPhone = companyForm.contactPhone;
    if (companyForm.website) body.website = companyForm.website;
    if (companyForm.address) body.address = companyForm.address;
    updateMutation.mutate(body);
  }

  function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    createKeyMutation.mutate(keyForm);
  }

  const activeKeys = apiKeys.filter((k) => k.isActive);
  const revokedKeys = apiKeys.filter((k) => !k.isActive);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("nav.settings")}
        </h1>
        <p className="text-muted-foreground">
          {t("settings.subtitle", "Настройки компании")}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">
                {t("settings.account", "Аккаунт")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("common.name")}</span>
              <span className="font-medium">
                {user?.firstName} {user?.lastName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("common.email")}</span>
              <span>{user?.email || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("common.phone")}</span>
              <span>{user?.phone || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("settings.role", "Роль")}
              </span>
              <Badge variant="secondary">
                {membership?.roleName || membership?.roleCode || "—"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">
                {t("settings.company", "Компания")}
              </CardTitle>
            </div>
            {canWriteSettings && (
              <Button size="sm" variant="outline" onClick={openEditCompany}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                {t("common.edit", "Редактировать")}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("settings.companyName", "Название")}
              </span>
              <span className="font-medium">
                {company?.name || membership?.companyName || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("common.status")}
              </span>
              <Badge className="bg-green-100 text-green-800">
                {company?.status || "active"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("common.email")}</span>
              <span>{company?.contactEmail || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("common.phone")}</span>
              <span>{company?.contactPhone || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("settings.website", "Сайт")}
              </span>
              <span>{company?.website || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("settings.address", "Адрес")}
              </span>
              <span className="text-right max-w-48 truncate">
                {company?.address || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("settings.created", "Создана")}
              </span>
              <span>
                {company?.createdAt
                  ? new Date(company.createdAt).toLocaleDateString()
                  : "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {company?.slug && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">
                {t("settings.inviteStaff", "Пригласить сотрудников")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-6 items-start">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`staff-app://company/${company.slug}`)}&format=png&margin=4`}
              alt="QR-код приглашения"
              width={160}
              height={160}
              className="rounded-lg border"
            />
            <div className="flex flex-col gap-3 flex-1">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {t("settings.companyCode", "Код компании")}
                </p>
                <p className="text-2xl font-mono font-bold tracking-widest">
                  {company.slug}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {t(
                  "settings.inviteHint",
                  "Сотрудник вводит код или сканирует QR при первом запуске приложения.",
                )}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={handleCopyLink}
              >
                {copied ? (
                  <Check className="h-4 w-4 mr-2 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                {copied
                  ? t("settings.copied", "Скопировано!")
                  : t("settings.copyLink", "Скопировать ссылку")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">
                {t("settings.apiKeys")}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("settings.apiKeysSubtitle")}
              </p>
            </div>
          </div>
          {canWriteSettings && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreateKeyOpen(true)}
            >
              <Key className="h-3.5 w-3.5 mr-1" />
              {t("settings.createKey")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {activeKeys.length === 0 && revokedKeys.length === 0 ? (
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Key className="h-5 w-5" />
                </EmptyMedia>
                <EmptyTitle>{t("settings.emptyKeys")}</EmptyTitle>
                <EmptyDescription>
                  {t("settings.emptyKeysDesc")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="divide-y">
              {activeKeys.map((key) => (
                <div
                  key={key.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{key.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {key.provider}
                      </Badge>
                      {key.isActive && isKeyStale(key.lastUsedAt) && (
                        <StaleBadge lastUsedAt={key.lastUsedAt} />
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span>
                        {t("settings.keyPrefix")}:{" "}
                        <code className="font-mono bg-muted px-1 rounded">
                          {key.keyPrefix}…
                        </code>
                      </span>
                      <span>
                        {t("settings.keyLastUsed")}:{" "}
                        {key.lastUsedAt
                          ? new Date(key.lastUsedAt).toLocaleString()
                          : t("settings.keyNeverUsed")}
                      </span>
                    </div>
                  </div>
                  {canWriteSettings && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => setRevokeTarget(key)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      {t("settings.revokeKey")}
                    </Button>
                  )}
                </div>
              ))}
              {revokedKeys.map((key) => (
                <div
                  key={key.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center gap-3 opacity-50"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm line-through">
                        {key.name}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {key.provider}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {t("common.inactive")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span>
                        {t("settings.keyPrefix")}:{" "}
                        <code className="font-mono bg-muted px-1 rounded">
                          {key.keyPrefix}…
                        </code>
                      </span>
                      {key.revokedAt && (
                        <span>
                          {t("common.inactive")}:{" "}
                          {new Date(key.revokedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editCompany} onOpenChange={setEditCompany}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("settings.editCompany", "Редактировать компанию")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("settings.companyName", "Название")}</Label>
              <Input
                value={companyForm.name}
                onChange={(e) =>
                  setCompanyForm({ ...companyForm, name: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("common.email")}</Label>
                <Input
                  type="email"
                  value={companyForm.contactEmail}
                  onChange={(e) =>
                    setCompanyForm({
                      ...companyForm,
                      contactEmail: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("common.phone")}</Label>
                <Input
                  value={companyForm.contactPhone}
                  onChange={(e) =>
                    setCompanyForm({
                      ...companyForm,
                      contactPhone: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("settings.website", "Сайт")}</Label>
              <Input
                value={companyForm.website}
                onChange={(e) =>
                  setCompanyForm({ ...companyForm, website: e.target.value })
                }
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.address", "Адрес")}</Label>
              <Input
                value={companyForm.address}
                onChange={(e) =>
                  setCompanyForm({ ...companyForm, address: e.target.value })
                }
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditCompany(false)}
              >
                {t("common.cancel", "Отмена")}
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending
                  ? t("common.saving", "Сохранение...")
                  : t("common.save", "Сохранить")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={createKeyOpen} onOpenChange={setCreateKeyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.createKey")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateKey} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("settings.keyName")}</Label>
              <Input
                value={keyForm.name}
                onChange={(e) =>
                  setKeyForm({ ...keyForm, name: e.target.value })
                }
                placeholder="Production Teltonika"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.keyProvider")}</Label>
              <Input
                value={keyForm.provider}
                onChange={(e) =>
                  setKeyForm({ ...keyForm, provider: e.target.value })
                }
                placeholder="teltonika"
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateKeyOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={createKeyMutation.isPending}>
                {createKeyMutation.isPending
                  ? t("common.creating")
                  : t("settings.createKey")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!createdKey}
        onOpenChange={(open) => {
          if (!open) setCreatedKey(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.keyCreatedTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("settings.keyCreatedNote")}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">
                {createdKey?.rawKey}
              </code>
              <Button size="sm" variant="outline" onClick={handleCopyKey}>
                {copiedKey ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedKey(null)}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("common.confirmAction", { action: t("settings.revokeKey") })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget
                ? t("settings.revokeKeyConfirm", { name: revokeTarget.name })
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (revokeTarget) revokeKeyMutation.mutate(revokeTarget.id);
              }}
            >
              {t("settings.revokeKey")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
