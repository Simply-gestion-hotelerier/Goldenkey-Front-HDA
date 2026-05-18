// src/pages/reports/Reports.tsx
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp, Download, FileSpreadsheet, FileText, RefreshCw,
  ShoppingBag, Hotel, Sparkles, Package, AlertTriangle, CheckCircle2,
  BarChart3, Calendar, ChevronDown, ChevronRight, ArrowUpRight, ArrowDownRight,
  Printer, FileDown, Users, DoorOpen, Building2, PieChart,
  Crown, Trophy, Wallet,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState, useMemo } from "react";
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
const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR");
const today = new Date().toISOString().slice(0, 10);
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  .toISOString().slice(0, 10);

const METHOD_LBL: Record<string, string> = {
  cash: "Espèces", card: "Carte", mobile: "Mobile", bank: "Virement",
};

const DEPT_COLORS: Record<string, string> = {
  restaurant: "bg-orange-100 text-orange-800",
  bar: "bg-amber-100 text-amber-800",
  lounge: "bg-purple-100 text-purple-800",
  pub: "bg-purple-100 text-purple-800",
  hotel: "bg-blue-100 text-blue-800",
  spa: "bg-teal-100 text-teal-800",
  rooftop: "bg-indigo-100 text-indigo-800",
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
          <div className={`p-2.5 rounded-xl border ${colors[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}% {trend >= 0 ? "▲" : "▼"}
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
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Icon className="w-4 h-4" /> {title}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

// ── Top Revenue Card ───────────────────────────────────────────────────────────
function TopItem({ rank, name, value, percentage, icon: Icon }: any) {
  const rankColors = ["text-yellow-500", "text-gray-400", "text-amber-600"];
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${rank === 1 ? "bg-yellow-100 text-yellow-600" : rank === 2 ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-600"}`}>
          {rank}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{name}</span>
          </div>
          <span className="text-xs text-muted-foreground">{fmt(value)} Ar</span>
        </div>
      </div>
      <div className="text-right">
        <div className="font-semibold">{percentage}%</div>
        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden mt-1">
          <div className="h-full bg-primary rounded-full" style={{ width: `${percentage}%` }} />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

export default function Reports() {
  const { t } = useTranslation();
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [deptFilter, setDeptFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"dashboard" | "rooms" | "clients" | "pos">("dashboard");
  const [exporting, setExporting] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());

  // ── Queries ────────────────────────────────────────────────────────────────
  const salesQuery = useQuery({
    queryKey: ["reports", "sales", from, to, deptFilter],
    queryFn: () => api.get<any>(`/reports/sales?from=${from}&to=${to}&dept=${deptFilter}`),
    enabled: !!from && !!to,
  });

  // Nouvelles queries pour le dashboard de rentabilité
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

  const stockQuery = useQuery({
    queryKey: ["reports", "stock"],
    queryFn: () => api.get<any>("/reports/stock"),
  });

  const salesData = salesQuery.data;
  const revenueByRoom = revenueByRoomQuery.data?.rooms ?? [];
  const revenueByClient = revenueByClientQuery.data?.clients ?? [];
  const revenueByPos = revenueByPosQuery.data?.pos ?? [];

  // KPIs dérivés
  const restRevenue = salesData?.restaurant?.summary?.totalRevenue ?? 0;
  const barRevenue = salesData?.bar?.summary?.totalRevenue ?? 0;
  const loungeRevenue = salesData?.lounge?.summary?.totalRevenue ?? 0;
  const hotelRevenue = salesData?.hotel?.summary?.totalRevenue ?? 0;
  const spaRevenue = salesData?.spa?.summary?.totalRevenue ?? 0;
  const grandTotal = restRevenue + barRevenue + loungeRevenue + hotelRevenue + spaRevenue;
  const totalPaid = (salesData?.restaurant?.summary?.totalPaid ?? 0) +
    (salesData?.bar?.summary?.totalPaid ?? 0) +
    (salesData?.lounge?.summary?.totalPaid ?? 0) +
    (salesData?.hotel?.summary?.totalPaid ?? 0) + spaRevenue;
  const totalUnpaid = grandTotal - totalPaid;

  // Top 5 des points de vente
  const topPos = [...revenueByPos]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Top 5 des chambres
  const topRooms = [...revenueByRoom]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Top 5 des clients
  const topClients = [...revenueByClient]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const isLoading = salesQuery.isLoading || revenueByRoomQuery.isLoading || revenueByClientQuery.isLoading || revenueByPosQuery.isLoading;

  // Export Excel amélioré
  const handleExportExcel = () => {
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // Feuille 1: Synthèse
      const synthese = [
        ["RAPPORT DE RENTABILITÉ"],
        [`Période : ${from} → ${to}`],
        [`Export : ${new Date().toLocaleString("fr-FR")}`], [],
        ["CHIFFRE D'AFFAIRES PAR POINT DE VENTE"],
        ["Point de vente", "CA (Ar)", "% du total"],
        ...revenueByPos.map(p => [p.name, p.revenue, p.percentage]),
        [], [],
        ["CHIFFRE D'AFFAIRES PAR CHAMBRE"],
        ["Chambre", "CA (Ar)", "Nuits", "CA/Nuit"],
        ...revenueByRoom.map(r => [r.number, r.revenue, r.nights, r.averagePerNight]),
        [], [],
        ["CHIFFRE D'AFFAIRES PAR CLIENT"],
        ["Client", "CA (Ar)", "Séjours", "CA/Séjour"],
        ...revenueByClient.map(c => [c.name, c.revenue, c.stays, c.averagePerStay]),
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(synthese);
      XLSX.utils.book_append_sheet(wb, ws1, "Rentabilité");

      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `rapport-rentabilite-${from}-${to}.xlsx`);
      toast({ title: t('reports.excelExportSuccess') });
    } catch (e) {
      toast({ title: t('reports.excelExportError'), description: String(e), variant: "destructive" });
    } finally { setExporting(false); }
  };

  const toggleOrder = (id: number) =>
    setExpandedOrders(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

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
                <BarChart3 className="w-7 h-7 text-primary" /> {t('reports.title')}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">Dashboard de rentabilité en temps réel</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => { salesQuery.refetch(); revenueByRoomQuery.refetch(); revenueByClientQuery.refetch(); revenueByPosQuery.refetch(); }}>
                <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
                {isLoading ? t('common.loading') : t('common.refresh')}
              </Button>
              <Button size="sm" onClick={handleExportExcel} disabled={exporting}
                className="bg-green-600 hover:bg-green-700 text-white">
                <FileSpreadsheet className="w-4 h-4 mr-1.5" /> {t('export.excel')}
              </Button>
            </div>
          </div>

          {/* ── Filtres ── */}
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1 font-medium">{t('common.from')}</label>
                  <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-40" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1 font-medium">{t('common.to')}</label>
                  <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-40" />
                </div>
                <div className="flex gap-1 ml-auto">
                  {[
                    { label: "Aujourd'hui", fn: () => { setFrom(today); setTo(today); } },
                    { label: "7 jours", fn: () => { const d = new Date(); d.setDate(d.getDate() - 7); setFrom(d.toISOString().slice(0, 10)); setTo(today); } },
                    { label: "Ce mois", fn: () => { setFrom(firstOfMonth); setTo(today); } },
                  ].map(q => (
                    <Button key={q.label} variant="outline" size="sm" onClick={q.fn} className="h-9 text-xs px-3">{q.label}</Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── KPIs globaux ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard label="CA Total" value={`${fmt(grandTotal)} Ar`} icon={Trophy} color="gold" sub={`${from} → ${to}`} />
            <KPICard label="Collecté" value={`${fmt(totalPaid)} Ar`} icon={CheckCircle2} color="green" sub={`${grandTotal > 0 ? Math.round((totalPaid / grandTotal) * 100) : 0}% encaissé`} />
            <KPICard label="Impayé" value={`${fmt(totalUnpaid)} Ar`} icon={AlertTriangle} color={totalUnpaid > 0 ? "red" : "green"} />
            <KPICard label="Taux d'occupation" value={`${revenueByRoomQuery.data?.occupancyRate ?? 0}%`} icon={Building2} color="blue" />
          </div>

          {/* ── Onglets ── */}
          <div className="flex gap-1 border-b">
            {([
              { key: "dashboard", label: "Dashboard", icon: BarChart3 },
              { key: "rooms", label: "CA par Chambre", icon: Hotel },
              { key: "clients", label: "CA par Client", icon: Users },
              { key: "pos", label: "CA par Point de Vente", icon: ShoppingBag },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key
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
              <Section title="Top 5 des points de vente les plus rentables" icon={Crown} defaultOpen>
                <div className="space-y-2">
                  {topPos.map((p, idx) => (
                    <TopItem
                      key={p.name}
                      rank={idx + 1}
                      name={p.name}
                      value={p.revenue}
                      percentage={p.percentage}
                      icon={ShoppingBag}
                    />
                  ))}
                </div>
              </Section>

              {/* Top 5 Chambres */}
              <Section title="Top 5 des chambres génératrices de CA" icon={Hotel}>
                <div className="space-y-2">
                  {topRooms.map((r, idx) => (
                    <TopItem
                      key={r.number}
                      rank={idx + 1}
                      name={`Chambre ${r.number}`}
                      value={r.revenue}
                      percentage={r.percentage}
                      icon={DoorOpen}
                    />
                  ))}
                </div>
              </Section>

              {/* Top 5 Clients */}
              <Section title="Top 5 des clients les plus dépensiers" icon={Crown}>
                <div className="space-y-2">
                  {topClients.map((c, idx) => (
                    <TopItem
                      key={c.name}
                      rank={idx + 1}
                      name={c.name}
                      value={c.revenue}
                      percentage={c.percentage}
                      icon={Users}
                    />
                  ))}
                </div>
              </Section>

              {/* Répartition du CA par département */}
              <Section title="Répartition du CA par département" icon={PieChart}>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Restaurant</p>
                    <p className="text-lg font-bold">{fmt(restRevenue)} Ar</p>
                    <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-orange-500 rounded-full" style={{ width: `${grandTotal > 0 ? (restRevenue / grandTotal) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Bar</p>
                    <p className="text-lg font-bold">{fmt(barRevenue)} Ar</p>
                    <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${grandTotal > 0 ? (barRevenue / grandTotal) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Lounge</p>
                    <p className="text-lg font-bold">{fmt(loungeRevenue)} Ar</p>
                    <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${grandTotal > 0 ? (loungeRevenue / grandTotal) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Hôtel</p>
                    <p className="text-lg font-bold">{fmt(hotelRevenue)} Ar</p>
                    <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${grandTotal > 0 ? (hotelRevenue / grandTotal) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Spa</p>
                    <p className="text-lg font-bold">{fmt(spaRevenue)} Ar</p>
                    <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full" style={{ width: `${grandTotal > 0 ? (spaRevenue / grandTotal) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              </Section>
            </div>
          )}

          {/* ═══════ CA PAR CHAMBRE ═══════ */}
          {activeTab === "rooms" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {revenueByRoom.map((room: any) => {
                  const percentage = grandTotal > 0 ? (room.revenue / grandTotal) * 100 : 0;
                  return (
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
                          <p className="text-xs text-muted-foreground">{room.nights} nuits · {fmt(room.averagePerNight)} Ar/nuit</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span>{percentage.toFixed(1)}% du CA total</span>
                          <span>{room.orders} commandes</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percentage}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {revenueByRoom.length === 0 && !revenueByRoomQuery.isLoading && (
                  <div className="text-center py-12 text-muted-foreground">Aucune donnée pour cette période</div>
                )}
              </div>
            </div>
          )}

          {/* ═══════ CA PAR CLIENT ═══════ */}
          {activeTab === "clients" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {revenueByClient.map((client: any, idx: number) => {
                  const percentage = grandTotal > 0 ? (client.revenue / grandTotal) * 100 : 0;
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
                              {isTop3 && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Top client</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">{client.stays} séjour(s)</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">{fmt(client.revenue)} Ar</p>
                          <p className="text-xs text-muted-foreground">{fmt(client.averagePerStay)} Ar/séjour</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span>{percentage.toFixed(1)}% du CA total</span>
                          <span>{client.orders} commandes</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${percentage}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {revenueByClient.length === 0 && !revenueByClientQuery.isLoading && (
                  <div className="text-center py-12 text-muted-foreground">Aucune donnée pour cette période</div>
                )}
              </div>
            </div>
          )}

          {/* ═══════ CA PAR POINT DE VENTE ═══════ */}
          {activeTab === "pos" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {revenueByPos.map((pos: any) => {
                  const percentage = grandTotal > 0 ? (pos.revenue / grandTotal) * 100 : 0;
                  const IconComponent = pos.name === "Restaurant" ? ShoppingBag : pos.name === "Bar" ? Wine : pos.name === "Lounge" ? Coffee : Hotel;
                  return (
                    <div key={pos.name} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-xl ${DEPT_COLORS[pos.name.toLowerCase()]?.split(" ")[0] ?? "bg-gray-100"}`}>
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <span className="font-semibold text-lg">{pos.name}</span>
                        </div>
                        <Badge className={percentage >= 30 ? "bg-green-100 text-green-800" : percentage >= 15 ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-800"}>
                          {percentage.toFixed(1)}% du CA
                        </Badge>
                      </div>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-2xl font-bold text-primary">{fmt(pos.revenue)} Ar</p>
                          <p className="text-xs text-muted-foreground">{pos.orders} commandes</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{fmtCompact(pos.revenue)} Ar</p>
                          <p className="text-xs text-muted-foreground">CA total</p>
                        </div>
                      </div>
                      <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${percentage >= 30 ? "bg-green-500" : percentage >= 15 ? "bg-yellow-500" : "bg-blue-500"}`} style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
                {revenueByPos.length === 0 && !revenueByPosQuery.isLoading && (
                  <div className="text-center py-12 text-muted-foreground col-span-2">Aucune donnée pour cette période</div>
                )}
              </div>

              {/* Résumé des performances par point de vente */}
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
                        const percentage = grandTotal > 0 ? (pos.revenue / grandTotal) * 100 : 0;
                        const avgBasket = pos.orders > 0 ? pos.revenue / pos.orders : 0;
                        return (
                          <tr key={pos.name} className="border-b hover:bg-muted/20">
                            <td className="p-2 font-medium">{pos.name}</td>
                            <td className="p-2 text-right font-semibold">{fmt(pos.revenue)} Ar</td>
                            <td className="p-2 text-right">{percentage.toFixed(1)}%</td>
                            <td className="p-2 text-right">{pos.orders}</td>
                            <td className="p-2 text-right">{fmt(avgBasket)} Ar</td>
                            <td className="p-2 text-center">
                              <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden mx-auto">
                                <div className={`h-full rounded-full ${percentage >= 30 ? "bg-green-500" : percentage >= 15 ? "bg-yellow-500" : "bg-blue-500"}`} style={{ width: `${percentage}%` }} />
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
                        <td className="p-2 text-right">-</td>
                        <td className="p-2 text-right">-</td>
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