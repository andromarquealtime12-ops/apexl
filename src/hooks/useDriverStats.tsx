import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface DriverStats {
  totalDeliveries: number;
  completedDeliveries: number;
  pendingDeliveries: number;
  inProgressDeliveries: number;
  totalEarnings: number;
  monthlyEarnings: number;
}

export function useDriverStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["driver-stats", user?.id],
    queryFn: async (): Promise<DriverStats> => {
      if (!user) throw new Error("Not authenticated");

      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, status, delivery_fee")
        .eq("driver_id", user.id);

      if (error) throw error;

      const completedDeliveries = orders?.filter(o => o.status === "delivered").length || 0;
      const pendingDeliveries = orders?.filter(o => o.status === "ready_for_pickup").length || 0;
      const inProgressDeliveries = orders?.filter(o => o.status === "in_transit").length || 0;
      const totalEarnings = orders
        ?.filter(o => o.status === "delivered")
        .reduce((sum, o) => sum + Number(o.delivery_fee || 0), 0) || 0;

      return {
        totalDeliveries: orders?.length || 0,
        completedDeliveries,
        pendingDeliveries,
        inProgressDeliveries,
        totalEarnings,
        monthlyEarnings: totalEarnings, // Simplified
      };
    },
    enabled: !!user,
  });
}

export function useDriverDeliveries() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["driver-deliveries", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useAvailableDeliveries() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["available-deliveries"],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .is("driver_id", null)
        .in("status", ["ready", "ready_for_pickup"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}
