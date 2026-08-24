import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { AvatarUploadField } from "@/components/ui/AvatarUploadField";
import { toast } from "sonner";
import { Settings as SettingsIcon, Save, Bell, BellOff, CheckCircle, MapPin } from "lucide-react";

export default function Settings() {
  const { t } = useTranslation();
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
      avatar_url: (profile as any)?.avatar_url ?? null as string | null,
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
    if (!locked && !form.first_name.trim()) return toast.error(t("settingsx.errFirst"));
    if (!locked && !form.last_name.trim()) return toast.error(t("settingsx.errLast"));
    if (form.lat == null || form.lng == null) return toast.error(t("settingsx.errAddress"));

    try {
      setSaving(true);
      const full_name = `${form.first_name.trim()} ${form.last_name.trim()}`.trim();
      await updateProfile.mutateAsync({
        ...(locked ? {} : { full_name }),
        phone: form.phone.trim() || null,
        avatar_url: form.avatar_url,
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

      toast.success(t("settingsx.saved"));

    } catch (e: any) {
      toast.error(e?.message || t("settingsx.errSave"));
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
            <h1 className="text-2xl font-bold">{t("settingsx.title")}</h1>
            <p className="text-muted-foreground">{t("settingsx.subtitle")}</p>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>{t("settingsx.personal")}</CardTitle>
            <CardDescription>
              {isSeller ? t("settingsx.personalDescSeller") : t("settingsx.personalDescBuyer")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <>
                {locked && (
                  <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                    {t("settingsx.lockedNote")}
                  </p>
                )}

                <AvatarUploadField
                  userId={user.id}
                  value={form.avatar_url}
                  onChange={(url) => setForm((p) => ({ ...p, avatar_url: url }))}
                  label={t("photoUpload.label", "Photo de profil")}
                  hint={t("photoUpload.hint", "Cette photo vous représente (boutique, livreur) dans l'application.")}
                />

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">{t("settingsx.firstName")} *</Label>
                    <Input
                      id="first_name"
                      value={form.first_name}
                      onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                      maxLength={50}
                      disabled={locked}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">{t("settingsx.lastName")}</Label>
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
                    <Label htmlFor="dob">{t("settingsx.dob")}</Label>
                    <Input
                      id="dob"
                      type="date"
                      value={form.date_of_birth || ""}
                      onChange={(e) => setForm((p) => ({ ...p, date_of_birth: e.target.value }))}
                      disabled={locked}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t("settingsx.phone")}</Label>
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
                    {t("settingsx.address")}
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
                    placeholder={t("settingsx.addressPlaceholder")}
                  />
                  {form.lat != null && form.lng != null && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      {t("settingsx.savedPosition")} : {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
                    </p>
                  )}
                </div>

                <Button onClick={onSave} disabled={saving || updateProfile.isPending} className="w-full gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? t("settingsx.saving") : t("settingsx.save")}
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
              {t("settingsx.notifTitle")}
            </CardTitle>
            <CardDescription>
              {t("settingsx.notifDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isSupported ? (
              <p className="text-sm text-muted-foreground">
                {t("settingsx.notSupported")}
              </p>
            ) : permission === "granted" ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">{t("settingsx.enabled")}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">{t("settingsx.enabledDesc")}</p>
                </div>
              </div>
            ) : permission === "denied" ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <BellOff className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-200">{t("settingsx.blocked")}</p>
                  <p className="text-xs text-red-600 dark:text-red-400">{t("settingsx.blockedDesc")}</p>
                </div>
              </div>
            ) : (
              <Button onClick={requestPermission} className="w-full gap-2">
                <Bell className="h-4 w-4" />
                {t("settingsx.enable")}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* About */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{t("settingsx.about")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p><strong>APEXL</strong> — {t("settingsx.aboutDesc")}</p>
            <p>{t("settingsx.version")}</p>
            <div className="pt-2 border-t space-y-1">
              <p>📧 {t("settingsx.contact")} : support@apex.com</p>
              <p>📱 {t("settingsx.whatsapp")} : +509 39 29 7720</p>
            </div>
            <p className="text-xs pt-2">© {new Date().getFullYear()} APEXL. {t("settingsx.rights")}</p>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </main>
  );
}
