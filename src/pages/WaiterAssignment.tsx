// components/restaurant/WaiterAssignment.tsx
import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, UserPlus, UserMinus, Users, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Waiter {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Table {
  id: number;
  code: string;
  department: string;
  assignedWaiter?: Waiter;
}

interface WaiterAssignmentProps {
  tables: Table[];
  onAssignmentChange?: () => void;
}

export function WaiterAssignment({ tables, onAssignmentChange }: WaiterAssignmentProps) {
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedWaiterId, setSelectedWaiterId] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: waiters = [] } = useQuery({
    queryKey: ["restaurant", "waiters", "available"],
    queryFn: () => api.get<Waiter[]>("/restaurant/waiters"),
  });

  const { data: unassignedWaiters = [] } = useQuery({
    queryKey: ["restaurant", "waiters", "unassigned"],
    queryFn: () => api.get<Waiter[]>("/restaurant/waiters/unassigned"),
  });

  const assignWaiter = useMutation({
    mutationFn: ({ tableId, waiterId }: { tableId: number; waiterId: number | null }) =>
      api.patch(`/restaurant/tables/${tableId}/assign`, { waiterId }),
    onSuccess: () => {
      toast({ title: "✅ Serveur assigné avec succès" });
      setAssignmentDialogOpen(false);
      setSelectedTable(null);
      setSelectedWaiterId("");
      queryClient.invalidateQueries({ queryKey: ["restaurant", "tables"] });
      queryClient.invalidateQueries({ queryKey: ["restaurant", "waiters"] });
      onAssignmentChange?.();
    },
    onError: (error: any) => {
      toast({
        title: "❌ Erreur",
        description: error.response?.data?.error || "Impossible d'assigner le serveur",
        variant: "destructive",
      });
    },
  });

  const handleAssign = () => {
    if (selectedTable && selectedWaiterId) {
      assignWaiter.mutate({
        tableId: selectedTable.id,
        waiterId: parseInt(selectedWaiterId),
      });
    }
  };

  const handleUnassign = (table: Table) => {
    if (confirm(`Retirer le serveur ${table.assignedWaiter?.name} de la table ${table.code} ?`)) {
      assignWaiter.mutate({ tableId: table.id, waiterId: null });
    }
  };

  const openAssignmentDialog = (table: Table) => {
    setSelectedTable(table);
    setSelectedWaiterId(table.assignedWaiter?.id.toString() || "");
    setAssignmentDialogOpen(true);
  };

  const assignedTables   = tables.filter(t => t.assignedWaiter);
  const unassignedTables = tables.filter(t => !t.assignedWaiter);
  const uniqueWaiters    = new Set(assignedTables.map(t => t.assignedWaiter?.id)).size;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Assignment des serveurs
            </span>
            <Badge variant="outline" className="text-sm">
              {assignedTables.length}/{tables.length} tables assignées
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">

          {/* ── Résumé ── */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg p-3 text-center bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{waiters.length}</div>
              <div className="text-xs text-muted-foreground">Serveurs</div>
            </div>
            <div className="rounded-lg p-3 text-center bg-green-50 dark:bg-green-950/40 border border-green-100 dark:border-green-900">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{uniqueWaiters}</div>
              <div className="text-xs text-muted-foreground">Serveurs actifs</div>
            </div>
            <div className="rounded-lg p-3 text-center bg-orange-50 dark:bg-orange-950/40 border border-orange-100 dark:border-orange-900">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{unassignedWaiters.length}</div>
              <div className="text-xs text-muted-foreground">Non assignés</div>
            </div>
          </div>

          {/* ── Tables assignées ── */}
          {assignedTables.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                Tables assignées
              </h4>
              <div className="space-y-2">
                {assignedTables.map(table => (
                  <div
                    key={table.id}
                    className="flex items-center justify-between p-3 rounded-lg
                      bg-green-50 dark:bg-green-950/30
                      border border-green-200 dark:border-green-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="font-medium text-foreground">{table.code}</div>
                      <div className="flex items-center gap-1 text-sm text-green-700 dark:text-green-400">
                        <User className="h-3 w-3" />
                        <span>{table.assignedWaiter?.name}</span>
                        <Badge variant="outline" className="text-xs ml-1">
                          {table.assignedWaiter?.role}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openAssignmentDialog(table)}>
                        <UserPlus className="h-3 w-3 mr-1" />
                        Changer
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleUnassign(table)}>
                        <UserMinus className="h-3 w-3 text-red-600 dark:text-red-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Tables non assignées ── */}
          {unassignedTables.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                Tables non assignées
              </h4>
              <div className="space-y-2">
                {unassignedTables.map(table => (
                  <div
                    key={table.id}
                    className="flex items-center justify-between p-3 rounded-lg
                      bg-orange-50 dark:bg-orange-950/30
                      border border-orange-200 dark:border-orange-800"
                  >
                    <div className="font-medium text-foreground">{table.code}</div>
                    <Button size="sm" onClick={() => openAssignmentDialog(table)}>
                      <UserPlus className="h-3 w-3 mr-1" />
                      Assigner un serveur
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tables.length === 0 && (
            <div className="text-center text-muted-foreground py-6">
              Aucune table disponible
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Dialogue d'assignation ── */}
      <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Assigner un serveur</DialogTitle>
            <DialogDescription>
              Table {selectedTable?.code} — Choisissez un serveur
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedWaiterId} onValueChange={setSelectedWaiterId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez un serveur" />
              </SelectTrigger>
              <SelectContent>
                {waiters.map(waiter => (
                  <SelectItem key={waiter.id} value={waiter.id.toString()}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{waiter.name}</span>
                      <Badge variant="outline" className="text-xs ml-1">
                        {waiter.role}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignmentDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleAssign} disabled={!selectedWaiterId || assignWaiter.isPending}>
                {assignWaiter.isPending ? "..." : "Assigner"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}