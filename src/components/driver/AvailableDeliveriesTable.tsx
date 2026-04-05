import { useEffect, useState } from "react";
import { useAvailableDeliveries } from "@/hooks/useDriverStats";
import { useAcceptDelivery } from "@/hooks/useDriverActions";
import { useCurrentPosition, calculateDistance } from "@/hooks/useGeolocation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Package, Clock, Check, Navigation, Loader2, Map } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import DeliveryMapPreview from "./DeliveryMapPreview";

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
  itemCount?: number;
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
      const { data: items } = await supabase
        .from("order_items")
        .select("order_id")
        .in("order_id", orderIds);

      const itemCounts: Record<string, number> = {};
      items?.forEach(item => {
        itemCounts[item.order_id] = (itemCounts[item.order_id] || 0) + 1;
      });

      const result: EnrichedDelivery[] = deliveries.map(d => {
        let distance_km: number | undefined;
        if (position && d.buyer_latitude && d.buyer_longitude) {
          distance_km = calculateDistance(position.latitude, position.longitude, d.buyer_latitude, d.buyer_longitude);
        }
        return {
          ...d,
          distance_km,
          itemCount: itemCounts[d.id] || 0,
        };
      });

      // Sort by distance if available
      result.sort((a, b) => {
        if (a.distance_km !== undefined && b.distance_km !== undefined) return a.distance_km - b.distance_km;
        if (a.distance_km !== undefined) return -1;
        return 1;
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
                
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">{delivery.delivery_city || "Ville non spécifiée"}</p>
                    <p className="text-sm text-muted-foreground">{delivery.delivery_address || "Adresse à confirmer"}</p>
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
                  size="icon"
                  onClick={() => setMapOrderId(mapOrderId === delivery.id ? null : delivery.id)}
                  title="Voir sur la carte"
                >
                  <Map className="h-4 w-4" />
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
