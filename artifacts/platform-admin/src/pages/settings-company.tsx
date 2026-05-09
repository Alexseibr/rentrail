import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { useRolePermissions } from "@/hooks/use-role-permissions";
import { api } from "@/lib/api";
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
import { Pencil, Building2, User } from "lucide-react";
interface _Company {
  id: string;
  name?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  address?: string;
  status?: string;
  createdAt?: string;
  members?: unknown[];
}

export default function SettingsCompanyPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { canWriteSettings } = useRolePermissions();
  const queryClient = useQueryClient();
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

  const companyQuery = useQuery<Company>({
    queryKey: ["company-detail", companyId],
    queryFn: () => api(`/companies/${companyId}`, { headers: companyHeaders }),
    enabled: !!companyId,
  });
  const company = companyQuery.data;

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
    </div>
  );
}
