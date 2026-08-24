import { useEffect, useState } from "react";
import { useAvailableDeliveries } from "@/hooks/useDriverStats";
import { useAcceptDelivery } from "@/hooks/useDriverActions";
import { useCurrentPosition, calculateDistance, useDriverLocation } from "@/hooks/useGeolocation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Package, Clock, Check, Navigation, Loader2, Map, Store, ArrowRight, Route, Banknote } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import DeliveryMapPreview from "./DeliveryMapPreview";
import { getMultiLegRoute } from "@/utils/osrmRouting";


interface SellerInfo {
  shop_name: string;
  shop_address: string;
  shop_city: string;
  latitude: number | null;
  longitude: number | null;
}

interface RouteStep {
  label: string;
  sublabel?: string;
  distance_from_prev: number;
  type: "seller" | "buyer";
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
  seller_buyer_km?: number;
  total_route_km?: number;
  itemCount?: number;
  seller?: SellerInfo;
  sellerCount?: number;
  steps?: RouteStep[];
}

export default function AvailableDeliveriesTable() {
  const { t } = useTranslation();
  const { data: deliveries, isLoading } = useAvailableDeliveries();
  const { data: driverLocation } = useDriverLocation();
  const isOnline = driverLocation?.is_online ?? false;
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
        const { data: allShops } = await (supabase as any)
          .rpc("get_public_seller_shops", { p_user_id: null });
        const sellers = (allShops || []).filter((s: any) => uniqueSellerIds.includes(s.user_id));
        sellers?.forEach((s: any) => {
          sellerMap[s.user_id] = s;
        });
      }

      const baseResults: EnrichedDelivery[] = deliveries.map((d: any) => {
        // Buyer coordinate fallback: prefer explicit buyer position, else delivery pin
        const bLat = d.buyer_latitude ?? d.delivery_lat ?? null;
        const bLng = d.buyer_longitude ?? d.delivery_lng ?? null;
        let distance_km: number | undefined;
        if (position && bLat && bLng) {
          distance_km = calculateDistance(position.latitude, position.longitude, bLat, bLng);
        }
        const sellerIds = orderSellerIds[d.id] || [];
        const sellerStops = sellerIds
          .map((id) => sellerMap[id])
          .filter((s) => s && s.latitude != null && s.longitude != null) as SellerInfo[];

        // Nearest-next ordering (haversine, fast) — pick the visit order
        const ordered: SellerInfo[] = [];
        const remaining = [...sellerStops];
        let curLat = position?.latitude ?? sellerStops[0]?.latitude ?? null;
        let curLng = position?.longitude ?? sellerStops[0]?.longitude ?? null;
        while (remaining.length && curLat != null && curLng != null) {
          let bestIdx = 0;
          let bestD = Infinity;
          remaining.forEach((s, i) => {
            const dd = calculateDistance(curLat!, curLng!, s.latitude!, s.longitude!);
            if (dd < bestD) { bestD = dd; bestIdx = i; }
          });
          const next = remaining.splice(bestIdx, 1)[0];
          ordered.push(next);
          curLat = next.latitude!;
          curLng = next.longitude!;
        }
        // Never drop stops (e.g. when driver position is unknown)
        ordered.push(...remaining);

        // Seller → buyer distance (independent of driver position)
        let seller_buyer_km: number | undefined;
        const lastStop = ordered[ordered.length - 1];
        if (lastStop?.latitude != null && lastStop?.longitude != null && bLat && bLng) {
          seller_buyer_km = calculateDistance(lastStop.latitude, lastStop.longitude, bLat, bLng);
        }

        return {
          ...d,
          buyer_latitude: bLat,
          buyer_longitude: bLng,
          distance_km,
          seller_buyer_km,
          itemCount: itemCounts[d.id] || 0,
          seller: sellerIds[0] ? sellerMap[sellerIds[0]] : undefined,
          sellerCount: sellerIds.length,
          _orderedStops: ordered,
        } as any;
      });

      // Enrich each delivery with REAL road distance (OSRM) — chained
      // Driver → seller₁ → seller₂ → … → buyer. Falls back to haversine on error.
      const result: EnrichedDelivery[] = await Promise.all(
        baseResults.map(async (d: any) => {
          const points: Array<{ lat: number; lng: number }> = [];
          if (position) points.push({ lat: position.latitude, lng: position.longitude });
          d._orderedStops.forEach((s: SellerInfo) =>
            points.push({ lat: s.latitude!, lng: s.longitude! })
          );
          if (d.buyer_latitude && d.buyer_longitude) {
            points.push({ lat: d.buyer_latitude, lng: d.buyer_longitude });
          }

          if (points.length < 2) return d;

          const chained = await getMultiLegRoute(points);
          // Build per-step distances from OSRM legs
          const steps: RouteStep[] = [];
          const legDistances: number[] = [];
          for (let i = 0; i < points.length - 1; i++) {
            const leg = await import("@/utils/osrmRouting").then(m =>
              m.getRoute(points[i], points[i + 1])
            );
            legDistances.push(leg.distanceKm);
          }
          d._orderedStops.forEach((s: SellerInfo, idx: number) => {
            steps.push({
              label: s.shop_name,
              sublabel: `${s.shop_address}, ${s.shop_city}`,
              distance_from_prev: legDistances[idx] ?? 0,
              type: "seller",
            });
          });
          if (d.buyer_latitude && d.buyer_longitude) {
            steps.push({
              label: d.delivery_city || "Client",
              sublabel: d.delivery_address || undefined,
              distance_from_prev: legDistances[legDistances.length - 1] ?? 0,
              type: "buyer",
            });
          }

          return {
            ...d,
            total_route_km: chained.distanceKm,
            steps,
            _routeDurationMin: chained.durationMin,
            _routeIsFallback: chained.isFallback,
          } as any;
        })
      );

      // Sort by total road distance (fallback to straight-line if OSRM failed)
      result.sort((a: any, b: any) => {
        const ka = a.total_route_km ?? a.distance_km ?? Infinity;
        const kb = b.total_route_km ?? b.distance_km ?? Infinity;
        return ka - kb;
      });

      // Only keep deliveries within 60 km road distance from driver
      const within60 = position
        ? result.filter((d: any) => {
            const km = d.total_route_km ?? d.distance_km ?? Infinity;
            return km <= 60;
          })
        : result;

      setEnriched(within60);
    };


    enrich();
  }, [deliveries, position]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 0 }).format(amount);

  const handleAccept = async (orderId: string) => {
    try {
      await acceptDelivery.mutateAsync(orderId);
      toast.success(t("driverx.available.acceptSuccess"));
    } catch (e: any) {
      toast.error(e?.message || t("driverx.available.acceptError"));
    }
  };

  if (!isOnline) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium text-foreground">{t("driverx.available.offline")}</p>
        <p className="text-sm">
          {t("driverx.available.offlineHint")}
        </p>
      </div>
    );
  }

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
        <Loader2 className="h-10 w-10 mx-auto mb-3 animate-spin text-primary" />
        <p className="font-medium text-foreground">{t("driverx.available.searching")}</p>
        <p className="text-sm">{t("driverx.available.searchingHint")}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        {t("driverx.available.searchingMore")}
      </div>
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
                      {t("driverx.available.items", { count: delivery.itemCount })}
                    </Badge>
                  )}
                </div>
                
                {/* Pickup location (seller) */}
                {delivery.seller && (
                  <div className="flex items-start gap-2 bg-orange-50 dark:bg-orange-950/20 rounded-lg p-2">
                    <Store className="h-4 w-4 text-orange-500 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-orange-600">
                        📦 {delivery.sellerCount && delivery.sellerCount > 1 ? t("driverx.available.pickupAtMulti", { count: delivery.sellerCount }) : t("driverx.available.pickupAt")}
                      </p>
                      <p className="font-medium text-sm">
                        {delivery.seller.shop_name}
                        {delivery.sellerCount && delivery.sellerCount > 1 && (
                          <span className="text-muted-foreground"> {t("driverx.available.andOthers", { count: delivery.sellerCount - 1 })}</span>
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
                    <span className="text-xs">{t("driverx.available.thenDeliverTo")}</span>
                  </div>
                )}

                {/* Delivery location (buyer) */}
                <div className="flex items-start gap-2 bg-green-50 dark:bg-green-950/20 rounded-lg p-2">
                  <MapPin className="h-4 w-4 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-green-600">🏠 {t("driverx.available.deliverTo")}</p>
                    <p className="font-medium text-sm">{delivery.delivery_city || t("driverx.available.cityUnspecified")}</p>
                    <p className="text-xs text-muted-foreground">{delivery.delivery_address || t("driverx.available.addressToConfirm")}</p>
                  </div>
                </div>

                {(delivery.total_route_km !== undefined || delivery.distance_km !== undefined || delivery.seller_buyer_km !== undefined) && (
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    {delivery.total_route_km !== undefined && (
                      <span className="flex items-center gap-1">
                        <Navigation className="h-3 w-3 text-primary" />
                        <span className="font-medium text-primary">{t("driverx.available.totalRoute", { km: delivery.total_route_km.toFixed(1) })}</span>
                      </span>
                    )}
                    {(delivery as any)._routeDurationMin !== undefined && (
                      <Badge variant="secondary" className="text-xs">
                        ⏱ ≈ {(delivery as any)._routeDurationMin >= 60
                          ? `${Math.floor((delivery as any)._routeDurationMin / 60)}h${String((delivery as any)._routeDurationMin % 60).padStart(2, "0")}`
                          : `${(delivery as any)._routeDurationMin} min`}
                      </Badge>
                    )}
                    {delivery.seller_buyer_km !== undefined && (
                      <Badge variant="outline" className="text-xs gap-1 border-green-600 text-green-700">
                        <Route className="h-3 w-3" />
                        {t("driverx.available.sellerToBuyer", { km: delivery.seller_buyer_km.toFixed(1) })}
                      </Badge>
                    )}
                    {delivery.distance_km !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {t("driverx.available.clientDistance", { km: delivery.distance_km.toFixed(1) })}
                      </span>
                    )}
                  </div>
                )}
                {/* Cash payment alert on available list */}
                {(delivery as any).payment_method === "cash" && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-2">
                    <Banknote className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-bold text-amber-700 dark:text-amber-400">{t("driverx.available.cashPayment")}</p>
                      <p className="text-muted-foreground">
                        {t("driverx.available.cashCollect")} <span className="font-semibold text-foreground">{formatCurrency(Number(delivery.total_amount || 0))}</span> {t("driverx.available.cashFromBuyer")}
                        {t("driverx.available.cashGiveSeller")} <span className="font-semibold text-foreground">{formatCurrency(Number(delivery.total_amount || 0) - Number(delivery.delivery_fee || 0))}</span> {t("driverx.available.cashToSeller")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Étapes du parcours */}
                {delivery.steps && delivery.steps.length > 0 && (
                  <div className="rounded-lg border bg-muted/30 p-3 mt-2">
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1">
                      <Navigation className="h-3 w-3 text-primary" />
                      {t("driverx.available.routeSteps")}
                    </p>
                    <ol className="space-y-1.5">
                      {delivery.steps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs">
                          <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                            step.type === "buyer" ? "bg-green-500/20 text-green-700" : "bg-orange-500/20 text-orange-700"
                          }`}>
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {step.type === "seller" ? "📦 " : "🏠 "}{step.label}
                            </p>
                            {step.sublabel && (
                              <p className="text-muted-foreground truncate">{step.sublabel}</p>
                            )}
                          </div>
                          <span className="text-muted-foreground whitespace-nowrap">
                            +{step.distance_from_prev.toFixed(1)} km
                          </span>
                        </li>
                      ))}
                    </ol>
                    {delivery.total_route_km !== undefined && (
                      <div className="mt-2 pt-2 border-t flex justify-between text-xs font-semibold">
                        <span>{t("driverx.available.total")}</span>
                        <span className="text-primary">{delivery.total_route_km.toFixed(1)} km</span>
                      </div>
                    )}
                  </div>
                )}

                {(delivery.delivery_notes || (delivery as any).delivery_address2) && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-1 text-xs">
                    <p className="font-bold text-primary">📍 {t("driverx.my.addressDetails")}</p>
                    {(delivery as any).delivery_address2 && (
                      <p><span className="text-muted-foreground">{t("driverx.my.houseNumber")}</span> <span className="font-semibold">{(delivery as any).delivery_address2}</span></p>
                    )}
                    {delivery.delivery_notes && (
                      <p className="italic">🗒️ "{delivery.delivery_notes}"</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{t("driverx.available.commission")}</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(delivery.delivery_fee || 0)}</p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMapOrderId(mapOrderId === delivery.id ? null : delivery.id)}
                  title={t("driverx.available.viewRoute")}
                  className="gap-1"
                >
                  <Map className="h-4 w-4" />
                  <span className="hidden sm:inline">{mapOrderId === delivery.id ? t("driverx.available.hideRoute") : t("driverx.available.viewRoute")}</span>
                </Button>
                
                <Button
                  onClick={() => handleAccept(delivery.id)}
                  disabled={acceptDelivery.isPending}
                  className="gap-2"
                >
                  {acceptDelivery.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {t("driverx.available.accept")}
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
