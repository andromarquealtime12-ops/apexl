import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Package, Truck, MapPin, Key, CheckCircle, Clock, Navigation, MessageSquare, RotateCcw, Star, MessageCircle, Download } from "lucide-react";
import { generateOrderReceipt } from "@/utils/generateReceipt";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import ReturnRequestButton from "@/components/returns/ReturnRequestButton";
import OrderRatingDialog from "@/components/reviews/OrderRatingDialog";
import UserRatingBadge from "@/components/reviews/UserRatingBadge";
import { WhatsAppContact } from "@/components/contact/WhatsAppContact";
import OrderChat from "@/components/chat/OrderChat";
import CancelOrderButton from "@/components/orders/CancelOrderButton";
import { Link } from "react-router-dom";
import { getDateFnsLocale } from "@/i18n/dateLocale";
import { CURRENCY_SYMBOLS } from "@/types/database";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";

const statusIconVariant: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pending: { variant: "secondary", icon: Clock },
  confirmed: { variant: "default", icon: CheckCircle },
  preparing: { variant: "outline", icon: Package },
  ready: { variant: "outline", icon: Package },
  ready_for_pickup: { variant: "outline", icon: Package },
  picked_up: { variant: "default", icon: Truck },
  in_transit: { variant: "default", icon: Truck },
  delivered: { variant: "secondary", icon: CheckCircle },
  cancelled: { variant: "destructive", icon: Package },
  refunded: { variant: "outline", icon: RotateCcw },
  return_requested: { variant: "destructive", icon: RotateCcw },
  return_pickup_ready: { variant: "outline", icon: RotateCcw },
  return_in_transit: { variant: "default", icon: RotateCcw },
  returned: { variant: "secondary", icon: RotateCcw },
  redelivery: { variant: "default", icon: Truck },
};

interface OrderWithItems {
  id: string;
  status: string;
  updated_at: string;
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
    selected_color?: string | null;
    selected_size?: string | null;
    products: {
      name: string;
      images: string[];
    } | null;
  }>;
}

export default function BuyerOrdersTracker() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [ratingOrder, setRatingOrder] = useState<{ orderId: string; userId: string; type: "buyer_to_seller" | "buyer_to_driver" } | null>(null);
  const [chatOrderId, setChatOrderId] = useState<string | null>(null);
  const refundMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const { data, error } = await supabase.rpc("request_refund", { p_order_id: orderId, p_reason: reason });
      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast({ title: t("buyerx.tracker.refundSentTitle"), description: t("buyerx.tracker.refundSentDesc") });
      setRefundOrderId(null);
      setRefundReason("");
      queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
    },
    onError: (e: any) => toast({ title: t("buyerx.common.error"), description: e.message, variant: "destructive" }),
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
          seller_id,
          selected_color,
          selected_size,
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
        <p>{t("buyerx.tracker.noOrders")}</p>
        <p className="text-sm">{t("buyerx.tracker.noOrdersHint")}</p>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-4">
      {orders.map((order) => {
        const statusKey = order.status || "pending";
        const statusMeta = statusIconVariant[statusKey] || statusIconVariant["pending"];
        const status = {
          ...statusMeta,
          label: t(`buyerx.status.${statusKey}.label`),
          description: t(`buyerx.status.${statusKey}.description`),
        };
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
                    {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: getDateFnsLocale(i18n.language) })}
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
                    <span className="text-sm font-medium">{t("buyerx.tracker.deliveryCode")}</span>
                  </div>
                  <p className="text-3xl font-mono font-bold tracking-[0.3em] text-primary">
                    {verification.delivery_code}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("buyerx.tracker.deliveryCodeHint")}
                  </p>
                </div>
              )}

              {/* Order items */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {order.items.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex-shrink-0">
                    <img
                      src={item.products?.images?.[0] || "/placeholder.svg"}
                      alt={item.products?.name || t("buyerx.tracker.product")}
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

              <div className="space-y-1 text-sm">
                {order.items.slice(0, 3).map((item) => (
                  <p key={item.id}>
                    {item.quantity}x {item.products?.name || t("buyerx.tracker.product")}
                    {(item.selected_color || item.selected_size) && (
                      <span className="text-muted-foreground">{" "}• {[item.selected_color, item.selected_size].filter(Boolean).join(" / ")}</span>
                    )}
                  </p>
                ))}
                {order.items.length > 3 && (
                  <p className="text-xs text-muted-foreground">{t("buyerx.tracker.moreItems", { count: order.items.length - 3 })}</p>
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
                <span className="text-muted-foreground">{t("buyerx.tracker.total")}: <strong>{currencySymbol} {order.total_amount.toLocaleString()}</strong></span>
                <div className="flex gap-2 flex-wrap">
                  {(order as any).driver_id && ["picked_up", "in_transit"].includes(order.status || "") && (
                    <WhatsAppContact userId={(order as any).driver_id} label={t("buyerx.tracker.driver")} message={t("buyerx.tracker.whatsappMessage", { id: order.id.slice(0, 8) })} />
                  )}
                  {["confirmed", "preparing", "ready", "ready_for_pickup", "picked_up", "in_transit"].includes(order.status || "") && (
                    <Button size="sm" className="gap-1.5" asChild>
                      <Link to={`/track/${order.id}`}>
                        <Navigation className="h-3.5 w-3.5" />
                        {t("buyerx.tracker.track")}
                      </Link>
                    </Button>
                  )}
                  {/* Cancel button (only pre-pickup) */}
                  <CancelOrderButton
                    orderId={order.id}
                    orderStatus={order.status}
                    hasDriver={!!(order as any).driver_id}
                    role="buyer"
                  />
                  {/* Return button (2h window) */}
                  <ReturnRequestButton orderId={order.id} orderStatus={order.status} deliveredAt={order.updated_at || order.created_at} />
                  {/* Rating buttons for delivered orders */}
                  {order.status === "delivered" && order.items?.[0] && (
                    <Button size="sm" variant="ghost" className="gap-1" onClick={() => {
                      const sellerId = (order.items[0] as any)?.seller_id;
                      if (sellerId) setRatingOrder({ orderId: order.id, userId: sellerId, type: "buyer_to_seller" });
                    }}>
                      <Star className="h-3.5 w-3.5" /> {t("buyerx.tracker.rate")}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={async () => {
                      try {
                        await generateOrderReceipt(order.id);
                      } catch (e: any) {
                        toast({ title: t("buyerx.common.error"), description: e.message || t("buyerx.tracker.receiptError"), variant: "destructive" });
                      }
                    }}
                  >
                    <Download className="h-3.5 w-3.5" /> {t("buyerx.tracker.receipt")}
                  </Button>
                </div>
              </div>

              {/* Chat button */}
              {["confirmed", "preparing", "ready", "ready_for_pickup", "picked_up", "in_transit"].includes(order.status || "") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => setChatOrderId(chatOrderId === order.id ? null : order.id)}
                >
                  <MessageCircle className="h-4 w-4" />
                  {chatOrderId === order.id ? t("buyerx.tracker.closeChat") : t("buyerx.tracker.chatWith")}
                </Button>
              )}

              {/* Chat */}
              {chatOrderId === order.id && (
                <OrderChat
                  orderId={order.id}
                  otherUserName={t("buyerx.tracker.sellerDriver")}
                  compact
                />
              )}

            </CardContent>
          </Card>
        );
      })}
    </div>
    {ratingOrder && (
        <OrderRatingDialog
          open={!!ratingOrder}
          onClose={() => setRatingOrder(null)}
          orderId={ratingOrder.orderId}
          reviewedUserId={ratingOrder.userId}
          reviewType={ratingOrder.type}
        />
      )}
    </>
  );
}
