// src/components/crm/GuestProfileSheet.tsx
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  User, Mail, Phone, MapPin, Building2, Cake, Globe,
  Hotel, Sparkles, Wine, UtensilsCrossed, TrendingUp, Star
} from "lucide-react";
import { api } from "@/lib/api";
import { GuestProfile } from "@/types/guestProfile";
import { useTranslation } from "react-i18next";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " Ar";
const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR");

const tierColors: Record<string, string> = {
  Bronze: "bg-orange-100 text-orange-800",
  Silver: "bg-gray-100 text-gray-700",
  Gold: "bg-yellow-100 text-yellow-800",
  Platinum: "bg-purple-100 text-purple-800",
};

interface Props {
  customerId: string | null; // ex: "hotel:42"
  open: boolean;
  onClose: () => void;
}

export function GuestProfileSheet({ customerId, open, onClose }: Props) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const isHotelGuest = customerId?.startsWith("hotel:");

  useEffect(() => {
    if (!open || !customerId || !isHotelGuest) return;
    setLoading(true);
    api.get<GuestProfile>(`/crm/customers/${customerId}/profile`)
      .then(setProfile)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, customerId]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Fiche client
          </DialogTitle>
        </DialogHeader>

        {!isHotelGuest && (
          <div className="text-sm text-muted-foreground p-4 bg-muted rounded-lg">
            Fiche complète uniquement disponible pour les clients hôtel. 
            Les clients spa/bar/restaurant sont identifiés par nom sans profil consolidé.
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {profile && !loading && (
          <Tabs defaultValue="overview">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="hotel">
                <Hotel className="h-3 w-3 mr-1" /> Hôtel ({profile.hotelHistory.length})
              </TabsTrigger>
              <TabsTrigger value="spa">
                <Sparkles className="h-3 w-3 mr-1" /> Spa ({profile.spaHistory.length})
              </TabsTrigger>
              <TabsTrigger value="bar">
                <Wine className="h-3 w-3 mr-1" /> Bar ({profile.barHistory.length})
              </TabsTrigger>
              <TabsTrigger value="restaurant">
                <UtensilsCrossed className="h-3 w-3 mr-1" /> Resto ({profile.restHistory.length})
              </TabsTrigger>
            </TabsList>

            {/* ── Vue d'ensemble ── */}
            <TabsContent value="overview" className="space-y-6 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Infos contact */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4" /> Informations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-lg">{profile.guest.fullName}</span>
                      {profile.guest.loyaltyTier && (
                        <Badge className={tierColors[profile.guest.loyaltyTier] ?? ""}>
                          <Star className="h-3 w-3 mr-1" />
                          {profile.guest.loyaltyTier}
                        </Badge>
                      )}
                    </div>
                    <Separator />
                    {profile.guest.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3 w-3" /> {profile.guest.email}
                      </div>
                    )}
                    {profile.guest.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3 w-3" /> {profile.guest.phone}
                      </div>
                    )}
                    {profile.guest.address && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {profile.guest.address}
                      </div>
                    )}
                    {profile.guest.nationality && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Globe className="h-3 w-3" /> {profile.guest.nationality}
                      </div>
                    )}
                    {profile.guest.company && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="h-3 w-3" /> {profile.guest.company}
                      </div>
                    )}
                    {profile.guest.birthDate && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Cake className="h-3 w-3" /> {fmtDate(profile.guest.birthDate)}
                      </div>
                    )}
                    {profile.guest.segment && (
                      <Badge variant="outline" className="capitalize">{profile.guest.segment}</Badge>
                    )}
                  </CardContent>
                </Card>

                {/* Statistiques */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Statistiques
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between font-medium">
                      <span>Total dépensé</span>
                      <span className="text-primary">{fmt(profile.stats.totalSpent)}</span>
                    </div>
                    <Separator />
                    <div className="space-y-2">Programme Or
                      {[
                        { label: "Hôtel", value: profile.stats.hotelSpent, visits: profile.stats.totalStays, icon: "🏨" },
                        { label: "Spa", value: profile.stats.spaSpent, visits: profile.stats.totalSpaVisits, icon: "💆" },
                        { label: "Bar", value: profile.stats.barSpent, visits: profile.stats.totalBarVisits, icon: "🍷" },
                        { label: "Restaurant", value: profile.stats.restSpent, visits: profile.stats.totalRestVisits, icon: "🍽️" },
                      ].map(({ label, value, visits, icon }) => (
                        <div key={label} className="flex items-center justify-between text-muted-foreground">
                          <span>{icon} {label} — {visits} visite{visits > 1 ? "s" : ""}</span>
                          <span className="font-medium text-foreground">{fmt(value)}</span>
                        </div>
                      ))}
                    </div>
                    {profile.guest.loyaltyPoints > 0 && (
                      <>
                        <Separator />
                        <div className="flex justify-between">
                          <span>Points  </span>
                          <span className="font-medium">{profile.guest.loyaltyPoints} pts</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Notes */}
              {profile.guest.notes && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Notes & préférences</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{profile.guest.notes}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── Hôtel ── */}
            <TabsContent value="hotel" className="space-y-4 mt-4">
              {profile.hotelHistory.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Aucun séjour</p>
              ) : (
                profile.hotelHistory.map((stay) => (
                  <Card key={stay.id}>
                    <CardContent className="pt-4 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">
                          Chambre {stay.roomNumber} <span className="text-muted-foreground font-normal">({stay.roomType})</span>
                        </div>
                        <Badge variant={stay.status === "checked_out" ? "secondary" : "default"} className="capitalize">
                          {stay.status}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground">
                        {fmtDate(stay.checkIn)} → {fmtDate(stay.checkOut)} · {stay.rate.toLocaleString()} Ar/{stay.rateMode === "per_night" ? "nuit" : stay.rateMode}
                      </div>
                      <div className="flex justify-between font-medium pt-1 border-t">
                        <span>Total facturé</span>
                        <span>{fmt(stay.folioTotal)}</span>
                      </div>
                      {stay.charges.length > 0 && (
                        <details className="text-xs text-muted-foreground">
                          <summary className="cursor-pointer hover:text-foreground">
                            {stay.charges.length} ligne(s) de facturation
                          </summary>
                          <div className="mt-2 space-y-1 pl-2">
                            {stay.charges.map((c, i) => (
                              <div key={i} className="flex justify-between">
                                <span>{c.description} ×{c.qty}</span>
                                <span>{fmt(c.qty * c.unitPrice)}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>


            {/* ── Bar ── */}
            <TabsContent value="bar" className="space-y-4 mt-4">
              {profile.barHistory.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Aucune note de bar</p>
              ) : (
                profile.barHistory.map((t) => (
                  <Card key={t.id}>
                    <CardContent className="pt-4 flex items-center justify-between text-sm">
                      <div>
                        <div className="font-medium">Note #{t.id}</div>
                        <Badge variant="outline" className="capitalize text-xs">{t.status}</Badge>
                      </div>
                      <div className="font-medium">{fmt(t.totalPaid)}</div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* ── Restaurant ── */}
            <TabsContent value="restaurant" className="space-y-4 mt-4">
              {profile.restHistory.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Aucune facture restaurant</p>
              ) : (
                profile.restHistory.map((inv) => (
                  <Card key={inv.id}>
                    <CardContent className="pt-4 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">Facture {inv.number}</div>
                        <div className="font-medium">{fmt(inv.totalTTC)}</div>
                      </div>
                      <div className="text-muted-foreground">{fmtDate(inv.date)}</div>
                      {inv.lines.length > 0 && (
                        <details className="text-xs text-muted-foreground">
                          <summary className="cursor-pointer hover:text-foreground">{inv.lines.length} article(s)</summary>
                          <div className="mt-2 space-y-1 pl-2">
                            {inv.lines.map((l, i) => (
                              <div key={i} className="flex justify-between">
                                <span>{l.description} ×{l.qty}</span>
                                <span>{fmt(l.qty * l.unitPrice)}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}