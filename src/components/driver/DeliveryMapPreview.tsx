import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Store, Navigation, X } from "lucide-react";
import OpenStreetMap from "@/components/map/OpenStreetMap";
import { calculateDistance } from "@/hooks/useGeolocation";

interface DeliveryMapPreviewProps {
  orderId: string;
  buyerLat: number | null;
  buyerLng: number | null;
  driverLat?: number;
  driverLng?: number;
  onClose: () => void;
}

interface SellerStop {
  user_id: string;
  shop_name: string;
  shop_city: string | null;
  latitude: number;
  longitude: number;
}

export default function DeliveryMapPreview({
  orderId,
  buyerLat,
  buyerLng,
  driverLat,
  driverLng,
  onClose,
}: DeliveryMapPreviewProps) {
  // Fetch ALL distinct sellers for this order
  const { data: sellers } = useQuery({
    queryKey: ["delivery-preview-sellers", orderId],
    queryFn: async (): Promise<SellerStop[]> => {
      const { data: items } = await supabase
        .from("order_items")
        .select("seller_id")
        .eq("order_id", orderId);

      const ids = [...new Set((items || []).map((i: any) => i.seller_id).filter(Boolean))];
      if (!ids.length) return [];

      const { data: shops } = await supabase
        .from("seller_applications")
        .select("user_id, shop_name, shop_city, latitude, longitude")
        .in("user_id", ids as string[])
        .eq("status", "approved");

      return (shops || []).filter((s: any) => s.latitude && s.longitude) as SellerStop[];
    },
  });

  // Order sellers by nearest-next from driver
  const orderedStops: SellerStop[] = [];
  const remaining = [...(sellers || [])];
  let curLat = driverLat;
  let curLng = driverLng;
  while (remaining.length && curLat != null && curLng != null) {
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((s, i) => {
      const d = calculateDistance(curLat!, curLng!, s.latitude, s.longitude);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    const next = remaining.splice(bestIdx, 1)[0];
    orderedStops.push(next);
    curLat = next.latitude;
    curLng = next.longitude;
  }
  // Append any remaining (no driver position)
  orderedStops.push(...remaining);

  const markers: any[] = [];
  const routes: any[] = [];

  if (driverLat && driverLng) {
    markers.push({ lat: driverLat, lng: driverLng, color: "blue" as const, popup: "🚗 Vous" });
  }

  // Sellers as numbered stops
  orderedStops.forEach((s, idx) => {
    markers.push({
      lat: s.latitude,
      lng: s.longitude,
      color: "red" as const,
      popup: `📦 Étape ${idx + 1} : ${s.shop_name}`,
    });
  });

  if (buyerLat && buyerLng) {
    markers.push({ lat: buyerLat, lng: buyerLng, color: "green" as const, popup: "🏠 Livraison" });
  }

  // Build chained routes: driver → s1 → s2 → ... → buyer
  const chain: Array<{ lat: number; lng: number }> = [];
  if (driverLat && driverLng) chain.push({ lat: driverLat, lng: driverLng });
  orderedStops.forEach((s) => chain.push({ lat: s.latitude, lng: s.longitude }));
  if (buyerLat && buyerLng) chain.push({ lat: buyerLat, lng: buyerLng });

  let totalDist = 0;
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i], b = chain[i + 1];
    const isLast = i === chain.length - 2 && buyerLat && buyerLng;
    routes.push({
      from: a, to: b,
      color: isLast ? "#16a34a" : "#f97316",
      dashed: true,
    });
    totalDist += calculateDistance(a.lat, a.lng, b.lat, b.lng);
  }

  const allLats = markers.map((m) => m.lat);
  const allLngs = markers.map((m) => m.lng);
  const center = allLats.length
    ? { lat: (Math.min(...allLats) + Math.max(...allLats)) / 2, lng: (Math.min(...allLngs) + Math.max(...allLngs)) / 2 }
    : undefined;

  if (!center) return null;

  const pickupCount = orderedStops.length;

  return (
    <Card className="border-primary/30 overflow-hidden">
      <CardContent className="p-0">
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-[1000] bg-background/80 backdrop-blur-sm h-7 w-7"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>

          <OpenStreetMap
            center={center}
            zoom={12}
            markers={markers}
            routes={routes}
            className="h-[220px] w-full"
          />

          <div className="absolute bottom-2 left-2 right-2 z-[1000] flex gap-2 flex-wrap">
            {pickupCount > 0 && (
              <Badge className="bg-orange-500/90 text-white gap-1">
                <Store className="h-3 w-3" />
                {pickupCount} arrêt{pickupCount > 1 ? "s" : ""}
              </Badge>
            )}
            {totalDist > 0 && (
              <Badge className="bg-primary/90 text-primary-foreground gap-1">
                <Navigation className="h-3 w-3" />
                Total: {totalDist.toFixed(1)} km
              </Badge>
            )}
          </div>
        </div>

        {orderedStops.length > 0 && (
          <div className="p-2 border-t space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Parcours :</p>
            <ol className="text-xs space-y-0.5">
              {orderedStops.map((s, i) => (
                <li key={s.user_id} className="flex items-start gap-1">
                  <span className="font-bold text-orange-600">{i + 1}.</span>
                  <span><Store className="inline h-3 w-3 mr-0.5" />{s.shop_name}{s.shop_city ? ` • ${s.shop_city}` : ""}</span>
                </li>
              ))}
              {buyerLat && buyerLng && (
                <li className="flex items-start gap-1">
                  <span className="font-bold text-green-600">{orderedStops.length + 1}.</span>
                  <span><MapPin className="inline h-3 w-3 mr-0.5 text-green-600" />Livraison client</span>
                </li>
              )}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
