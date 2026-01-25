import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Wallet, WalletTransaction, PaymentMethodType, Currency } from "@/types/database";

export function useWallet() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as Wallet | null;
    },
    enabled: !!user,
  });
}

export function useWalletTransactions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["wallet-transactions", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // First get the wallet
      const { data: wallet } = await supabase
        .from("wallets")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!wallet) return [];

      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("wallet_id", wallet.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as WalletTransaction[];
    },
    enabled: !!user,
  });
}

interface DepositParams {
  amount: number;
  currency: Currency;
  paymentMethod: PaymentMethodType;
}

export function useDepositToWallet() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ amount, currency, paymentMethod }: DepositParams) => {
      if (!user) throw new Error("User not authenticated");

      // Get wallet
      const { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (walletError) throw walletError;

      // Create transaction
      const { data, error } = await supabase
        .from("wallet_transactions")
        .insert({
          wallet_id: wallet.id,
          type: "deposit",
          amount,
          currency,
          payment_method: paymentMethod,
          status: "pending",
          description: `Dépôt via ${paymentMethod}`
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
    },
  });
}
