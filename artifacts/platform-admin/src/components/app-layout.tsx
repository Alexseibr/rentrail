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
  Wrench,
  Map,
  Menu,
  X,
  Search,
  Bell,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { canAccessRoute } from "@/lib/permissions";

interface NavItem {
  path: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  roles?: string[] | null;
}

interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

const platformNavGroups: NavGroup[] = [
  {
    labelKey: "nav.groupMain",
    items: [
      { path: "/", labelKey: "nav.dashboard", icon: LayoutDashboard, roles: null },
      { path: "/companies", labelKey: "nav.companies", icon: Building2, roles: ["superAdmin", "platformAdmin", "platformSupport"] },
    ],
  },
  {
    labelKey: "nav.groupTools",
    items: [
      { path: "/billing", labelKey: "nav.billing", icon: CreditCard, roles: ["superAdmin", "platformAdmin", "platformFinance"] },
      { path: "/blacklist", labelKey: "nav.blacklist", icon: ShieldBan, roles: ["superAdmin", "platformAdmin", "platformRisk"] },
      { path: "/diagnostics", labelKey: "nav.diagnostics", icon: Activity, roles: ["superAdmin", "platformAdmin"] },
      { path: "/analytics", labelKey: "nav.analytics", icon: BarChart3, roles: ["superAdmin", "platformAdmin", "platformFinance"] },
      { path: "/white-label", labelKey: "nav.whiteLabel", icon: Palette, roles: ["superAdmin", "platformAdmin"] },
    ],
  },
];

const companyNavGroups: NavGroup[] = [
  {
    labelKey: "nav.groupMain",
    items: [
      { path: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
      { path: "/fleet", labelKey: "nav.fleet", icon: Bike },
      { path: "/map", labelKey: "nav.map", icon: Map },
      { path: "/rentals", labelKey: "nav.rentals", icon: ClipboardList },
    ],
  },
  {
    labelKey: "nav.groupManagement",
    items: [
      { path: "/clients", labelKey: "nav.clients", icon: Users },
      { path: "/service", labelKey: "nav.service", icon: Wrench },
      { path: "/branches", labelKey: "nav.branches", icon: MapPin },
      { path: "/settings", labelKey: "nav.settings", icon: Settings },
    ],
  },
];

const PLATFORM_ROLES = ["superAdmin", "platformAdmin", "platformSupport", "platformFinance", "platformRisk"];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout, hasTenantMemberships } = useAuth();
  const { t, i18n } = useTranslation();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  const isPlatformUser = useMemo(() => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    return (user.platformRoles || []).some((r) => PLATFORM_ROLES.includes(r));
  }, [user]);

  const companyName = useMemo(() => {
    if (!user?.memberships?.length) return null;
    return user.memberships[0].companyName || user.memberships[0].roleName || null;
  }, [user]);

  const roleCode = useMemo(() => {
    if (!user?.memberships?.length) return undefined;
    return user.memberships[0].roleCode;
  }, [user]);

  const navGroups = useMemo(() => {
    if (isPlatformUser) {
      return platformNavGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            if (!item.roles) return true;
            if (user?.isSuperAdmin) return true;
            const userRoles = user?.platformRoles || [];
            return item.roles.some((r) => userRoles.includes(r));
          }),
        }))
        .filter((group) => group.items.length > 0);
    }
    return companyNavGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => canAccessRoute(roleCode, item.path)),
      }))
      .filter((group) => group.items.length > 0);
  }, [isPlatformUser, user, roleCode]);

  const navItems = useMemo(() => navGroups.flatMap((g) => g.items), [navGroups]);

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === "ru" ? "en" : "ru");
  };

  const headerTitle = isPlatformUser ? t("nav.platformAdmin") : (companyName || t("nav.companyPanel"));

  const currentPageTitle = useMemo(() => {
    const current = navItems.find((item) =>
      item.path === "/" ? location === "/" || location === "" : location.startsWith(item.path)
    );
    return current ? t(current.labelKey) : "";
  }, [navItems, location, t]);

  const mobileNavItems = navItems.slice(0, 5);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "hidden md:flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out border-0",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        <div className={cn("flex items-center h-16 px-4", collapsed ? "justify-center" : "gap-3")}>
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary shrink-0">
            <Bike className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-sm truncate block text-sidebar-foreground">{headerTitle}</span>
              {isPlatformUser && hasTenantMemberships && (
                <span className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">Platform</span>
              )}
              {!isPlatformUser && roleCode && (
                <span className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">{roleCode}</span>
              )}
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent", collapsed && "hidden")}
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 mx-auto mb-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent flex"
              onClick={() => setCollapsed(false)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {navGroups.map((group, gi) => (
            <div key={gi} className={cn(gi > 0 && "mt-4")}>
              {!collapsed && (
                <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  {t(group.labelKey)}
                </p>
              )}
              {collapsed && gi > 0 && (
                <Separator className="my-2 bg-sidebar-foreground/10" />
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active =
                    item.path === "/"
                      ? location === "/" || location === ""
                      : location.startsWith(item.path);
                  return (
                    <Link key={item.path} href={item.path}>
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium cursor-pointer transition-all duration-200",
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                          collapsed && "justify-center px-2",
                        )}
                      >
                        <item.icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-primary-foreground")} />
                        {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 space-y-1">
          <button
            onClick={toggleLang}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm w-full transition-all duration-200 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              collapsed && "justify-center px-2",
            )}
          >
            <Languages className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && (
              <span className="text-sm">{i18n.language === "ru" ? "English" : "Русский"}</span>
            )}
          </button>
          <div className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5", collapsed && "justify-center px-2")}>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-sidebar-accent text-sidebar-foreground text-xs font-semibold shrink-0">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-sidebar-foreground">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-sidebar-foreground/50 truncate">{user?.phone}</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={logout}
              title={t("nav.logout", "Выйти")}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-in-out md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary shrink-0">
              <Bike className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm text-sidebar-foreground">{headerTitle}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {navGroups.map((group, gi) => (
            <div key={gi} className={cn(gi > 0 && "mt-4")}>
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                {t(group.labelKey)}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active =
                    item.path === "/"
                      ? location === "/" || location === ""
                      : location.startsWith(item.path);
                  return (
                    <Link key={item.path} href={item.path}>
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium cursor-pointer transition-all duration-200",
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                        )}
                      >
                        <item.icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-primary-foreground")} />
                        <span className="truncate">{t(item.labelKey)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 space-y-1 border-t border-sidebar-border">
          <button
            onClick={toggleLang}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm w-full text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <Languages className="h-[18px] w-[18px] shrink-0" />
            <span>{i18n.language === "ru" ? "English" : "Русский"}</span>
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm w-full text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            <span>{t("nav.logout", "Выйти")}</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border/50 bg-card flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">{currentPageTitle}</h1>
          </div>
          <div className="flex items-center gap-1.5">
            {searchOpen ? (
              <div className="flex items-center gap-2">
                <Input
                  placeholder={t("common.search", "Поиск...")}
                  className="w-48 h-9 text-sm"
                  autoFocus
                  onBlur={() => setSearchOpen(false)}
                  onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
                />
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground relative"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:inline-flex text-muted-foreground hover:text-foreground"
              onClick={toggleLang}
            >
              <Languages className="h-4 w-4 mr-1" />
              {i18n.language === "ru" ? "EN" : "RU"}
            </Button>
            <div className="relative hidden md:block" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 ml-1 pl-2 border-l border-border/50 py-1 hover:opacity-80 transition-opacity"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
                <span className="text-sm font-medium hidden lg:inline">{user?.firstName}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-card rounded-xl shadow-lg border border-border/50 py-1.5 z-50">
                  <div className="px-4 py-2.5 border-b border-border/50">
                    <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs text-muted-foreground">{user?.phone}</p>
                  </div>
                  <button
                    onClick={() => { toggleLang(); setUserMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Languages className="h-4 w-4 text-muted-foreground" />
                    {i18n.language === "ru" ? "Switch to English" : "Переключить на Русский"}
                  </button>
                  <button
                    onClick={() => { logout(); setUserMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-muted/50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    {t("nav.logout", "Выйти")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div key={location} className="page-transition">
            {children}
          </div>
        </main>

        <nav className="md:hidden border-t border-border/50 bg-card flex items-center justify-around py-1 shrink-0 safe-area-bottom">
          {mobileNavItems.map((item) => {
            const active =
              item.path === "/"
                ? location === "/" || location === ""
                : location.startsWith(item.path);
            return (
              <Link key={item.path} href={item.path}>
                <div className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[56px]",
                  active ? "text-primary" : "text-muted-foreground",
                )}>
                  <item.icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium leading-tight">{t(item.labelKey)}</span>
                </div>
              </Link>
            );
          })}
          {navItems.length > 5 && (
            <button
              onClick={() => setMobileOpen(true)}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-muted-foreground min-w-[56px]"
            >
              <Menu className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-tight">{t("nav.more", "Ещё")}</span>
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}
