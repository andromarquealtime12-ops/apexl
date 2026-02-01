import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useAcceptDelivery() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("orders")
        .update({ 
          driver_id: user.id,
          status: "ready_for_pickup"
        })
        .eq("id", orderId)
        .is("driver_id", null);

      if (error) throw error;
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
      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["driver-stats"] });
    },
  });
}
