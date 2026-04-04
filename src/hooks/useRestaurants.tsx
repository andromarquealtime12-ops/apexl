import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useRestaurants() {
  return useQuery({
    queryKey: ["restaurants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("is_active", true)
        .eq("is_approved", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useRestaurantById(id: string | undefined) {
  return useQuery({
    queryKey: ["restaurant", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useRestaurantItems(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ["restaurant-items", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_items")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .eq("is_available", true)
        .order("category", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useSellerRestaurants() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["seller-restaurants", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateRestaurant() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (values: {
      name: string;
      description?: string;
      address: string;
      city: string;
      phone?: string;
      whatsapp?: string;
      cuisine_type?: string;
    }) => {
      const { data, error } = await supabase
        .from("restaurants")
        .insert({ ...values, seller_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-restaurants"] });
      toast.success("Restaurant créé ! En attente d'approbation.");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useSellerRestaurantItems(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ["seller-restaurant-items", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_items")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: {
      restaurant_id: string;
      name: string;
      description?: string;
      price: number;
      currency?: string;
      category?: string;
      image_url?: string;
      preparation_time?: number;
    }) => {
      const { data, error } = await supabase
        .from("restaurant_items")
        .insert(values)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["seller-restaurant-items", vars.restaurant_id] });
      toast.success("Plat ajouté !");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string; restaurant_id: string; [key: string]: any }) => {
      const { error } = await supabase
        .from("restaurant_items")
        .update(values)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["seller-restaurant-items", vars.restaurant_id] });
      toast.success("Plat mis à jour !");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, restaurantId }: { id: string; restaurantId: string }) => {
      const { error } = await supabase
        .from("restaurant_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return restaurantId;
    },
    onSuccess: (restaurantId) => {
      queryClient.invalidateQueries({ queryKey: ["seller-restaurant-items", restaurantId] });
      toast.success("Plat supprimé");
    },
    onError: (e: any) => toast.error(e.message),
  });
}
