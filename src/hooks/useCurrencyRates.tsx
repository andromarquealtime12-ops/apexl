import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CurrencyRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  updated_at: string;
}

export const CONVERSION_COMMISSION_PERCENT = 1;

export function useCurrencyRates() {
  return useQuery({
    queryKey: ["currency-rates"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("currency_rates")
        .select("*")
        .order("from_currency");
      if (error) throw error;
      return data as CurrencyRate[];
    },
  });
}

/** Rafraîchit les taux depuis une source de change en temps réel */
export function useSyncCurrencyRates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-currency-rates");
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["currency-rates"] }),
  });
}


export function useUpdateCurrencyRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, rate }: { id: string; rate: number }) => {
      const { error } = await supabase
        .from("currency_rates")
        .update({ rate, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["currency-rates"] }),
  });
}

export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: CurrencyRate[],
  applyCommission = true
): number {
  if (from === to) return amount;
  const rate = rates.find(r => r.from_currency === from && r.to_currency === to);
  if (!rate) return 0;
  const net = applyCommission
    ? amount * (1 - CONVERSION_COMMISSION_PERCENT / 100)
    : amount;
  return net * rate.rate;
}
