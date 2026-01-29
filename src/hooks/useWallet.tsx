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

// Payment instructions for each method
export const PAYMENT_INSTRUCTIONS: Record<string, { 
  accountNumber: string; 
  accountName: string; 
  instructions: string;
}> = {
  banreservas: {
    accountNumber: "9607842951",
    accountName: "Santo Josefa",
    instructions: "Effectuez un dépôt sur ce compte, puis entrez le numéro de transaction et téléchargez la photo du reçu."
  },
  moncash: {
    accountNumber: "39297720",
    accountName: "Ayiti Market",
    instructions: "Envoyez le montant via Moncash, puis entrez le numéro de transaction et téléchargez la capture d'écran."
  },
  orange_money: {
    accountNumber: "À définir",
    accountName: "Ayiti Market",
    instructions: "Envoyez le montant via Orange Money, puis entrez le numéro de transaction et téléchargez la capture d'écran."
  },
  bhd: {
    accountNumber: "À définir",
    accountName: "Ayiti Market",
    instructions: "Effectuez un virement sur ce compte, puis entrez le numéro de transaction et téléchargez la preuve."
  },
  bank_transfer_do: {
    accountNumber: "À définir",
    accountName: "Ayiti Market",
    instructions: "Effectuez un virement bancaire, puis entrez le numéro de transaction et téléchargez la preuve."
  },
  bank_transfer_ht: {
    accountNumber: "À définir",
    accountName: "Ayiti Market",
    instructions: "Effectuez un virement bancaire, puis entrez le numéro de transaction et téléchargez la preuve."
  }
};