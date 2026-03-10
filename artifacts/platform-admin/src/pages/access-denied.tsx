import { useAuth } from "@/lib/auth";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export default function AccessDeniedPage() {
  const { logout, user } = useAuth();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-2">
            <ShieldAlert className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-xl">{t("accessDenied.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("accessDenied.message", { email: user?.email })}
          </p>
          <Button variant="outline" onClick={logout} className="w-full">
            {t("accessDenied.signOut")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
