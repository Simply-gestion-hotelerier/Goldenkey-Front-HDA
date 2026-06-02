// src/pages/reports/Reports.tsx
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, Download, FileSpreadsheet, RefreshCw,
  ShoppingBag, Hotel, Package, AlertTriangle, CheckCircle2,
  BarChart3, ChevronDown, ChevronRight, ArrowUpRight, ArrowDownRight,
  Users, DoorOpen, Building2, PieChart,
  Crown, Trophy, Wallet, UtensilsCrossed, Table2, UserCheck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useTranslation } from "react-i18next";

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return String(n);
};
const today = new Date().toISOString().slice(0, 10);
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  .toISOString().slice(0, 10);

const DEPT_COLORS: Record<string, string> = {
  restaurant: "bg-orange-100 text-orange-800",
  bar: "bg-amber-100 text-amber-800",
  lounge: "bg-purple-100 text-purple-800",
  hotel: "bg-blue-100 text-blue-800",
  casino: "bg-emerald-100 text-emerald-800",
};

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, icon: Icon, color = "blue", trend }: any) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-green-50 text-green-600 border-green-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    red: "bg-red-50 text-red-600 border-red-100",
    teal: "bg-teal-50 text-teal-600 border-teal-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    gold: "bg-yellow-50 text-yellow-600 border-yellow-100",
  };
  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-xl border ${colors[color] ?? colors.blue}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Section collapsible ────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = true }: any) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-xl overflow-hidden shadow-sm">
      <button
        className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
        onClick={() => setOpen((v: boolean) => !v)}
      >
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Icon className="w-4 h-4" /> {title}
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

// ── Top Item Row ───────────────────────────────────────────────────────────────
function TopItem({ rank, name, value, percentage, sub, icon: Icon }: any) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm
          ${rank === 1 ? "bg-yellow-100 text-yellow-600"
            : rank === 2 ? "bg-gray-100 text-gray-500"
            : rank === 3 ? "bg-amber-100 text-amber-600"
            : "bg-muted text-muted-foreground"}`}>
          {rank}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{fmt(value)} Ar</span>
            {sub && <span className="text-xs text-muted-foreground">· {sub}</span>}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-semibold text-sm">{percentage}%</div>
        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden mt-1">
          <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(percentage, 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ loading }: { loading: boolean }) {
  if (loading) return <div className="text-center py-8 text-muted-foreground text-sm">Chargement…</div>;
  return <div className="text-center py-8 text-muted-foreground text-sm">Aucune donnée pour cette période</div>;
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

export default function Reports() {
  const { t } = useTranslation();
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [activeTab, setActiveTab] = useState<"dashboard" | "rooms" | "clients" | "pos">("dashboard");
  const [exporting, setExporting] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────
  const salesQuery = useQuery({
    queryKey: ["reports", "sales", from, to],
    queryFn: () => api.get<any>(`/reports/sales?from=${from}&to=${to}&dept=all`),
    enabled: !!from && !!to,
  });

  const revenueByRoomQuery = useQuery({
    queryKey: ["reports", "revenue-by-room", from, to],
    queryFn: () => api.get<any>(`/reports/revenue-by-room?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });

  const revenueByClientQuery = useQuery({
    queryKey: ["reports", "revenue-by-client", from, to],
    queryFn: () => api.get<any>(`/reports/revenue-by-client?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });

  const revenueByPosQuery = useQuery({
    queryKey: ["reports", "revenue-by-pos", from, to],
    queryFn: () => api.get<any>(`/reports/revenue-by-pos?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });

  // NOUVELLES queries Top 5
  const topItemsQuery = useQuery({
    queryKey: ["reports", "top-items", from, to],
    queryFn: () => api.get<any>(`/reports/top-items?from=${from}&to=${to}&dept=all`),
    enabled: !!from && !!to,
  });

  const topTablesQuery = useQuery({
    queryKey: ["reports", "top-tables", from, to],
    queryFn: () => api.get<any>(`/reports/top-tables?from=${from}&to=${to}&dept=all`),
    enabled: !!from && !!to,
  });

  const topStaffQuery = useQuery({
    queryKey: ["reports", "top-staff", from, to],
    queryFn: () => api.get<any>(`/reports/top-staff?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });

  // ── Données dérivées ───────────────────────────────────────────────────────
  const salesData = salesQuery.data;
  const revenueByRoom = revenueByRoomQuery.data?.rooms ?? [];
  const revenueByClient = revenueByClientQuery.data?.clients ?? [];
  const revenueByPos = revenueByPosQuery.data?.pos ?? [];
  const topItems = (topItemsQuery.data?.items ?? []).slice(0, 5);
  const topTables = (topTablesQuery.data?.tables ?? []).slice(0, 5);
  const topStaff = (topStaffQuery.data?.staff ?? []).slice(0, 5);

  // CORRIGÉ: grandTotal depuis revenue-by-pos (source unique de vérité)
  const grandTotal = revenueByPosQuery.data?.totalRevenue
    ?? (revenueByPos.reduce((s: number, p: any) => s + p.revenue, 0));

  const restRevenue = salesData?.restaurant?.summary?.totalRevenue ?? 0;
  const barRevenue = salesData?.bar?.summary?.totalRevenue ?? 0;
  const loungeRevenue = salesData?.lounge?.summary?.totalRevenue ?? 0;
  const hotelRevenue = salesData?.hotel?.summary?.totalRevenue ?? 0;
  const casinoRevenue = salesData?.casino?.summary?.totalRevenue ?? 0;

  // CORRIGÉ: totalPaid agrégé correctement
  const totalPaid =
    (salesData?.restaurant?.summary?.totalPaid ?? 0) +
    (salesData?.bar?.summary?.totalPaid ?? 0) +
    (salesData?.lounge?.summary?.totalPaid ?? 0) +
    (salesData?.hotel?.summary?.totalPaid ?? 0) +
    casinoRevenue; // casino = appointments payés intégralement

  const totalUnpaid = Math.max(0, grandTotal - totalPaid);

  // Top 5 triés (% déjà calculés côté serveur)
  const topPos = [...revenueByPos].sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5);
  const topRooms = [...revenueByRoom].sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5);
  const topClients = [...revenueByClient].sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5);

  const isLoading =
    salesQuery.isLoading ||
    revenueByRoomQuery.isLoading ||
    revenueByClientQuery.isLoading ||
    revenueByPosQuery.isLoading;

  const refetchAll = () => {
    salesQuery.refetch();
    revenueByRoomQuery.refetch();
    revenueByClientQuery.refetch();
    revenueByPosQuery.refetch();
    topItemsQuery.refetch();
    topTablesQuery.refetch();
    topStaffQuery.refetch();
  };

  // ── Export Excel ───────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      const synthese = [
        ["RAPPORT DE RENTABILITÉ"],
        [`Période : ${from} → ${to}`],
        [`Export : ${new Date().toLocaleString("fr-FR")}`], [],
        ["CHIFFRE D'AFFAIRES PAR POINT DE VENTE"],
        ["Point de vente", "CA (Ar)", "% du total", "Commandes"],
        ...revenueByPos.map((p: any) => [p.name, p.revenue, p.percentage, p.orders]),
        [], [],
        ["CHIFFRE D'AFFAIRES PAR CHAMBRE (Top 5)"],
        ["Chambre", "Type", "CA (Ar)", "Nuits", "CA/Nuit", "%"],
        ...topRooms.map((r: any) => [r.number, r.type, r.revenue, r.nights, r.averagePerNight, r.percentage]),
        [], [],
        ["CHIFFRE D'AFFAIRES PAR CLIENT (Top 5)"],
        ["Client", "CA (Ar)", "Séjours", "CA/Séjour", "%"],
        ...topClients.map((c: any) => [c.name, c.revenue, c.stays, c.averagePerStay, c.percentage]),
        [], [],
        ["TOP 5 ARTICLES LES PLUS VENDUS"],
        ["Article", "CA (Ar)", "Qté vendue", "Prix moyen", "%"],
        ...topItems.map((i: any) => [i.name, i.revenue, i.qty, i.averagePrice, i.percentage]),
        [], [],
        ["TOP 5 TABLES LES PLUS RENTABLES"],
        ["Table", "CA (Ar)", "Commandes", "Panier moyen", "%"],
        ...topTables.map((t: any) => [t.code, t.revenue, t.orders, t.averagePerOrder, t.percentage]),
        [], [],
        ["TOP 5 STAFF PAR ENCAISSEMENT"],
        ["Opérateur", "Montant (Ar)", "Transactions", "Moy./transaction", "%"],
        ...topStaff.map((s: any) => [s.name, s.amount, s.transactions, s.averagePerTransaction, s.percentage]),
      ];

      const ws1 = XLSX.utils.aoa_to_sheet(synthese);
      XLSX.utils.book_append_sheet(wb, ws1, "Rentabilité");

      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(
        new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `rapport-rentabilite-${from}-${to}.xlsx`
      );
      toast({ title: t("reports.excelExportSuccess") });
    } catch (e) {
      toast({ title: t("reports.excelExportError"), description: String(e), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6 space-y-6">

          {/* ── Titre + Actions ── */}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <BarChart3 className="w-7 h-7 text-primary" /> {t("reports.title")}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">Dashboard de rentabilité en temps réel</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={refetchAll}>
                <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
                {isLoading ? t("common.loading") : t("common.refresh")}
              </Button>
              <Button
                size="sm"
                onClick={handleExportExcel}
                disabled={exporting}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <FileSpreadsheet className="w-4 h-4 mr-1.5" /> {t("export.excel")}
              </Button>
            </div>
          </div>

          {/* ── Filtres ── */}
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1 font-medium">{t("common.from")}</label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1 font-medium">{t("common.to")}</label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
                </div>
                <div className="flex gap-1 ml-auto">
                  {[
                    { label: "Aujourd'hui", fn: () => { setFrom(today); setTo(today); } },
                    {
                      label: "7 jours", fn: () => {
                        const d = new Date(); d.setDate(d.getDate() - 7);
                        setFrom(d.toISOString().slice(0, 10)); setTo(today);
                      }
                    },
                    { label: "Ce mois", fn: () => { setFrom(firstOfMonth); setTo(today); } },
                  ].map((q) => (
                    <Button key={q.label} variant="outline" size="sm" onClick={q.fn} className="h-9 text-xs px-3">
                      {q.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── KPIs globaux ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard label="CA Total" value={`${fmt(grandTotal)} Ar`} icon={Trophy} color="gold" sub={`${from} → ${to}`} />
            <KPICard
              label="Collecté"
              value={`${fmt(totalPaid)} Ar`}
              icon={CheckCircle2}
              color="green"
              sub={`${grandTotal > 0 ? Math.round((totalPaid / grandTotal) * 100) : 0}% encaissé`}
            />
            <KPICard
              label="Impayé"
              value={`${fmt(totalUnpaid)} Ar`}
              icon={AlertTriangle}
              color={totalUnpaid > 0 ? "red" : "green"}
            />
            <KPICard
              label="Taux d'occupation"
              value={`${revenueByRoomQuery.data?.occupancyRate ?? 0}%`}
              icon={Building2}
              color="blue"
              sub={`${revenueByRoom.length} chambre(s) actives`}
            />
          </div>

          {/* ── Onglets ── */}
          <div className="flex gap-1 border-b overflow-x-auto">
            {([
              { key: "dashboard", label: "Dashboard", icon: BarChart3 },
              { key: "rooms", label: "CA par Chambre", icon: Hotel },
              { key: "clients", label: "CA par Client", icon: Users },
              { key: "pos", label: "CA par Point de Vente", icon: ShoppingBag },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="w-4 h-4" /> {tab.label}
              </button>
            ))}
          </div>

          {/* ═══════ DASHBOARD ═══════ */}
          {activeTab === "dashboard" && (
            <div className="space-y-4">

              {/* Top 5 Points de vente */}
              <Section title="Top 5 — Points de vente les plus rentables" icon={Crown} defaultOpen>
                <div className="space-y-2">
                  {topPos.length > 0
                    ? topPos.map((p: any, idx: number) => (
                      <TopItem key={p.dept} rank={idx + 1} name={p.name} value={p.revenue}
                        percentage={p.percentage} sub={`${p.orders} commandes`} icon={ShoppingBag} />
                    ))
                    : <EmptyState loading={revenueByPosQuery.isLoading} />}
                </div>
              </Section>

              {/* Top 5 Chambres */}
              <Section title="Top 5 — Chambres génératrices de CA" icon={Hotel}>
                <div className="space-y-2">
                  {topRooms.length > 0
                    ? topRooms.map((r: any, idx: number) => (
                      <TopItem key={r.number} rank={idx + 1} name={`Chambre ${r.number}`}
                        value={r.revenue} percentage={r.percentage}
                        sub={`${r.nights} nuits · ${fmt(r.averagePerNight)} Ar/nuit`} icon={DoorOpen} />
                    ))
                    : <EmptyState loading={revenueByRoomQuery.isLoading} />}
                </div>
              </Section>

              {/* Top 5 Clients */}
              <Section title="Top 5 — Clients les plus dépensiers" icon={Crown}>
                <div className="space-y-2">
                  {topClients.length > 0
                    ? topClients.map((c: any, idx: number) => (
                      <TopItem key={c.id} rank={idx + 1} name={c.name} value={c.revenue}
                        percentage={c.percentage}
                        sub={`${c.stays} séjour(s) · ${fmt(c.averagePerStay)} Ar/séjour`} icon={Users} />
                    ))
                    : <EmptyState loading={revenueByClientQuery.isLoading} />}
                </div>
              </Section>

              {/* NOUVEAU — Top 5 Articles */}
              <Section title="Top 5 — Articles les plus vendus" icon={UtensilsCrossed} defaultOpen={false}>
                <div className="space-y-2">
                  {topItems.length > 0
                    ? topItems.map((item: any, idx: number) => (
                      <TopItem key={item.name} rank={idx + 1} name={item.name} value={item.revenue}
                        percentage={item.percentage}
                        sub={`${item.qty} unités · ${fmt(item.averagePrice)} Ar/u`} icon={Package} />
                    ))
                    : <EmptyState loading={topItemsQuery.isLoading} />}
                </div>
              </Section>

              {/* NOUVEAU — Top 5 Tables */}
              <Section title="Top 5 — Tables les plus rentables" icon={Table2} defaultOpen={false}>
                <div className="space-y-2">
                  {topTables.length > 0
                    ? topTables.map((table: any, idx: number) => (
                      <TopItem key={table.code} rank={idx + 1} name={table.code} value={table.revenue}
                        percentage={table.percentage}
                        sub={`${table.orders} commandes · panier moy. ${fmt(table.averagePerOrder)} Ar`} icon={Table2} />
                    ))
                    : <EmptyState loading={topTablesQuery.isLoading} />}
                </div>
              </Section>

              {/* NOUVEAU — Top 5 Staff */}
              <Section title="Top 5 — Staff par encaissement" icon={UserCheck} defaultOpen={false}>
                <div className="space-y-2">
                  {topStaff.length > 0
                    ? topStaff.map((s: any, idx: number) => (
                      <TopItem key={s.id} rank={idx + 1} name={s.name} value={s.amount}
                        percentage={s.percentage}
                        sub={`${s.transactions} transactions · moy. ${fmt(s.averagePerTransaction)} Ar`} icon={UserCheck} />
                    ))
                    : <EmptyState loading={topStaffQuery.isLoading} />}
                </div>
              </Section>

              {/* Répartition du CA par département */}
              <Section title="Répartition du CA par département" icon={PieChart}>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: "Restaurant", revenue: restRevenue, color: "bg-orange-500" },
                    { label: "Lounge", revenue: loungeRevenue, color: "bg-purple-500" },
                    { label: "Hôtel", revenue: hotelRevenue, color: "bg-blue-500" },
                    { label: "Casino", revenue: casinoRevenue, color: "bg-emerald-500" },
                  ].map(({ label, revenue, color }) => (
                    <div key={label} className="border rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-lg font-bold">{fmt(revenue)} Ar</p>
                      <p className="text-xs text-muted-foreground">
                        {grandTotal > 0 ? ((revenue / grandTotal) * 100).toFixed(1) : 0}%
                      </p>
                      <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                        <div
                          className={`h-full ${color} rounded-full`}
                          style={{ width: `${grandTotal > 0 ? (revenue / grandTotal) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* ═══════ CA PAR CHAMBRE ═══════ */}
          {activeTab === "rooms" && (
            <div className="space-y-4">
              {revenueByRoom.length > 0
                ? revenueByRoom.map((room: any) => (
                  <div key={room.number} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Hotel className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-lg">Chambre {room.number}</p>
                          <p className="text-xs text-muted-foreground">{room.type}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">{fmt(room.revenue)} Ar</p>
                        <p className="text-xs text-muted-foreground">
                          {room.nights} nuits · {fmt(room.averagePerNight)} Ar/nuit
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span>{room.percentage}% du CA chambres</span>
                        <span>{room.orders} réservation(s)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(room.percentage, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))
                : <EmptyState loading={revenueByRoomQuery.isLoading} />}
            </div>
          )}

          {/* ═══════ CA PAR CLIENT ═══════ */}
          {activeTab === "clients" && (
            <div className="space-y-3">
              {revenueByClient.length > 0
                ? revenueByClient.map((client: any, idx: number) => {
                  const isTop3 = idx < 3;
                  return (
                    <div key={client.id} className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${isTop3 ? "border-yellow-200 bg-yellow-50/20" : ""}`}>
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isTop3 ? "bg-yellow-100" : "bg-gray-100"}`}>
                            {isTop3 ? <Crown className="w-5 h-5 text-yellow-600" /> : <Users className="w-5 h-5 text-gray-500" />}
                          </div>
                          <div>
                            <p className="font-semibold text-lg flex items-center gap-2">
                              {client.name}
                              {isTop3 && (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Top client</span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {client.stays} séjour(s) · {client.orders} charge(s) folio
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">{fmt(client.revenue)} Ar</p>
                          <p className="text-xs text-muted-foreground">{fmt(client.averagePerStay)} Ar/séjour</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span>{client.percentage}% du CA clients</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(client.percentage, 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })
                : <EmptyState loading={revenueByClientQuery.isLoading} />}
            </div>
          )}

          {/* ═══════ CA PAR POINT DE VENTE ═══════ */}
          {activeTab === "pos" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {revenueByPos.map((pos: any) => (
                  <div key={pos.dept} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-xl ${DEPT_COLORS[pos.dept]?.split(" ")[0] ?? "bg-gray-100"}`}>
                          <ShoppingBag className="w-5 h-5" />
                        </div>
                        <span className="font-semibold text-lg">{pos.name}</span>
                      </div>
                      <Badge className={
                        pos.percentage >= 30 ? "bg-green-100 text-green-800"
                          : pos.percentage >= 15 ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                      }>
                        {pos.percentage}% du CA
                      </Badge>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-2xl font-bold text-primary">{fmt(pos.revenue)} Ar</p>
                        <p className="text-xs text-muted-foreground">{pos.orders} commandes</p>
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">{fmtCompact(pos.revenue)} Ar</p>
                    </div>
                    <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pos.percentage >= 30 ? "bg-green-500" : pos.percentage >= 15 ? "bg-yellow-500" : "bg-blue-500"}`}
                        style={{ width: `${Math.min(pos.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {revenueByPos.length === 0 && !revenueByPosQuery.isLoading && (
                  <div className="text-center py-12 text-muted-foreground col-span-2">Aucune donnée pour cette période</div>
                )}
              </div>

              {/* Tableau synthèse */}
              <Section title="Analyse des performances par point de vente" icon={TrendingUp}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="p-2 text-left">Point de vente</th>
                        <th className="p-2 text-right">CA (Ar)</th>
                        <th className="p-2 text-right">Part du CA</th>
                        <th className="p-2 text-right">Commandes</th>
                        <th className="p-2 text-right">Panier moyen</th>
                        <th className="p-2 text-center">Performance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueByPos.map((pos: any) => {
                        const avgBasket = pos.orders > 0 ? pos.revenue / pos.orders : 0;
                        return (
                          <tr key={pos.dept} className="border-b hover:bg-muted/20">
                            <td className="p-2 font-medium">{pos.name}</td>
                            <td className="p-2 text-right font-semibold">{fmt(pos.revenue)} Ar</td>
                            <td className="p-2 text-right">{pos.percentage}%</td>
                            <td className="p-2 text-right">{pos.orders}</td>
                            <td className="p-2 text-right">{fmt(avgBasket)} Ar</td>
                            <td className="p-2 text-center">
                              <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden mx-auto">
                                <div
                                  className={`h-full rounded-full ${pos.percentage >= 30 ? "bg-green-500" : pos.percentage >= 15 ? "bg-yellow-500" : "bg-blue-500"}`}
                                  style={{ width: `${Math.min(pos.percentage, 100)}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/40 font-semibold">
                        <td className="p-2">Total</td>
                        <td className="p-2 text-right">{fmt(grandTotal)} Ar</td>
                        <td className="p-2 text-right">100%</td>
                        <td className="p-2 text-right">
                          {revenueByPos.reduce((s: number, p: any) => s + p.orders, 0)}
                        </td>
                        <td className="p-2 text-right">—</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Section>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}