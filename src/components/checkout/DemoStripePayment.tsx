import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, Lock, CheckCircle, Loader2 } from "lucide-react";
import { CURRENCY_SYMBOLS, Currency } from "@/types/database";
import { toast } from "sonner";

interface DemoStripePaymentProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  currency: Currency;
  onSuccess: () => void;
}

export function DemoStripePayment({ isOpen, onClose, amount, currency, onSuccess }: DemoStripePaymentProps) {
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(" ") : value;
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    if (v.length >= 2) {
      return v.slice(0, 2) + (v.length > 2 ? "/" + v.slice(2, 4) : "");
    }
    return v;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate demo card
    if (cardNumber.replace(/\s/g, "") !== "4242424242424242") {
      toast.error("Mode démo : utilisez la carte 4242 4242 4242 4242");
      return;
    }

    setLoading(true);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setLoading(false);
    setSuccess(true);
    
    // Wait a bit then callback
    setTimeout(() => {
      onSuccess();
      setSuccess(false);
      setCardNumber("");
      setExpiry("");
      setCvc("");
      setName("");
    }, 1500);
  };

  if (success) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[400px]">
          <div className="py-12 text-center">
            <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Paiement réussi !</h3>
            <p className="text-muted-foreground">
              {CURRENCY_SYMBOLS[currency]} {amount.toLocaleString()} ajoutés à votre portefeuille
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Paiement par carte
          </DialogTitle>
          <DialogDescription>
            Mode démo - Utilisez la carte test : 4242 4242 4242 4242
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-8">
                <div className="text-xs opacity-70">Carte de crédit</div>
                <CreditCard className="h-6 w-6" />
              </div>
              <div className="font-mono text-lg tracking-wider mb-4">
                {cardNumber || "•••• •••• •••• ••••"}
              </div>
              <div className="flex justify-between text-sm">
                <div>
                  <div className="text-xs opacity-70">Titulaire</div>
                  <div>{name || "VOTRE NOM"}</div>
                </div>
                <div>
                  <div className="text-xs opacity-70">Expire</div>
                  <div>{expiry || "MM/AA"}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="cardNumber">Numéro de carte</Label>
              <Input
                id="cardNumber"
                placeholder="4242 4242 4242 4242"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                maxLength={19}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nom sur la carte</Label>
              <Input
                id="name"
                placeholder="Jean Dupont"
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expiry">Date d'expiration</Label>
                <Input
                  id="expiry"
                  placeholder="MM/AA"
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  maxLength={5}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cvc">CVC</Label>
                <Input
                  id="cvc"
                  placeholder="123"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  maxLength={3}
                  required
                />
              </div>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-2 text-sm">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Paiement sécurisé - Mode démo
            </span>
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Traitement en cours...
              </>
            ) : (
              <>
                Payer {CURRENCY_SYMBOLS[currency]} {amount.toLocaleString()}
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
