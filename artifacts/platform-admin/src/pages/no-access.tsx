import { useAuth } from "@/lib/auth";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ShieldOff } from "lucide-react";
import { getNavPaths } from "@/lib/permissions";

export default function NoAccessPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const roleCode = user?.memberships?.[0]?.roleCode;
  const allowedPaths = getNavPaths(roleCode);
  const fallback = allowedPaths[0] || "/";

  return (
    <div className="flex flex-col items-center justify-center h-full py-20 px-4">
      <ShieldOff className="h-16 w-16 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-semibold mb-2">{t("noAccess.title")}</h1>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        {t("noAccess.message", { role: roleCode || "—" })}
      </p>
      <Link href={fallback}>
        <Button variant="outline">{t("noAccess.goHome")}</Button>
      </Link>
    </div>
  );
}
