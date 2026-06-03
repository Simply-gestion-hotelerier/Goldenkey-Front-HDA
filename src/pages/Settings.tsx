// src/pages/settings/Settings.tsx
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/rbac";
import { useTheme } from "next-themes";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  User, Palette, Users, Plus, Pencil, Trash2, X, Check, Key,
  Sun, Moon, Monitor, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

// ── Rôles ────────────────────────────────────────────────────────────────────
const ROLES = [
  { value: "ADMIN",        label: "admin",        tw: "bg-red-50    text-red-700    border border-red-200"    },
  { value: "MANAGER",      label: "manager",      tw: "bg-blue-50   text-blue-700   border border-blue-200"   },
  { value: "RECEPTION",    label: "reception",    tw: "bg-teal-50   text-teal-700   border border-teal-200"   },
  { value: "HOUSEKEEPING", label: "housekeeping", tw: "bg-green-50  text-green-700  border border-green-200"  },
  { value: "WAITER",       label: "waiter",       tw: "bg-amber-50  text-amber-700  border border-amber-200"  },
  { value: "KITCHEN",      label: "kitchen",      tw: "bg-orange-50 text-orange-700 border border-orange-200" },
  { value: "CASHIER",      label: "cashier",      tw: "bg-pink-50   text-pink-700   border border-pink-200"   },
];

interface UserRow { id: number; email: string; name: string | null; role: string; createdAt: string; }
const emptyForm = { email: "", password: "", name: "", role: "" };

// ── Section : Compte ─────────────────────────────────────────────────────────
const AccountSection = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [name]  = useState(user?.name  || "");
  const [email] = useState(user?.email || "");
  const [phone] = useState(user?.phone || "");
  const [avatar] = useState(user?.avatar || "");

  const initials = (n: string) =>
    n ? n.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "U";

  return (
    <div className="space-y-8">
      {/* Avatar */}
      <div className="flex items-center gap-5 pb-6 border-b border-border">
        <Avatar className="h-16 w-16 ring-2 ring-border">
          <AvatarImage src={avatar} alt={name} />
          <AvatarFallback className="text-base font-medium bg-muted">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-lg leading-tight">{name || "—"}</p>
          <p className="text-sm text-muted-foreground">{email}</p>
          <span className={cn(
            "inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium",
            ROLES.find(r => r.value === user?.role?.toUpperCase())?.tw ?? "bg-muted text-muted-foreground"
          )}>
            {user?.role || "—"}
          </span>
        </div>
      </div>

      {/* Champs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t('settings.fullName')}
          </Label>
          <Input value={name} disabled readOnly className="bg-muted/40 text-foreground" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t('common.email')}
          </Label>
          <Input value={email} disabled readOnly type="email" className="bg-muted/40" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t('common.phone')}
          </Label>
          <Input value={phone} disabled readOnly className="bg-muted/40 max-w-sm" />
        </div>
      </div>

      <p className="text-xs text-muted-foreground/60 italic">
        {t('settings.contactAdmin', 'Contactez un administrateur pour modifier ces informations.')}
      </p>
    </div>
  );
};

// ── Section : Thème ───────────────────────────────────────────────────────────
const ThemeSection = () => {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  const themes = [
    { value: "light",  icon: Sun,     label: t('settings.light',  'Clair')  },
    { value: "dark",   icon: Moon,    label: t('settings.dark',   'Sombre') },
    { value: "system", icon: Monitor, label: t('settings.system', 'Système')},
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          {t('settings.themeDescription', 'Choisissez l\'apparence de l\'interface.')}
        </p>

        <div className="grid grid-cols-3 gap-3">
          {themes.map(({ value, icon: Icon, label }) => {
            const active = (theme ?? "light") === value;
            return (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "group relative flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all duration-150 cursor-pointer",
                  active
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/40 hover:bg-muted/50"
                )}
              >
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-muted"
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={cn(
                  "text-sm font-medium",
                  active ? "text-primary" : "text-foreground"
                )}>
                  {label}
                </span>
                {active && (
                  <span className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                    <Check className="h-2.5 w-2.5 text-primary-foreground" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Section : Utilisateurs ────────────────────────────────────────────────────
const UsersSection = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [showCreate, setShowCreate]     = useState(false);
  const [editId, setEditId]             = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [form, setForm]                 = useState({ ...emptyForm });
  const [editForm, setEditForm]         = useState<Partial<typeof emptyForm & { id: number }>>({});
  const [formError, setFormError]       = useState("");

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["users"],
    queryFn:  () => api.get("/users"),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyForm) => api.post("/users", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setShowCreate(false);
      setForm({ ...emptyForm });
      setFormError("");
    },
    onError: (err: any) => setFormError(err?.message || t('team.createError')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<typeof emptyForm> & { id: number }) =>
      api.patch(`/users/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setEditId(null);
      setEditForm({});
    },
    onError: (err: any) => setFormError(err?.message || t('team.updateError')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setDeleteTarget(null);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.role) {
      setFormError(t('team.requiredFields'));
      return;
    }
    createMutation.mutate(form);
  };

  const startEdit = (u: UserRow) => {
    setEditId(u.id);
    setEditForm({ id: u.id, email: u.email, name: u.name ?? "", role: u.role, password: "" });
    setFormError("");
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.id) return;
    const payload: any = { id: editForm.id };
    if (editForm.email)    payload.email    = editForm.email;
    if (editForm.name)     payload.name     = editForm.name;
    if (editForm.role)     payload.role     = editForm.role;
    if (editForm.password) payload.password = editForm.password;
    updateMutation.mutate(payload);
  };

  const getRoleEntry  = (role: string) => ROLES.find(r => r.value === role);
  const getRoleLabel  = (role: string) => {
    const found = getRoleEntry(role);
    return found ? t(`team.roles.${found.label}`) : role;
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">
          {t('team.subtitle', 'Gérez les comptes et les rôles du personnel.')}
        </p>
        <Button
          size="sm"
          onClick={() => { setShowCreate(v => !v); setFormError(""); }}
          variant={showCreate ? "secondary" : "default"}
          className="gap-1.5 shrink-0"
        >
          {showCreate ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showCreate ? t('common.cancel') : t('team.newAccount')}
        </Button>
      </div>

      {/* Formulaire création */}
      {showCreate && (
        <div className="mb-6 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-5">
          <p className="text-sm font-medium flex items-center gap-2 mb-4 text-primary">
            <Key className="h-4 w-4" /> {t('team.createUser')}
          </p>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">{t('common.email')} *</Label>
              <Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="jean@hotel.com" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('team.password')} *</Label>
              <Input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder={t('team.passwordMinLength')} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('team.fullName')}</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={t('team.fullNamePlaceholder')} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('team.role')} *</Label>
              <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue placeholder={t('team.selectRole')} /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{t(`team.roles.${r.label}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {formError && (
              <div className="sm:col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{formError}</div>
            )}
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={createMutation.isPending} size="sm">
                {createMutation.isPending ? t('common.loading') : t('team.create')}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Liste */}
      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">{t('common.loading')}</div>
      ) : users.length === 0 ? (
        <div className="py-16 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{t('team.noUsers')}</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {users.map(user => {
            const isEditing = editId === user.id;
            const roleEntry = getRoleEntry(user.role);

            return (
              <div key={user.id} className={cn(
                "px-4 py-3 transition-colors",
                isEditing ? "bg-muted/60" : "bg-card hover:bg-muted/30"
              )}>
                {isEditing ? (
                  <form onSubmit={handleUpdate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{t('common.email')}</Label>
                      <Input value={editForm.email ?? ""} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('team.fullName')}</Label>
                      <Input value={editForm.name ?? ""} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('team.role')}</Label>
                      <Select value={editForm.role ?? ""} onValueChange={v => setEditForm(p => ({ ...p, role: v }))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{t(`team.roles.${r.label}`)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('team.newPassword')}</Label>
                      <Input type="password" value={editForm.password ?? ""} onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))} placeholder={t('team.passwordOptional')} className="h-8 text-sm" />
                    </div>
                    {formError && <p className="sm:col-span-2 text-xs text-red-600">{formError}</p>}
                    <div className="sm:col-span-2 flex gap-2">
                      <Button type="submit" size="sm" disabled={updateMutation.isPending} className="gap-1 h-7 text-xs">
                        <Check className="h-3 w-3" /> {updateMutation.isPending ? "..." : t('common.save')}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditId(null)} className="gap-1 h-7 text-xs">
                        <X className="h-3 w-3" /> {t('common.cancel')}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center gap-3">
                    {/* Initiales */}
                    <div className={cn(
                      "h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold",
                      roleEntry?.tw ?? "bg-muted text-muted-foreground"
                    )}>
                      {(user.name || user.email).slice(0, 2).toUpperCase()}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">{user.name || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    {/* Role badge */}
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium shrink-0 hidden sm:inline-block", roleEntry?.tw ?? "bg-muted text-muted-foreground")}>
                      {getRoleLabel(user.role)}
                    </span>
                    {/* Date */}
                    <p className="text-xs text-muted-foreground/50 shrink-0 hidden lg:block">
                      {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                    </p>
                    {/* Actions */}
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(user)} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(user)} className="h-7 w-7 text-muted-foreground hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm suppression */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('team.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('team.deleteConfirmDescription')}{" "}
              <strong>{deleteTarget?.name || deleteTarget?.email}</strong>.{" "}
              {t('team.deleteConfirmWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// ── Tabs config ───────────────────────────────────────────────────────────────
type Tab = "account" | "theme" | "users";

const TABS = [
  { id: "account" as Tab, icon: User,    labelKey: "settings.profile",    label: "Compte"       },
  { id: "theme"   as Tab, icon: Palette, labelKey: "settings.appearance", label: "Thème"        },
  { id: "users"   as Tab, icon: Users,   labelKey: "team.title",          label: "Utilisateurs", adminOnly: true },
];

// ── Page principale ───────────────────────────────────────────────────────────
export default function Settings() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isAdmin = ["ADMIN", "admin"].includes(user?.role ?? "");

  const tabs = TABS.filter(tab => !tab.adminOnly || isAdmin);
  const [activeTab, setActiveTab] = useState<Tab>("account");

  const TAB_TITLES: Record<Tab, string> = {
    account: t('settings.profile', 'Compte'),
    theme:   t('settings.appearance', 'Thème'),
    users:   t('team.title', 'Utilisateurs'),
  };
  const TAB_SUBTITLES: Record<Tab, string> = {
    account: t('settings.subtitle', 'Vos informations personnelles.'),
    theme:   t('settings.themeDescription', 'Personnalisez l\'apparence.'),
    users:   t('team.subtitle', 'Gérez le personnel et les accès.'),
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto px-6 py-8">

            {/* Page header */}
            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight">{t('settings.title', 'Paramètres')}</h1>
            </div>

            {/* Layout : sidebar tabs + contenu */}
            <div className="flex gap-8">

              {/* ── Nav verticale ── */}
              <nav className="w-52 shrink-0 space-y-1">
                {tabs.map(({ id, icon: Icon, labelKey, label }) => {
                  const active = activeTab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={cn(
                        "group w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-100 text-left",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                      )} />
                      <span className="truncate">{t(labelKey, label)}</span>
                      {active && <ChevronRight className="ml-auto h-3.5 w-3.5 text-primary-foreground/60" />}
                    </button>
                  );
                })}
              </nav>

              {/* ── Panneau de contenu ── */}
              <div className="flex-1 min-w-0">
                <div className="rounded-xl border border-border bg-card p-7">
                  {/* En-tête du panneau */}
                  <div className="mb-7 pb-5 border-b border-border">
                    <h2 className="text-base font-semibold">{TAB_TITLES[activeTab]}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">{TAB_SUBTITLES[activeTab]}</p>
                  </div>

                  {/* Contenu */}
                  {activeTab === "account" && <AccountSection />}
                  {activeTab === "theme"   && <ThemeSection />}
                  {activeTab === "users"   && isAdmin && <UsersSection />}
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}