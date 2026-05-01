import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import { useCheckout } from "@/hooks/useCheckout";
import { useCashCheckout } from "@/hooks/useCashCheckout";
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
import { CURRENCY_SYMBOLS, Currency } from "@/types/database";
import { ShoppingBag, MapPin, Wallet, Truck, AlertCircle, CheckCircle, Mail, Loader2, Navigation, Store, Banknote } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateDistance } from "@/hooks/useGeolocation";
import { ALL_CITIES } from "@/utils/cities";

const Checkout = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { items, getSubtotal, getDeliveryFee, getTotal } = useCart();
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: profile } = useProfile();
  const checkout = useCheckout();
  const cashCheckout = useCashCheckout();

  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [currency, setCurrency] = useState<Currency>("DOP");
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "cash">("wallet");
  
  // Buyer GPS
  const [buyerLat, setBuyerLat] = useState<number | null>(null);
  const [buyerLng, setBuyerLng] = useState<number | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [shopDistances, setShopDistances] = useState<Record<string, { distance: number; shopName: string; fee: number }>>({});

  // Get current position
  const handleGetLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBuyerLat(pos.coords.latitude);
        setBuyerLng(pos.coords.longitude);
        setGettingLocation(false);
        toast({ title: "Position obtenue ✓", description: "Votre position a été enregistrée" });
      },
      () => {
        setGettingLocation(false);
        toast({ title: "Erreur", description: "Impossible d'obtenir votre position", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Calculate distance per shop when buyer location available
  useEffect(() => {
    if (!buyerLat || !buyerLng || items.length === 0) return;
    
    const fetchSellerLocations = async () => {
      const sellerIds = [...new Set(items.map(i => i.product.seller_id))];
      const { data } = await supabase
        .from("seller_applications")
        .select("user_id, latitude, longitude, shop_name")
        .in("user_id", sellerIds)
        .eq("status", "approved")
        .not("latitude", "is", null);
      
      if (data) {
        // Compute distance for each seller, then sort by distance
        const sellersWithDist = data
          .filter(s => s.latitude && s.longitude)
          .map(seller => ({
            user_id: seller.user_id,
            shopName: seller.shop_name,
            distance: calculateDistance(buyerLat, buyerLng, seller.latitude!, seller.longitude!),
          }))
          .sort((a, b) => a.distance - b.distance);

        const distances: Record<string, { distance: number; shopName: string; fee: number }> = {};
        sellersWithDist.forEach((s, idx) => {
          const baseFee = Math.round(50 + 25 * s.distance);
          // First (closest) shop = base fee. Additional shops within 10 km radius = +10%
          const fee = idx === 0 ? baseFee : (s.distance <= 10 ? Math.round(baseFee * 1.10) : baseFee);
          distances[s.user_id] = { distance: s.distance, shopName: s.shopName, fee };
        });
        setShopDistances(distances);
      }
    };
    fetchSellerLocations();
  }, [buyerLat, buyerLng, items]);


  const isEmailVerified = profile?.email_verified ?? false;

  const subtotal = getSubtotal();
  // Calculate total delivery fee from all shops
  const sellerIds = [...new Set(items.map(i => i.product.seller_id))];
  const deliveryFee = sellerIds.reduce((total, sid) => {
    const shopInfo = shopDistances[sid];
    return total + (shopInfo ? shopInfo.fee : Math.round(50 + 25 * 5));
  }, 0);
  const total = subtotal + deliveryFee;

  const balanceField = currency === "DOP" ? "balance_dop" : currency === "HTG" ? "balance_htg" : "balance_usd";
  const currentBalance = wallet ? (wallet[balanceField] || 0) : 0;
  const hasEnoughBalance = currentBalance >= total;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({ title: "Erreur", description: "Vous devez être connecté pour passer une commande", variant: "destructive" });
      return;
    }

    if (!deliveryAddress || !deliveryCity) {
      toast({ title: "Erreur", description: "Veuillez renseigner l'adresse de livraison", variant: "destructive" });
      return;
    }

    if (paymentMethod === "wallet" && !hasEnoughBalance) {
      toast({ title: "Solde insuffisant", description: "Rechargez votre portefeuille ou payez en cash", variant: "destructive" });
      return;
    }

    try {
      const params = {
        deliveryAddress,
        deliveryCity,
        deliveryNotes,
        currency,
        buyerLatitude: buyerLat,
        buyerLongitude: buyerLng,
        deliveryFee,
      };

      if (paymentMethod === "cash") {
        await cashCheckout.mutateAsync(params);
      } else {
        await checkout.mutateAsync(params);
      }
      
      setOrderSuccess(true);
      toast({ title: "Commande confirmée !", description: paymentMethod === "cash" ? "Préparez le montant exact pour le livreur" : "Votre commande a été passée avec succès" });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message || "Une erreur est survenue", variant: "destructive" });
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
              <p className="text-muted-foreground mb-4">Vous devez être connecté pour passer une commande</p>
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
              <p className="text-muted-foreground mb-4">Ajoutez des produits à votre panier pour continuer</p>
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
              <div className="bg-green-100 dark:bg-green-900/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Commande confirmée !</h2>
              <p className="text-muted-foreground mb-4">
                Votre commande a été passée avec succès. Vous recevrez une notification lorsqu'elle sera en cours de livraison.
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => navigate("/")}>Retour à l'accueil</Button>
                <Button onClick={() => navigate("/orders")}>Voir mes commandes</Button>
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
                  {/* GPS Location button */}
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">📍 Position GPS</p>
                        {buyerLat && buyerLng ? (
                          <p className="text-xs text-green-600">Position enregistrée ✓</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Utilisez votre position pour un calcul précis des frais</p>
                        )}
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={handleGetLocation} disabled={gettingLocation}>
                        {gettingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                        <span className="ml-1">{buyerLat ? "Actualiser" : "Ma position"}</span>
                      </Button>
                    </div>
                    {Object.keys(shopDistances).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {Object.entries(shopDistances).map(([sid, info]) => (
                          <p key={sid} className="text-xs text-primary flex items-center gap-1">
                            <Store className="h-3 w-3" />
                            {info.shopName}: {info.distance.toFixed(1)} km → Livraison: RD$ {info.fee.toLocaleString()}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">Ville</Label>
                      <Select value={deliveryCity} onValueChange={setDeliveryCity}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner une ville" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          <SelectItem value="__do_header" disabled>🇩🇴 République Dominicaine</SelectItem>
                          {ALL_CITIES.DO.map((city) => (
                            <SelectItem key={city} value={city}>{city}</SelectItem>
                          ))}
                          <SelectItem value="__ht_header" disabled>🇭🇹 Haïti</SelectItem>
                          {ALL_CITIES.HT.map((city) => (
                            <SelectItem key={city} value={city}>{city}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">Devise</Label>
                      <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
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

              {/* Paiement */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Wallet className="h-5 w-5" />
                    Mode de paiement
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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

                  {/* Wallet payment option */}
                  <div
                    className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-all ${paymentMethod === "wallet" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "bg-muted/30 hover:bg-muted/50"}`}
                    onClick={() => setPaymentMethod("wallet")}
                  >
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
                    {paymentMethod === "wallet" && <CheckCircle className="h-5 w-5 text-primary" />}
                  </div>

                  {paymentMethod === "wallet" && !hasEnoughBalance && (
                    <p className="text-destructive text-sm flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      Solde insuffisant ({CURRENCY_SYMBOLS[currency]} {(total - currentBalance).toLocaleString()} manquants).
                      <Button type="button" variant="link" className="h-auto p-0 pl-1" onClick={() => navigate("/wallet")}>
                        Recharger
                      </Button>
                    </p>
                  )}

                  {/* Cash payment option */}
                  <div
                    className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-all ${paymentMethod === "cash" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "bg-muted/30 hover:bg-muted/50"}`}
                    onClick={() => setPaymentMethod("cash")}
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-accent/50 p-2 rounded-full">
                        <Banknote className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Paiement en cash</p>
                        <p className="text-sm text-muted-foreground">
                          Payez en espèces au livreur à la réception
                        </p>
                      </div>
                    </div>
                    {paymentMethod === "cash" && <CheckCircle className="h-5 w-5 text-primary" />}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Résumé */}
            <div>
              <Card className="sticky top-20">
                <CardHeader>
                  <CardTitle className="text-lg">Résumé de la commande</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                    {Object.entries(shopDistances).length > 0 ? (
                      Object.entries(shopDistances).map(([sid, info]) => (
                        <div key={sid} className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1 text-xs">
                            <Truck className="h-3 w-3" />
                            {info.shopName} ({info.distance.toFixed(1)} km)
                          </span>
                          <span className="text-xs">{CURRENCY_SYMBOLS[currency]} {info.fee.toLocaleString()}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Truck className="h-3 w-3" />
                          Livraison
                        </span>
                        <span>{CURRENCY_SYMBOLS[currency]} {deliveryFee.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="border-t pt-2">
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span>{CURRENCY_SYMBOLS[currency]} {total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" size="lg" disabled={checkout.isPending || cashCheckout.isPending || (paymentMethod === "wallet" && !hasEnoughBalance)}>
                    {(checkout.isPending || cashCheckout.isPending) ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : paymentMethod === "cash" ? (
                      <Banknote className="h-4 w-4 mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    {paymentMethod === "cash" ? "Commander (paiement cash)" : "Confirmer la commande"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>

      </main>
      <Footer />
    </div>
  );
};

export default Checkout;