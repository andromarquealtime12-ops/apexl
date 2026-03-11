import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PendingDeposit {
  id: string;
  wallet_id: string;
  type: string;
  amount: number;
  currency: string;
  payment_method: string | null;
  status: string;
  description: string | null;
  transaction_reference: string | null;
  proof_image_url: string | null;
  created_at: string;
  // Joined data
  user_email?: string;
  user_name?: string;
}

export interface TransactionHistory extends PendingDeposit {
  processed_at?: string;
}

async function fetchTransactionsWithUsers(
  statusFilter: string | string[],
  typeFilter?: string
) {
  const query = supabase
    .from("wallet_transactions")
    .select(`
      *,
      wallets!inner(user_id)
    `)
    .order("created_at", { ascending: false });

  if (Array.isArray(statusFilter)) {
    query.in("status", statusFilter);
  } else {
    query.eq("status", statusFilter);
  }

  if (typeFilter) {
    query.eq("type", typeFilter);
  }

  const { data: transactions, error } = await query;

  if (error) throw error;

  // Get user profiles for each transaction
  const userIds = [...new Set(transactions?.map((t: any) => t.wallets.user_id) || [])];
  
  let profiles: any[] = [];
  if (userIds.length > 0) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);
    profiles = profileData || [];
  }

  // Map transactions with user info
  return (transactions || []).map((tx: any) => {
    const profile = profiles.find(p => p.user_id === tx.wallets.user_id);
    return {
      ...tx,
      user_name: profile?.full_name || "Utilisateur inconnu",
      user_id: tx.wallets.user_id
    };
  });
}

export function useAdminPendingDeposits() {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ["admin-pending-deposits"],
    queryFn: async () => {
      return fetchTransactionsWithUsers("pending", "deposit") as Promise<PendingDeposit[]>;
    },
    enabled: isAdmin,
  });
}

export function useAdminTransactionHistory() {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ["admin-transaction-history"],
    queryFn: async () => {
      return fetchTransactionsWithUsers(["completed", "failed"]) as Promise<TransactionHistory[]>;
    },
    enabled: isAdmin,
  });
}

export function useApproveDeposit() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (transactionId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("approve_deposit" as any, {
        transaction_id_input: transactionId,
        admin_id_input: user.id
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-deposits"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
    },
  });
}

export function useRejectDeposit() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ transactionId, reason }: { transactionId: string; reason?: string }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("reject_deposit" as any, {
        transaction_id_input: transactionId,
        admin_id_input: user.id,
        reason_input: reason || "Demande rejetée par l'administrateur"
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-deposits"] });
    },
  });
}

export function useProofImageUrl(proofPath: string | null) {
  return useQuery({
    queryKey: ["proof-image", proofPath],
    queryFn: async () => {
      if (!proofPath) return null;

      // If it's already a full URL (e.g. from public bucket or external), use directly
      if (proofPath.startsWith("http://") || proofPath.startsWith("https://")) {
        return proofPath;
      }

      // Strip bucket prefix if accidentally included
      const cleanPath = proofPath.replace(/^transaction-proofs\//, "");

      const { data } = await supabase.storage
        .from("transaction-proofs")
        .createSignedUrl(cleanPath, 3600);

      if (data?.signedUrl) return data.signedUrl;

      // Fallback: try public URL
      const { data: publicData } = supabase.storage
        .from("transaction-proofs")
        .getPublicUrl(cleanPath);

      return publicData?.publicUrl || null;
    },
    enabled: !!proofPath,
  });
}
