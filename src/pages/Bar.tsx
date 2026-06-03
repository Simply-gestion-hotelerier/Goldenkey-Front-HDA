// src/pages/bar/Bar.tsx
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Wine,
  Clock,
  CheckCircle,
  Package,
  DollarSign,
  ClipboardList,
  Trash2,
  Download,
  ChevronDown,
  FileText,
  Table,
  FileCode,
  FileSpreadsheet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

const Bar = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [exportOpen, setExportOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const { data: openOrders = [] } = useQuery({
    queryKey: ["lounge", "orders", "open"],
    queryFn: () => api.get<any[]>("/bar/orders?status=open"),
  });

  const { data: allOrders = [] } = useQuery({
    queryKey: ["lounge", "orders", "all"],
    queryFn: () => api.get<any[]>("/bar/orders"),
  });

  const { data: tables = [] } = useQuery({
    queryKey: ["lounge", "tables"],
    queryFn: () => api.get<any[]>("/bar/tables"),
  });

  const reportsToday = useQuery({
    queryKey: ["reports", "daily", "lounge"],
    queryFn: () =>
      api.get<any>(`/reports/daily?dept=lounge&date=${new Date().toISOString().slice(0, 10)}`),
  });

  const deleteOrder = useMutation({
    mutationFn: (id: number) => api.del(`/bar/orders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lounge", "orders", "all"] });
      toast({ title: "Commande supprimée" });
    },
    onError: (e: any) =>
      toast({ title: "Erreur", description: String(e), variant: "destructive" }),
  });

  const closeOrder = useMutation({
    mutationFn: (orderId: number) => api.post(`/bar/orders/${orderId}/close`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lounge", "orders", "open"] });
      qc.invalidateQueries({ queryKey: ["lounge", "orders", "all"] });
      toast({ title: "Commande fermée" });
    },
    onError: (e: any) =>
      toast({ title: "Erreur", description: String(e), variant: "destructive" }),
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      open: "bg-warning/10 text-warning border-warning/20",
      closed: "bg-success/10 text-success border-success/20",
      cancelled: "bg-muted text-muted-foreground border-muted",
    };
    const labels: Record<string, string> = {
      open: "Active",
      closed: "Fermée",
      cancelled: "Annulée",
    };
    return (
      <Badge variant="outline" className={styles[status] || styles.open}>
        {labels[status] || labels.open}
      </Badge>
    );
  };

  const occupiedTableCodes = Array.from(
    new Set((openOrders as any[]).map((o: any) => o.table?.code).filter(Boolean))
  );
  const totalTables = (tables as any[]).length;
  const activeOrders = (openOrders as any[]).length;
  const dailyRevenue = (reportsToday.data as any)?.total ?? 0;
  const drinksServed = (allOrders as any[])
    .filter((o: any) => o.status === "closed")
    .reduce(
      (sum: number, o: any) =>
        sum + ((o.lines as any[])?.reduce((s: number, l: any) => s + (l.qty || 0), 0) || 0),
      0
    );

  const prepareExportData = () => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      metadata: {
        exportDate: new Date().toLocaleString("fr-FR"),
        periode: today,
        totalCommandes: (allOrders as any[]).length,
      },
      statistiques: {
        tablesOccupees: occupiedTableCodes.length,
        totalTables,
        commandesActives: activeOrders,
        caJournalier: dailyRevenue,
        articlesServis: drinksServed,
      },
      commandesActives: (openOrders as any[]).map((o: any) => ({
        id: o.id,
        table: o.table?.code || "N/A",
        statut: "Active",
        articles: (o.lines as any[])?.map((l: any) => `${l.itemName} × ${l.qty}`).join(", ") || "",
        total:
          (o.lines as any[])?.reduce((s: number, l: any) => s + (l.unitPrice || 0) * l.qty, 0) ||
          0,
        heure: new Date(o.openedAt || Date.now()).toLocaleTimeString("fr-FR"),
        date: new Date(o.openedAt || Date.now()).toLocaleDateString("fr-FR"),
      })),
      commandesFermees: (allOrders as any[])
        .filter((o: any) => o.status === "closed")
        .map((o: any) => ({
          id: o.id,
          table: o.table?.code || "N/A",
          statut: "Fermée",
          articles:
            (o.lines as any[])?.map((l: any) => `${l.itemName} × ${l.qty}`).join(", ") || "",
          total:
            (o.lines as any[])?.reduce(
              (s: number, l: any) => s + (l.unitPrice || 0) * l.qty,
              0
            ) || 0,
          heure: new Date(o.closedAt || Date.now()).toLocaleTimeString("fr-FR"),
          date: new Date(o.closedAt || Date.now()).toLocaleDateString("fr-FR"),
        })),
    };
  };

  const handleExport = async (format: string) => {
    setExportLoading(true);
    try {
      const data = prepareExportData();
      const today = new Date().toISOString().slice(0, 10);

      if (format === "excel") {
        const wb = XLSX.utils.book_new();
        const synthData = [
          ["Rapport Bar", ""],
          ["Période", data.metadata.periode],
          ["Export", data.metadata.exportDate],
          ["Total commandes", data.metadata.totalCommandes],
          ["", ""],
          ["Tables occupées", `${data.statistiques.tablesOccupees}/${data.statistiques.totalTables}`],
          ["Commandes actives", data.statistiques.commandesActives],
          ["CA Journalier", data.statistiques.caJournalier],
          ["Articles servis", data.statistiques.articlesServis],
        ];
        const wsS = XLSX.utils.aoa_to_sheet(synthData);
        wsS["!cols"] = [{ wch: 25 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, wsS, "Synthèse");

        const headers = ["ID", "Table", "Statut", "Articles", "Total (Ar)", "Heure", "Date"];
        const activesData = data.commandesActives.map((c) => [
          c.id, c.table, c.statut, c.articles, c.total, c.heure, c.date,
        ]);
        const wsA = XLSX.utils.aoa_to_sheet([headers, ...activesData]);
        wsA["!cols"] = [{ wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, wsA, "Commandes actives");

        const fermeesData = data.commandesFermees.slice(0, 100).map((c) => [
          c.id, c.table, c.statut, c.articles, c.total, c.heure, c.date,
        ]);
        const wsF = XLSX.utils.aoa_to_sheet([headers, ...fermeesData]);
        XLSX.utils.book_append_sheet(wb, wsF, "Commandes fermées");

        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        saveAs(new Blob([wbout], { type: "application/octet-stream" }), `bar-rapport-${today}.xlsx`);
      } else if (format === "csv") {
        let csv = "\uFEFFRapport Bar\n";
        csv += `Période,${data.metadata.periode}\nExport,${data.metadata.exportDate}\n\n`;
        csv += "ID,Table,Statut,Articles,Total,Heure,Date\n";
        [...data.commandesActives, ...data.commandesFermees].forEach((c) => {
          csv += `${c.id},${c.table},${c.statut},"${c.articles}",${c.total},${c.heure},${c.date}\n`;
        });
        saveAs(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `bar-rapport-${today}.csv`);
      } else if (format === "json") {
        saveAs(
          new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
          `bar-rapport-${today}.json`
        );
      } else if (format === "txt") {
        const lines = [
          "========================================",
          "         RAPPORT BAR",
          `Période: ${data.metadata.periode}`,
          `Export: ${data.metadata.exportDate}`,
          "========================================",
          `Tables occupées : ${data.statistiques.tablesOccupees}/${data.statistiques.totalTables}`,
          `Commandes actives : ${data.statistiques.commandesActives}`,
          `CA Journalier : ${fmt(data.statistiques.caJournalier)} Ar`,
          `Articles servis : ${data.statistiques.articlesServis}`,
          "----------------------------------------",
          ...data.commandesActives.map(
            (c) => `[${c.id}] ${c.table} | ${c.articles} | ${fmt(c.total)} Ar`
          ),
        ];
        saveAs(
          new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8;" }),
          `bar-rapport-${today}.txt`
        );
      }

      toast({ title: "Export réussi" });
    } catch (e) {
      toast({ title: "Erreur export", variant: "destructive" });
    } finally {
      setExportLoading(false);
      setExportOpen(false);
    }
  };

  const exportOptions = [
    { format: "excel", label: "Excel", extension: ".xlsx", icon: FileSpreadsheet, color: "text-green-600", bgColor: "bg-green-50", hoverColor: "hover:bg-green-100" },
    { format: "csv", label: "CSV", extension: ".csv", icon: Table, color: "text-blue-600", bgColor: "bg-blue-50", hoverColor: "hover:bg-blue-100" },
    { format: "txt", label: "TXT", extension: ".txt", icon: FileText, color: "text-purple-600", bgColor: "bg-purple-50", hoverColor: "hover:bg-purple-100" },
    { format: "json", label: "JSON", extension: ".json", icon: FileCode, color: "text-orange-600", bgColor: "bg-orange-50", hoverColor: "hover:bg-orange-100" },
  ];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Wine className="h-8 w-8 text-purple-600" /> Lounge Bar
              </h1>
              <p className="text-muted-foreground">Tableau de bord du bar</p>
            </div>
            <div className="relative">
              <Button
                variant="outline"
                onClick={() => setExportOpen((v) => !v)}
                disabled={exportLoading}
              >
                <Download className="h-4 w-4 mr-2" />
                {exportLoading ? "Export…" : "Exporter"}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
              {exportOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="p-2 border-b border-gray-100">
                    <p className="text-xs text-gray-500 font-medium px-2">Format d'export</p>
                  </div>
                  <div className="p-1">
                    {exportOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.format}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md ${option.hoverColor} transition-colors`}
                          onClick={() => handleExport(option.format)}
                        >
                          <div className={`p-1.5 rounded ${option.bgColor}`}>
                            <Icon className={`h-4 w-4 ${option.color}`} />
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-700">{option.label}</span>
                              <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{option.extension}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                    <p className="text-xs text-gray-500 text-center">{(allOrders as any[]).length} commandes</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Tables occupées"
              value={`${occupiedTableCodes.length}/${totalTables}`}
              icon={Wine}
              variant="default"
            />
            <StatCard
              title="Commandes actives"
              value={String(activeOrders)}
              icon={Clock}
              variant="warning"
            />
            <StatCard
              title="CA Journalier"
              value={`${fmt(dailyRevenue)} Ar`}
              icon={DollarSign}
              variant="gold"
            />
            <StatCard
              title="Articles servis"
              value={String(drinksServed)}
              icon={CheckCircle}
              variant="success"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions rapides</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/bar/pos")}>
                  <ClipboardList className="mr-2 h-4 w-4" /> Nouvelle commande
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/bar/menu")}>
                  <Wine className="mr-2 h-4 w-4" /> Carte du bar
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/inventory")}>
                  <Package className="mr-2 h-4 w-4" /> Inventaire
                </Button>
              </CardContent>
            </Card>

            {/* Active Orders */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Commandes actives</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(openOrders as any[]).map((order: any) => (
                    <div key={order.id} className="p-4 border border-border rounded-lg hover:shadow-elegant transition-all duration-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Wine className="h-4 w-4 text-purple-600" />
                          <span className="font-semibold">
                            {order.id} - {order.table?.code || "N/A"}
                          </span>
                        </div>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        {(order.lines as any[])?.map((l: any) => `${l.itemName} × ${l.qty}`).join(", ")}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {new Date(order.openedAt || Date.now()).toLocaleTimeString("fr-FR")}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gold">
                            {fmt(
                              (order.lines as any[])?.reduce(
                                (s: number, l: any) => s + (l.unitPrice || 0) * l.qty,
                                0
                              ) || 0
                            )}{" "}
                            Ar
                          </span>
                          <Button size="sm" variant="outline" onClick={() => closeOrder.mutate(order.id)}>
                            Fermer
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(openOrders as any[]).length === 0 && (
                    <div className="text-sm text-muted-foreground">Aucune commande active</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Closed Orders */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Commandes fermées</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(allOrders as any[])
                    .filter((o: any) => o.status === "closed")
                    .slice(0, 20)
                    .map((order: any) => (
                      <div key={order.id} className="p-4 border border-border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Wine className="h-4 w-4 text-success" />
                            <span className="font-semibold">
                              {order.id} - {order.table?.code || "N/A"}
                            </span>
                          </div>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">
                          {(order.lines as any[])?.map((l: any) => `${l.itemName} × ${l.qty}`).join(", ")}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {new Date(order.closedAt || Date.now()).toLocaleString("fr-FR")}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold">
                              {fmt(
                                (order.lines as any[])?.reduce(
                                  (s: number, l: any) => s + (l.unitPrice || 0) * l.qty,
                                  0
                                ) || 0
                              )}{" "}
                              Ar
                            </span>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm("Supprimer cette commande ?")) deleteOrder.mutate(order.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-1" /> Supprimer
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  {(allOrders as any[]).filter((o: any) => o.status === "closed").length === 0 && (
                    <div className="text-sm text-muted-foreground">Aucune commande fermée</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Bar;