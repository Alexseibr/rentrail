import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/companies", label: "Companies", icon: Building2 },
  { path: "/billing", label: "Billing", icon: CreditCard },
  { path: "/blacklist", label: "Global Blacklist", icon: ShieldBan },
  { path: "/diagnostics", label: "Diagnostics", icon: Activity },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/white-label", label: "White Label", icon: Palette },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

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
              <span className="font-semibold text-sm truncate block">Platform Admin</span>
              <Badge variant="outline" className="text-[10px] h-4 px-1">
                Admin Mode
              </Badge>
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
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3">
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
