import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ShopLocation {
  user_id: string;
  shop_name: string;
  shop_city: string | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Cached list of every approved shop's location.
 * Lets any product card compute distance / estimated fee locally.
 */
export function useShopLocations() {
  return useQuery({
    queryKey: ["shop-locations"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_public_seller_shops", {
        p_user_id: null,
      });
      if (error) throw error;
      return (data || []) as ShopLocation[];
    },
    staleTime: 5 * 60 * 1000, // 5 min — shop locations rarely change
  });
}
