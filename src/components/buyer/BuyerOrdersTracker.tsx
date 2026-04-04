import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Package, Truck, MapPin, Key, CheckCircle, Clock, Navigation, MessageSquare, RotateCcw } from "lucide-react";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { WhatsAppContact } from "@/components/contact/WhatsAppContact";
import { Link } from "react-router-dom";
import { fr } from "date-fns/locale";
import { CURRENCY_SYMBOLS } from "@/types/database";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";

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
  refunded: { label: "Remboursée", variant: "outline", icon: RotateCcw, description: "Cette commande a été remboursée" },
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("");

  const refundMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const { data, error } = await supabase.rpc("request_refund", { p_order_id: orderId, p_reason: reason });
      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast({ title: "Demande envoyée", description: "Votre demande de remboursement a été soumise." });
      setRefundOrderId(null);
      setRefundReason("");
      queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

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

              {/* Total + Track + Contact buttons */}
              <div className="flex flex-wrap justify-between items-center pt-2 border-t text-sm gap-2">
                <span className="text-muted-foreground">Total: <strong>{currencySymbol} {order.total_amount.toLocaleString()}</strong></span>
                <div className="flex gap-2 flex-wrap">
                  {(order as any).driver_id && ["picked_up", "in_transit"].includes(order.status || "") && (
                    <WhatsAppContact userId={(order as any).driver_id} label="Livreur" message={`Bonjour, concernant ma commande #${order.id.slice(0, 8)}`} />
                  )}
                  {["confirmed", "preparing", "ready", "ready_for_pickup", "picked_up", "in_transit"].includes(order.status || "") && (
                    <Button size="sm" className="gap-1.5" asChild>
                      <Link to={`/track/${order.id}`}>
                        <Navigation className="h-3.5 w-3.5" />
                        Suivre
                      </Link>
                    </Button>
                  )}
                  {/* Refund button for delivered orders within 15 days */}
                  {order.status === "delivered" && differenceInDays(new Date(), new Date(order.created_at)) <= 15 && (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setRefundOrderId(order.id)}>
                      <RotateCcw className="h-3.5 w-3.5" />
                      Remboursement
                    </Button>
                  )}
                </div>
              </div>

              {/* Refund form */}
              {refundOrderId === order.id && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <Textarea
                    placeholder="Raison du remboursement..."
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!refundReason.trim() || refundMutation.isPending}
                      onClick={() => refundMutation.mutate({ orderId: order.id, reason: refundReason })}>
                      {refundMutation.isPending ? "Envoi..." : "Envoyer"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setRefundOrderId(null); setRefundReason(""); }}>
                      Annuler
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
