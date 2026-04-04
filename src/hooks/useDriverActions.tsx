import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { notifyOrderStatusChange, notifyDeliveryComplete } from "@/hooks/useOrderNotifications";

export function useAcceptDelivery() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("driver_accept_order" as any, {
        p_order_id: orderId,
      });

      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || "Erreur inconnue");

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["available-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["driver-stats"] });
      queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
      queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
    },
  });
}

export function useUpdateDeliveryStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      // Get order info for notifications
      const { data: order } = await supabase
        .from("orders")
        .select("buyer_id, driver_id")
        .eq("id", orderId)
        .single();

      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", orderId);

      if (error) throw error;

      // Send notifications based on status change
      if (order?.buyer_id) {
        notifyOrderStatusChange(orderId, order.buyer_id, status, order.driver_id);
        
        if (status === "delivered" && order.driver_id) {
          notifyDeliveryComplete(orderId, order.buyer_id, order.driver_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["driver-stats"] });
      queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
      queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
    },
  });
}
