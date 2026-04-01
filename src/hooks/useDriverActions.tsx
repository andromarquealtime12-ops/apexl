import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { notifyDriverAssigned, notifyOrderStatusChange, notifyDeliveryComplete } from "@/hooks/useOrderNotifications";

export function useAcceptDelivery() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!user) throw new Error("Not authenticated");

      // Get the order to find buyer_id
      const { data: order } = await supabase
        .from("orders")
        .select("buyer_id")
        .eq("id", orderId)
        .single();

      const { error } = await supabase
        .from("orders")
        .update({ 
          driver_id: user.id,
          status: "ready_for_pickup"
        })
        .eq("id", orderId)
        .is("driver_id", null);

      if (error) throw error;

      // Send notifications
      if (order?.buyer_id) {
        notifyDriverAssigned(orderId, user.id, order.buyer_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["available-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["driver-stats"] });
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
    },
  });
}
