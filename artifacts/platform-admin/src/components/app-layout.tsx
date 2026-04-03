import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  ShieldBan,
  Activity,
  BarChart3,
  Palette,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Languages,
  Bike,
  Users,
  ClipboardList,
  MapPin,
  Settings,
  AlertTriangle,
  Wrench,
  Map,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface NavItem {
  path: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  roles?: string[] | null;
}

const platformNavItems: NavItem[] = [
  { path: "/", labelKey: "nav.dashboard", icon: LayoutDashboard, roles: null },
  { path: "/companies", labelKey: "nav.companies", icon: Building2, roles: ["superAdmin", "platformAdmin", "platformSupport"] },
  { path: "/billing", labelKey: "nav.billing", icon: CreditCard, roles: ["superAdmin", "platformAdmin", "platformFinance"] },
  { path: "/blacklist", labelKey: "nav.blacklist", icon: ShieldBan, roles: ["superAdmin", "platformAdmin", "platformRisk"] },
  { path: "/diagnostics", labelKey: "nav.diagnostics", icon: Activity, roles: ["superAdmin", "platformAdmin"] },
  { path: "/analytics", labelKey: "nav.analytics", icon: BarChart3, roles: ["superAdmin", "platformAdmin", "platformFinance"] },
  { path: "/white-label", labelKey: "nav.whiteLabel", icon: Palette, roles: ["superAdmin", "platformAdmin"] },
];

const companyNavItems: NavItem[] = [
  { path: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { path: "/fleet", labelKey: "nav.fleet", icon: Bike },
  { path: "/map", labelKey: "nav.map", icon: Map },
  { path: "/service", labelKey: "nav.service", icon: Wrench },
  { path: "/rentals", labelKey: "nav.rentals", icon: ClipboardList },
  { path: "/clients", labelKey: "nav.clients", icon: Users },
  { path: "/branches", labelKey: "nav.branches", icon: MapPin },
  { path: "/settings", labelKey: "nav.settings", icon: Settings },
];

const PLATFORM_ROLES = ["superAdmin", "platformAdmin", "platformSupport", "platformFinance", "platformRisk"];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout, hasTenantMemberships } = useAuth();
  const { t, i18n } = useTranslation();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const isPlatformUser = useMemo(() => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    return (user.platformRoles || []).some((r) => PLATFORM_ROLES.includes(r));
  }, [user]);

  const companyName = useMemo(() => {
    if (!user?.memberships?.length) return null;
    return user.memberships[0].companyName || user.memberships[0].roleName || null;
  }, [user]);

  const navItems = useMemo(() => {
    if (isPlatformUser) {
      return platformNavItems.filter((item) => {
        if (!item.roles) return true;
        if (user?.isSuperAdmin) return true;
        const userRoles = user?.platformRoles || [];
        return item.roles.some((r) => userRoles.includes(r));
      });
    }
    return companyNavItems;
  }, [isPlatformUser, user]);

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === "ru" ? "en" : "ru");
  };

  const headerTitle = isPlatformUser ? t("nav.platformAdmin") : (companyName || t("nav.companyPanel"));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={cn(
          "flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-200",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className="flex items-center gap-2 border-b px-4 h-14">
          {!collapsed && (
            <div className="min-w-0">
              <span className="font-semibold text-sm truncate block">{headerTitle}</span>
              {isPlatformUser && hasTenantMemberships && (
                <Badge variant="outline" className="text-[10px] h-4 px-1">
                  {t("nav.platformAdminMode")}
                </Badge>
              )}
              {!isPlatformUser && user?.memberships?.[0]?.roleCode && (
                <Badge variant="outline" className="text-[10px] h-4 px-1">
                  {user.memberships[0].roleCode}
                </Badge>
              )}
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn("ml-auto h-8 w-8", collapsed && "mx-auto")}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
          {navItems.map((item) => {
            const active =
              item.path === "/"
                ? location === "/" || location === ""
                : location.startsWith(item.path);
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium cursor-pointer transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    collapsed && "justify-center px-2",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3 space-y-2">
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            className={cn("w-full", collapsed ? "h-8 w-8 mx-auto" : "justify-start gap-2")}
            onClick={toggleLang}
          >
            <Languages className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <span className="text-xs">{i18n.language === "ru" ? "English" : "Русский"}</span>
            )}
          </Button>
          <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
