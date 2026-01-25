import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Product } from "@/types/database";

interface UseProductsOptions {
  categoryId?: string;
  featured?: boolean;
  limit?: number;
  searchQuery?: string;
}

export function useProducts(options: UseProductsOptions = {}) {
  const { categoryId, featured, limit, searchQuery } = options;

  return useQuery({
    queryKey: ["products", categoryId, featured, limit, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select(`
          *,
          category:categories(*)
        `)
        .eq("is_active", true);

      if (categoryId) {
        query = query.eq("category_id", categoryId);
      }

      if (featured) {
        query = query.eq("is_featured", true);
      }

      if (searchQuery) {
        query = query.ilike("name", `%${searchQuery}%`);
      }

      query = query.order("created_at", { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Product[];
    },
  });
}

export function useProduct(productId: string) {
  return useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          category:categories(*)
        `)
        .eq("id", productId)
        .maybeSingle();

      if (error) throw error;
      return data as Product | null;
    },
    enabled: !!productId,
  });
}
