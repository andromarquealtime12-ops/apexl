import { useState, useEffect } from "react";
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

export default function DeliveryMapPreview({
  orderId,
  buyerLat,
  buyerLng,
  driverLat,
  driverLng,
  onClose,
}: DeliveryMapPreviewProps) {
  // Fetch seller location from order items
  const { data: sellerInfo } = useQuery({
    queryKey: ["delivery-preview-seller", orderId],
    queryFn: async () => {
      const { data: items } = await supabase
        .from("order_items")
        .select("seller_id")
        .eq("order_id", orderId)
        .limit(1);

      if (!items?.length || !items[0].seller_id) return null;

      const { data: seller } = await supabase
        .from("seller_applications")
        .select("latitude, longitude, shop_name, shop_address, shop_city")
        .eq("user_id", items[0].seller_id)
        .eq("status", "approved")
        .maybeSingle();

      return seller;
    },
  });

  const markers = [];
  const routes = [];

  // Driver position
  if (driverLat && driverLng) {
    markers.push({
      lat: driverLat,
      lng: driverLng,
      color: "blue" as const,
      popup: "🚗 Vous",
    });
  }

  // Seller (pickup)
  if (sellerInfo?.latitude && sellerInfo?.longitude) {
    markers.push({
      lat: sellerInfo.latitude,
      lng: sellerInfo.longitude,
      color: "red" as const,
      popup: `📦 ${sellerInfo.shop_name}`,
    });

    // Route: driver → seller
    if (driverLat && driverLng) {
      routes.push({
        from: { lat: driverLat, lng: driverLng },
        to: { lat: sellerInfo.latitude, lng: sellerInfo.longitude },
        color: "#f97316",
        dashed: true,
      });
    }
  }

  // Buyer (delivery)
  if (buyerLat && buyerLng) {
    markers.push({
      lat: buyerLat,
      lng: buyerLng,
      color: "green" as const,
      popup: "🏠 Livraison",
    });

    // Route: seller → buyer
    if (sellerInfo?.latitude && sellerInfo?.longitude) {
      routes.push({
        from: { lat: sellerInfo.latitude, lng: sellerInfo.longitude },
        to: { lat: buyerLat, lng: buyerLng },
        color: "#16a34a",
        dashed: true,
      });
    }
  }

  // Calculate distances
  const pickupDist =
    driverLat && driverLng && sellerInfo?.latitude && sellerInfo?.longitude
      ? calculateDistance(driverLat, driverLng, sellerInfo.latitude, sellerInfo.longitude)
      : null;

  const deliveryDist =
    sellerInfo?.latitude && sellerInfo?.longitude && buyerLat && buyerLng
      ? calculateDistance(sellerInfo.latitude, sellerInfo.longitude, buyerLat, buyerLng)
      : null;

  const totalDist = pickupDist !== null && deliveryDist !== null ? pickupDist + deliveryDist : null;

  // Center map on middle of all points
  const allLats = markers.map((m) => m.lat);
  const allLngs = markers.map((m) => m.lng);
  const center =
    allLats.length > 0
      ? {
          lat: (Math.min(...allLats) + Math.max(...allLats)) / 2,
          lng: (Math.min(...allLngs) + Math.max(...allLngs)) / 2,
        }
      : undefined;

  if (!center) return null;

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
            className="h-[200px] w-full"
          />

          {/* Distance info overlay */}
          <div className="absolute bottom-2 left-2 right-2 z-[1000] flex gap-2 flex-wrap">
            {pickupDist !== null && (
              <Badge className="bg-orange-500/90 text-white gap-1">
                <Store className="h-3 w-3" />
                Récup: {pickupDist.toFixed(1)} km
              </Badge>
            )}
            {deliveryDist !== null && (
              <Badge className="bg-green-600/90 text-white gap-1">
                <MapPin className="h-3 w-3" />
                Livr: {deliveryDist.toFixed(1)} km
              </Badge>
            )}
            {totalDist !== null && (
              <Badge className="bg-primary/90 text-primary-foreground gap-1">
                <Navigation className="h-3 w-3" />
                Total: {totalDist.toFixed(1)} km
              </Badge>
            )}
          </div>
        </div>

        {sellerInfo && (
          <div className="p-2 text-xs text-muted-foreground border-t flex items-center gap-1">
            <Store className="h-3 w-3" />
            Récupérer chez: <span className="font-medium text-foreground">{sellerInfo.shop_name}</span>
            {sellerInfo.shop_city && <span>• {sellerInfo.shop_city}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
