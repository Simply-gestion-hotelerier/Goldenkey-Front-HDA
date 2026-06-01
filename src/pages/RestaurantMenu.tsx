// src/pages/restaurant/RestaurantMenu.tsx
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Utensils, Clock, DollarSign, Edit2, Trash2, List, Download, ChevronDown, Table, FileText, FileCode, FileSpreadsheet } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/lib/api";
import { useTranslation } from "react-i18next";

// Schema de validation frontend
const dishFormSchema = z.object({
  name: z.string().min(1, "Le nom du plat est requis"),
  description: z.string().optional(),
  category: z.enum(["appetizer", "main_course", "dessert", "beverage", "side_dish", "dejeuner", "snack"]),
  preparationTime: z.number().min(1, "Le temps de préparation est requis"),
  price: z.number().min(0, "Le prix doit être positif"),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

// Types
interface DishIngredient {
  itemId: number;
  itemName: string;
  quantity: number;
  unit: string;
  cost: number;
  costPrice: number;
}

interface Dish {
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

export default function RestaurantMenu() {
  const { t } = useTranslation();
  const { toast } = useToast();

  // États locaux
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [items, setItems] = useState<ItemForDish[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDishDialog, setShowDishDialog] = useState(false);
  const [showIngredientDialog, setShowIngredientDialog] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemForDish | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [quantityInput, setQuantityInput] = useState<string>("");
  const [ingredients, setIngredients] = useState<DishIngredient[]>([]);
  const [loading, setLoading] = useState(false);

  // États pour l'exportation
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportMenuLoading, setExportMenuLoading] = useState(false);

  // Form setup
  const dishForm = useForm<z.infer<typeof dishFormSchema>>({
    resolver: zodResolver(dishFormSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "main_course",
      preparationTime: 0,
      price: 0,
      difficulty: "medium",
    }
  });

  // Charger les données au montage du composant
  useEffect(() => {
    loadDishes();
    loadItems();
  }, []);

  // Validation de la saisie de quantité
  const isQuantityInputValid = (value: string): boolean => {
    if (value === "" || value === ".") return false;
    return /^\d+\.?\d*$/.test(value) && parseFloat(value) > 0;
  };

  const getQuantityErrorMessage = (): string | null => {
    if (quantityInput === "") return null;
    if (!/^\d*\.?\d*$/.test(quantityInput) || quantityInput === ".") {
      return t('restaurant.invalidQuantity') || "Quantité invalide";
    }
    if (/^\d+\.?\d*$/.test(quantityInput) && parseFloat(quantityInput) <= 0) {
      return t('restaurant.quantityMustBePositive') || "La quantité doit être supérieure à 0";
    }
    return null;
  };

  // Fonction de téléchargement de fichier
  const telechargerFichier = (contenu: string, nomFichier: string, typeMime: string) => {
    const blob = new Blob([contenu], { type: typeMime });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = nomFichier;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  };

  // Fonctions d'exportation des plats
  const exporterPlats = async (formatType: string) => {
    if (dishes.length === 0) {
      toast({ title: t('export.noDataToExport'), variant: "destructive" });
      return;
    }

    setExportMenuLoading(true);
    setExportMenuOpen(false);

    try {
      const aujourdhui = new Date().toISOString().slice(0, 10);

      const donneesPlats = dishes.map((plat: Dish) => {
        const { totalCost, profitMargin } = calculateDishStats(plat);
        return {
          nom: plat.name,
          description: plat.description || '',
          categorie: plat.category,
          categorieFormatee: getCategoryLabel(plat.category),
          tempsPreparation: plat.preparationTime,
          prix: plat.price,
          prixFormate: `${new Intl.NumberFormat('fr-FR').format(plat.price)} Ar`,
          difficulte: plat.difficulty,
          difficulteFormatee: getDifficultyLabel(plat.difficulty),
          statut: plat.isActive ? t('common.active') : t('common.inactive'),
          nombreIngredients: plat.ingredients?.length || 0,
          coutIngredients: totalCost,
          coutIngredientsFormate: `${new Intl.NumberFormat('fr-FR').format(totalCost)} Ar`,
          marge: profitMargin,
          margeFormatee: `${profitMargin.toFixed(1)}%`,
          dateCreation: new Date(plat.createdAt).toLocaleDateString('fr-FR')
        };
      });

      const statistiques = {
        totalPlats: dishes.length,
        platsActifs: dishes.filter((p: Dish) => p.isActive).length,
        platsInactifs: dishes.filter((p: Dish) => !p.isActive).length,
        prixMoyen: dishes.reduce((sum: number, p: Dish) => sum + p.price, 0) / dishes.length,
        ingredientsTotal: dishes.reduce((sum: number, p: Dish) => sum + (p.ingredients?.length || 0), 0),
        dateExport: new Date().toLocaleString('fr-FR')
      };

      switch (formatType) {
        case 'excel':
          exporterPlatsExcel(donneesPlats, statistiques, aujourdhui);
          break;
        case 'csv':
          exporterPlatsCSV(donneesPlats, statistiques, aujourdhui);
          break;
        case 'txt':
          exporterPlatsTXT(donneesPlats, statistiques, aujourdhui);
          break;
        case 'json':
          exporterPlatsJSON(donneesPlats, statistiques, aujourdhui);
          break;
        default:
          break;
      }
    } catch (erreur) {
      console.error('Export error:', erreur);
      toast({ title: t('export.exportError'), description: String(erreur), variant: 'destructive' });
    } finally {
      setExportMenuLoading(false);
    }
  };

  const exporterPlatsCSV = (donnees: any[], statistiques: any, date: string) => {
    const entetes = [
      t('restaurant.dishName'),
      t('common.description'),
      t('restaurant.category'),
      t('restaurant.preparationTimeMin'),
      `${t('restaurant.price')} (Ar)`,
      t('restaurant.difficulty'),
      t('common.status'),
      t('restaurant.ingredientsCount'),
      `${t('restaurant.ingredientsCost')} (Ar)`,
      `${t('restaurant.margin')} (%)`,
      t('common.createdAt')
    ];

    const lignes = donnees.map(plat => [
      `"${plat.nom}"`,
      `"${plat.description}"`,
      `"${plat.categorieFormatee}"`,
      plat.tempsPreparation,
      plat.prix,
      `"${plat.difficulteFormatee}"`,
      `"${plat.statut}"`,
      plat.nombreIngredients,
      plat.coutIngredients,
      plat.marge,
      `"${plat.dateCreation}"`
    ]);

    const contenuCSV = [entetes.join(','), ...lignes.map(ligne => ligne.join(','))].join('\n');
    telechargerFichier(contenuCSV, `restaurant-dishes-${date}.csv`, 'text/csv');
    toast({ title: t('export.csv'), description: t('restaurant.exportSuccess') });
  };

  const exporterPlatsExcel = async (donnees: any[], statistiques: any, date: string) => {
    const entetes = [
      t('restaurant.dishName'),
      t('common.description'),
      t('restaurant.category'),
      t('restaurant.preparationTimeMin'),
      `${t('restaurant.price')} (Ar)`,
      t('restaurant.difficulty'),
      t('common.status'),
      t('restaurant.ingredientsCount'),
      `${t('restaurant.ingredientsCost')} (Ar)`,
      `${t('restaurant.margin')} (%)`,
      t('common.createdAt')
    ];

    const lignes = donnees.map(plat => [
      plat.nom,
      plat.description,
      plat.categorieFormatee,
      plat.tempsPreparation,
      plat.prix,
      plat.difficulteFormatee,
      plat.statut,
      plat.nombreIngredients,
      plat.coutIngredients,
      plat.marge,
      plat.dateCreation
    ]);

    const contenuExcel = [entetes.join('\t'), ...lignes.map(ligne => ligne.join('\t'))].join('\n');
    telechargerFichier(contenuExcel, `restaurant-dishes-${date}.xls`, 'application/vnd.ms-excel');
    toast({ title: t('export.excel'), description: t('restaurant.exportSuccess') });
  };

  const exporterPlatsTXT = (donnees: any[], statistiques: any, date: string) => {
    const contenuTexte = `
${t('restaurant.dishReport')}
${"=".repeat(40)}

${t('restaurant.generationDate')}: ${statistiques.dateExport}

${t('restaurant.statistics')}:
=============
• ${t('restaurant.totalDishes')}: ${statistiques.totalPlats}
• ${t('restaurant.activeDishes')}: ${statistiques.platsActifs}
• ${t('restaurant.inactiveDishes')}: ${statistiques.platsInactifs}
• ${t('restaurant.averagePrice')}: ${new Intl.NumberFormat('fr-FR').format(statistiques.prixMoyen)} Ar
• ${t('restaurant.totalIngredients')}: ${statistiques.ingredientsTotal}

${t('restaurant.dishList')}:
================
${donnees.map((plat, index) => `
${index + 1}. ${plat.nom}
    ${t('restaurant.category')}: ${plat.categorieFormatee}
    ${t('common.description')}: ${plat.description || t('common.none')}
    ${t('restaurant.preparationTime')}: ${plat.tempsPreparation} min
    ${t('restaurant.price')}: ${plat.prixFormate}
    ${t('restaurant.difficulty')}: ${plat.difficulteFormatee}
    ${t('common.status')}: ${plat.statut}
    ${t('restaurant.ingredients')}: ${plat.nombreIngredients}
    ${t('restaurant.ingredientsCost')}: ${plat.coutIngredientsFormate}
    ${t('restaurant.margin')}: ${plat.margeFormatee}
    ${t('common.createdAt')}: ${plat.dateCreation}
`).join('\n')}

---
${t('restaurant.reportFooter')}
    `.trim();

    telechargerFichier(contenuTexte, `restaurant-dishes-${date}.txt`, 'text/plain');
    toast({ title: t('export.txt'), description: t('restaurant.exportSuccess') });
  };

  const exporterPlatsJSON = (donnees: any[], statistiques: any, date: string) => {
    const donneesJSON = {
      restaurant: t('restaurant.hotelName'),
      exportDate: new Date().toISOString(),
      statistiques: {
        totalPlats: statistiques.totalPlats,
        platsActifs: statistiques.platsActifs,
        platsInactifs: statistiques.platsInactifs,
        prixMoyen: Math.round(statistiques.prixMoyen),
        totalIngredients: statistiques.ingredientsTotal
      },
      plats: donnees
    };

    telechargerFichier(JSON.stringify(donneesJSON, null, 2), `restaurant-dishes-${date}.json`, 'application/json');
    toast({ title: t('export.json'), description: t('restaurant.exportSuccess') });
  };

  // Fonctions utilitaires pour les labels
  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      appetizer: t('restaurant.categoryAppetizer'),
      main_course: t('restaurant.categoryMainCourse'),
      dessert: t('restaurant.categoryDessert'),
      beverage: t('restaurant.categoryBeverage'),
      side_dish: t('restaurant.categorySideDish'),
      dejeuner: t('restaurant.categoryBreakfast'),
      snack: t('restaurant.categorySnack')
    };
    return labels[category] || category;
  };

  const getDifficultyLabel = (difficulty: string): string => {
    const labels: Record<string, string> = {
      easy: t('restaurant.difficultyEasy'),
      medium: t('restaurant.difficultyMedium'),
      hard: t('restaurant.difficultyHard')
    };
    return labels[difficulty] || difficulty;
  };

  const DISH_CATEGORIES = [
    { key: "appetizer",   label: t('restaurant.categoryAppetizer') },
    { key: "main_course", label: t('restaurant.categoryMainCourse') },
    { key: "dessert",     label: t('restaurant.categoryDessert') },
    { key: "beverage",    label: t('restaurant.categoryBeverage') },
    { key: "side_dish",   label: t('restaurant.categorySideDish') },
    { key: "dejeuner",    label: t('restaurant.categoryBreakfast') },
    { key: "snack",       label: t('restaurant.categorySnack') },
  ];

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

  // Fonction pour calculer le coût total des ingrédients
  const calculateTotalCost = (ingredients: DishIngredient[]): number => {
    return ingredients.reduce((total, ingredient) => total + ingredient.cost, 0);
  };

  const loadDishes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dishes');
      
      let dishesData = [];
      if (Array.isArray(response.data?.data)) {
        dishesData = response.data.data;
      } else if (Array.isArray(response.data)) {
        dishesData = response.data;
      } else {
        dishesData = [];
      }

      setDishes(dishesData);
    } catch (error) {
      console.error('Error loading dishes:', error);
      toast({
        title: t('common.error'),
        description: t('restaurant.loadDishesError'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dishes/for-dishes');
      
      let itemsData;
      if (response.data && Array.isArray(response.data.data)) {
        itemsData = response.data.data;
      } else if (Array.isArray(response.data)) {
        itemsData = response.data;
      } else {
        itemsData = response.data?.data || response.data || [];
      }

      const itemsForDish: ItemForDish[] = itemsData.map((item: any) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        costPrice: Number(item.costPrice) || 0,
        availableQty: item.availableQty !== undefined ? Number(item.availableQty) : undefined,
      }));

      setItems(itemsForDish);
    } catch (error) {
      console.error('Error loading items:', error);
      toast({
        title: t('common.error'),
        description: t('restaurant.loadItemsError'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Filtrer les plats par recherche
  const filteredDishes = useMemo(() => {
    if (!searchTerm) return dishes;
    const searchLower = searchTerm.toLowerCase();
    return dishes.filter(dish =>
      dish.name.toLowerCase().includes(searchLower) ||
      dish.category.toLowerCase().includes(searchLower) ||
      dish.description?.toLowerCase().includes(searchLower)
    );
  }, [dishes, searchTerm]);

  // Calculer le coût total et la marge d'un plat
  const calculateDishStats = (dish: Dish) => {
    try {
      const ingredients = Array.isArray(dish.ingredients) ? dish.ingredients : [];
      const totalCost = ingredients.reduce((total: number, ing: DishIngredient) => {
        return total + (ing.cost || 0);
      }, 0);
      const profitMargin = dish.price > 0 ? ((dish.price - totalCost) / dish.price) * 100 : 0;
      return { totalCost, profitMargin };
    } catch (error) {
      console.error('Error calculating dish stats:', error);
      return { totalCost: 0, profitMargin: 0 };
    }
  };

  // Réinitialiser le champ quantité
  const resetQuantityFields = () => {
    setQuantity(0);
    setQuantityInput("");
  };

  // Ajouter un ingrédient
  const addIngredient = () => {
    if (!selectedItem) {
      toast({
        title: t('common.error'),
        description: t('restaurant.selectItemAndQuantity'),
        variant: 'destructive'
      });
      return;
    }

    if (!isQuantityInputValid(quantityInput)) {
      toast({
        title: t('common.error'),
        description: getQuantityErrorMessage() || t('restaurant.selectItemAndQuantity'),
        variant: 'destructive'
      });
      return;
    }

    const unitCost = Number(selectedItem.costPrice) || 0;
    const existing = ingredients.find((i) => i.itemId === selectedItem.id);

    if (existing) {
      const newQty = existing.quantity + quantity;
      setIngredients((prev) =>
        prev.map((i) =>
          i.itemId === selectedItem.id
            ? { ...i, quantity: newQty, cost: unitCost * newQty }
            : i
        )
      );
    } else {
      const newIngredient: DishIngredient = {
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        quantity: quantity,
        unit: selectedItem.unit,
        cost: quantity * unitCost,
        costPrice: unitCost,
      };
      setIngredients(prev => [...prev, newIngredient]);
    }

    setSelectedItem(null);
    resetQuantityFields();
    setShowIngredientDialog(false);

    toast({
      title: t('restaurant.ingredientAdded'),
      description: `${selectedItem.name} ${t('restaurant.ingredientAddedDesc')}`
    });
  };

  // Supprimer un ingrédient
  const removeIngredient = (itemId: number) => {
    setIngredients(prev => prev.filter((i) => i.itemId !== itemId));
  };

  // Fermer le dialog ingrédient et réinitialiser
  const closeIngredientDialog = () => {
    setShowIngredientDialog(false);
    setSelectedItem(null);
    resetQuantityFields();
  };

  // Soumettre le plat (création ou modification)
  const onSubmitDish = async (data: z.infer<typeof dishFormSchema>) => {
    try {
      if (ingredients.length === 0) {
        const confirmCreate = window.confirm(t('restaurant.noIngredientsConfirm'));
        if (!confirmCreate) return;
      }

      const dishData = {
        name: data.name,
        description: data.description || "",
        category: data.category,
        preparationTime: data.preparationTime,
        price: data.price,
        difficulty: data.difficulty,
        isActive: true,
        ingredients: ingredients.map(ing => ({
          itemId: ing.itemId,
          itemName: ing.itemName,
          quantity: ing.quantity,
          unit: ing.unit,
          cost: ing.cost,
          costPrice: ing.costPrice
        }))
      };

      let response;
      if (editingDish) {
        response = await api.patch(`/dishes/${editingDish.id}`, dishData);
        toast({
          title: t('restaurant.dishUpdated'),
          description: `"${data.name}" ${t('restaurant.dishUpdatedDesc', { count: ingredients.length })}`
        });
      } else {
        response = await api.post('/dishes', dishData);
        toast({
          title: t('restaurant.dishCreated'),
          description: `"${data.name}" ${t('restaurant.dishCreatedDesc', { count: ingredients.length })}`
        });
      }

      await loadDishes();
      resetForm();

    } catch (error: any) {
      console.error('Error saving dish:', error);

      if (error.response?.data?.error?.includes('stock') || error.response?.data?.error?.includes('Stock')) {
        toast({
          title: t('restaurant.stockWarning'),
          description: t('restaurant.stockWarningDesc'),
          variant: 'default'
        });
        await loadDishes();
        resetForm();
      } else {
        let errorMessage = t('restaurant.saveError');
        if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.message) {
          errorMessage = error.message;
        }
        toast({
          title: t('common.error'),
          description: errorMessage,
          variant: 'destructive'
        });
      }
    }
  };
  
  // Supprimer un plat
  const handleDeleteDish = async (dish: Dish) => {
    if (confirm(t('restaurant.deleteConfirm', { name: dish.name }))) {
      try {
        await api.del(`/dishes/${dish.id}`);
        toast({ title: t('common.success'), description: t('restaurant.dishDeleted') });
        await loadDishes();
      } catch (error: any) {
        console.error('Error deleting dish:', error);
        const errorMessage = error.response?.data?.error || t('restaurant.deleteError');
        toast({
          title: t('common.error'),
          description: errorMessage,
          variant: 'destructive'
        });
      }
    }
  };

  // Préparer l'édition d'un plat
  const prepareEditDish = (dish: Dish) => {
    setEditingDish(dish);
    setIngredients(dish.ingredients || []);

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

  // Réinitialiser le formulaire
  const resetForm = () => {
    setShowDishDialog(false);
    setEditingDish(null);
    setIngredients([]);
    resetQuantityFields();
    dishForm.reset();
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-6 flex items-center justify-center">
            <div className="text-center">{t('common.loading')}</div>
          </main>
        </div>
      </div>
    );
  }

  const quantityError = getQuantityErrorMessage();
  const quantityHasError = quantityInput !== "" && quantityError !== null;

  const exportOptions = [
    { format: "excel", label: "Excel", extension: ".xlsx", icon: FileSpreadsheet, color: "text-green-600", bgColor: "bg-green-50", hoverColor: "hover:bg-green-100" },
    { format: "csv",   label: "CSV",   extension: ".csv",  icon: Table,           color: "text-blue-600",   bgColor: "bg-blue-50",   hoverColor: "hover:bg-blue-100"  },
    { format: "txt",   label: "TXT",   extension: ".txt",  icon: FileText,        color: "text-purple-600", bgColor: "bg-purple-50", hoverColor: "hover:bg-purple-100"},
    { format: "json",  label: "JSON",  extension: ".json", icon: FileCode,        color: "text-orange-600", bgColor: "bg-orange-50", hoverColor: "hover:bg-orange-100"},
  ];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6 space-y-6">

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Utensils className="h-8 w-8 text-orange-600" /> {t('restaurant.dishManagement')}
              </h1>
              <p className="text-muted-foreground">{dishes.length} {t('restaurant.dishes')}</p>
            </div>
            <div className="flex gap-2 items-center">

              {/* Export */}
              <div className="relative">
                <Button variant="outline" onClick={() => setExportMenuOpen((v) => !v)} disabled={exportMenuLoading}>
                  <Download className="h-4 w-4 mr-2" />
                  {exportMenuLoading ? t('export.exporting') : t('restaurant.exportDishes')}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
                {exportMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <div className="p-1">
                      {exportOptions.map((opt) => {
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.format}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md ${opt.hoverColor} transition-colors`}
                            onClick={() => exporterPlats(opt.format)}
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

              {/* New dish */}
              <Button onClick={() => setShowDishDialog(true)} className="bg-orange-600 hover:bg-orange-700 text-white">
                <Plus className="h-4 w-4 mr-2" /> {t('restaurant.newDish')}
              </Button>
            </div>
          </div>

          {/* ── Search ──────────────────────────────────────────────────────── */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('restaurant.searchDish')}
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* ── Dish Cards by category ───────────────────────────────────────── */}
          {DISH_CATEGORIES.map(({ key, label }) => {
            const categoryDishes = filteredDishes.filter((d) => d.category === key);
            if (categoryDishes.length === 0) return null;
            return (
              <div key={key}>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span className="h-1 w-6 bg-orange-500 rounded-full inline-block" />
                  {label}
                  <Badge variant="secondary">{categoryDishes.length}</Badge>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryDishes.map((dish) => {
                    const { totalCost, profitMargin } = calculateDishStats(dish);
                    return (
                      <Card key={dish.id} className={`transition-all ${!dish.isActive ? "opacity-60" : ""}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base font-semibold leading-tight">{dish.name}</CardTitle>
                            <div className="flex gap-1 shrink-0">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => prepareEditDish(dish)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteDish(dish)}>
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
                            <span className="flex items-center gap-1 font-semibold text-orange-700">
                              <DollarSign className="h-3.5 w-3.5" />
                              {fmt(dish.price)} Ar
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />
                              {dish.preparationTime} min
                            </span>
                            {totalCost > 0 && (
                              <span className={`text-xs font-medium ${profitMargin >= 30 ? "text-green-600" : profitMargin >= 15 ? "text-orange-600" : "text-red-600"}`}>
                                {profitMargin.toFixed(0)}%
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {getDifficultyLabel(dish.difficulty)}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-xs cursor-pointer ${dish.isActive ? "text-green-700 border-green-300 bg-green-50" : "text-red-600 border-red-300 bg-red-50"}`}
                            >
                              {dish.isActive ? t('common.active') : t('common.inactive')}
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
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filteredDishes.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Utensils className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">{t('restaurant.noDishes')}</p>
              <p className="text-sm">{t('restaurant.startAddingDishes')}</p>
            </div>
          )}

        </main>
      </div>

      {/* ── Dialog Create/Edit Dish ──────────────────────────────────────────── */}
      <Dialog open={showDishDialog} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDish ? t('restaurant.editDish') : t('restaurant.addDish')}</DialogTitle>
            <DialogDescription>
              {editingDish ? `${t('restaurant.editDishDesc')} "${editingDish.name}"` : t('restaurant.addDishDesc')}
            </DialogDescription>
          </DialogHeader>

          <Form {...dishForm}>
            <form onSubmit={dishForm.handleSubmit(onSubmitDish)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">

                <FormField control={dishForm.control} name="name" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>{t('restaurant.dishName')} *</FormLabel>
                    <FormControl>
                      <Input placeholder={t('restaurant.dishNamePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={dishForm.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('restaurant.category')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder={t('restaurant.selectCategory')} /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DISH_CATEGORIES.map((c) => (
                          <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={dishForm.control} name="difficulty" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('restaurant.difficulty')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="easy">{t('restaurant.difficultyEasy')}</SelectItem>
                        <SelectItem value="medium">{t('restaurant.difficultyMedium')}</SelectItem>
                        <SelectItem value="hard">{t('restaurant.difficultyHard')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={dishForm.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('restaurant.price')} (Ar) *</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={dishForm.control} name="preparationTime" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('restaurant.preparationTime')} (min)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={dishForm.control} name="description" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>{t('common.description')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('restaurant.descriptionPlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Ingredients */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{t('restaurant.ingredients')} / {t('restaurant.components', 'Composants')}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowIngredientDialog(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> {t('restaurant.addIngredient')}
                  </Button>
                </div>
                {ingredients.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">{t('restaurant.noIngredients')}</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {ingredients.map((ingredient) => (
                      <div key={ingredient.itemId} className="flex items-center justify-between bg-muted/30 rounded px-3 py-1.5 text-sm">
                        <span>{ingredient.itemName}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{ingredient.quantity} {ingredient.unit}</span>
                          <span className="text-xs text-green-600">{fmt(ingredient.cost)} Ar</span>
                          <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => removeIngredient(ingredient.itemId)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center text-sm px-3 pt-2 border-t mt-1">
                      <span className="font-medium">{t('restaurant.totalIngredientsCost')} :</span>
                      <span className="text-green-600 font-semibold">{fmt(calculateTotalCost(ingredients))} Ar</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={loading} className="bg-orange-600 hover:bg-orange-700 text-white">
                  {loading ? t('common.saving', 'Enregistrement…') : editingDish ? t('common.edit') : t('restaurant.createDish')}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Add Ingredient ────────────────────────────────────────────── */}
      <Dialog open={showIngredientDialog} onOpenChange={(open) => !open && closeIngredientDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('restaurant.addIngredient')}</DialogTitle>
            <DialogDescription>{t('restaurant.selectItemAndQuantityDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">

            {/* Article selector */}
            <div>
              <label className="text-sm font-medium mb-1 block">{t('inventory.item')}</label>
              <Select onValueChange={(value) => {
                const selected = items.find(item => item.id === Number(value));
                setSelectedItem(selected || null);
              }}>
                <SelectTrigger><SelectValue placeholder={t('inventory.selectItem')} /></SelectTrigger>
                <SelectContent>
                  {items.length === 0 ? (
                    <SelectItem value="loading" disabled>{t('common.loading')}</SelectItem>
                  ) : (
                    items.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name} ({item.unit}){item.availableQty !== undefined ? ` — Stock: ${item.availableQty}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity input */}
            <div className="space-y-1">
              <label className="text-sm font-medium block">
                {t('inventory.quantity')}{selectedItem ? ` (${selectedItem.unit})` : ""}
              </label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder={t('restaurant.quantityNeeded')}
                value={quantityInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
                    setQuantityInput(raw);
                    const parsed = parseFloat(raw);
                    setQuantity(!isNaN(parsed) ? parsed : 0);
                  }
                }}
                className={quantityHasError ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {quantityHasError && (
                <p className="text-xs text-red-500">{quantityError}</p>
              )}
            </div>

            {/* Cost preview */}
            {selectedItem && isQuantityInputValid(quantityInput) && (
              <div className="p-3 bg-muted/50 rounded-md space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('inventory.unit')} :</span>
                  <span className="font-medium">{selectedItem.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('inventory.unitCost')} :</span>
                  <span className="font-medium">{fmt(selectedItem.costPrice)} Ar</span>
                </div>
                <div className="flex justify-between text-green-600 font-semibold border-t pt-1 mt-1">
                  <span>{t('restaurant.totalCost')} :</span>
                  <span>{fmt(quantity * selectedItem.costPrice)} Ar</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeIngredientDialog}>{t('common.cancel')}</Button>
              <Button onClick={addIngredient} disabled={!selectedItem || !isQuantityInputValid(quantityInput)}>
                {t('restaurant.addIngredient')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}