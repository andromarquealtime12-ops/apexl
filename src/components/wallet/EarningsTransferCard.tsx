import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PiggyBank, ArrowRightLeft, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { CURRENCY_SYMBOLS, Currency } from "@/types/database";

const CURRENCIES: Currency[] = ["DOP", "HTG", "USD"];

export default function EarningsTransferCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currency, setCurrency] = useState<Currency>("DOP");
  const [amount, setAmount] = useState("");

  const { data: wallet, isLoading } = useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!user,
  });

  const earningsFor = (c: Currency) =>
    Number(
      wallet?.[c === "DOP" ? "earnings_dop" : c === "HTG" ? "earnings_htg" : "earnings_usd"] ?? 0
    );

  const available = earningsFor(currency);
  const parsed = parseFloat(amount) || 0;
  const fee = Math.round(parsed * 1) / 100; // 1% fee, rounded to 2 decimals
  const net = parsed - fee;

  const transfer = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("transfer_earnings_to_wallet" as any, {
        p_amount: parsed,
        p_currency: currency,
      });
      if (error) throw error;
      const res = data as any;
      if (!res?.success) throw new Error(res?.error || t("sellerx.earnings.toasts.transferFailed"));
      return res;
    },
    onSuccess: (res: any) => {
      toast({
        title: t("sellerx.earnings.toasts.successTitle"),
        description: t("sellerx.earnings.toasts.successDescription", {
          symbol: CURRENCY_SYMBOLS[currency],
          transferred: res.transferred,
          fee: res.fee,
        }),
      });
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
    },
    onError: (e: any) =>
      toast({ title: t("sellerx.earnings.toasts.errorTitle"), description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5" />
          {t("sellerx.earnings.title")}
        </CardTitle>
        <CardDescription>
          {t("sellerx.earnings.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {CURRENCIES.map((c) => {
                const val = earningsFor(c);
                return (
                  <div key={c} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{c}</p>
                    <p
                      className={`text-lg font-bold ${val < 0 ? "text-destructive" : ""}`}
                    >
                      {CURRENCY_SYMBOLS[c]} {val.toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>

            {available < 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {t("sellerx.earnings.negativeBalance", { currency })}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>{t("sellerx.earnings.currencyLabel")}</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t("sellerx.earnings.amountLabel")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            {parsed > 0 && (
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>{t("sellerx.earnings.transferFee")}</span>
                  <span>
                    -{CURRENCY_SYMBOLS[currency]} {fee.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between font-medium text-foreground">
                  <span>{t("sellerx.earnings.creditedToWallet")}</span>
                  <span>
                    {CURRENCY_SYMBOLS[currency]} {net.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setAmount(available > 0 ? String(available) : "")}
                disabled={available <= 0}
              >
                {t("sellerx.earnings.all")}
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={() => transfer.mutate()}
                disabled={transfer.isPending || parsed <= 0 || parsed > available}
              >
                <ArrowRightLeft className="h-4 w-4" />
                {transfer.isPending ? t("sellerx.earnings.transferring") : t("sellerx.earnings.transferButton")}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
