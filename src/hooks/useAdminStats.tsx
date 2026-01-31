import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AdminStats {
  usersCount: number;
  productsCount: number;
  ordersCount: number;
  totalTransactions: number;
}

export function useAdminStats() {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: async (): Promise<AdminStats> => {
      // Fetch all stats in parallel
      const [usersResult, productsResult, ordersResult, transactionsResult] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("wallet_transactions")
          .select("amount, currency")
          .eq("status", "completed")
      ]);

      // Calculate total transactions in DOP (simplified - could add currency conversion)
      const totalTransactions = (transactionsResult.data || []).reduce((sum, tx) => {
        // Simple approach: sum all amounts (assuming DOP for now)
        return sum + Number(tx.amount);
      }, 0);

      return {
        usersCount: usersResult.count || 0,
        productsCount: productsResult.count || 0,
        ordersCount: ordersResult.count || 0,
        totalTransactions,
      };
    },
    enabled: isAdmin,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
