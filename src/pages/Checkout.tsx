import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import { useCheckout } from "@/hooks/useCheckout";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DemoStripePayment } from "@/components/checkout/DemoStripePayment";
import { PayPalPayment } from "@/components/checkout/PayPalPayment";
import { CURRENCY_SYMBOLS, Currency } from "@/types/database";
import { ShoppingBag, MapPin, Wallet, Truck, AlertCircle, CheckCircle, CreditCard, Mail } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const CITIES = [
  { value: "Santo Domingo", label: "Santo Domingo", country: "DO" },
  { value: "Santiago", label: "Santiago", country: "DO" },
  { value: "La Romana", label: "La Romana", country: "DO" },
  { value: "Port-au-Prince", label: "Port-au-Prince", country: "HT" },
  { value: "Cap-Haïtien", label: "Cap-Haïtien", country: "HT" },
  { value: "Pétion-Ville", label: "Pétion-Ville", country: "HT" },
];

const Checkout = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { items, getSubtotal, getDeliveryFee, getTotal } = useCart();
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: profile } = useProfile();
  const checkout = useCheckout();

  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [currency, setCurrency] = useState<Currency>("DOP");
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [showStripePayment, setShowStripePayment] = useState(false);
  const [showPayPalPayment, setShowPayPalPayment] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(0);

  // Handle PayPal return
  useEffect(() => {
    const paypalStatus = searchParams.get("paypal");
    const paypalOrderId = sessionStorage.getItem("paypal_order_id");
    const paypalCurrency = sessionStorage.getItem("paypal_currency") as Currency;
    
    if (paypalStatus === "success" && paypalOrderId && user) {
      // Capture the PayPal payment
      supabase.functions.invoke("paypal-payment", {
        body: {
          action: "capture_order",
          order_id: paypalOrderId,
          currency: paypalCurrency || "DOP",
          user_id: user.id,
        },
      }).then(({ data, error }) => {
        if (data?.success) {
          toast({ title: "Paiement PayPal réussi !", description: "Votre portefeuille a été rechargé" });
          queryClient.invalidateQueries({ queryKey: ["wallet"] });
          queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
        } else {
          toast({ title: "Erreur PayPal", description: error?.message || "Erreur lors de la capture", variant: "destructive" });
        }
        sessionStorage.removeItem("paypal_order_id");
        sessionStorage.removeItem("paypal_amount");
        sessionStorage.removeItem("paypal_currency");
        // Clean URL
        navigate("/checkout", { replace: true });
      });
    } else if (paypalStatus === "cancel") {
      toast({ title: "Paiement annulé", description: "Le paiement PayPal a été annulé" });
      sessionStorage.removeItem("paypal_order_id");
      navigate("/checkout", { replace: true });
    }
  }, [searchParams, user]);

  const isEmailVerified = profile?.email_verified ?? false;

  const subtotal = getSubtotal();
  const deliveryFee = getDeliveryFee(deliveryCity);
  const total = getTotal(deliveryCity);

  const balanceField = currency === "DOP" ? "balance_dop" : currency === "HTG" ? "balance_htg" : "balance_usd";
  const currentBalance = wallet ? (wallet[balanceField] || 0) : 0;
  const hasEnoughBalance = currentBalance >= total;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Erreur",
        description: "Vous devez être connecté pour passer une commande",
        variant: "destructive",
      });
      return;
    }

    if (!deliveryAddress || !deliveryCity) {
      toast({
        title: "Erreur",
        description: "Veuillez renseigner l'adresse de livraison",
        variant: "destructive",
      });
      return;
    }

    if (!hasEnoughBalance) {
      toast({
        title: "Solde insuffisant",
        description: "Rechargez votre portefeuille pour continuer",
        variant: "destructive",
      });
      return;
    }

    try {
      await checkout.mutateAsync({
        deliveryAddress,
        deliveryCity,
        deliveryNotes,
        currency,
      });
      
      setOrderSuccess(true);
      toast({
        title: "Commande confirmée !",
        description: "Votre commande a été passée avec succès",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container py-8">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Connexion requise</h2>
              <p className="text-muted-foreground mb-4">
                Vous devez être connecté pour passer une commande
              </p>
              <Button onClick={() => navigate("/")}>Retour à l'accueil</Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (items.length === 0 && !orderSuccess) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container py-8">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Panier vide</h2>
              <p className="text-muted-foreground mb-4">
                Ajoutez des produits à votre panier pour continuer
              </p>
              <Button onClick={() => navigate("/products")}>Voir les produits</Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (orderSuccess) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container py-8">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <div className="bg-success/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Commande confirmée !</h2>
              <p className="text-muted-foreground mb-4">
                Votre commande a été passée avec succès. Vous recevrez une notification lorsqu'elle sera en cours de livraison.
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => navigate("/")}>
                  Retour à l'accueil
                </Button>
                <Button onClick={() => navigate("/orders")}>
                  Voir mes commandes
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <ShoppingBag className="h-6 w-6" />
          Finaliser la commande
        </h1>

        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Colonne gauche - Formulaire */}
            <div className="lg:col-span-2 space-y-6">
              {/* Adresse de livraison */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MapPin className="h-5 w-5" />
                    Adresse de livraison
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">Ville</Label>
                      <Select value={deliveryCity} onValueChange={setDeliveryCity}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner une ville" />
                        </SelectTrigger>
                        <SelectContent>
                          {CITIES.map((city) => (
                            <SelectItem key={city.value} value={city.value}>
                              {city.label} ({city.country})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">Devise</Label>
                      <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DOP">Peso Dominicain (RD$)</SelectItem>
                          <SelectItem value="HTG">Gourde Haïtienne (G)</SelectItem>
                          <SelectItem value="USD">Dollar US ($)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Adresse complète</Label>
                    <Input
                      id="address"
                      placeholder="Rue, numéro, quartier..."
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Instructions de livraison (optionnel)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Informations supplémentaires pour le livreur..."
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Méthode de paiement */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Wallet className="h-5 w-5" />
                    Paiement
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Email verification warning */}
                  {!isEmailVerified && (
                    <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-900/20">
                      <Mail className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800 dark:text-amber-200">
                        Veuillez vérifier votre email avant de passer commande.
                        <Button variant="link" className="h-auto p-0 pl-1 text-amber-600" onClick={() => navigate("/profile")}>
                          Vérifier maintenant
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <Wallet className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Portefeuille Ayiti Market</p>
                        <p className="text-sm text-muted-foreground">
                          Solde: {CURRENCY_SYMBOLS[currency]} {currentBalance.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {hasEnoughBalance ? (
                      <CheckCircle className="h-5 w-5 text-success" />
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => navigate("/wallet")}
                        >
                          Recharger
                        </Button>
                      </div>
                    )}
                  </div>

                  {!hasEnoughBalance && (
                    <div className="space-y-3">
                      <p className="text-destructive text-sm flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        Solde insuffisant ({CURRENCY_SYMBOLS[currency]} {(total - currentBalance).toLocaleString()} manquants)
                      </p>

                      {/* Demo Stripe payment option */}
                      <div className="border rounded-lg p-4 bg-muted/20">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="bg-primary/10 p-2 rounded-full">
                            <CreditCard className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">Payer par carte (Démo)</p>
                            <p className="text-xs text-muted-foreground">
                              Ajoutez le montant manquant à votre portefeuille
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full gap-2"
                          onClick={() => {
                            setTopUpAmount(total - currentBalance);
                            setShowStripePayment(true);
                          }}
                        >
                          <CreditCard className="h-4 w-4" />
                          Ajouter {CURRENCY_SYMBOLS[currency]} {(total - currentBalance).toLocaleString()} par carte
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Colonne droite - Résumé */}
            <div>
              <Card className="sticky top-20">
                <CardHeader>
                  <CardTitle className="text-lg">Résumé de la commande</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Liste des produits */}
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {items.map((item) => (
                      <div key={item.product.id} className="flex gap-3">
                        <img
                          src={item.product.images?.[0] || "/placeholder.svg"}
                          alt={item.product.name}
                          className="w-12 h-12 object-cover rounded bg-muted"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-1">{item.product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} × {CURRENCY_SYMBOLS[item.product.currency]} {item.product.price.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sous-total</span>
                      <span>{CURRENCY_SYMBOLS[currency]} {subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Truck className="h-4 w-4" /> Livraison
                      </span>
                      <span>{CURRENCY_SYMBOLS[currency]} {deliveryFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-base pt-2 border-t">
                      <span>Total</span>
                      <span className="text-primary">{CURRENCY_SYMBOLS[currency]} {total.toLocaleString()}</span>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="hero"
                    className="w-full"
                    size="lg"
                    disabled={!isEmailVerified || !hasEnoughBalance || checkout.isPending || !deliveryAddress || !deliveryCity}
                  >
                    {checkout.isPending ? "Traitement..." : "Confirmer la commande"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </main>
      <Footer />

      {/* Demo Stripe Payment Modal */}
      <DemoStripePayment
        isOpen={showStripePayment}
        onClose={() => setShowStripePayment(false)}
        amount={topUpAmount}
        currency={currency}
        onSuccess={async () => {
           // Use secure server-side RPC function for demo wallet top-up
           const { data, error } = await supabase.rpc("demo_wallet_topup" as any, {
             p_amount: topUpAmount,
             p_currency: currency,
           });

           if (error) {
             toast({
               title: "Erreur",
               description: error.message || "Impossible de recharger le portefeuille",
               variant: "destructive",
             });
           } else {
             queryClient.invalidateQueries({ queryKey: ["wallet"] });
             queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
             toast({
               title: "Portefeuille rechargé !",
               description: `${CURRENCY_SYMBOLS[currency]} ${topUpAmount.toLocaleString()} ajoutés à votre solde`,
             });
          }
          setShowStripePayment(false);
        }}
      />
    </div>
  );
};

export default Checkout;
