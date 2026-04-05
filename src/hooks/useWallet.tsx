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
  transactionReference: string;
  proofFile: File;
}

export function useDepositToWallet() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ amount, currency, paymentMethod, transactionReference, proofFile }: DepositParams) => {
      if (!user) throw new Error("User not authenticated");

      // Get wallet
      const { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (walletError) throw walletError;

      // Upload proof image
      const fileExt = proofFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("transaction-proofs")
        .upload(fileName, proofFile);

      if (uploadError) throw uploadError;

      // Get the file URL
      const { data: urlData } = supabase.storage
        .from("transaction-proofs")
        .getPublicUrl(fileName);

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
          description: `Dépôt via ${paymentMethod}`,
          transaction_reference: transactionReference,
          proof_image_url: fileName // Store the path, not full URL since bucket is private
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

interface WithdrawalParams {
  amount: number;
  currency: Currency;
  paymentMethod: PaymentMethodType;
  accountDetails: string;
}

export function useRequestWithdrawal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ amount, currency, paymentMethod, accountDetails }: WithdrawalParams) => {
      const { data, error } = await supabase.rpc("request_withdrawal" as any, {
        p_amount: amount,
        p_currency: currency,
        p_payment_method: paymentMethod,
        p_account_details: accountDetails,
      });
      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
    },
  });
}
