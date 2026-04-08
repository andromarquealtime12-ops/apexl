import { useState } from "react";
import { useDriverDeliveries } from "@/hooks/useDriverStats";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Package, Navigation, Key, ExternalLink, MessageSquare, Phone, ShoppingBag } from "lucide-react";
import { DeliveryCodeVerification } from "./DeliveryCodeVerification";
import OrderChat from "@/components/chat/OrderChat";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; action?: "pickup" | "delivery"; actionLabel?: string }> = {
  ready: { 
    label: "Prête - À récupérer", 
    variant: "outline",
    action: "pickup",
    actionLabel: "Entrer code récupération"
  },
  ready_for_pickup: { 
    label: "À récupérer", 
    variant: "outline",
    action: "pickup",
    actionLabel: "Entrer code récupération"
  },
  picked_up: { 
    label: "Récupérée - En route", 
    variant: "default",
    action: "delivery",
    actionLabel: "Entrer code livraison"
  },
  in_transit: { 
    label: "En livraison", 
    variant: "default",
    action: "delivery",
    actionLabel: "Entrer code livraison"
  },
  delivered: { 
    label: "Livrée", 
    variant: "secondary"
  },
  cancelled: { 
    label: "Annulée", 
    variant: "destructive"
  },
  pending: { label: "En attente", variant: "secondary" },
  confirmed: { label: "Confirmée", variant: "default" },
  preparing: { label: "En préparation", variant: "outline" },
  return_requested: { label: "Retour demandé", variant: "destructive" },
  return_pickup_ready: { label: "Retour prêt", variant: "outline" },
  return_in_transit: { label: "Retour en cours", variant: "default" },
  returned: { label: "Retourné", variant: "secondary" },
  refunded: { label: "Remboursé", variant: "destructive" },
  redelivery: { label: "Re-livraison", variant: "default" },
};

function getNavigationUrl(lat?: number | null, lng?: number | null, address?: string | null) {
  if (lat && lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  if (address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  }
  return null;
}

function WhatsAppButton({ userId, label }: { userId: string; label: string }) {
  const { data: profile } = useQuery({
    queryKey: ["contact-whatsapp", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("whatsapp, phone, full_name")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  const whatsappNumber = profile?.whatsapp || profile?.phone;
  if (!whatsappNumber) return null;

  const cleanNumber = whatsappNumber.replace(/[^0-9+]/g, "").replace(/^\+/, "");
  const url = `https://wa.me/${cleanNumber}`;

  return (
    <Button variant="outline" size="sm" className="gap-1" asChild>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <MessageSquare className="h-3 w-3" />
        {label}
      </a>
    </Button>
  );
}

function PhoneCallButton({ userId, label }: { userId: string; label: string }) {
  const { data: profile } = useQuery({
    queryKey: ["contact-phone", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("phone, full_name")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  if (!profile?.phone) return null;

  return (
    <Button variant="outline" size="sm" className="gap-1" asChild>
      <a href={`tel:${profile.phone}`}>
        <Phone className="h-3 w-3" />
        Appeler {label}
      </a>
    </Button>
  );
}

export default function MyDeliveriesTable() {
  const [verificationModal, setVerificationModal] = useState<{
    isOpen: boolean;
    orderId: string;
    type: "pickup" | "delivery";
  }>({ isOpen: false, orderId: "", type: "pickup" });
  const { data: deliveries, isLoading } = useDriverDeliveries();

  // Fetch seller locations for navigation to seller (not buyer) before pickup
  const { data: sellerLocations } = useQuery({
    queryKey: ["seller-locations-for-deliveries", deliveries?.map(d => d.id)],
    queryFn: async () => {
      if (!deliveries?.length) return {};
      const orderIds = deliveries.filter(d => !["delivered", "cancelled"].includes(d.status || "")).map(d => d.id);
      if (orderIds.length === 0) return {};

      const { data: items } = await supabase
        .from("order_items")
        .select("order_id, seller_id")
        .in("order_id", orderIds);

      if (!items?.length) return {};

      const sellerIds = [...new Set(items.map(i => i.seller_id).filter(Boolean))];
      const { data: sellers } = await supabase
        .from("seller_applications")
        .select("user_id, latitude, longitude, shop_address, shop_city, shop_name")
        .in("user_id", sellerIds as string[])
        .eq("status", "approved");

      const result: Record<string, any> = {};
      items.forEach(item => {
        if (item.seller_id) {
          const seller = sellers?.find(s => s.user_id === item.seller_id);
          if (seller) {
            result[item.order_id] = seller;
          }
        }
      });
      return result;
    },
    enabled: !!deliveries?.length,
  });

  // Fetch order items with product names for deliveries
  const { data: orderProducts } = useQuery({
    queryKey: ["delivery-order-items", deliveries?.map(d => d.id)],
    queryFn: async () => {
      if (!deliveries?.length) return {};
      const orderIds = deliveries.map(d => d.id);
      const { data: items } = await supabase
        .from("order_items")
        .select("order_id, quantity, unit_price, selected_color, selected_size, product_id")
        .in("order_id", orderIds);

      if (!items?.length) return {};

      // Fetch product names
      const productIds = [...new Set(items.map(i => i.product_id).filter(Boolean))];
      const { data: products } = await supabase
        .from("products")
        .select("id, name, images")
        .in("id", productIds as string[]);

      const productMap: Record<string, { name: string; image?: string }> = {};
      products?.forEach(p => {
        productMap[p.id] = { name: p.name, image: p.images?.[0] };
      });

      const result: Record<string, Array<{ name: string; quantity: number; color?: string; size?: string; image?: string }>> = {};
      items.forEach(item => {
        if (!result[item.order_id]) result[item.order_id] = [];
        const product = item.product_id ? productMap[item.product_id] : null;
        result[item.order_id].push({
          name: product?.name || "Produit",
          quantity: item.quantity,
          color: item.selected_color || undefined,
          size: item.selected_size || undefined,
          image: product?.image,
        });
      });
      return result;
    },
    enabled: !!deliveries?.length,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const openVerification = (orderId: string, type: "pickup" | "delivery") => {
    setVerificationModal({ isOpen: true, orderId, type });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const activeDeliveries = deliveries?.filter(d => d.status !== "delivered" && d.status !== "cancelled") || [];
  const completedDeliveries = deliveries?.filter(d => d.status === "delivered" || d.status === "cancelled") || [];

  if (!deliveries || deliveries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Aucune livraison assignée</p>
        <p className="text-sm">Acceptez des livraisons dans l'onglet "Disponibles"</p>
      </div>
    );
  }

  // Determine if pickup is done (status picked_up or later)
  const isPickupDone = (status: string | null) => {
    return ["picked_up", "in_transit", "delivering", "delivered"].includes(status || "");
  };

  return (
    <>
      <div className="space-y-6">
        {activeDeliveries.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              En cours ({activeDeliveries.length})
            </h3>
            <div className="grid gap-4">
              {activeDeliveries.map((delivery) => {
                const status = statusConfig[delivery.status || "ready_for_pickup"] || { label: delivery.status || "Inconnu", variant: "outline" as const };
                const pickupDone = isPickupDone(delivery.status);
                const seller = sellerLocations?.[delivery.id];
                
                // Before pickup: navigate to seller. After pickup: navigate to buyer.
                const navUrl = pickupDone
                  ? getNavigationUrl(delivery.buyer_latitude, delivery.buyer_longitude, delivery.delivery_address)
                  : getNavigationUrl(seller?.latitude, seller?.longitude, seller?.shop_address ? `${seller.shop_address}, ${seller.shop_city}` : null);

                // Get seller_id from sellerLocations for WhatsApp
                const sellerUserId = seller?.user_id;
                
                return (
                  <Card key={delivery.id} className="border-primary/20 bg-primary/5">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="font-mono">
                            #{delivery.id.slice(0, 8)}
                          </Badge>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        
                        {/* Before pickup: show seller location. After: show buyer destination */}
                        {!pickupDone && seller ? (
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-orange-500 mt-0.5" />
                            <div>
                              <p className="font-medium text-orange-600">📦 Récupérer chez: {seller.shop_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {seller.shop_address}, {seller.shop_city}
                              </p>
                            </div>
                          </div>
                        ) : pickupDone ? (
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-primary mt-0.5" />
                            <div>
                              <p className="font-medium">🏠 Livrer à: {delivery.delivery_city || "Ville"}</p>
                              <p className="text-sm text-muted-foreground">
                                {delivery.delivery_address || "Adresse à confirmer"}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="font-medium">En attente de récupération</p>
                            </div>
                          </div>
                        )}

                        {/* Product details */}
                        {orderProducts?.[delivery.id] && orderProducts[delivery.id].length > 0 && (
                          <div className="bg-muted/40 rounded-lg p-3 space-y-2">
                            <p className="text-xs font-semibold flex items-center gap-1 text-muted-foreground uppercase tracking-wide">
                              <ShoppingBag className="h-3 w-3" />
                              Contenu du colis
                            </p>
                            {orderProducts[delivery.id].map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                {item.image && (
                                  <img src={item.image} alt={item.name} className="w-8 h-8 rounded object-cover" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Qté: {item.quantity}
                                    {item.color && ` • ${item.color}`}
                                    {item.size && ` • ${item.size}`}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {delivery.delivery_notes && pickupDone && (
                          <p className="text-sm bg-muted/50 p-2 rounded italic">
                            "{delivery.delivery_notes}"
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t flex-wrap gap-2">
                          <div className="flex gap-2 flex-wrap">
                            {navUrl ? (
                              <Button variant="outline" size="sm" className="gap-1" asChild>
                                <a href={navUrl} target="_blank" rel="noopener noreferrer">
                                  <Navigation className="h-3 w-3" />
                                  {pickupDone ? "Itinéraire acheteur" : "Itinéraire vendeur"}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" className="gap-1" disabled>
                                <Navigation className="h-3 w-3" />
                                Itinéraire
                              </Button>
                            )}
                            {/* WhatsApp + Phone contact */}
                            {!pickupDone && sellerUserId && (
                              <WhatsAppButton userId={sellerUserId} label="Vendeur" />
                            )}
                            {pickupDone && delivery.buyer_id && (
                              <>
                                <WhatsAppButton userId={delivery.buyer_id} label="Acheteur" />
                                <PhoneCallButton userId={delivery.buyer_id} label="acheteur" />
                              </>
                            )}
                          </div>
                          
                          {status.action && (
                            <Button
                              size="sm"
                              onClick={() => openVerification(delivery.id, status.action!)}
                              className="gap-1"
                            >
                              <Key className="h-3 w-3" />
                              {status.actionLabel}
                            </Button>
                          )}
                        </div>
                        {/* Chat with buyer */}
                        {delivery.buyer_id && delivery.status !== "delivered" && (
                          <OrderChat
                            orderId={delivery.id}
                            otherUserName="Acheteur"
                            compact
                          />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {completedDeliveries.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Historique ({completedDeliveries.length})
            </h3>
            <div className="grid gap-2">
              {completedDeliveries.slice(0, 10).map((delivery) => {
                const status = statusConfig[delivery.status || "delivered"] || { label: delivery.status || "Inconnu", variant: "outline" as const };
                
                return (
                  <Card key={delivery.id} className="bg-muted/30">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono text-xs">
                            #{delivery.id.slice(0, 8)}
                          </Badge>
                          <span className="text-sm">{delivery.delivery_city}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-green-600">
                            +{formatCurrency(delivery.delivery_fee || 0)}
                          </span>
                          <Badge variant={status.variant} className="text-xs">
                            {status.label}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <DeliveryCodeVerification
        isOpen={verificationModal.isOpen}
        onClose={() => setVerificationModal({ isOpen: false, orderId: "", type: "pickup" })}
        orderId={verificationModal.orderId}
        type={verificationModal.type}
      />
    </>
  );
}
