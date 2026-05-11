import { useEffect, useState } from "react";
import { useAvailableDeliveries } from "@/hooks/useDriverStats";
import { useAcceptDelivery } from "@/hooks/useDriverActions";
import { useCurrentPosition, calculateDistance } from "@/hooks/useGeolocation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Package, Clock, Check, Navigation, Loader2, Map, Store, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import DeliveryMapPreview from "./DeliveryMapPreview";

interface SellerInfo {
  shop_name: string;
  shop_address: string;
  shop_city: string;
  latitude: number | null;
  longitude: number | null;
}

interface EnrichedDelivery {
  id: string;
  created_at: string;
  delivery_city: string | null;
  delivery_address: string | null;
  delivery_notes: string | null;
  delivery_fee: number | null;
  buyer_latitude: number | null;
  buyer_longitude: number | null;
  total_amount: number;
  distance_km?: number;
  total_route_km?: number;
  itemCount?: number;
  seller?: SellerInfo;
  sellerCount?: number;
}

export default function AvailableDeliveriesTable() {
  const { data: deliveries, isLoading } = useAvailableDeliveries();
  const acceptDelivery = useAcceptDelivery();
  const { position, getCurrentPosition } = useCurrentPosition();
  const [enriched, setEnriched] = useState<EnrichedDelivery[]>([]);
  const [mapOrderId, setMapOrderId] = useState<string | null>(null);
  useEffect(() => {
    getCurrentPosition();
  }, []);

  // Enrich deliveries with distance and item count
  useEffect(() => {
    if (!deliveries || deliveries.length === 0) {
      setEnriched([]);
      return;
    }

    const enrich = async () => {
      const orderIds = deliveries.map(d => d.id);
      
      // Fetch item counts and seller IDs
      const { data: items } = await supabase
        .from("order_items")
        .select("order_id, seller_id")
        .in("order_id", orderIds);

      const itemCounts: Record<string, number> = {};
      const orderSellerIds: Record<string, string[]> = {};
      items?.forEach(item => {
        itemCounts[item.order_id] = (itemCounts[item.order_id] || 0) + 1;
        if (item.seller_id) {
          if (!orderSellerIds[item.order_id]) orderSellerIds[item.order_id] = [];
          if (!orderSellerIds[item.order_id].includes(item.seller_id)) {
            orderSellerIds[item.order_id].push(item.seller_id);
          }
        }
      });

      // Fetch seller locations
      const uniqueSellerIds = [...new Set(Object.values(orderSellerIds).flat())];
      const sellerMap: Record<string, SellerInfo> = {};
      if (uniqueSellerIds.length > 0) {
        const { data: sellers } = await supabase
          .from("seller_applications")
          .select("user_id, shop_name, shop_address, shop_city, latitude, longitude")
          .in("user_id", uniqueSellerIds)
          .eq("status", "approved");
        sellers?.forEach(s => {
          sellerMap[s.user_id] = s;
        });
      }

      const result: EnrichedDelivery[] = deliveries.map(d => {
        let distance_km: number | undefined;
        if (position && d.buyer_latitude && d.buyer_longitude) {
          distance_km = calculateDistance(position.latitude, position.longitude, d.buyer_latitude, d.buyer_longitude);
        }
        const sellerIds = orderSellerIds[d.id] || [];
        const sellerStops = sellerIds
          .map((id) => sellerMap[id])
          .filter((s) => s && s.latitude != null && s.longitude != null) as SellerInfo[];

        // Chain nearest-next: driver → s1 → s2 → ... → buyer
        let total_route_km: number | undefined;
        if (position) {
          const remaining = [...sellerStops];
          let curLat = position.latitude;
          let curLng = position.longitude;
          let total = 0;
          while (remaining.length) {
            let bestIdx = 0;
            let bestD = Infinity;
            remaining.forEach((s, i) => {
              const dd = calculateDistance(curLat, curLng, s.latitude!, s.longitude!);
              if (dd < bestD) { bestD = dd; bestIdx = i; }
            });
            total += bestD;
            const next = remaining.splice(bestIdx, 1)[0];
            curLat = next.latitude!;
            curLng = next.longitude!;
          }
          if (d.buyer_latitude && d.buyer_longitude) {
            total += calculateDistance(curLat, curLng, d.buyer_latitude, d.buyer_longitude);
          }
          total_route_km = total;
        }

        return {
          ...d,
          distance_km,
          total_route_km,
          itemCount: itemCounts[d.id] || 0,
          seller: sellerIds[0] ? sellerMap[sellerIds[0]] : undefined,
          sellerCount: sellerIds.length,
        };
      });

      // Sort by total chained route distance
      result.sort((a, b) => {
        const ka = a.total_route_km ?? a.distance_km ?? Infinity;
        const kb = b.total_route_km ?? b.distance_km ?? Infinity;
        return ka - kb;
      });

      setEnriched(result);
    };

    enrich();
  }, [deliveries, position]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 0 }).format(amount);

  const handleAccept = async (orderId: string) => {
    try {
      await acceptDelivery.mutateAsync(orderId);
      toast.success("Livraison acceptée !");
    } catch {
      toast.error("Erreur lors de l'acceptation");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!enriched || enriched.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Aucune livraison disponible</p>
        <p className="text-sm">Les nouvelles commandes apparaîtront ici</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {enriched.map((delivery) => (
        <Card key={delivery.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="font-mono">
                    #{delivery.id.slice(0, 8)}
                  </Badge>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(delivery.created_at), { addSuffix: true, locale: fr })}
                  </span>
                  {delivery.itemCount !== undefined && delivery.itemCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      <Package className="h-3 w-3 mr-1" />
                      {delivery.itemCount} article{delivery.itemCount > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                
                {/* Pickup location (seller) */}
                {delivery.seller && (
                  <div className="flex items-start gap-2 bg-orange-50 dark:bg-orange-950/20 rounded-lg p-2">
                    <Store className="h-4 w-4 text-orange-500 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-orange-600">
                        📦 Récupérer chez {delivery.sellerCount && delivery.sellerCount > 1 ? `${delivery.sellerCount} boutiques` : ""}
                      </p>
                      <p className="font-medium text-sm">
                        {delivery.seller.shop_name}
                        {delivery.sellerCount && delivery.sellerCount > 1 && (
                          <span className="text-muted-foreground"> + {delivery.sellerCount - 1} autre{delivery.sellerCount - 1 > 1 ? "s" : ""}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{delivery.seller.shop_address}, {delivery.seller.shop_city}</p>
                    </div>
                  </div>
                )}

                {/* Arrow between locations */}
                {delivery.seller && (
                  <div className="flex items-center gap-1 pl-2 text-muted-foreground">
                    <ArrowRight className="h-3 w-3" />
                    <span className="text-xs">puis livrer à</span>
                  </div>
                )}

                {/* Delivery location (buyer) */}
                <div className="flex items-start gap-2 bg-green-50 dark:bg-green-950/20 rounded-lg p-2">
                  <MapPin className="h-4 w-4 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-green-600">🏠 Livrer à</p>
                    <p className="font-medium text-sm">{delivery.delivery_city || "Ville non spécifiée"}</p>
                    <p className="text-xs text-muted-foreground">{delivery.delivery_address || "Adresse à confirmer"}</p>
                  </div>
                </div>

                {delivery.distance_km !== undefined && (
                  <div className="flex items-center gap-1 text-sm">
                    <Navigation className="h-3 w-3 text-primary" />
                    <span className="font-medium text-primary">{delivery.distance_km.toFixed(1)} km</span>
                    <span className="text-muted-foreground">de vous</span>
                  </div>
                )}

                {delivery.delivery_notes && (
                  <p className="text-sm text-muted-foreground italic">"{delivery.delivery_notes}"</p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Commission</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(delivery.delivery_fee || 0)}</p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMapOrderId(mapOrderId === delivery.id ? null : delivery.id)}
                  title="Voir le parcours"
                  className="gap-1"
                >
                  <Map className="h-4 w-4" />
                  <span className="hidden sm:inline">{mapOrderId === delivery.id ? "Masquer" : "Parcours"}</span>
                </Button>
                
                <Button
                  onClick={() => handleAccept(delivery.id)}
                  disabled={acceptDelivery.isPending}
                  className="gap-2"
                >
                  {acceptDelivery.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Accepter
                </Button>
              </div>
            </div>

            {/* Map Preview */}
            {mapOrderId === delivery.id && (
              <div className="mt-3">
                <DeliveryMapPreview
                  orderId={delivery.id}
                  buyerLat={delivery.buyer_latitude}
                  buyerLng={delivery.buyer_longitude}
                  driverLat={position?.latitude}
                  driverLng={position?.longitude}
                  onClose={() => setMapOrderId(null)}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
