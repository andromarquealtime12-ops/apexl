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

// Les clés configurées par l'admin (ex: "Banco qik", "Reservas") ne sont pas
// toujours des valeurs de l'enum payment_method_type. On normalise avant l'appel RPC.
const PAYMENT_METHOD_ENUM = [
  "card_visa", "card_mastercard", "orange_money", "moncash", "banreservas", "bhd",
  "bank_transfer_do", "bank_transfer_ht", "paypal", "wise", "popular", "bank_other", "cash",
];

export function normalizePaymentMethod(key: string): PaymentMethodType {
  const raw = (key || "").trim();
  const slug = raw.toLowerCase().replace(/\s+/g, "_");
  if (PAYMENT_METHOD_ENUM.includes(slug)) return slug as PaymentMethodType;
  if (slug.includes("moncash")) return "moncash" as PaymentMethodType;
  if (slug.includes("paypal")) return "paypal" as PaymentMethodType;
  if (slug.includes("wise")) return "wise" as PaymentMethodType;
  if (slug.includes("reservas")) return "banreservas" as PaymentMethodType;
  if (slug.includes("popular")) return "popular" as PaymentMethodType;
  if (slug.includes("bhd")) return "bhd" as PaymentMethodType;
  return "bank_other" as PaymentMethodType;
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

      // Upload proof image (bucket is private, we store the path)
      const fileExt = proofFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("transaction-proofs")
        .upload(fileName, proofFile);

      if (uploadError) throw uploadError;

      // Create the pending transaction through the secure RPC
      const { data, error } = await supabase.rpc("submit_deposit_request" as any, {
        p_amount: amount,
        p_currency: currency,
        p_payment_method: paymentMethod,
        p_transaction_reference: transactionReference,
        p_proof_path: fileName,
      });

      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || "Dépôt refusé");
      return result;
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
