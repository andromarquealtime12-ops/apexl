import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GpsAddressField } from "@/components/ui/GpsAddressField";
import { MapPin, Save, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { calculateDistance } from "@/hooks/useGeolocation";

const MAX_MOVE_KM = 3;

export default function ShopLocationCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [originalLat, setOriginalLat] = useState<number | null>(null);
  const [originalLng, setOriginalLng] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("shop_latitude, shop_longitude, shop_address")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setAddress(data.shop_address ?? "");
        setLat(data.shop_latitude ?? null);
        setLng(data.shop_longitude ?? null);
        setOriginalLat(data.shop_latitude ?? null);
        setOriginalLng(data.shop_longitude ?? null);
      }
      setLoading(false);
    })();
  }, [user]);

  const distanceFromOrigin =
    lat != null && lng != null && originalLat != null && originalLng != null
      ? calculateDistance(originalLat, originalLng, lat, lng)
      : 0;
  const outOfRange = originalLat != null && distanceFromOrigin > MAX_MOVE_KM;

  const save = async () => {
    if (!user || lat == null || lng == null) return;
    if (outOfRange) {
      toast.error(`Nouvelle position à ${distanceFromOrigin.toFixed(1)} km — max ${MAX_MOVE_KM} km autour du point enregistré. Contactez le support pour un déplacement plus grand.`);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ shop_latitude: lat, shop_longitude: lng, shop_address: address })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setOriginalLat(lat);
    setOriginalLng(lng);
    toast.success("Position de la boutique enregistrée ✓");
  };

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Emplacement de retrait des colis
        </CardTitle>
        <CardDescription>
          Position enregistrée où les livreurs viennent chercher vos colis. Modifiable dans un rayon de {MAX_MOVE_KM} km.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            <GpsAddressField
              value={address}
              onChange={setAddress}
              coords={{ lat, lng }}
              onCoords={(la, lo) => { setLat(la); setLng(lo); }}
              onSelect={(s) => setAddress(s.address)}
              placeholder="Adresse exacte de la boutique"
            />

            {originalLat != null && lat != null && lng != null && (
              outOfRange ? (
                <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded p-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Position hors zone : {distanceFromOrigin.toFixed(1)} km du point d'origine (max {MAX_MOVE_KM} km).</span>
                </div>
              ) : distanceFromOrigin > 0.05 ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  Déplacement de {distanceFromOrigin.toFixed(2)} km — dans la limite autorisée.
                </div>
              ) : null
            )}

            <Button onClick={save} disabled={saving || lat == null || lng == null || outOfRange} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Enregistrer la position
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
