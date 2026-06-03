// src/pages/Index.tsx
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Users, DollarSign, TrendingUp, Clock, Utensils, Bed, Wine, Dices,
  Download, ChevronDown, FileText, Table, FileCode, FileSpreadsheet, Hotel
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/rbac";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const today = new Date().toISOString().slice(0, 10);

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { user, hasScopes } = useAuth();

  const canReadRooms = hasScopes("rooms:read");
  const canReadReservations = hasScopes("reservations:read");
  const canReadReports = hasScopes("reports:read");
  const canReadOrders = hasScopes("orders:read");

  // Rooms & Reservations
  const { data: rooms = [] } = useQuery({
    queryKey: ["hotel", "rooms"],
    queryFn: () => api.get<any[]>("/hotelrooms/rooms"),
    enabled: canReadRooms,
    refetchInterval: canReadRooms ? 10000 : false,
    refetchOnWindowFocus: canReadRooms,
    staleTime: 5000,
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ["hotel", "reservations", today],
    queryFn: () => api.get<any[]>(`/hotelrooms/reservations?date=${today}`),
    enabled: canReadReservations,
    refetchInterval: canReadReservations ? 10000 : false,
    refetchOnWindowFocus: canReadReservations,
    staleTime: 5000,
  });

  // Revenue
  const { data: revenueTotal = 0 } = useQuery({
    queryKey: ["reports", "daily-total", today],
    queryFn: async () => {
      const depts = ["hotel", "restaurant", "pub", "spa"] as const;
      const res = await Promise.all(
        depts.map((d) => api.get<{ total: number }>(`/reports/daily?dept=${d}&date=${today}`))
      );
      return res.reduce((s, r) => s + (r?.total || 0), 0);
    },
    enabled: canReadReports,
    refetchInterval: canReadReports ? 30000 : false,
    refetchOnWindowFocus: canReadReports,
    staleTime: 10000,
  });

  // Restaurant
  const { data: restaurantOrdersOpen = [] } = useQuery({
    queryKey: ["restaurant", "orders", "open"],
    queryFn: () => api.get<any[]>("/restaurant/orders?dept=restaurant&status=open"),
    enabled: canReadOrders,
    refetchInterval: canReadOrders ? 5000 : false,
    refetchOnWindowFocus: canReadOrders,
    staleTime: 2000,
  });
  const { data: restaurantTables = [] } = useQuery({
    queryKey: ["restaurant", "tables"],
    queryFn: () => api.get<any[]>("/restaurant/tables"),
    enabled: canReadOrders,
    refetchInterval: canReadOrders ? 60000 : false,
    refetchOnWindowFocus: canReadOrders,
    staleTime: 15000,
  });

  // Bar / Lounge
  const { data: barOrdersOpen = [] } = useQuery({
    queryKey: ["lounge", "orders", "open"],
    queryFn: () => api.get<any[]>("/bar/orders?status=open"),
    enabled: canReadOrders,
    refetchInterval: canReadOrders ? 5000 : false,
    refetchOnWindowFocus: canReadOrders,
    staleTime: 2000,
  });
  const { data: barTables = [] } = useQuery({
    queryKey: ["lounge", "tables"],
    queryFn: () => api.get<any[]>("/bar/tables"),
    enabled: canReadOrders,
    refetchInterval: canReadOrders ? 60000 : false,
    refetchOnWindowFocus: canReadOrders,
    staleTime: 15000,
  });

  // Casino
  const { data: casinoOrdersOpen = [] } = useQuery({
    queryKey: ["casino", "orders", "open"],
    queryFn: () => api.get<any[]>("/casino/orders?status=open"),
    enabled: canReadOrders,
    refetchInterval: canReadOrders ? 5000 : false,
    refetchOnWindowFocus: canReadOrders,
    staleTime: 2000,
  });
  const { data: casinoTables = [] } = useQuery({
    queryKey: ["casino", "tables"],
    queryFn: () => api.get<any[]>("/casino/tables"),
    enabled: canReadOrders,
    refetchInterval: canReadOrders ? 60000 : false,
    refetchOnWindowFocus: canReadOrders,
    staleTime: 15000,
  });

  // === CORRECTION: Room Service (commandes en chambre) avec les bonnes routes ===
  const { data: roomServiceOrdersOpen = [] } = useQuery({
    queryKey: ["hotel", "orders", "open"],
    queryFn: () => api.get<any[]>("/hotel/orders?status=open"),
    enabled: canReadOrders,
    refetchInterval: canReadOrders ? 5000 : false,
    refetchOnWindowFocus: canReadOrders,
    staleTime: 2000,
  });

  const { data: roomServiceAllOrders = [] } = useQuery({
    queryKey: ["hotel", "orders", "all"],
    queryFn: () => api.get<any[]>("/hotel/orders"),
    enabled: canReadOrders,
    refetchInterval: canReadOrders ? 30000 : false,
    refetchOnWindowFocus: canReadOrders,
    staleTime: 10000,
  });

  const { data: tablesOpenRoomService = [] } = useQuery({
      queryKey: ["hotel", "tables"],
      queryFn: () => api.get<any[]>("/hotel/tables"),
    });

  const { data: roomServiceTables = [] } = useQuery({
    queryKey: ["hotel", "tables"],
    queryFn: () => api.get<any[]>("/hotel/tables"),
    enabled: canReadOrders,
    refetchInterval: canReadOrders ? 60000 : false,
    refetchOnWindowFocus: canReadOrders,
    staleTime: 15000,
  });

  // Chambres avec room service actif (une commande ouverte par chambre)
  // On suppose que chaque commande contient un champ `roomNumber` ou `table.code` pour identifier la chambre
  const roomsWithActiveRoomService = new Set(
    (roomServiceOrdersOpen as any[]).map((o: any) => o.roomNumber || o.table?.code).filter(Boolean)
  ).size;

  
  const totalRooms = rooms.length;

  const totalRoomsWithRoomService = (tablesOpenRoomService as any[]).length; //Le nombre de tables dans Hotel room service, qui correspond au nombre de chambres pouvant avoir du room service actif.

  // Computed stats
  const occupiedRooms = rooms.filter((r: any) => r.status === "occupied").length;
  const occupancyRate = totalRooms ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
  const presentGuests = reservations.filter((r: any) => r.status === "checked_in").length;

  const usedTablesRestaurant = new Set(
    (restaurantOrdersOpen as any[]).map((o: any) => o.table?.code).filter(Boolean)
  ).size;
  const totalTablesRestaurant = (restaurantTables as any[]).length;

  const usedTablesBar = new Set(
    (barOrdersOpen as any[]).map((o: any) => o.table?.code).filter(Boolean)
  ).size;
  const totalTablesBar = (barTables as any[]).length;

  const usedTablesCasino = new Set(
    (casinoOrdersOpen as any[]).map((o: any) => o.table?.code).filter(Boolean)
  ).size;
  const totalTablesCasino = (casinoTables as any[]).length;

  const openOrdersCount =
    restaurantOrdersOpen.length + barOrdersOpen.length + casinoOrdersOpen.length + roomServiceOrdersOpen.length;

  const formatAr = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} Ar`;

  // Export
  const exportOptions = [
    { format: "excel", label: t('export.excel'), extension: ".xlsx", icon: FileSpreadsheet, color: "text-green-600", bgColor: "bg-green-50", hoverColor: "hover:bg-green-100" },
    { format: "csv",   label: t('export.csv'),   extension: ".csv",  icon: Table,           color: "text-blue-600",  bgColor: "bg-blue-50",  hoverColor: "hover:bg-blue-100" },
    { format: "txt",   label: t('export.txt'),   extension: ".txt",  icon: FileText,        color: "text-purple-600",bgColor: "bg-purple-50",hoverColor: "hover:bg-purple-100" },
    { format: "json",  label: t('export.json'),  extension: ".json", icon: FileCode,        color: "text-orange-600",bgColor: "bg-orange-50",hoverColor: "hover:bg-orange-100" },
  ];

  const prepareExportData = () => ({
    metadata: {
      hotelName: "Hôtel de l'Avenue",
      exportDate: new Date().toLocaleString("fr-FR"),
      periode: today,
      generatedBy: (user as any)?.name || (user as any)?.email || "Utilisateur",
    },
    statistiques: {
      presentGuests,
      revenueTotal,
      revenueTotalFormatted: formatAr(revenueTotal),
      occupancyRate,
      openOrdersCount,
      occupiedRooms,
      totalRooms,
      usedTablesRestaurant,
      totalTablesRestaurant,
      usedTablesBar,
      totalTablesBar,
      usedTablesCasino,
      totalTablesCasino,
      roomsWithActiveRoomService,
      totalRoomsWithRoomService,
      roomServiceOrdersCount: roomServiceOrdersOpen.length,
    },
  });

  const exportToCSV = (data: any) => {
    let csv = "\uFEFF";
    csv += `DASHBOARD - Hôtel de l'Avenue\nPeriode: ${data.metadata.periode}\nExporte: ${data.metadata.exportDate}\n\n`;
    csv += "Indicateur,Valeur\n";
    csv += `${t('dashboard.presentGuests')},${data.statistiques.presentGuests}\n`;
    csv += `${t('dashboard.dailyRevenue')},${data.statistiques.revenueTotal}\n`;
    csv += `${t('dashboard.occupancyRate')},${data.statistiques.occupancyRate}%\n`;
    csv += `${t('dashboard.activeOrders')},${data.statistiques.openOrdersCount}\n`;
    csv += `${t('dashboard.occupiedRooms')},${data.statistiques.occupiedRooms}/${data.statistiques.totalRooms}\n`;
    csv += `${t('dashboard.restaurantTables')},${data.statistiques.usedTablesRestaurant}/${data.statistiques.totalTablesRestaurant}\n`;
    csv += `${t('dashboard.barTables')},${data.statistiques.usedTablesBar}/${data.statistiques.totalTablesBar}\n`;
    csv += `${t('dashboard.casinoTables')},${data.statistiques.usedTablesCasino}/${data.statistiques.totalTablesCasino}\n`;
    csv += `${t('dashboard.roomServiceActive')},${data.statistiques.roomsWithActiveRoomService}/${data.statistiques.totalRoomsWithRoomService}\n`;
    csv += `${t('dashboard.roomServiceOrders')},${data.statistiques.roomServiceOrdersCount}\n`;
    saveAs(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `dashboard-${today}.csv`);
  };

  const exportToExcel = (data: any) => {
    const wb = XLSX.utils.book_new();
    const rows = [
      ["Indicateur", "Valeur"],
      [t('dashboard.presentGuests'),    data.statistiques.presentGuests],
      [t('dashboard.dailyRevenue'),     data.statistiques.revenueTotal],
      [t('dashboard.occupancyRate'),    `${data.statistiques.occupancyRate}%`],
      [t('dashboard.activeOrders'),     data.statistiques.openOrdersCount],
      [t('dashboard.occupiedRooms'),    `${data.statistiques.occupiedRooms}/${data.statistiques.totalRooms}`],
      [t('dashboard.restaurantTables'), `${data.statistiques.usedTablesRestaurant}/${data.statistiques.totalTablesRestaurant}`],
      [t('dashboard.barTables'),        `${data.statistiques.usedTablesBar}/${data.statistiques.totalTablesBar}`],
      [t('dashboard.casinoTables'),     `${data.statistiques.usedTablesCasino}/${data.statistiques.totalTablesCasino}`],
      [t('dashboard.roomServiceActive'),`${data.statistiques.roomsWithActiveRoomService}/${data.statistiques.totalRoomsWithRoomService}`],
      [t('dashboard.roomServiceOrders'), data.statistiques.roomServiceOrdersCount],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, "Dashboard");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `dashboard-${today}.xlsx`);
  };

  const exportToTXT = (data: any) => {
    const txt =
      `DASHBOARD - Hôtel de l'Avenue\n${"=".repeat(40)}\n` +
      `Periode: ${data.metadata.periode}\nExporte: ${data.metadata.exportDate}\n\n` +
      `${t('dashboard.presentGuests')}: ${data.statistiques.presentGuests}\n` +
      `${t('dashboard.dailyRevenue')}: ${data.statistiques.revenueTotalFormatted}\n` +
      `${t('dashboard.occupancyRate')}: ${data.statistiques.occupancyRate}%\n` +
      `${t('dashboard.activeOrders')}: ${data.statistiques.openOrdersCount}\n` +
      `${t('dashboard.occupiedRooms')}: ${data.statistiques.occupiedRooms}/${data.statistiques.totalRooms}\n` +
      `${t('dashboard.restaurantTables')}: ${data.statistiques.usedTablesRestaurant}/${data.statistiques.totalTablesRestaurant}\n` +
      `${t('dashboard.barTables')}: ${data.statistiques.usedTablesBar}/${data.statistiques.totalTablesBar}\n` +
      `${t('dashboard.casinoTables')}: ${data.statistiques.usedTablesCasino}/${data.statistiques.totalTablesCasino}\n` +
      `${t('dashboard.roomServiceActive')}: ${data.statistiques.roomsWithActiveRoomService}/${data.statistiques.totalRoomsWithRoomService}\n` +
      `${t('dashboard.roomServiceOrders')}: ${data.statistiques.roomServiceOrdersCount}\n`;
    saveAs(new Blob([txt], { type: "text/plain;charset=utf-8" }), `dashboard-${today}.txt`);
  };

  const exportToJSON = (data: any) => {
    saveAs(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }),
      `dashboard-${today}.json`
    );
  };

  const exportData = async (format: string) => {
    setIsExporting(true);
    setIsExportOpen(false);
    try {
      const data = prepareExportData();
      if (format === "csv")   exportToCSV(data);
      if (format === "excel") exportToExcel(data);
      if (format === "txt")   exportToTXT(data);
      if (format === "json")  exportToJSON(data);
    } catch (e) {
      console.error("Export error:", e);
    } finally {
      setIsExporting(false);
    }
  };

  const isAdminOrManager = ["ADMIN", "MANAGER", "admin", "manager", "compta", "COMPTA"].includes(
    (user as any)?.role ?? ""
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 md:p-6">

          {/* Title + Export */}
          <div className="flex justify-between items-start mb-6 md:mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                {t('dashboard.title')}
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                {t('dashboard.subtitle')} • {t('dashboard.overview')}
              </p>
            </div>

            {isAdminOrManager && (
              <div className="relative flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => navigate("/reports")}
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>{t('dashboard.reportAndAnalysis')}</span>
                </Button>

                <button
                  onClick={() => setIsExportOpen(!isExportOpen)}
                  disabled={isExporting}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg transition-all shadow-lg font-semibold"
                >
                  {isExporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{t('export.exporting')}</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>{t('common.export')}</span>
                      <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </button>

                {isExportOpen && (
                  <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 z-10 overflow-hidden">
                    <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                      <p className="text-sm font-bold text-blue-900">{t('export.formats')}</p>
                    </div>
                    <div className="p-3 space-y-2">
                      {exportOptions.map((opt) => (
                        <button
                          key={opt.format}
                          onClick={() => exportData(opt.format)}
                          className={`flex items-center gap-3 w-full text-left p-3 rounded-lg transition-all ${opt.bgColor} ${opt.hoverColor}`}
                        >
                          <opt.icon className={`w-5 h-5 ${opt.color}`} />
                          <div>
                            <span className="font-semibold text-gray-900 text-sm">{opt.label}</span>
                            <span className="ml-2 text-xs font-mono bg-gray-100 text-gray-500 px-1 rounded">
                              {opt.extension}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Row 1 — KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
            <StatCard
              title={t('dashboard.presentGuests')}
              value={canReadReservations ? presentGuests : "—"}
              icon={Users}
              variant="default"
            />
            {canReadReports && (
              <StatCard
                title={t('dashboard.dailyRevenue')}
                value={formatAr(revenueTotal)}
                icon={DollarSign}
                variant="gold"
              />
            )}
            <StatCard
              title={t('dashboard.occupancyRate')}
              value={canReadRooms ? `${occupancyRate}%` : "—"}
              icon={TrendingUp}
              variant="success"
            />
            <StatCard
              title={t('dashboard.activeOrders')}
              value={canReadOrders ? openOrdersCount : "—"}
              icon={Clock}
              variant="warning"
            />
          </div>

          {/* Row 2 — Tables & Rooms (avec Room Service) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-6">
            <StatCard
              title={t('dashboard.occupiedRooms')}
              value={canReadRooms ? `${occupiedRooms}/${totalRooms}` : "—"}
              icon={Bed}
              variant="default"
            />
            <StatCard
              title={t('dashboard.roomServiceActive')}
              value={canReadOrders ? `${roomsWithActiveRoomService}/${totalRoomsWithRoomService}` : "—"}
              icon={Hotel}
              variant="default"
            />
            <StatCard
              title={t('dashboard.restaurantTables')}
              value={canReadOrders ? `${usedTablesRestaurant}/${totalTablesRestaurant}` : "—"}
              icon={Utensils}
              variant="default"
            />
            <StatCard
              title={t('dashboard.barTables')}
              value={canReadOrders ? `${usedTablesBar}/${totalTablesBar}` : "—"}
              icon={Wine}
              variant="default"
            />
            <StatCard
              title={t('dashboard.casinoTables')}
              value={canReadOrders ? `${usedTablesCasino}/${totalTablesCasino}` : "—"}
              icon={Dices}
              variant="default"
            />
          </div>

          {/* Row 3 — Quick actions & Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <QuickActions />
            <RecentActivity />
          </div>

        </main>
      </div>
    </div>
  );
};

export default Index;