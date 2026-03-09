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
  Key, ChefHat, Navigation, ArrowLeft, Radio
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { CURRENCY_SYMBOLS } from "@/types/database";
import OpenStreetMap from "@/components/map/OpenStreetMap";
import { useDriverLocationsRealtime } from "@/hooks/useGeolocation";
import { Link } from "react-router-dom";

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
        setDriverPosition({ lat: payload.new.latitude, lng: payload.new.longitude });
        refetchDriverLoc();
      }
      refetchOrder();
    }, [order?.driver_id])
  );

  useEffect(() => {
    if (driverLoc) {
      setDriverPosition({ lat: driverLoc.latitude, lng: driverLoc.longitude });
    }
  }, [driverLoc]);

  if (!order) return null;

  const currentStepIndex = STATUS_INDEX[order.status || "pending"] ?? -1;
  const currencySymbol = CURRENCY_SYMBOLS[order.currency as keyof typeof CURRENCY_SYMBOLS] || "$";
  const isActive = ["confirmed", "preparing", "ready", "ready_for_pickup", "picked_up", "in_transit"].includes(order.status || "");
  const showDeliveryCode = verification?.delivery_code && ["picked_up", "in_transit"].includes(order.status || "");

  // Map markers
  const mapMarkers = [];
  if (order.buyer_latitude && order.buyer_longitude) {
    mapMarkers.push({ lat: order.buyer_latitude, lng: order.buyer_longitude, color: "green" as const, popup: "📍 Livraison ici" });
  }
  if (driverPosition) {
    mapMarkers.push({ lat: driverPosition.lat, lng: driverPosition.lng, color: "blue" as const, popup: "🛵 Livreur" });
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

      {/* Live Map */}
      {isActive && mapCenter && (
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="relative">
            <OpenStreetMap
              center={mapCenter}
              zoom={14}
              markers={mapMarkers}
              className="h-[300px] w-full"
              showUserLocation={!!order.buyer_latitude}
              userPosition={order.buyer_latitude ? { lat: order.buyer_latitude, lng: order.buyer_longitude! } : null}
            />
            {driverPosition && (
              <div className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg flex items-center gap-2">
                <Radio className="h-3 w-3 text-green-500 animate-pulse" />
                <span className="text-xs font-medium">En direct</span>
              </div>
            )}
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
                  {/* Vertical line */}
                  {i < TRACKING_STEPS.length - 1 && (
                    <div className={`absolute left-[15px] top-[32px] w-0.5 h-[calc(100%-8px)] ${isCompleted ? "bg-primary" : "bg-muted"}`} />
                  )}
                  
                  {/* Circle */}
                  <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 shrink-0 transition-all ${
                    isCurrent ? "border-primary bg-primary text-primary-foreground scale-110 shadow-lg" :
                    isCompleted ? "border-primary bg-primary text-primary-foreground" :
                    "border-muted bg-background text-muted-foreground"
                  }`}>
                    <StepIcon className="h-4 w-4" />
                  </div>

                  {/* Label */}
                  <div className={`pb-6 ${isCurrent ? "" : "opacity-60"}`}>
                    <p className={`font-medium text-sm ${isCurrent ? "text-primary" : ""}`}>{step.label}</p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                    {isCurrent && (
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
