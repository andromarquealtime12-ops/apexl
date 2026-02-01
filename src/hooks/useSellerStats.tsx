import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SellerStats {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  monthlyRevenue: number;
}

export function useSellerStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["seller-stats", user?.id],
    queryFn: async (): Promise<SellerStats> => {
      if (!user) throw new Error("Not authenticated");

      // Get products count
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, is_active")
        .eq("seller_id", user.id);

      if (productsError) throw productsError;

      // Get order items for this seller
      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("total_price, order_id")
        .eq("seller_id", user.id);

      if (itemsError) throw itemsError;

      // Get unique order IDs
      const orderIds = [...new Set(orderItems?.map(item => item.order_id) || [])];

      // Get orders to check status
      let pendingCount = 0;
      if (orderIds.length > 0) {
        const { data: orders, error: ordersError } = await supabase
          .from("orders")
          .select("id, status")
          .in("id", orderIds);

        if (!ordersError && orders) {
          pendingCount = orders.filter(o => o.status === "pending" || o.status === "confirmed").length;
        }
      }

      const totalRevenue = orderItems?.reduce((sum, item) => sum + Number(item.total_price), 0) || 0;

      return {
        totalProducts: products?.length || 0,
        activeProducts: products?.filter(p => p.is_active).length || 0,
        totalOrders: orderIds.length,
        pendingOrders: pendingCount,
        totalRevenue,
        monthlyRevenue: totalRevenue, // Simplified for now
      };
    },
    enabled: !!user,
  });
}

export function useSellerProducts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["seller-products", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name)")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useSellerOrders() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["seller-orders", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      // Get order items for this seller
      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select(`
          id,
          quantity,
          unit_price,
          total_price,
          product_id,
          order_id,
          products(name, images)
        `)
        .eq("seller_id", user.id);

      if (itemsError) throw itemsError;

      // Get unique order IDs
      const orderIds = [...new Set(orderItems?.map(item => item.order_id) || [])];
      
      if (orderIds.length === 0) return [];

      // Get orders details
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .in("id", orderIds)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      // Combine orders with their items
      return orders?.map(order => ({
        ...order,
        items: orderItems?.filter(item => item.order_id === order.id) || [],
      })) || [];
    },
    enabled: !!user,
  });
}
