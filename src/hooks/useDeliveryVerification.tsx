import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DeliveryVerification {
  id: string;
  order_id: string;
  pickup_code: string;
  delivery_code: string | null;
  status: string;
  pickup_verified_at: string | null;
  delivery_verified_at: string | null;
  created_at: string;
}

// Get verification info for an order
export function useDeliveryVerification(orderId: string) {
  return useQuery({
    queryKey: ["delivery-verification", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_verification")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();

      if (error) throw error;
      return data as DeliveryVerification | null;
    },
    enabled: !!orderId,
  });
}

// Create delivery verification when order is ready
export function useCreateDeliveryVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.rpc("create_delivery_verification", {
        p_order_id: orderId,
      });

      if (error) throw error;
      return data as { pickup_code: string };
    },
    onSuccess: (_, orderId) => {
      queryClient.invalidateQueries({ queryKey: ["delivery-verification", orderId] });
      queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
    },
  });
}

// Verify pickup code (driver entering seller's code)
export function useVerifyPickupCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, code }: { orderId: string; code: string }) => {
      const { data, error } = await supabase.rpc("verify_pickup_code", {
        p_order_id: orderId,
        p_code: code,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; message: string; delivery_code?: string };
      if (!result.success) {
        throw new Error(result.message);
      }
      
      return result;
    },
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ["delivery-verification", orderId] });
      queryClient.invalidateQueries({ queryKey: ["driver-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Colis récupéré ! Code de livraison envoyé au client.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Code de récupération invalide");
    },
  });
}

// Verify delivery code (driver entering buyer's code)
export function useVerifyDeliveryCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, code }: { orderId: string; code: string }) => {
      const { data, error } = await supabase.rpc("verify_delivery_code", {
        p_order_id: orderId,
        p_code: code,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; message: string };
      if (!result.success) {
        throw new Error(result.message);
      }
      
      return result;
    },
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ["delivery-verification", orderId] });
      queryClient.invalidateQueries({ queryKey: ["driver-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["driver-stats"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Livraison confirmée ! Paiement crédité.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Code de livraison invalide");
    },
  });
}

// Regenerate an expired pickup code
export function useRegeneratePickupCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.rpc("regenerate_pickup_code", {
        p_order_id: orderId,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; pickup_code?: string; error?: string };
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return result;
    },
    onSuccess: (_, orderId) => {
      queryClient.invalidateQueries({ queryKey: ["delivery-verification", orderId] });
      queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
      toast.success("Nouveau code de récupération généré !");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erreur lors de la régénération");
    },
  });
}
