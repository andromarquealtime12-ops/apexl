import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Settings as SettingsIcon, Save, Bell, BellOff, CheckCircle } from "lucide-react";

export default function Settings() {
  const { user, loading } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const { permission, isSupported, requestPermission } = usePushNotifications();

  const initial = useMemo(
    () => ({
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
      country: profile?.country ?? "",
      city: profile?.city ?? "",
      address: profile?.address ?? "",
    }),
    [profile]
  );

  const [form, setForm] = useState(initial);

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
    try {
      await updateProfile.mutateAsync({
        full_name: form.full_name.trim() || profile?.full_name,
        phone: form.phone.trim() || null,
        country: form.country.trim() || null,
        city: form.city.trim() || null,
        address: form.address.trim() || null,
      });
      toast.success("Paramètres enregistrés");
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'enregistrement");
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
              Modifiez vos coordonnées. (Mode démo: aucune confirmation email requise ici.)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Nom complet</Label>
                    <Input
                      id="full_name"
                      value={form.full_name}
                      onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                      placeholder="Votre nom"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="+509 ..."
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="country">Pays</Label>
                    <Input
                      id="country"
                      value={form.country}
                      onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
                      placeholder="HT / DO"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Ville</Label>
                    <Input
                      id="city"
                      value={form.city}
                      onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                      placeholder="Port-au-Prince"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Adresse</Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                    placeholder="Rue, quartier..."
                  />
                </div>

                <Button onClick={onSave} disabled={updateProfile.isPending} className="w-full gap-2">
                  <Save className="h-4 w-4" />
                  {updateProfile.isPending ? "Enregistrement..." : "Enregistrer"}
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
      </div>
      <Footer />
    </main>
  );
}
