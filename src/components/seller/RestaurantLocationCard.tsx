import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GpsAddressField } from "@/components/ui/GpsAddressField";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { MapPin, Save, CheckCircle, AlertTriangle } from "lucide-react";

interface Props {
  restaurantId: string;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

export default function RestaurantLocationCard({ restaurantId, address, city, latitude, longitude }: Props) {
  const queryClient = useQueryClient();
  const [addr, setAddr] = useState(address || "");
  const [cityValue, setCityValue] = useState(city || "");
  const [lat, setLat] = useState<number | null>(latitude);
  const [lng, setLng] = useState<number | null>(longitude);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (lat == null || lng == null) {
      toast.error("Confirmez la position de récupération (GPS ou recherche)");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await (supabase as any).rpc("update_pickup_location", {
        p_lat: lat,
        p_lng: lng,
        p_address: addr.trim() || null,
        p_city: cityValue.trim() || null,
        p_restaurant_id: restaurantId,
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error);

      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      queryClient.invalidateQueries({ queryKey: ["seller-restaurants"] });
      queryClient.invalidateQueries({ queryKey: ["restaurant", restaurantId] });
      toast.success("Position mise à jour ✓ Distances et itinéraires recalculés");
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 pt-2" onClick={(e) => e.stopPropagation()}>
      <Label className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" />
        Adresse de récupération des colis
      </Label>
      <GpsAddressField
        value={addr}
        onChange={setAddr}
        coords={{ lat, lng }}
        onCoords={(la, lo) => {
          setLat(la);
          setLng(lo);
        }}
        onSelect={(s) => {
          setAddr(s.address);
          setLat(s.lat);
          setLng(s.lng);
        }}
        placeholder="Utiliser ma position ou rechercher l'adresse du restaurant…"
      />
      <Input value={cityValue} onChange={(e) => setCityValue(e.target.value)} placeholder="Ville" />
      {lat != null && lng != null ? (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Position : {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>
      ) : (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Sans position GPS, les acheteurs ne voient pas la distance ni les frais de livraison.
        </p>
      )}
      <Button onClick={save} disabled={saving} size="sm" className="gap-2">
        <Save className="h-4 w-4" />
        {saving ? "Enregistrement..." : "Enregistrer la position"}
      </Button>
    </div>
  );
}
