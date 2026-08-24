import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Navigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { GpsAddressField } from "@/components/ui/GpsAddressField";
import { toast } from "sonner";
import { Settings as SettingsIcon, Save, Bell, BellOff, CheckCircle, MapPin } from "lucide-react";

export default function Settings() {
  const { user, loading, isSeller } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const { permission, isSupported, requestPermission } = usePushNotifications();


  const initial = useMemo(
    () => ({
      first_name: ((profile as any)?.full_name ?? "").split(" ")[0] ?? "",
      last_name: ((profile as any)?.full_name ?? "").split(" ").slice(1).join(" ") ?? "",
      phone: profile?.phone ?? "",
      date_of_birth: (profile as any)?.date_of_birth ?? "",
      address: profile?.address ?? "",
      lat: profile?.latitude ?? null as number | null,
      lng: profile?.longitude ?? null as number | null,
    }),
    [profile]
  );

  const locked = Boolean((profile as any)?.personal_info_locked);

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="container px-4 py-8">
          <Skeleton className="h-48 w-full" />
        </div>
      </main>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  const onSave = async () => {
    if (!locked && !form.first_name.trim()) return toast.error("Prénom requis");
    if (!locked && !form.last_name.trim()) return toast.error("Nom de famille requis");
    if (form.lat == null || form.lng == null) return toast.error("Confirmez une adresse (position ou recherche)");

    try {
      setSaving(true);
      const full_name = `${form.first_name.trim()} ${form.last_name.trim()}`.trim();
      await updateProfile.mutateAsync({
        ...(locked ? {} : { full_name }),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        latitude: form.lat,
        longitude: form.lng,
        ...(!locked && form.date_of_birth ? { date_of_birth: form.date_of_birth } : {}),
      } as any);

      // Propagate the pickup location everywhere the geolocation system uses it
      const { data: syncData, error: syncError } = await (supabase as any).rpc("update_pickup_location", {
        p_lat: form.lat,
        p_lng: form.lng,
        p_address: form.address.trim() || null,
        p_city: null,
        p_restaurant_id: null,
      });
      if (syncError) throw syncError;
      if (syncData && syncData.success === false) throw new Error(syncData.error);

      // Refresh every cache that depends on shop coordinates (distances / itinéraires)
      queryClient.invalidateQueries({ queryKey: ["shop-locations"] });
      queryClient.invalidateQueries({ queryKey: ["seller-shops"] });
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });

      toast.success("Position mise à jour ✓ Les distances et itinéraires sont recalculés");

    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container px-4 py-8 max-w-3xl">
        <header className="flex items-center gap-3 mb-6">
          <SettingsIcon className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Paramètres</h1>
            <p className="text-muted-foreground">Gérez vos informations de compte</p>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Informations personnelles</CardTitle>
            <CardDescription>
              Nom, prénom, date de naissance et adresse. L'adresse enregistrée sert au calcul de la distance
              {isSeller ? " entre votre boutique et les acheteurs." : " avec les vendeurs et livreurs."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <>
                {locked && (
                  <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                    Votre nom, prénom et date de naissance sont confirmés et ne peuvent plus être
                    modifiés. Vous pouvez toujours changer votre email et votre téléphone.
                  </p>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">Prénom *</Label>
                    <Input
                      id="first_name"
                      value={form.first_name}
                      onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                      maxLength={50}
                      disabled={locked}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Nom</Label>
                    <Input
                      id="last_name"
                      value={form.last_name}
                      onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
                      maxLength={50}
                      disabled={locked}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dob">Date de naissance</Label>
                    <Input
                      id="dob"
                      type="date"
                      value={form.date_of_birth || ""}
                      onChange={(e) => setForm((p) => ({ ...p, date_of_birth: e.target.value }))}
                      disabled={locked}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="+509 ..."
                      maxLength={30}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    Adresse
                  </Label>
                  <GpsAddressField
                    value={form.address}
                    onChange={(v) => setForm((p) => ({ ...p, address: v }))}
                    coords={{ lat: form.lat, lng: form.lng }}
                    onCoords={(la, lo) =>
                      setForm((p) => ({ ...p, lat: la, lng: lo }))
                    }
                    onSelect={(s) =>
                      setForm((p) => ({ ...p, address: s.address, lat: s.lat, lng: s.lng }))
                    }
                    placeholder="Utiliser ma position ou rechercher une adresse…"
                  />
                  {form.lat != null && form.lng != null && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Position enregistrée : {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
                    </p>
                  )}
                </div>

                <Button onClick={onSave} disabled={saving || updateProfile.isPending} className="w-full gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications Push
            </CardTitle>
            <CardDescription>
              Recevez des alertes sur vos commandes et livraisons
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isSupported ? (
              <p className="text-sm text-muted-foreground">
                Les notifications ne sont pas supportées sur ce navigateur.
              </p>
            ) : permission === "granted" ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">Notifications activées</p>
                  <p className="text-xs text-green-600 dark:text-green-400">Vous recevrez des alertes pour les commandes et livraisons</p>
                </div>
              </div>
            ) : permission === "denied" ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <BellOff className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-200">Notifications bloquées</p>
                  <p className="text-xs text-red-600 dark:text-red-400">Activez-les dans les paramètres de votre navigateur</p>
                </div>
              </div>
            ) : (
              <Button onClick={requestPermission} className="w-full gap-2">
                <Bell className="h-4 w-4" />
                Activer les notifications
              </Button>
            )}
          </CardContent>
        </Card>

        {/* About */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>À propos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p><strong>APEXL</strong> — Plateforme de commerce et livraison en Haïti et République Dominicaine.</p>
            <p>Version 1.0.0</p>
            <div className="pt-2 border-t space-y-1">
              <p>📧 Contact : support@apex.com</p>
              <p>📱 WhatsApp : +509 39 29 7720</p>
            </div>
            <p className="text-xs pt-2">© {new Date().getFullYear()} APEXL. Tous droits réservés.</p>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </main>
  );
}
