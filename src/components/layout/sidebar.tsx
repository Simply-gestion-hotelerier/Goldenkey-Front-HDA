// src/components/layout/sidebar.tsx

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BarChart3, Settings, Bell, LogOut, ChevronDown, Menu, X,
  // Hébergement
  BedDouble, Map, LayoutGrid, CalendarDays, Users, SprayCan,
  // Hôtel F&B
  ConciergeBell, ShoppingCart, BookOpen,
  // Restaurant
  UtensilsCrossed, ClipboardList, Scroll,
  // Bar
  GlassWater, CreditCard, Wine,
  // Casino
  Dice5, Layers, ChefHat,
  // Finance
  Receipt, FileText, Banknote, TrendingUp,
  // Stock
  Package,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, CSSProperties, useEffect } from "react";
import { useAuth, Role } from "@/lib/rbac";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

// ─── Types ───────────────────────────────────────────────────────────────────

type NavItem = { name: string; href: string; icon: React.ElementType };

// ─── Palette par groupe ───────────────────────────────────────────────────────

const GROUP_COLORS = {
  dashboard:  { rgb: "59,130,246",   label: "text-blue-600 dark:text-blue-400",     icon: "text-blue-500",    active: "text-blue-700 dark:text-blue-300",    indicator: "bg-blue-500",    header: "hover:bg-blue-500/5"     },
  lodging:    { rgb: "20,184,166",   label: "text-teal-600 dark:text-teal-400",     icon: "text-teal-500",    active: "text-teal-700 dark:text-teal-300",    indicator: "bg-teal-500",    header: "hover:bg-teal-500/5"     },
  hotel_fb:   { rgb: "249,115,22",   label: "text-orange-600 dark:text-orange-400", icon: "text-orange-500",  active: "text-orange-700 dark:text-orange-300", indicator: "bg-orange-500",  header: "hover:bg-orange-500/5"   },
  restaurant: { rgb: "244,63,94",    label: "text-rose-600 dark:text-rose-400",     icon: "text-rose-500",    active: "text-rose-700 dark:text-rose-300",    indicator: "bg-rose-500",    header: "hover:bg-rose-500/5"     },
  bar:        { rgb: "168,85,247",   label: "text-purple-600 dark:text-purple-400", icon: "text-purple-500",  active: "text-purple-700 dark:text-purple-300", indicator: "bg-purple-500",  header: "hover:bg-purple-500/5"   },
  casino:     { rgb: "234,179,8",    label: "text-yellow-600 dark:text-yellow-400", icon: "text-yellow-500",  active: "text-yellow-700 dark:text-yellow-300", indicator: "bg-yellow-500",  header: "hover:bg-yellow-500/5"   },
  finance:    { rgb: "16,185,129",   label: "text-emerald-600 dark:text-emerald-400", icon: "text-emerald-500", active: "text-emerald-700 dark:text-emerald-300", indicator: "bg-emerald-500", header: "hover:bg-emerald-500/5" },
  stock:      { rgb: "14,165,233",   label: "text-sky-600 dark:text-sky-400",       icon: "text-sky-500",     active: "text-sky-700 dark:text-sky-300",      indicator: "bg-sky-500",     header: "hover:bg-sky-500/5"      },
};

function fadeStyle(rgb: string, index: number, total: number, isActive: boolean): CSSProperties {
  const maxOpacity = 0.10;
  const minOpacity = 0.03;
  const opacity = isActive
    ? maxOpacity * 1.8
    : maxOpacity - (index / Math.max(total - 1, 1)) * (maxOpacity - minOpacity);

  return {
    backgroundColor: `rgba(${rgb}, ${opacity})`,
  };
}

// ─── Navigation groupée avec les routes corrigées ──────────────────────────────────────────────────────

export const getNavGroups = (t: (key: string) => string) => [
  {
    label: "",
    colorKey: "dashboard",
    items: [
      { name: t("nav.dashboard"), href: "/", icon: BarChart3 },
    ],
  },
  {
    label: t("nav.group.lodging"),
    colorKey: "lodging",
    items: [
      { name: t("nav.hotelrooms"),     href: "/hotelrooms",   icon: BedDouble    },
      { name: t("nav.roomPlan"),       href: "/hotelrooms/plan",   icon: Map          },
      { name: t("nav.roomManagement"), href: "/rooms/manage", icon: LayoutGrid   },
      { name: t("nav.reservations"),   href: "/reservations", icon: CalendarDays },
      { name: t("nav.crm"),            href: "/crm",          icon: Users        },
      { name: t("nav.housekeeping"),   href: "/housekeeping", icon: SprayCan     },
    ],
  },
  {
    label: t("nav.group.hotel_fb"),
    colorKey: "hotel_fb",
    items: [
      { name: t("nav.hotel"),      href: "/hotel",      icon: ConciergeBell },
      { name: "Hotel POS",         href: "/hotel/pos",  icon: ShoppingCart  },
      { name: t("nav.menu"),       href: "/hotel/menu", icon: BookOpen      },
    ],
  },
  {
    label: t("nav.group.restaurant"),
    colorKey: "restaurant",
    items: [
      { name: t("nav.restaurant"),        href: "/restaurant",      icon: UtensilsCrossed },
      { name: "Restaurant POS",           href: "/restaurant/pos",  icon: ClipboardList   },
      { name: t("nav.menu"),              href: "/restaurant/menu", icon: Scroll          },
    ],
  },
  {
    label: t("nav.group.bar"),
    colorKey: "bar",
    items: [
      { name: t("nav.bar"),        href: "/bar",      icon: GlassWater },
      { name: "Bar POS",           href: "/bar/pos",  icon: CreditCard },
      { name: t("nav.menu"),       href: "/bar/menu", icon: Wine       },
    ],
  },
  {
    label: t("nav.group.casino"),
    colorKey: "casino",
    items: [
      { name: "Casino",           href: "/casino",      icon: Dice5   },
      { name: "Casino POS",       href: "/casino/pos",  icon: Layers  },
      { name: t("nav.menu"),      href: "/casino/menu", icon: ChefHat },
    ],
  },
  {
    label: t("nav.group.finance"),
    colorKey: "finance",
    items: [
      { name: t("nav.clientInvoice"), href: "/invoices/client", icon: Receipt    },
      { name: t("nav.dailyInvoice"),  href: "/invoices/daily",  icon: FileText   },
    /* { name: t("nav.cash"),          href: "/cash",            icon: Banknote   },*/
      { name: t("nav.reports"),       href: "/reports",         icon: TrendingUp },
    ],
  },
  {
    label: t("nav.group.stock"),
    colorKey: "stock",
    items: [
      { name: t("nav.inventory"), href: "/inventory", icon: Package },
    ],
  },
];

// ─── RBAC ─────────────────────────────────────────────────────────────────────

const roleAccess: Record<Role, string[]> = {
  admin: [
    "/", "/hotelrooms", "/hotelrooms/plan", "/rooms/manage", "/reservations", "/crm", "/housekeeping",
    "/hotel", "/hotel/pos", "/hotel/menu",
    "/restaurant", "/restaurant/pos", "/restaurant/menu", 
    "/bar", "/bar/pos", "/bar/menu",
    "/casino", "/casino/pos", "/casino/menu",
    "/invoices/client", "/invoices/daily", "/cash", "/reports",
    "/inventory",
    "/notifications", "/settings", "/team", "/room-inspection",
  ],
  manager: [
    "/", "/hotelrooms", "/hotelrooms/plan", "/rooms/manage", "/reservations", "/crm", "/housekeeping",
    "/hotel", "/hotel/pos", "/hotel/menu",
    "/restaurant", "/restaurant/pos", "/restaurant/menu", 
    "/bar", "/bar/pos", "/bar/menu",
    "/invoices/client", "/invoices/daily", "/cash", "/reports",
    "/inventory",
    "/notifications", "/settings", "/room-inspection",
  ],
  reception: [
    "/", "/hotelrooms", "/hotelrooms/plan", "/rooms/manage", "/reservations", "/crm",
    "/hotel/pos",
    "/restaurant", "/restaurant/pos", "/restaurant/menu", 
    "/invoices/client",
    "/notifications", "/settings",
  ],
  serveur: [
    "/", "/restaurant", "/restaurant/pos", "/restaurant/menu",
    "/notifications", "/settings",
  ],
  bar: [
    "/", "/bar", "/bar/pos", "/bar/menu",
    "/notifications", "/settings",
  ],
  cuisine: [
    "/", "/restaurant", 
    "/notifications", "/settings",
  ],
  compta: [
    "/", "/invoices/client", "/invoices/daily", "/cash", "/reports",
    "/notifications", "/settings",
  ],
  housekeeping: [
    "/", "/housekeeping", "/room-inspection",
    "/notifications", "/settings",
  ],
};

// ─── NavButton ────────────────────────────────────────────────────────────────

type NavButtonProps = {
  item: NavItem;
  index: number;
  total: number;
  isActive: boolean;
  colors: typeof GROUP_COLORS[keyof typeof GROUP_COLORS];
  navigate: (href: string) => void;
  onClose?: () => void;
};

function NavButton({ item, index, total, isActive, colors, navigate, onClose }: NavButtonProps) {
  const bgStyle = fadeStyle(colors.rgb, index, total, isActive);

  const handleClick = () => {
    navigate(item.href);
    if (onClose) onClose();
  };

  return (
    <li>
      <button
        onClick={handleClick}
        style={bgStyle}
        className={cn(
          "w-full flex items-center gap-3 px-3 h-9 rounded-md text-sm",
          "transition-all duration-150 relative group/btn",
          isActive
            ? cn("font-medium", colors.active)
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {isActive && (
          <span className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full",
            colors.indicator,
          )} />
        )}
        <item.icon
          className={cn(
            "h-4 w-4 flex-shrink-0 transition-colors duration-150",
            isActive ? colors.icon : cn("opacity-50 group-hover/btn:opacity-80", colors.icon),
          )}
        />
        <span className="truncate">{item.name}</span>
      </button>
    </li>
  );
}

// ─── CollapsibleGroup ─────────────────────────────────────────────────────────

type CollapsibleGroupProps = {
  group: ReturnType<typeof getNavGroups>[number];
  allowed: string[];
  location: { pathname: string };
  navigate: (href: string) => void;
  openKey: string | null;
  onToggle: (key: string) => void;
  onClose?: () => void;
};

function CollapsibleGroup({ group, allowed, location, navigate, openKey, onToggle, onClose }: CollapsibleGroupProps) {
  const colors      = GROUP_COLORS[group.colorKey as keyof typeof GROUP_COLORS];
  const visible     = group.items.filter((item) => allowed.includes(item.href));
  const hasActiveItem = visible.some((item) => location.pathname === item.href);
  const isOpen      = openKey === group.colorKey;

  if (!visible.length) return null;

  // Dashboard : pas de header collapsible
  if (!group.label) {
    return (
      <ul className="flex flex-col gap-0.5 mb-2">
        {visible.map((item, i) => (
          <NavButton
            key={item.href}
            item={item}
            index={i}
            total={visible.length}
            isActive={location.pathname === item.href}
            colors={colors}
            navigate={navigate}
            onClose={onClose}
          />
        ))}
      </ul>
    );
  }

  return (
    <div className="mb-0.5">
      {/* Header cliquable */}
      <button
        onClick={() => onToggle(group.colorKey)}
        className={cn(
          "w-full flex items-center justify-between px-2 py-1.5 rounded-md mb-0.5",
          "transition-colors duration-150 cursor-pointer select-none group/header",
          colors.header,
        )}
      >
        <div className="flex items-center gap-2">
          <span className={cn(
            "w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-200",
            colors.indicator,
            hasActiveItem
              ? "opacity-100 ring-2 ring-offset-1 ring-offset-background"
              : "opacity-50 group-hover/header:opacity-80",
          )} />
          <span className={cn("text-[11px] font-semibold uppercase tracking-wider", colors.label)}>
            {group.label}
          </span>
        </div>

        <ChevronDown className={cn(
          "h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200",
          colors.label,
          isOpen ? "rotate-0" : "-rotate-90",
        )} />
      </button>

      {/* Items animés */}
      <div className={cn(
        "overflow-hidden transition-all duration-200 ease-in-out",
        isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
      )}>
        <div className="relative pl-3">
          {/* Ligne verticale colorée */}
          <span className={cn(
            "absolute left-[11px] top-0 bottom-1 w-px opacity-20",
            colors.indicator,
          )} />
          <ul className="flex flex-col gap-0.5">
            {visible.map((item, i) => (
              <NavButton
                key={item.href}
                item={item}
                index={i}
                total={visible.length}
                isActive={location.pathname === item.href}
                colors={colors}
                navigate={navigate}
                onClose={onClose}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar Content (réutilisable pour desktop et mobile) ───────────────────

type SidebarContentProps = {
  onClose?: () => void;
};

function SidebarContent({ onClose }: SidebarContentProps) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, logout } = useAuth();
  const { t }     = useTranslation();
  const { theme } = useTheme();

  const currentRole = user?.role ?? "reception";
  const allowed     = roleAccess[currentRole] ?? [];
  const navGroups   = getNavGroups(t);
  const logoSrc     = theme === "dark" ? "/logo_s.png" : "/logo_n.png";

  // Trouver le groupe qui contient la route active pour l'ouvrir par défaut
  const initialGroup = navGroups.find((g) =>
    g.items.some((item) => item.href === location.pathname)
  )?.colorKey ?? null;

  const [openGroup, setOpenGroup] = useState<string | null>(initialGroup);

  const handleToggle = (key: string) =>
    setOpenGroup((prev) => (prev === key ? null : key));

  const handleLogout = () => {
    logout();
    if (onClose) onClose();
  };

  const handleNavigate = (href: string) => {
    navigate(href);
    if (onClose) onClose();
  };

  return (
    <>
      {/* HEADER */}
      <div className="h-16 border-b flex items-center px-4 gap-3 group">
        <img
          src={logoSrc}
          alt="Hôtel de l'Avenue Logo"
          className="h-12 w-12 object-contain rounded-lg transition-transform group-hover:scale-110"
        />
        <h1 className="text-lg font-bold text-foreground truncate">
          Hôtel de l'Avenue
        </h1>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        {navGroups.map((group) => (
          <CollapsibleGroup
            key={group.colorKey}
            group={group}
            allowed={allowed}
            location={location}
            navigate={handleNavigate}
            openKey={openGroup}
            onToggle={handleToggle}
            onClose={onClose}
          />
        ))}
      </nav>

      {/* FOOTER */}
      <div className="mt-auto p-3 border-t space-y-1">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent"
          onClick={() => handleNavigate("/notifications")}
        >
          <Bell className="mr-3 h-5 w-5" />
          {t("nav.notifications")}
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent"
          onClick={() => handleNavigate("/settings")}
        >
          <Settings className="mr-3 h-5 w-5" />
          {t("nav.settings")}
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          onClick={handleLogout}
        >
          <LogOut className="mr-3 h-5 w-5" />
          {t("profile.logout")}
        </Button>
      </div>
    </>
  );
}

// ─── Sidebar principale (Desktop) ────────────────────────────────────────────

export function Sidebar() {
  return (
    <div className="hidden md:flex min-h-screen w-64 flex-col bg-background border-r">
      <SidebarContent />
    </div>
  );
}

// ─── MobileSidebar (version mobile avec Sheet) ────────────────────────────────

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-10 w-10">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent onClose={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}