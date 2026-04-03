import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle, Loader2, ExternalLink } from "lucide-react";
import { CURRENCY_SYMBOLS, Currency } from "@/types/database";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface PayPalPaymentProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  currency: Currency;
  onSuccess: () => void;
}

export function PayPalPayment({ isOpen, onClose, amount, currency, onSuccess }: PayPalPaymentProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePayPal = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Create PayPal order via edge function
      const { data, error } = await supabase.functions.invoke("paypal-payment", {
        body: {
          action: "create_order",
          amount,
          currency,
          user_id: user.id,
          return_url: window.location.origin,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || "Erreur PayPal");
      }

      const approveUrl = data.order.links?.find((l: any) => l.rel === "approve")?.href;
      if (!approveUrl) throw new Error("Lien PayPal non trouvé");

      // Store order info for capture on return
      sessionStorage.setItem("paypal_order_id", data.order.id);
      sessionStorage.setItem("paypal_amount", amount.toString());
      sessionStorage.setItem("paypal_currency", currency);

      // Redirect to PayPal
      window.location.href = approveUrl;
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du paiement PayPal");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[400px]">
          <div className="py-12 text-center">
            <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Paiement PayPal réussi !</h3>
            <p className="text-muted-foreground">
              {CURRENCY_SYMBOLS[currency]} {amount.toLocaleString()} ajoutés à votre portefeuille
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Convert to approximate USD for display
  let usdEstimate = amount;
  if (currency === "DOP") usdEstimate = Math.ceil(amount / 58);
  else if (currency === "HTG") usdEstimate = Math.ceil(amount / 132);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            💳 Paiement PayPal
          </DialogTitle>
          <DialogDescription>
            Payez en toute sécurité avec votre carte bancaire ou compte PayPal
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Montant local</span>
              <span className="font-medium">{CURRENCY_SYMBOLS[currency]} {amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Montant USD (approx.)</span>
              <span className="font-medium">≈ ${usdEstimate.toLocaleString()} USD</span>
            </div>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            Vous serez redirigé vers PayPal pour compléter le paiement de manière sécurisée.
            Vous pouvez payer par carte bancaire sans avoir de compte PayPal.
          </div>

          <Button
            onClick={handlePayPal}
            className="w-full bg-[#0070ba] hover:bg-[#005ea6] text-white"
            size="lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Redirection vers PayPal...
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4 mr-2" />
                Payer avec PayPal
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
