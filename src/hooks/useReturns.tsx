import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface OrderReturn {
  id: string;
  order_id: string;
  buyer_id: string;
  reason: string;
  status: string;
  fault_type: string | null;
  return_pickup_code: string | null;
  return_delivery_code: string | null;
  return_driver_id: string | null;
  return_delivery_fee: number;
  seller_confirmed: boolean;
  seller_notes: string | null;
  refund_amount: number;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReturnMessage {
  id: string;
  return_id: string;
  sender_id: string;
  message: string | null;
  image_url: string | null;
  created_at: string;
}

export function useOrderReturns(role: "buyer" | "seller" | "driver" | "admin") {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["order-returns", role, user?.id],
    queryFn: async (): Promise<OrderReturn[]> => {
      const { data, error } = await supabase
        .from("order_returns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as OrderReturn[];
    },
    enabled: !!user,
  });
}

export function useReturnForOrder(orderId: string) {
  return useQuery({
    queryKey: ["order-return", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_returns")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as OrderReturn | null;
    },
    enabled: !!orderId,
  });
}

export function useReturnMessages(returnId: string) {
  return useQuery({
    queryKey: ["return-messages", returnId],
    queryFn: async (): Promise<ReturnMessage[]> => {
      const { data, error } = await supabase
        .from("return_messages")
        .select("*")
        .eq("return_id", returnId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ReturnMessage[];
    },
    enabled: !!returnId,
  });
}

export function useRequestReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const { data, error } = await supabase.rpc("request_return", {
        p_order_id: orderId,
        p_reason: reason,
      });
      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-returns"] });
      queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
      toast.success("Demande de retour envoyée !");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApproveReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ returnId, faultType }: { returnId: string; faultType: string }) => {
      const { data, error } = await supabase.rpc("approve_return", {
        p_return_id: returnId,
        p_fault_type: faultType,
      });
      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-returns"] });
      toast.success("Retour approuvé !");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useConfirmReturnReceived() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ returnId, confirmed, notes, action }: { returnId: string; confirmed: boolean; notes?: string; action?: string }) => {
      const { data, error } = await supabase.rpc("confirm_return_received", {
        p_return_id: returnId,
        p_confirmed: confirmed,
        p_notes: notes || null,
        p_action: action || "refund",
      });
      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-returns"] });
      queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
      toast.success("Retour traité !");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDriverAcceptReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (returnId: string) => {
      const { data, error } = await supabase.rpc("driver_accept_return", {
        p_return_id: returnId,
      });
      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-returns"] });
      toast.success("Retour accepté !");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useVerifyReturnPickup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ returnId, code }: { returnId: string; code: string }) => {
      const { data, error } = await supabase.rpc("verify_return_pickup", {
        p_return_id: returnId,
        p_code: code,
      });
      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-returns"] });
      toast.success("Colis retour récupéré !");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useVerifyReturnDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ returnId, code }: { returnId: string; code: string }) => {
      const { data, error } = await supabase.rpc("verify_return_delivery", {
        p_return_id: returnId,
        p_code: code,
      });
      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-returns"] });
      toast.success("Colis retour livré au vendeur !");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSendReturnMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ returnId, message, imageUrl }: { returnId: string; message?: string; imageUrl?: string }) => {
      const { error } = await supabase
        .from("return_messages")
        .insert({
          return_id: returnId,
          sender_id: user!.id,
          message: message || null,
          image_url: imageUrl || null,
        });
      if (error) throw error;
    },
    onSuccess: (_, { returnId }) => {
      queryClient.invalidateQueries({ queryKey: ["return-messages", returnId] });
    },
  });
}
