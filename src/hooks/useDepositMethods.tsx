import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DepositMethod {
  id: string;
  method_key: string;
  label: string;
  method_type: string;
  account_number: string | null;
  account_name: string | null;
  instructions: string | null;
  country: string;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
}

export function useDepositMethods() {
  return useQuery({
    queryKey: ["deposit-methods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deposit_methods")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as DepositMethod[];
    },
  });
}

export function useCreateDepositMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (method: Omit<DepositMethod, "id">) => {
      const { data, error } = await supabase
        .from("deposit_methods")
        .insert(method)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deposit-methods"] }),
  });
}

export function useUpdateDepositMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DepositMethod> & { id: string }) => {
      const { error } = await supabase
        .from("deposit_methods")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deposit-methods"] }),
  });
}

export function useDeleteDepositMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("deposit_methods")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deposit-methods"] }),
  });
}
