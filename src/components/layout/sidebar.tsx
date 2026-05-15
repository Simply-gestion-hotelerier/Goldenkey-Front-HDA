// src/components/layout/sidebar.tsx

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Hotel,
  UtensilsCrossed,
  Sparkles,
  BarChart3,
  Settings,
  Bell,
  Users,
  LayoutGrid,
  DollarSign as DollarIcon,
  CalendarDays,
  LogOut,
} from "lucide-react";

import { useLocation, useNavigate } from "react-router-dom";
import { useAuth, Role } from "@/lib/rbac";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";


// =========================
// NAVIGATION
// =========================

export const getNavigation = (t: (key: string) => string) => [
  {
    name: t("nav.dashboard"),
    href: "/",
    icon: BarChart3,
  },

  // CRM CLIENTS
  {
    name: t("nav.crm"),
    href: "/crm",
    icon: Users,
  },

  // RESTAURANT
  {
    name: t("nav.restaurant"),
    href: "/restaurant",
    icon: UtensilsCrossed,
  },

  // POS RESTAURANT
  {
    name: "POS Restaurant",
    href: "/restaurant/pos",
    icon: UtensilsCrossed,
  },

  // CAISSE
  {
    name: t("nav.cash"),
    href: "/cash",
    icon: DollarIcon,
  },

  // FACTURE CLIENT
  {
    name: t("nav.clientInvoice"),
    href: "/invoices/client",
    icon: DollarIcon,
  },

  // FACTURE JOURNALIERE
  {
    name: t("nav.dailyInvoice"),
    href: "/invoices/daily",
    icon: DollarIcon,
  },

  // REPORTING
  {
    name: t("nav.reports"),
    href: "/reports",
    icon: BarChart3,
  },
];


// =========================
// ICON COLORS
// =========================

const ICON_COLORS: Record<string, string> = {
  "/": "text-blue-500",

  "/crm": "text-green-600",

  "/restaurant": "text-rose-500",
  "/restaurant/pos": "text-pink-500",

  "/cash": "text-lime-500",

  "/invoices/client": "text-emerald-500",
  "/invoices/daily": "text-emerald-500",

  "/reports": "text-cyan-500",

  "/notifications": "text-orange-400",
  "/settings": "text-zinc-500",
};


// =========================
// ROLE ACCESS
// =========================

const roleAccess: Record<Role, string[]> = {
  admin: [
    "/",
    "/crm",
    "/restaurant",
    "/restaurant/pos",
    "/cash",
    "/invoices/client",
    "/invoices/daily",
    "/reports",
    "/notifications",
    "/settings",
  ],

  manager: [
    "/",
    "/crm",
    "/restaurant",
    "/restaurant/pos",
    "/cash",
    "/invoices/client",
    "/invoices/daily",
    "/reports",
    "/notifications",
    "/settings",
  ],

  reception: [
    "/crm",
    "/invoices/client",
    "/notifications",
    "/settings",
  ],

  serveur: [
    "/restaurant",
    "/restaurant/pos",
    "/notifications",
    "/settings",
  ],

  compta: [
    "/cash",
    "/invoices/client",
    "/invoices/daily",
    "/reports",
    "/notifications",
    "/settings",
  ],

  housekeeping: [
    "/notifications",
    "/settings",
  ],

  cuisine: [
    "/restaurant",
    "/notifications",
    "/settings",
  ],

  spa: [
    "/notifications",
    "/settings",
  ],

  bar: [
    "/restaurant",
    "/restaurant/pos",
    "/notifications",
    "/settings",
  ],
};


// =========================
// SIDEBAR
// =========================

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const { user, logout } = useAuth();

  const { t } = useTranslation();

  const { theme } = useTheme();

  const navigation = getNavigation(t);

  const filteredNavigation = navigation.filter((item) => {
    const currentRole = user?.role || "reception";

    return roleAccess[currentRole]?.includes(item.href);
  });

  // LOGO SELON THEME
  const logoSrc =
    theme === "dark"
      ? "/logo_s.png"
      : "/logo_n.png";

  return (
    <div className="hidden md:flex min-h-screen w-64 flex-col bg-background border-r">

      {/* HEADER */}
      <div className="h-16 border-b flex items-center">
        <div className="flex items-center gap-3 pl-4 group w-full">

          <img
            src={logoSrc}
            alt="Hôtel de l'Avenue Logo"
            className="h-12 w-12 object-contain rounded-lg transition-transform group-hover:scale-110"
          />

          <div className="flex items-center justify-between w-full pr-4">
            <h1 className="text-lg font-bold text-foreground">
              Hôtel de l'Avenue
            </h1>
          </div>

        </div>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 px-4 py-4 overflow-y-auto">

        {filteredNavigation.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>{t("common.noData")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">

            {filteredNavigation.map((item) => {
              const isActive =
                location.pathname === item.href;

              return (
                <li key={item.name}>
                  <Button
                    variant={
                      isActive
                        ? "default"
                        : "ghost"
                    }
                    className={cn(
                      "w-full justify-start px-3 flex items-center gap-3 transition-all duration-200",

                      isActive
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                    )}
                    onClick={() =>
                      navigate(item.href)
                    }
                  >
                    <item.icon
                      className={cn(
                        "h-5 w-5 flex-shrink-0",
                        ICON_COLORS[item.href] ??
                          "text-muted-foreground"
                      )}
                    />

                    <span className="truncate">
                      {item.name}
                    </span>
                  </Button>
                </li>
              );
            })}

          </ul>
        )}
      </nav>

      {/* FOOTER */}
      <div className="mt-auto p-4 border-t space-y-2">

        {/* NOTIFICATIONS */}
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent"
          onClick={() =>
            navigate("/notifications")
          }
        >
          <Bell className="mr-3 h-5 w-5" />

          {t("nav.notifications")}
        </Button>

        {/* SETTINGS */}
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent"
          onClick={() =>
            navigate("/settings")
          }
        >
          <Settings className="mr-3 h-5 w-5" />

          {t("nav.settings")}
        </Button>

        {/* LOGOUT */}
        <Button
          variant="ghost"
          className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50"
          onClick={logout}
        >
          <LogOut className="mr-3 h-5 w-5" />

          Déconnexion
        </Button>

      </div>
    </div>
  );
}