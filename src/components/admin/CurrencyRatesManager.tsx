import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Save, RefreshCw } from "lucide-react";
import { useCurrencyRates, useUpdateCurrencyRate } from "@/hooks/useCurrencyRates";
import { toast } from "sonner";

const CURRENCY_FLAGS: Record<string, string> = {
  USD: "🇺🇸",
  DOP: "🇩🇴",
  HTG: "🇭🇹",
};

export default function CurrencyRatesManager() {
  const { data: rates, isLoading } = useCurrencyRates();
  const updateRate = useUpdateCurrencyRate();
  const [localRates, setLocalRates] = useState<Record<string, number>>({});

  useEffect(() => {
    if (rates) {
      const map: Record<string, number> = {};
      rates.forEach(r => { map[r.id] = r.rate; });
      setLocalRates(map);
    }
  }, [rates]);

  const handleSave = async (id: string) => {
    try {
      await updateRate.mutateAsync({ id, rate: localRates[id] });
      toast.success("Taux mis à jour");
    } catch {
      toast.error("Erreur");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Taux de conversion
        </CardTitle>
        <CardDescription>Configurez les taux de change entre devises</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Chargement...</p>
        ) : (
          <div className="space-y-3">
            {rates?.map(rate => (
              <div key={rate.id} className="flex items-center gap-3 p-3 border rounded-lg">
                <span className="text-lg">{CURRENCY_FLAGS[rate.from_currency] || ""}</span>
                <span className="font-medium w-10">{rate.from_currency}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-lg">{CURRENCY_FLAGS[rate.to_currency] || ""}</span>
                <span className="font-medium w-10">{rate.to_currency}</span>
                <span className="text-muted-foreground mx-1">=</span>
                <Input
                  type="number"
                  step="0.0001"
                  className="w-32"
                  value={localRates[rate.id] ?? rate.rate}
                  onChange={(e) => setLocalRates(prev => ({ ...prev, [rate.id]: parseFloat(e.target.value) || 0 }))}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSave(rate.id)}
                  disabled={localRates[rate.id] === rate.rate || updateRate.isPending}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
