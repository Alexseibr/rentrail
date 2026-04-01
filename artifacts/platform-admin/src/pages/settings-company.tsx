import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsCompanyPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const membership = user?.memberships?.[0];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("nav.settings")}</h1>
        <p className="text-muted-foreground">{t("settings.subtitle", "Настройки компании")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("settings.account", "Аккаунт")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("common.name")}</span>
              <span className="font-medium">{user?.firstName} {user?.lastName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("common.email")}</span>
              <span>{user?.email || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("common.phone")}</span>
              <span>{user?.phone || "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("settings.company", "Компания")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("settings.companyName", "Название")}</span>
              <span className="font-medium">{membership?.companyName || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("settings.role", "Роль")}</span>
              <span>{membership?.roleName || membership?.roleCode || "—"}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
