import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AdminCode {
  id: string;
  code: string;
  is_active: boolean;
  uses_remaining: number | null;
  expires_at: string | null;
  created_at: string;
}

function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segments = [];
  for (let i = 0; i < 3; i++) {
    let segment = "";
    for (let j = 0; j < 4; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  return segments.join("-");
}

export function useAdminCodes() {
  return useQuery({
    queryKey: ["admin-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_access_codes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AdminCode[];
    },
  });
}

export function useCreateAdminCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { usesRemaining?: number; expiresInDays?: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const code = generateCode();
      const expiresAt = params.expiresInDays 
        ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { data, error } = await supabase
        .from("admin_access_codes")
        .insert({
          code,
          uses_remaining: params.usesRemaining ?? 1,
          expires_at: expiresAt,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-codes"] });
      toast.success("Code admin créé avec succès");
    },
    onError: () => {
      toast.error("Erreur lors de la création du code");
    },
  });
}

export function useDeleteAdminCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (codeId: string) => {
      const { error } = await supabase
        .from("admin_access_codes")
        .delete()
        .eq("id", codeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-codes"] });
      toast.success("Code supprimé");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression");
    },
  });
}

export function useToggleAdminCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ codeId, isActive }: { codeId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("admin_access_codes")
        .update({ is_active: isActive })
        .eq("id", codeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-codes"] });
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });
}
