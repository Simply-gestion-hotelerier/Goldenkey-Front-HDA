// src/components/layout/header.tsx

import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Bell,
  Search,
  Settings,
  LogOut,
  X,
  Menu,
  Trash2,
  CheckCheck,
  Users,
  UtensilsCrossed,
  DollarSign,
  BarChart3,
  FileText,
} from "lucide-react";

import { Input } from "@/components/ui/input";

import { useAuth, useUserProfile, Role } from "@/lib/rbac";

import { useState, useEffect, useRef } from "react";

import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
} from "@/components/ui/drawer";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import { cn } from "@/lib/utils";

import { api } from "@/lib/api";

import {
  useQueryClient,
  useQuery,
  useMutation,
} from "@tanstack/react-query";

import { useSSENotifications } from "@/hooks/useSSENotifications";

import { useTranslation } from "react-i18next";

import { MobileSidebar } from "./sidebar";


// ============================================
// NOTIFICATION TYPE
// ============================================

type NotificationItem = {
  id: number;
  title: string;
  body?: string | null;
  type?: string;
  read: boolean;
  createdAt: string;
};


// ============================================
// EVENT ICONS
// ============================================

const EVENT_ICONS: Record<string, string> = {
  payment: "💳",
  order_created: "🍽️",
  order_closed: "✅",
  order_line_status: "🔔",
  info: "ℹ️",
};


// ============================================
// HEADER
// ============================================

export function Header() {
  const { user, logout } = useAuth();

  const currentUser = useUserProfile();

  const qc = useQueryClient();

  const navigate = useNavigate();

  const location = useLocation();

  const { t } = useTranslation();

  const [currentTime, setCurrentTime] = useState(new Date());

  const [showNotifications, setShowNotifications] = useState(false);

  const [showProfile, setShowProfile] = useState(false);

  const notificationRef = useRef<HTMLDivElement>(null);

  const profileRef = useRef<HTMLDivElement>(null);

  useSSENotifications();


  // ============================================
  // CLOCK
  // ============================================

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);


  // ============================================
  // CLICK OUTSIDE
  // ============================================

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(e.target as Node)
      ) {
        setShowNotifications(false);
      }

      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setShowProfile(false);
      }
    }

    document.addEventListener("mousedown", handler);

    return () => document.removeEventListener("mousedown", handler);
  }, []);


  // ============================================
  // NOTIFICATIONS
  // ============================================

  const { data: notifications = [] } = useQuery<NotificationItem[]>({
    queryKey: ["notifications"],
    queryFn: () => api.get<NotificationItem[]>("/api/notifications"),
    refetchInterval: 60000,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = useMutation({
    mutationFn: (id: number) => api.patch(`/api/notifications/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post("/api/notifications/mark-all-read", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const removeNotification = useMutation({
    mutationFn: (id: number) => api.del(`/api/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });


  // ============================================
  // HELPERS
  // ============================================

  const getInitials = (name: string) =>
    name
      ? name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : "U";

  const timeString = currentTime.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const dateString = currentTime.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });


  // ============================================
  // NOTIFICATION PANEL
  // ============================================

  const NotificationPanel = () => (
    <div className="absolute right-0 top-12 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
      <div className="p-3 border-b flex justify-between items-center">
        <h3 className="font-semibold">Notifications</h3>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <CheckCheck className="h-3 w-3 mr-1" />
            Tout marquer lu
          </Button>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Aucune notification
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              className={cn(
                "p-3 border-b hover:bg-muted/50 transition-colors",
                !notif.read && "bg-blue-50 dark:bg-blue-950/20"
              )}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {EVENT_ICONS[notif.type || "info"] || "🔔"}
                    </span>
                    <p className="font-medium text-sm">{notif.title}</p>
                  </div>
                  {notif.body && (
                    <p className="text-xs text-muted-foreground mt-1">{notif.body}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(notif.createdAt).toLocaleString("fr-FR")}
                  </p>
                </div>
                <div className="flex gap-1">
                  {!notif.read && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => markRead.mutate(notif.id)}
                      disabled={markRead.isPending}
                    >
                      <CheckCheck className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                    onClick={() => removeNotification.mutate(notif.id)}
                    disabled={removeNotification.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );


  // ============================================
  // PROFILE PANEL
  // ============================================

  const ProfilePanel = () => (
    <div className="absolute right-0 top-12 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex items-center space-x-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={currentUser?.avatar} />
            <AvatarFallback>{getInitials(currentUser?.name ?? "User")}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{currentUser?.name}</p>
            <p className="text-xs text-muted-foreground">{currentUser?.email}</p>
            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {currentUser?.role}
            </span>
          </div>
        </div>
      </div>
      <div className="p-2">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => {
            navigate("/settings");
            setShowProfile(false);
          }}
        >
          <Settings className="h-4 w-4 mr-2" />
          {t("profile.settings")}
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start text-red-600 hover:bg-red-50"
          onClick={() => {
            logout();
            setShowProfile(false);
          }}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {t("profile.logout")}
        </Button>
      </div>
    </div>
  );


  // ============================================
  // RENDER
  // ============================================

  return (
    <header
      className="h-16 border-b border-border px-4 md:px-6 flex items-center justify-between relative"
      style={{
        backgroundColor: "#1f2d69",
      }}
    >
      {/* MOBILE MENU - Utilisation du MobileSidebar */}
      <div className="md:hidden mr-2">
        <MobileSidebar />
      </div>

      {/* SEARCH - Desktop seulement */}
      <div className="hidden md:flex items-center space-x-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white h-4 w-4" />
          <Input
            placeholder={t("common.search")}
            className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/70"
          />
        </div>
      </div>

      {/* CLOCK */}
      <div className="flex flex-row justify-between items-center w-40 md:w-48 lg:w-64 mx-4">
        <div className="text-lg font-semibold text-white">{timeString}</div>
        <div className="text-sm text-white/90 capitalize hidden lg:block">
          {dateString}
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex items-center space-x-4">
        {/* NOTIFICATIONS */}
        <div className="relative" ref={notificationRef}>
          <Button
            variant="ghost"
            size="icon"
            className="relative text-white hover:bg-white/10"
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfile(false);
            }}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
                {unreadCount}
              </span>
            )}
          </Button>
          {showNotifications && <NotificationPanel />}
        </div>

        {/* PROFILE */}
        <div className="relative" ref={profileRef}>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 p-1"
            onClick={() => {
              setShowProfile(!showProfile);
              setShowNotifications(false);
            }}
          >
            <Avatar className="h-8 w-8 border-2 border-white/20">
              <AvatarImage src={currentUser?.avatar} alt={currentUser?.name ?? "User"} />
              <AvatarFallback className="bg-white/20 text-white text-sm">
                {getInitials(currentUser?.name ?? "User")}
              </AvatarFallback>
            </Avatar>
          </Button>
          {showProfile && <ProfilePanel />}
        </div>
      </div>
    </header>
  );
}