import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DeliveryZone } from "@/utils/deliveryPricing";

export function useDeliveryZones(includeInactive = false) {
  return useQuery({
    queryKey: ["delivery-zones", includeInactive],
    queryFn: async () => {
      let query = (supabase as any).from("delivery_zones").select("*").order("name");
      if (!includeInactive) query = query.eq("active", true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DeliveryZone[];
    },
  });
}

export function useCreateDeliveryZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (zone: Omit<DeliveryZone, "id">) => {
      const { data, error } = await (supabase as any)
        .from("delivery_zones")
        .insert(zone)
        .select()
        .single();
      if (error) throw error;
      return data as DeliveryZone;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["delivery-zones"] }),
  });
}

export function useUpdateDeliveryZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DeliveryZone> & { id: string }) => {
      const { error } = await (supabase as any)
        .from("delivery_zones")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["delivery-zones"] }),
  });
}

export function useDeleteDeliveryZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("delivery_zones")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["delivery-zones"] }),
  });
}
