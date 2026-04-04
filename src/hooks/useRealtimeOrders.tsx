import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/**
 * Subscribes to realtime changes on orders and order_items tables.
 * Automatically invalidates relevant query caches so UI updates instantly.
 */
export function useRealtimeOrders() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("realtime-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;

          // Invalidate all order-related caches
          queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
          queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
          queryClient.invalidateQueries({ queryKey: ["seller-stats"] });
          queryClient.invalidateQueries({ queryKey: ["available-deliveries"] });
          queryClient.invalidateQueries({ queryKey: ["my-deliveries"] });
          queryClient.invalidateQueries({ queryKey: ["driver-stats"] });

          // Show toast for status changes
          if (payload.eventType === "UPDATE" && newRecord?.status !== oldRecord?.status) {
            const orderId = newRecord.id?.slice(0, 8);
            const statusLabels: Record<string, string> = {
              confirmed: "✅ Commande confirmée",
              preparing: "📦 En préparation",
              ready: "🎁 Commande prête",
              ready_for_pickup: "🎁 Prête pour le livreur",
              picked_up: "🛵 Colis récupéré",
              in_transit: "🚚 En route",
              delivered: "🎉 Commande livrée !",
              cancelled: "❌ Commande annulée",
            };
            const label = statusLabels[newRecord.status];
            if (label) {
              toast.info(label, {
                description: `Commande #${orderId}`,
              });
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_items" },
        () => {
          // New order items → refresh seller orders
          queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
          queryClient.invalidateQueries({ queryKey: ["seller-stats"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const notification = payload.new as any;
            if (notification.user_id === user.id) {
              queryClient.invalidateQueries({ queryKey: ["notifications"] });
              toast(notification.title, {
                description: notification.message,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);
}
