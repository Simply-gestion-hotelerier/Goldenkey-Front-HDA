// src/pages/hotel/HotelMenu.tsx
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  Clock,
  DollarSign,
  Edit2,
  Trash2,
  List,
  Download,
  ChevronDown,
  Table,
  FileText,
  FileCode,
  FileSpreadsheet,
  HotelIcon,
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/lib/api";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// ── Schema ────────────────────────────────────────────────────────────────────

const barDishFormSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  description: z.string().optional(),
  category: z.enum(["beverage", "breakfast", "appetizer", "main_course", "dessert", "side_dish", "snack"]),
  preparationTime: z.number().min(0, "Temps de préparation requis"),
  price: z.number().min(0, "Prix doit être positif"),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface DishIngredient {
  itemId: number;
  itemName: string;
  quantity: number;
  unit: string;
  cost: number;
  costPrice: number;
}

interface BarDish {
  id: number;
  name: string;
  description?: string;
  category: string;
  preparationTime: number;
  price: number;
  difficulty: string;
  isActive: boolean;
  ingredients: DishIngredient[];
  createdAt: string;
}

interface ItemForDish {
  id: number;
  name: string;
  sku: string;
  unit: string;
  costPrice: number;
  availableQty?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BAR_CATEGORIES = [
  { key: "beverage", label: "Boissons" },
  { key: "breakfast", label: "Petit-déjeuner" },
  { key: "appetizer", label: "Entrées" },
  { key: "main_course", label: "Plats principaux" },
  { key: "dessert", label: "Desserts" },
  { key: "side_dish", label: "Accompagnements" },
  { key: "snack", label: "Snacks / Room Service" },
];

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Facile",
  medium: "Moyen",
  hard: "Difficile",
};

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

// ── Component ─────────────────────────────────────────────────────────────────

export default function HotelMenu() {
  const { toast } = useToast();

  const [dishes, setDishes] = useState<BarDish[]>([]);
  const [items, setItems] = useState<ItemForDish[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDishDialog, setShowDishDialog] = useState(false);
  const [showIngredientDialog, setShowIngredientDialog] = useState(false);
  const [editingDish, setEditingDish] = useState<BarDish | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemForDish | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [ingredients, setIngredients] = useState<DishIngredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const dishForm = useForm<z.infer<typeof barDishFormSchema>>({
    resolver: zodResolver(barDishFormSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "beverage",
      preparationTime: 0,
      price: 0,
      difficulty: "easy",
    },
  });

  useEffect(() => {
    loadDishes();
    loadItems();
  }, []);

  const loadDishes = async () => {
    try {
      const response = await api.get<any>("/hotel/dishes");
      const data = response?.data ?? response ?? [];
      setDishes(Array.isArray(data) ? data : []);
    } catch (error) {
      toast({ title: "Erreur chargement articles hôtel", variant: "destructive" });
    }
  };

  const loadItems = async () => {
    try {
      const response = await api.get<any>("/hotel/dishes/for-hotel");
      const data = response?.data ?? response ?? [];
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      // fallback to generic items endpoint
      try {
        const response = await api.get<any>("/hotel/dishes/for-hotel");
        const data = response?.data ?? response ?? [];
        setItems(Array.isArray(data) ? data : []);
      } catch {
        setItems([]);
      }
    }
  };

  const filteredDishes = useMemo(() => {
    if (!searchTerm) return dishes;
    const q = searchTerm.toLowerCase();
    return dishes.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
    );
  }, [dishes, searchTerm]);

  const openCreateDialog = () => {
    setEditingDish(null);
    setIngredients([]);
    dishForm.reset({
      name: "",
      description: "",
      category: "beverage",
      preparationTime: 0,
      price: 0,
      difficulty: "easy",
    });
    setShowDishDialog(true);
  };

  const openEditDialog = (dish: BarDish) => {
    setEditingDish(dish);
    setIngredients([...dish.ingredients]);
    dishForm.reset({
      name: dish.name,
      description: dish.description || "",
      category: dish.category as any,
      preparationTime: dish.preparationTime,
      price: dish.price,
      difficulty: dish.difficulty as any,
    });
    setShowDishDialog(true);
  };

  const addIngredient = () => {
    if (!selectedItem || quantity <= 0) {
      toast({ title: "Sélectionnez un article et une quantité valide", variant: "destructive" });
      return;
    }
    const existing = ingredients.find((i) => i.itemId === selectedItem.id);
    if (existing) {
      setIngredients((prev) =>
        prev.map((i) =>
          i.itemId === selectedItem.id ? { ...i, quantity: i.quantity + quantity } : i
        )
      );
    } else {
      setIngredients((prev) => [
        ...prev,
        {
          itemId: selectedItem.id,
          itemName: selectedItem.name,
          quantity,
          unit: selectedItem.unit,
          cost: selectedItem.costPrice * quantity,
          costPrice: selectedItem.costPrice,
        },
      ]);
    }
    setSelectedItem(null);
    setQuantity(0);
    setShowIngredientDialog(false);
  };

  const removeIngredient = (itemId: number) => {
    setIngredients((prev) => prev.filter((i) => i.itemId !== itemId));
  };

  const onSubmit = async (values: z.infer<typeof barDishFormSchema>) => {
    setLoading(true);
    try {
      const payload = { ...values, ingredients, isActive: true };
      if (editingDish) {
        await api.patch(`/hotel/dishes/${editingDish.id}`, payload);
        toast({ title: "Article hôtel mis à jour" });
      } else {
        await api.post("/hotel/dishes", payload);
        toast({ title: "Article hôtel créé" });
      }
      setShowDishDialog(false);
      await loadDishes();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error?.response?.data?.error || String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteDish = async (id: number) => {
    if (!confirm("Supprimer cet article bar ? Les stocks seront restaurés.")) return;
    try {
      await api.del(`/bar/dishes/${id}`);
      toast({ title: "Article hôtel supprimé" });
      await loadDishes();
    } catch (error: any) {
      toast({ title: "Erreur", description: String(error), variant: "destructive" });
    }
  };

  const toggleActive = async (dish: BarDish) => {
    try {
      await api.patch(`/hotel/dishes/${dish.id}`, { isActive: !dish.isActive, ingredients: dish.ingredients });
      await loadDishes();
      toast({ title: dish.isActive ? "Article désactivé" : "Article activé" });
    } catch (error: any) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  // ── Export ──────────────────────────────────────────────────────────────────

  const handleExport = async (format: string) => {
    setExportLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const exportData = dishes.map((d) => ({
        id: d.id,
        nom: d.name,
        categorie: BAR_CATEGORIES.find((c) => c.key === d.category)?.label || d.category,
        prix: d.price,
        tempsPreparation: d.preparationTime,
        difficulte: DIFFICULTY_LABELS[d.difficulty] || d.difficulty,
        actif: d.isActive ? "Oui" : "Non",
        ingredients: d.ingredients.map((i) => `${i.itemName} (${i.quantity} ${i.unit})`).join(", "),
      }));

      if (format === "excel") {
        const wb = XLSX.utils.book_new();
        const headers = ["ID", "Nom", "Catégorie", "Prix (Ar)", "Préparation (min)", "Difficulté", "Actif", "Ingrédients"];
        const rows = exportData.map((d) => [d.id, d.nom, d.categorie, d.prix, d.tempsPreparation, d.difficulte, d.actif, d.ingredients]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        ws["!cols"] = [{ wch: 6 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 8 }, { wch: 50 }];
        XLSX.utils.book_append_sheet(wb, ws, "Carte Hôtel");
        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        saveAs(new Blob([wbout], { type: "application/octet-stream" }), `bar-carte-${today}.xlsx`);
      } else if (format === "csv") {
        let csv = "\uFEFFID,Nom,Catégorie,Prix,Préparation,Difficulté,Actif,Ingrédients\n";
        exportData.forEach((d) => {
          csv += `${d.id},"${d.nom}","${d.categorie}",${d.prix},${d.tempsPreparation},"${d.difficulte}","${d.actif}","${d.ingredients}"\n`;
        });
        saveAs(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `bar-carte-${today}.csv`);
      } else if (format === "json") {
        saveAs(new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" }), `bar-carte-${today}.json`);
      } else if (format === "txt") {
        const lines = ["=== CARTE HÔTEL / ROOM SERVICE ===", "", ...exportData.map((d) => `[${d.categorie}] ${d.nom} — ${fmt(d.prix)} Ar`)];
        saveAs(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8;" }), `bar-carte-${today}.txt`);
      }

      toast({ title: "Export réussi" });
    } catch {
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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <HotelIcon className="h-8 w-8 text-blue-700" /> Room Service / Menu Hôtel
              </h1>
              <p className="text-muted-foreground">{dishes.length} article(s)</p>
            </div>
            <div className="flex gap-2 items-center">
              {/* Export */}
              <div className="relative">
                <Button variant="outline" onClick={() => setExportOpen((v) => !v)} disabled={exportLoading}>
                  <Download className="h-4 w-4 mr-2" />
                  {exportLoading ? "Export…" : "Exporter"}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
                {exportOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <div className="p-1">
                      {exportOptions.map((opt) => {
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.format}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md ${opt.hoverColor} transition-colors`}
                            onClick={() => handleExport(opt.format)}
                          >
                            <div className={`p-1.5 rounded ${opt.bgColor}`}>
                              <Icon className={`h-4 w-4 ${opt.color}`} />
                            </div>
                            <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                            <span className="ml-auto text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{opt.extension}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              {/* New Item */}
              <Button onClick={openCreateDialog} className="bg-blue-700 hover:bg-blue-800 text-white">
                <Plus className="h-4 w-4 mr-2" /> Nouvel article
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un article…"
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Dish Cards */}
          {BAR_CATEGORIES.map(({ key, label }) => {
            const categoryDishes = filteredDishes.filter((d) => d.category === key);
            if (categoryDishes.length === 0) return null;
            return (
              <div key={key}>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span className="h-1 w-6 bg-blue-600 rounded-full inline-block" />
                  {label}
                  <Badge variant="secondary">{categoryDishes.length}</Badge>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryDishes.map((dish) => (
                    <Card key={dish.id} className={`transition-all ${!dish.isActive ? "opacity-60" : ""}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base font-semibold leading-tight">{dish.name}</CardTitle>
                          <div className="flex gap-1 shrink-0">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditDialog(dish)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deleteDish(dish.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {dish.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{dish.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-sm">
                          <span className="flex items-center gap-1 font-semibold text-purple-700">
                            <DollarSign className="h-3.5 w-3.5" />
                            {fmt(dish.price)} Ar
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {dish.preparationTime} min
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {DIFFICULTY_LABELS[dish.difficulty] || dish.difficulty}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs cursor-pointer ${dish.isActive ? "text-green-700 border-green-300 bg-green-50" : "text-red-600 border-red-300 bg-red-50"}`}
                            onClick={() => toggleActive(dish)}
                          >
                            {dish.isActive ? "Disponible" : "Indisponible"}
                          </Badge>
                        </div>
                        {dish.ingredients.length > 0 && (
                          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <List className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">
                              {dish.ingredients.map((i) => `${i.itemName} (${i.quantity} ${i.unit})`).join(", ")}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}

          {filteredDishes.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <HotelIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">Aucun article trouvé</p>
              <p className="text-sm">Créez votre premier article hôtel</p>
            </div>
          )}

        </main>
      </div>

      {/* ── Dialog Create/Edit Dish ────────────────────────────────────────── */}
      <Dialog open={showDishDialog} onOpenChange={setShowDishDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDish ? "Modifier l'article" : "Nouvel article hôtel"}</DialogTitle>
            <DialogDescription>
              {editingDish ? `Modifier "${editingDish.name}"` : "Créer un nouvel article pour la carte hôtel"}
            </DialogDescription>
          </DialogHeader>

          <Form {...dishForm}>
            <form onSubmit={dishForm.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={dishForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Nom de l'article *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Mojito, Bière pression…" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={dishForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Catégorie</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {BAR_CATEGORIES.map((c) => (
                            <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={dishForm.control}
                  name="difficulty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Difficulté</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="easy">Facile</SelectItem>
                          <SelectItem value="medium">Moyen</SelectItem>
                          <SelectItem value="hard">Difficile</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={dishForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prix (Ar) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number" min={0}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={dishForm.control}
                  name="preparationTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temps de préparation (min)</FormLabel>
                      <FormControl>
                        <Input
                          type="number" min={0}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={dishForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Description de l'article (optionnel)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Ingredients */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Ingrédients / Composants</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowIngredientDialog(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
                  </Button>
                </div>
                {ingredients.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Aucun ingrédient ajouté</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {ingredients.map((ing) => (
                      <div key={ing.itemId} className="flex items-center justify-between bg-muted/30 rounded px-3 py-1.5 text-sm">
                        <span>{ing.itemName}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{ing.quantity} {ing.unit}</span>
                          <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => removeIngredient(ing.itemId)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowDishDialog(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={loading} className="bg-blue-700 hover:bg-blue-800 text-white">
                  {loading ? "Enregistrement…" : editingDish ? "Mettre à jour" : "Créer"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Add Ingredient ─────────────────────────────────────────── */}
      <Dialog open={showIngredientDialog} onOpenChange={setShowIngredientDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un ingrédient</DialogTitle>
            <DialogDescription>Sélectionner un article du stock hôtel</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Article (stock bar)</label>
              <Select
                onValueChange={(v) => setSelectedItem(items.find((i) => i.id === Number(v)) || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un article…" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name} ({item.unit}){item.availableQty !== undefined ? ` — Stock: ${item.availableQty}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedItem && (
              <div>
                <label className="text-sm font-medium mb-1 block">Quantité ({selectedItem.unit})</label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowIngredientDialog(false)}>Annuler</Button>
              <Button onClick={addIngredient} disabled={!selectedItem || quantity <= 0}>
                Ajouter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}