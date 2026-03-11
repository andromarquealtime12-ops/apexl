import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  MapPin, Phone, Truck, Package, CheckCircle, Clock,
  Key, ChefHat, Navigation, ArrowLeft, Radio, Timer, MessageCircle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { CURRENCY_SYMBOLS } from "@/types/database";
import OpenStreetMap from "@/components/map/OpenStreetMap";
import { useDriverLocationsRealtime } from "@/hooks/useGeolocation";
import { estimateDeliveryTime } from "@/utils/deliveryEstimation";
import { Link } from "react-router-dom";
import OrderChat from "@/components/chat/OrderChat";

const TRACKING_STEPS = [
  { key: "confirmed", label: "Confirmée", icon: CheckCircle, description: "Commande acceptée" },
  { key: "preparing", label: "Préparation", icon: ChefHat, description: "Le vendeur prépare" },
  { key: "ready_for_pickup", label: "Prête", icon: Package, description: "En attente du livreur" },
  { key: "picked_up", label: "Récupérée", icon: Truck, description: "Livreur en route" },
  { key: "delivered", label: "Livrée", icon: CheckCircle, description: "Bon appétit !" },
];

const STATUS_INDEX: Record<string, number> = {
  pending: -1,
  confirmed: 0,
  preparing: 1,
  ready: 2,
  ready_for_pickup: 2,
  picked_up: 3,
  in_transit: 3,
  delivered: 4,
};

interface LiveOrderTrackingProps {
  orderId: string;
}

export default function LiveOrderTracking({ orderId }: LiveOrderTrackingProps) {
  const { user } = useAuth();
  const [driverPosition, setDriverPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [driverTrail, setDriverTrail] = useState<{ lat: number; lng: number }[]>([]);

  // Fetch order
  const { data: order, refetch: refetchOrder } = useQuery({
    queryKey: ["tracking-order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          items:order_items(
            id, quantity, unit_price,
            products(name, images)
          )
        `)
        .eq("id", orderId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
    refetchInterval: 10000,
  });

  // Fetch driver profile
  const { data: driverProfile } = useQuery({
    queryKey: ["tracking-driver", order?.driver_id],
    queryFn: async () => {
      if (!order?.driver_id) return null;
      const [profileRes, appRes] = await Promise.all([
        supabase.from("profiles").select("full_name, phone, avatar_url").eq("user_id", order.driver_id).single(),
        supabase.from("driver_applications").select("vehicle_type, vehicle_brand, vehicle_model, license_plate").eq("user_id", order.driver_id).eq("status", "approved").single(),
      ]);
      return {
        ...profileRes.data,
        ...appRes.data,
      };
    },
    enabled: !!order?.driver_id,
  });

  // Fetch driver live position
  const { data: driverLoc, refetch: refetchDriverLoc } = useQuery({
    queryKey: ["tracking-driver-loc", order?.driver_id],
    queryFn: async () => {
      if (!order?.driver_id) return null;
      const { data, error } = await supabase
        .from("driver_locations")
        .select("latitude, longitude, updated_at")
        .eq("driver_id", order.driver_id)
        .eq("is_online", true)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!order?.driver_id,
    refetchInterval: 5000,
  });

  // Fetch verification codes
  const { data: verification } = useQuery({
    queryKey: ["tracking-verification", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_verification")
        .select("*")
        .eq("order_id", orderId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!orderId,
    refetchInterval: 10000,
  });

  // Realtime driver location updates
  useDriverLocationsRealtime(
    useCallback((payload: any) => {
      if (payload.new?.driver_id === order?.driver_id) {
        const newPos = { lat: payload.new.latitude, lng: payload.new.longitude };
        setDriverPosition(newPos);
        // Add to trail (keep last 50 points)
        setDriverTrail(prev => {
          const last = prev[prev.length - 1];
          if (last && Math.abs(last.lat - newPos.lat) < 0.00005 && Math.abs(last.lng - newPos.lng) < 0.00005) {
            return prev; // Skip if hasn't moved much
          }
          return [...prev.slice(-49), newPos];
        });
        refetchDriverLoc();
      }
      refetchOrder();
    }, [order?.driver_id])
  );

  useEffect(() => {
    if (driverLoc) {
      const newPos = { lat: driverLoc.latitude, lng: driverLoc.longitude };
      setDriverPosition(newPos);
      setDriverTrail(prev => {
        if (prev.length === 0) return [newPos];
        return prev;
      });
    }
  }, [driverLoc]);

  // Reset trail when order changes status significantly
  useEffect(() => {
    if (order?.status === "picked_up" || order?.status === "in_transit") {
      // Keep trail for active delivery
    } else {
      setDriverTrail([]);
    }
  }, [order?.status]);

  if (!order) return null;

  const currentStepIndex = STATUS_INDEX[order.status || "pending"] ?? -1;
  const currencySymbol = CURRENCY_SYMBOLS[order.currency as keyof typeof CURRENCY_SYMBOLS] || "$";
  const isActive = ["confirmed", "preparing", "ready", "ready_for_pickup", "picked_up", "in_transit"].includes(order.status || "");
  const showDeliveryCode = verification?.delivery_code && ["picked_up", "in_transit"].includes(order.status || "");

  // ETA calculation
  const eta = driverPosition && order.buyer_latitude && order.buyer_longitude
    ? estimateDeliveryTime(
        driverPosition.lat,
        driverPosition.lng,
        order.buyer_latitude,
        order.buyer_longitude,
        driverProfile?.vehicle_type
      )
    : null;

  // Map markers
  const mapMarkers = [];
  if (order.buyer_latitude && order.buyer_longitude) {
    mapMarkers.push({ lat: order.buyer_latitude, lng: order.buyer_longitude, color: "green" as const, popup: "📍 Livraison ici" });
  }
  if (driverPosition) {
    mapMarkers.push({
      lat: driverPosition.lat,
      lng: driverPosition.lng,
      color: "blue" as const,
      popup: `🛵 Livreur${eta ? ` — ${eta.label} (${eta.distanceKm} km)` : ""}`,
    });
  }

  // Route lines: trail + direct line to destination
  const mapRoutes = [];
  
  // Driver trail (path already traveled)
  for (let i = 1; i < driverTrail.length; i++) {
    mapRoutes.push({
      from: driverTrail[i - 1],
      to: driverTrail[i],
      color: '#2563eb',
      dashed: false,
    });
  }
  
  // Dashed line from driver to destination
  if (driverPosition && order.buyer_latitude && order.buyer_longitude) {
    mapRoutes.push({
      from: driverPosition,
      to: { lat: order.buyer_latitude, lng: order.buyer_longitude },
      color: '#16a34a',
      dashed: true,
    });
  }

  const mapCenter = driverPosition
    ? { lat: driverPosition.lat, lng: driverPosition.lng }
    : order.buyer_latitude && order.buyer_longitude
      ? { lat: order.buyer_latitude, lng: order.buyer_longitude }
      : undefined;

  return (
    <div className="space-y-4">
      {/* Back button */}
      <Link to="/orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Retour aux commandes
      </Link>

      {/* ETA Banner */}
      {isActive && eta && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Timer className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Temps estimé d'arrivée</p>
                  <p className="text-2xl font-bold text-primary">{eta.label}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Distance</p>
                <p className="text-lg font-semibold">{eta.distanceKm} km</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Map */}
      {isActive && mapCenter && (
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="relative">
            <OpenStreetMap
              center={mapCenter}
              zoom={14}
              markers={mapMarkers}
              routes={mapRoutes}
              className="h-[350px] w-full"
              showUserLocation={!!order.buyer_latitude}
              userPosition={order.buyer_latitude ? { lat: order.buyer_latitude, lng: order.buyer_longitude! } : null}
            />
            <div className="absolute top-3 left-3 flex gap-2">
              {driverPosition && (
                <div className="bg-background/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg flex items-center gap-2">
                  <Radio className="h-3 w-3 text-green-500 animate-pulse" />
                  <span className="text-xs font-medium">En direct</span>
                </div>
              )}
              {driverTrail.length > 1 && (
                <div className="bg-background/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg flex items-center gap-2">
                  <Navigation className="h-3 w-3 text-primary" />
                  <span className="text-xs font-medium">{driverTrail.length} pts</span>
                </div>
              )}
            </div>
            {/* Legend */}
            <div className="absolute bottom-3 right-3 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg text-xs space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-[#2563eb]" />
                <span>Trajet parcouru</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 border-t-2 border-dashed border-[#16a34a]" />
                <span>Reste à parcourir</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Progress Steps */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm text-muted-foreground">Commande</p>
              <p className="font-mono text-xs">#{orderId.slice(0, 8)}</p>
            </div>
            <Badge variant={isActive ? "default" : "secondary"} className={isActive ? "bg-green-500 animate-pulse" : ""}>
              {isActive ? "En cours" : order.status === "delivered" ? "Livrée ✓" : order.status}
            </Badge>
          </div>

          {/* Step tracker */}
          <div className="relative">
            {TRACKING_STEPS.map((step, i) => {
              const StepIcon = step.icon;
              const isCompleted = currentStepIndex >= i;
              const isCurrent = currentStepIndex === i;

              return (
                <div key={step.key} className="flex items-start gap-4 relative">
                  {i < TRACKING_STEPS.length - 1 && (
                    <div className={`absolute left-[15px] top-[32px] w-0.5 h-[calc(100%-8px)] ${isCompleted ? "bg-primary" : "bg-muted"}`} />
                  )}
                  
                  <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 shrink-0 transition-all ${
                    isCurrent ? "border-primary bg-primary text-primary-foreground scale-110 shadow-lg" :
                    isCompleted ? "border-primary bg-primary text-primary-foreground" :
                    "border-muted bg-background text-muted-foreground"
                  }`}>
                    <StepIcon className="h-4 w-4" />
                  </div>

                  <div className={`pb-6 ${isCurrent ? "" : "opacity-60"}`}>
                    <p className={`font-medium text-sm ${isCurrent ? "text-primary" : ""}`}>{step.label}</p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                    {isCurrent && eta && i >= 3 && (
                      <p className="text-xs text-primary mt-1 flex items-center gap-1">
                        <Timer className="h-3 w-3" />
                        ~{eta.label} restantes
                      </p>
                    )}
                    {isCurrent && !eta && (
                      <p className="text-xs text-primary mt-1 animate-pulse">En cours...</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Delivery Code */}
      {showDeliveryCode && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="pt-6 text-center">
            <Key className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium mb-2">Code de livraison</p>
            <p className="text-4xl font-mono font-bold tracking-[0.4em] text-primary">
              {verification!.delivery_code}
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Donnez ce code au livreur pour confirmer la réception
            </p>
          </CardContent>
        </Card>
      )}

      {/* Driver Card */}
      {order.driver_id && driverProfile && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                  {driverProfile.full_name?.charAt(0) || "L"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold">{driverProfile.full_name || "Livreur"}</p>
                {driverProfile.vehicle_type && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Truck className="h-3 w-3" />
                    {driverProfile.vehicle_brand} {driverProfile.vehicle_model || ""} • {driverProfile.license_plate}
                  </p>
                )}
                {eta && (
                  <p className="text-xs text-primary flex items-center gap-1 mt-1">
                    <Timer className="h-3 w-3" />
                    Arrivée dans ~{eta.label} ({eta.distanceKm} km)
                  </p>
                )}
              </div>
              {driverProfile.phone && (
                <Button variant="outline" size="icon" className="rounded-full h-12 w-12" asChild>
                  <a href={`tel:${driverProfile.phone}`}>
                    <Phone className="h-5 w-5" />
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order Summary */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <p className="font-medium text-sm">Résumé de la commande</p>
          {order.items?.map((item: any) => (
            <div key={item.id} className="flex items-center gap-3">
              <img
                src={item.products?.images?.[0] || "/placeholder.svg"}
                alt={item.products?.name}
                className="w-10 h-10 rounded object-cover bg-muted"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{item.products?.name}</p>
                <p className="text-xs text-muted-foreground">x{item.quantity}</p>
              </div>
              <p className="text-sm font-medium">{currencySymbol}{(item.unit_price * item.quantity).toLocaleString()}</p>
            </div>
          ))}
          <Separator />
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{order.delivery_address}, {order.delivery_city}</span>
          </div>
          <div className="flex justify-between font-semibold pt-2">
            <span>Total</span>
            <span>{currencySymbol}{order.total_amount?.toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
