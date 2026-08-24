import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Currency, CURRENCY_SYMBOLS, Wallet } from "@/types/database";
import { convertCurrency, useSyncCurrencyRates, CONVERSION_COMMISSION_PERCENT } from "@/hooks/useCurrencyRates";
import { QueryClient } from "@tanstack/react-query";

interface Props {
  wallet: Wallet | null | undefined;
  currencyRates: any[];
  queryClient: QueryClient;
}

export default function CurrencyConverterCard({ wallet, currencyRates, queryClient }: Props) {
  const [fromCurrency, setFromCurrency] = useState<Currency>("DOP");
  const [toCurrency, setToCurrency] = useState<Currency>("USD");
  const [amount, setAmount] = useState("");
  const [converting, setConverting] = useState(false);
  const syncRates = useSyncCurrencyRates();

  // Taux en temps réel : synchronisation à l'ouverture puis toutes les 5 minutes
  useEffect(() => {
    syncRates.mutate();
    const id = setInterval(() => syncRates.mutate(), 5 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const preview = amount && parseFloat(amount) > 0
    ? convertCurrency(parseFloat(amount), fromCurrency, toCurrency, currencyRates)
    : null;

  const handleConvert = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) { toast.error("Montant invalide"); return; }

    setConverting(true);
    try {
      const { data, error } = await supabase.rpc("convert_wallet_currency" as any, {
        p_amount: val,
        p_from_currency: fromCurrency,
        p_to_currency: toCurrency,
      });
      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);
      toast.success(`Converti ! ${CURRENCY_SYMBOLS[fromCurrency]}${val} → ${CURRENCY_SYMBOLS[toCurrency]}${result.converted_amount}`);
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur de conversion");
    } finally {
      setConverting(false);
    }
  };

  const swap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  return (
    <Card className="mb-8">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5" />
          Convertir des devises
        </CardTitle>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Taux en temps réel · commission {CONVERSION_COMMISSION_PERCENT}%</span>
          <Button variant="ghost" size="sm" onClick={() => syncRates.mutate()} disabled={syncRates.isPending}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncRates.isPending ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rates display */}
        <div className="flex flex-wrap gap-2">
          {currencyRates.filter(r => r.from_currency === "USD").map(r => (
            <Badge key={r.id} variant="outline" className="text-xs">
              1 USD = {r.rate} {r.to_currency}
            </Badge>
          ))}
          {currencyRates.filter(r => r.from_currency === "DOP" && r.to_currency === "HTG").map(r => (
            <Badge key={r.id} variant="outline" className="text-xs">
              1 DOP = {r.rate} HTG
            </Badge>
          ))}
        </div>

        {/* Conversion form */}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">De</Label>
            <Select value={fromCurrency} onValueChange={(v) => setFromCurrency(v as Currency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DOP">RD$ Peso</SelectItem>
                <SelectItem value="HTG">G Gourde</SelectItem>
                <SelectItem value="USD">$ Dollar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" size="icon" onClick={swap} className="mb-0.5">
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Vers</Label>
            <Select value={toCurrency} onValueChange={(v) => setToCurrency(v as Currency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DOP">RD$ Peso</SelectItem>
                <SelectItem value="HTG">G Gourde</SelectItem>
                <SelectItem value="USD">$ Dollar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Montant</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <Button onClick={handleConvert} disabled={converting || !amount || fromCurrency === toCurrency}>
            {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Convertir"}
          </Button>
        </div>

        {preview !== null && fromCurrency !== toCurrency && (
          <div className="text-sm text-muted-foreground space-y-1">
            <p>≈ {CURRENCY_SYMBOLS[toCurrency]} {preview.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs">(après commission {CONVERSION_COMMISSION_PERCENT}%)</span></p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
