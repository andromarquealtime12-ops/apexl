import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Package, Truck, MapPin, Key, CheckCircle, Clock, Navigation } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { fr } from "date-fns/locale";
import { CURRENCY_SYMBOLS } from "@/types/database";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any; description: string }> = {
  pending: { label: "En attente", variant: "secondary", icon: Clock, description: "Votre commande est en cours de traitement" },
  confirmed: { label: "Confirmée", variant: "default", icon: CheckCircle, description: "Le vendeur prépare votre commande" },
  preparing: { label: "En préparation", variant: "outline", icon: Package, description: "Votre commande est en cours de préparation" },
  ready: { label: "Prête", variant: "outline", icon: Package, description: "Commande prête, en attente du livreur" },
  ready_for_pickup: { label: "Prête", variant: "outline", icon: Package, description: "Commande prête, en attente du livreur" },
  picked_up: { label: "Récupérée", variant: "default", icon: Truck, description: "Le livreur a récupéré votre commande" },
  in_transit: { label: "En route", variant: "default", icon: Truck, description: "Votre commande est en cours de livraison" },
  delivered: { label: "Livrée", variant: "secondary", icon: CheckCircle, description: "Commande livrée avec succès !" },
  cancelled: { label: "Annulée", variant: "destructive", icon: Package, description: "Cette commande a été annulée" },
};

interface OrderWithItems {
  id: string;
  status: string;
  total_amount: number;
  delivery_fee: number;
  currency: string;
  delivery_address: string;
  delivery_city: string;
  created_at: string;
  items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    products: {
      name: string;
      images: string[];
    } | null;
  }>;
}

export default function BuyerOrdersTracker() {
  const { user } = useAuth();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["buyer-orders", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: orderData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (ordersError) throw ordersError;
      if (!orderData?.length) return [];

      const orderIds = orderData.map((order) => order.id);

      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select(`
          id,
          order_id,
          quantity,
          unit_price,
          products(name, images)
        `)
        .in("order_id", orderIds);

      if (itemsError) throw itemsError;

      return orderData.map((order) => ({
        ...order,
        items: (orderItems || [])
          .filter((item) => item.order_id === order.id)
          .map(({ order_id, ...item }) => item),
      })) as OrderWithItems[];
    },
    enabled: !!user,
  });

  const { data: verifications } = useQuery({
    queryKey: ["buyer-verifications", user?.id],
    queryFn: async () => {
      if (!user || !orders?.length) return {};

      const orderIds = orders.map(o => o.id);
      const { data, error } = await supabase
        .from("delivery_verification")
        .select("*")
        .in("order_id", orderIds);

      if (error) throw error;

      // Convert to a map for easy lookup
      return data.reduce((acc, v) => {
        acc[v.order_id] = v;
        return acc;
      }, {} as Record<string, any>);
    },
    enabled: !!user && !!orders?.length,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Aucune commande pour le moment</p>
        <p className="text-sm">Vos commandes apparaîtront ici</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const status = statusConfig[order.status || "pending"];
        const StatusIcon = status.icon;
        const verification = verifications?.[order.id];
        const currencySymbol = CURRENCY_SYMBOLS[order.currency as keyof typeof CURRENCY_SYMBOLS] || "$";
        
        // Show delivery code if order is in transit
        const showDeliveryCode = verification?.delivery_code && 
          ["picked_up", "in_transit"].includes(order.status || "");

        return (
          <Card key={order.id} className={order.status === "in_transit" || order.status === "picked_up" ? "border-primary" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    #{order.id.slice(0, 8)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: fr })}
                  </span>
                </div>
                <Badge variant={status.variant} className="gap-1">
                  <StatusIcon className="h-3 w-3" />
                  {status.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status description */}
              <p className="text-sm text-muted-foreground">{status.description}</p>

              {/* Delivery code for buyer */}
              {showDeliveryCode && (
                <div className="bg-primary/10 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Key className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Code de livraison</span>
                  </div>
                  <p className="text-3xl font-mono font-bold tracking-[0.3em] text-primary">
                    {verification.delivery_code}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Donnez ce code au livreur pour confirmer la réception
                  </p>
                </div>
              )}

              {/* Order items */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {order.items.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex-shrink-0">
                    <img
                      src={item.products?.images?.[0] || "/placeholder.svg"}
                      alt={item.products?.name || "Product"}
                      className="w-12 h-12 object-cover rounded bg-muted"
                    />
                  </div>
                ))}
                {order.items.length > 4 && (
                  <div className="w-12 h-12 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                    +{order.items.length - 4}
                  </div>
                )}
              </div>

              {/* Delivery address */}
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{order.delivery_city}</p>
                  <p className="text-muted-foreground text-xs">{order.delivery_address}</p>
                </div>
              </div>

              {/* Total + Track button */}
              <div className="flex justify-between items-center pt-2 border-t text-sm">
                <span className="text-muted-foreground">Total: <strong>{currencySymbol} {order.total_amount.toLocaleString()}</strong></span>
                {["confirmed", "preparing", "ready", "ready_for_pickup", "picked_up", "in_transit"].includes(order.status || "") && (
                  <Button size="sm" className="gap-1.5" asChild>
                    <Link to={`/track/${order.id}`}>
                      <Navigation className="h-3.5 w-3.5" />
                      Suivre en direct
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
