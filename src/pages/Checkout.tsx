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
import { ShoppingBag, MapPin, Wallet, Truck, AlertCircle, CheckCircle, Mail, Loader2, Navigation, Store, Banknote, Globe, MapPinned } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateDistance } from "@/hooks/useGeolocation";
import { ALL_CITIES } from "@/utils/cities";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { GpsAddressField } from "@/components/ui/GpsAddressField";

import { useDeliveryZones } from "@/hooks/useDeliveryZones";
import { getZoneForPoint, calculateFee } from "@/utils/deliveryPricing";
import { getRoute } from "@/utils/osrmRouting";

const Checkout = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { items, getSubtotal, getDeliveryFee, getTotal } = useCart();
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: profile } = useProfile();
  const checkout = useCheckout();
  const cashCheckout = useCashCheckout();
  const { data: zones } = useDeliveryZones(false);

  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [currency, setCurrency] = useState<Currency>("DOP");
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "cash">("wallet");

  // Printful international address
  const [deliveryAddress2, setDeliveryAddress2] = useState("");
  const [deliveryState, setDeliveryState] = useState("");
  const [deliveryZip, setDeliveryZip] = useState("");
  const [deliveryCountry, setDeliveryCountry] = useState(profile?.country || "DO");

  const hasPrintfulItem = items.some((it) => (it.product as any).is_printful === true);

  // Printful orders are billed in USD only — force currency
  useEffect(() => {
    if (hasPrintfulItem && currency !== "USD") setCurrency("USD");
  }, [hasPrintfulItem, currency]);

  // Buyer GPS
  const [buyerLat, setBuyerLat] = useState<number | null>(null);
  const [buyerLng, setBuyerLng] = useState<number | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [shopDistances, setShopDistances] = useState<Record<string, { distance: number; shopName: string; fee: number }>>({});

  // Get current position (one-shot, high accuracy)
  const handleGetLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast({ title: "Erreur", description: "La géolocalisation n'est pas disponible sur cet appareil", variant: "destructive" });
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBuyerLat(pos.coords.latitude);
        setBuyerLng(pos.coords.longitude);
        setGettingLocation(false);
        toast({ title: "Position obtenue ✓", description: `Précision ~${Math.round(pos.coords.accuracy)} m` });
      },
      (err) => {
        setGettingLocation(false);
        toast({
          title: "Erreur de localisation",
          description: err.code === 1 ? "Veuillez autoriser l'accès à votre position" : "Impossible d'obtenir votre position",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  // Auto-request position on mount + continuous watch for robustness
  useEffect(() => {
    if (!navigator.geolocation) return;
    handleGetLocation();
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        // Only update if accuracy improves or position drifts > 50m
        setBuyerLat((prev) => {
          if (prev == null) return pos.coords.latitude;
          return pos.coords.accuracy < 50 ? pos.coords.latitude : prev;
        });
        setBuyerLng((prev) => {
          if (prev == null) return pos.coords.longitude;
          return pos.coords.accuracy < 50 ? pos.coords.longitude : prev;
        });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate REAL road distance per shop via OSRM when buyer location available
  useEffect(() => {
    if (!buyerLat || !buyerLng || items.length === 0) return;

    let cancelled = false;
    const fetchSellerLocations = async () => {
      const sellerIds = [...new Set(items.map(i => i.product.seller_id))];
      const { data: allShops } = await (supabase as any)
        .rpc("get_public_seller_shops", { p_user_id: null });
      const data = (allShops || []).filter((s: any) =>
        sellerIds.includes(s.user_id) && s.latitude != null && s.longitude != null
      );

      if (!data?.length) return;

      // Pick tarif zone based on buyer position
      const buyerZone = getZoneForPoint(buyerLat, buyerLng, zones);

      // Fetch real routing distance (parallel) for each seller
      const routed = await Promise.all(
        data.map(async (seller: any) => {
          const route = await getRoute(
            { lat: seller.latitude, lng: seller.longitude },
            { lat: buyerLat, lng: buyerLng }
          );
          return {
            user_id: seller.user_id,
            shopName: seller.shop_name,
            distance: route.distanceKm,
          };
        })
      );

      if (cancelled) return;

      const sorted = routed.sort((a, b) => a.distance - b.distance);
      const distances: Record<string, { distance: number; shopName: string; fee: number }> = {};
      sorted.forEach((s, idx) => {
        const baseFee = calculateFee(s.distance, buyerZone);
        // Additional shops within 10 km radius pay +10% surcharge
        const fee = idx === 0 ? baseFee : (s.distance <= 10 ? Math.round(baseFee * 1.10) : baseFee);
        distances[s.user_id] = { distance: s.distance, shopName: s.shopName, fee };
      });
      setShopDistances(distances);
    };
    fetchSellerLocations();
    return () => { cancelled = true; };
  }, [buyerLat, buyerLng, items, zones]);


  // Prefill phone from profile
  useEffect(() => {
    if (profile?.phone && !buyerPhone) setBuyerPhone(profile.phone);
  }, [profile?.phone, buyerPhone]);

  const subtotal = getSubtotal();
  // Calculate total delivery fee from all shops
  const sellerIds = [...new Set(items.map(i => i.product.seller_id))];
  const deliveryFee = sellerIds.reduce((total, sid) => {
    const shopInfo = shopDistances[sid];
    // Default if distance unknown: 30 RD$ × 5 km estimé
    return total + (shopInfo ? shopInfo.fee : 150);
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

    const phoneClean = buyerPhone.replace(/\s+/g, "");
    if (!phoneClean || phoneClean.length < 7) {
      toast({ title: "Téléphone requis", description: "Un numéro de téléphone valide est obligatoire pour que le livreur puisse vous contacter.", variant: "destructive" });
      return;
    }

    // Persist phone on profile if changed
    if (profile && profile.phone !== buyerPhone) {
      await supabase.from("profiles").update({ phone: buyerPhone }).eq("user_id", user.id);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    }

    if (paymentMethod === "wallet" && !hasEnoughBalance) {
      toast({ title: "Solde insuffisant", description: "Rechargez votre portefeuille ou payez en cash", variant: "destructive" });
      return;
    }

    if (hasPrintfulItem && (!deliveryAddress || !deliveryState || !deliveryZip || !deliveryCountry)) {
      toast({ title: "Adresse incomplète", description: "Veuillez compléter l'adresse internationale pour Printful (ligne 1, état, code postal, pays).", variant: "destructive" });
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
        deliveryAddress2: deliveryAddress2 || undefined,
        deliveryState: deliveryState || undefined,
        deliveryZip: deliveryZip || undefined,
        deliveryCountry: deliveryCountry || undefined,
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
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-medium text-sm">📍 Position GPS</p>
                        {buyerLat && buyerLng ? (
                          <p className="text-xs text-green-600">Position enregistrée ✓ ({buyerLat.toFixed(4)}, {buyerLng.toFixed(4)})</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Utilisez votre position pour un calcul précis des frais</p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button type="button" variant="outline" size="sm" onClick={handleGetLocation} disabled={gettingLocation}>
                          {gettingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                          <span className="ml-1">{buyerLat ? "Actualiser" : "Ma position"}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            if (!buyerLat || !buyerLng) {
                              toast({ title: "Position requise", description: "Activez d'abord votre position GPS", variant: "destructive" });
                              return;
                            }
                            navigate(`/products?near=1&lat=${buyerLat}&lng=${buyerLng}`);
                          }}
                        >
                          <MapPinned className="h-4 w-4" />
                          <span className="ml-1">Produits locaux</span>
                        </Button>
                      </div>
                    </div>
                    {Object.keys(shopDistances).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {Object.entries(shopDistances)
                          .sort(([, a], [, b]) => a.distance - b.distance)
                          .map(([sid, info], idx) => (
                          <p key={sid} className="text-xs text-primary flex items-center gap-1 flex-wrap">
                            <Store className="h-3 w-3" />
                            {info.shopName}: {info.distance.toFixed(1)} km → RD$ {info.fee.toLocaleString()}
                            {idx > 0 && info.distance <= 10 && (
                              <span className="text-amber-600 ml-1">(+10% multi-vendeurs)</span>
                            )}
                          </p>
                        ))}
                        {Object.keys(shopDistances).length > 1 && (
                          <p className="text-[11px] text-muted-foreground italic mt-1">
                            ℹ️ La 1ère boutique (la plus proche) au tarif normal. Les boutiques additionnelles dans un rayon de 10 km : +10%.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="country">Pays</Label>
                      <Select value={deliveryCountry} onValueChange={setDeliveryCountry}>
                        <SelectTrigger><SelectValue placeholder="Pays" /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          <SelectItem value="DO">🇩🇴 République Dominicaine</SelectItem>
                          <SelectItem value="HT">🇭🇹 Haïti</SelectItem>
                          <SelectItem value="US">🇺🇸 États-Unis</SelectItem>
                          <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                          <SelectItem value="MX">🇲🇽 Mexique</SelectItem>
                          <SelectItem value="FR">🇫🇷 France</SelectItem>
                          <SelectItem value="ES">🇪🇸 Espagne</SelectItem>
                          <SelectItem value="GB">🇬🇧 Royaume-Uni</SelectItem>
                          <SelectItem value="DE">🇩🇪 Allemagne</SelectItem>
                          <SelectItem value="IT">🇮🇹 Italie</SelectItem>
                          <SelectItem value="PT">🇵🇹 Portugal</SelectItem>
                          <SelectItem value="BE">🇧🇪 Belgique</SelectItem>
                          <SelectItem value="CH">🇨🇭 Suisse</SelectItem>
                          <SelectItem value="NL">🇳🇱 Pays-Bas</SelectItem>
                          <SelectItem value="BR">🇧🇷 Brésil</SelectItem>
                          <SelectItem value="AR">🇦🇷 Argentine</SelectItem>
                          <SelectItem value="CL">🇨🇱 Chili</SelectItem>
                          <SelectItem value="CO">🇨🇴 Colombie</SelectItem>
                          <SelectItem value="PE">🇵🇪 Pérou</SelectItem>
                          <SelectItem value="VE">🇻🇪 Venezuela</SelectItem>
                          <SelectItem value="PR">🇵🇷 Porto Rico</SelectItem>
                          <SelectItem value="CU">🇨🇺 Cuba</SelectItem>
                          <SelectItem value="JM">🇯🇲 Jamaïque</SelectItem>
                          <SelectItem value="BS">🇧🇸 Bahamas</SelectItem>
                          <SelectItem value="GP">🇬🇵 Guadeloupe</SelectItem>
                          <SelectItem value="MQ">🇲🇶 Martinique</SelectItem>
                          <SelectItem value="GF">🇬🇫 Guyane</SelectItem>
                          <SelectItem value="SN">🇸🇳 Sénégal</SelectItem>
                          <SelectItem value="CI">🇨🇮 Côte d'Ivoire</SelectItem>
                          <SelectItem value="CM">🇨🇲 Cameroun</SelectItem>
                          <SelectItem value="MA">🇲🇦 Maroc</SelectItem>
                          <SelectItem value="DZ">🇩🇿 Algérie</SelectItem>
                          <SelectItem value="TN">🇹🇳 Tunisie</SelectItem>
                          <SelectItem value="CN">🇨🇳 Chine</SelectItem>
                          <SelectItem value="JP">🇯🇵 Japon</SelectItem>
                          <SelectItem value="KR">🇰🇷 Corée du Sud</SelectItem>
                          <SelectItem value="IN">🇮🇳 Inde</SelectItem>
                          <SelectItem value="AU">🇦🇺 Australie</SelectItem>
                          <SelectItem value="OTHER">🌍 Autre pays</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Adresse ligne 1</Label>
                    <GpsAddressField
                      id="address"
                      value={deliveryAddress}
                      onChange={setDeliveryAddress}
                      coords={{ lat: buyerLat, lng: buyerLng }}
                      onCoords={(la, lo) => {
                        setBuyerLat(la);
                        setBuyerLng(lo);
                      }}
                      onSelect={(s) => {
                        setDeliveryAddress(s.address);
                        if (s.city) setDeliveryCity(s.city);
                        if (s.state) setDeliveryState(s.state);
                        if (s.postcode) setDeliveryZip(s.postcode);
                      }}
                      placeholder="Ex: Av. 27 de Febrero, Santo Domingo…"
                      countryCodes={deliveryCountry === "HT" ? "ht" : deliveryCountry === "DO" ? "do" : "do,ht"}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address2">Adresse ligne 2 (optionnel)</Label>
                    <Input
                      id="address2"
                      placeholder="Appartement, suite, étage, point de repère..."
                      value={deliveryAddress2}
                      onChange={(e) => setDeliveryAddress2(e.target.value)}
                    />
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="state">État / Province / Région {hasPrintfulItem && <span className="text-destructive">*</span>}</Label>
                      <Input
                        id="state"
                        placeholder="Ex: Distrito Nacional, Ouest..."
                        value={deliveryState}
                        onChange={(e) => setDeliveryState(e.target.value)}
                        required={hasPrintfulItem}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zip">Code postal {hasPrintfulItem && <span className="text-destructive">*</span>}</Label>
                      <Input
                        id="zip"
                        placeholder="10101"
                        value={deliveryZip}
                        onChange={(e) => setDeliveryZip(e.target.value)}
                        required={hasPrintfulItem}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Devise</Label>
                    <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)} disabled={hasPrintfulItem}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DOP" disabled={hasPrintfulItem}>Peso Dominicain (RD$)</SelectItem>
                        <SelectItem value="HTG" disabled={hasPrintfulItem}>Gourde Haïtienne (G)</SelectItem>
                        <SelectItem value="USD">Dollar US ($)</SelectItem>
                      </SelectContent>
                    </Select>
                    {hasPrintfulItem && (
                      <p className="text-xs text-muted-foreground">Les commandes Printful sont obligatoirement réglées en USD.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="buyer_phone">
                      Téléphone de contact <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="buyer_phone"
                      type="tel"
                      placeholder="+1 809 000 0000"
                      value={buyerPhone}
                      onChange={(e) => setBuyerPhone(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Obligatoire — le livreur vous appellera à ce numéro pour la livraison.
                    </p>
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
                  {hasPrintfulItem && (
                    <Alert>
                      <Globe className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Les produits Printful sont facturés en USD et expédiés par Printful directement à cette adresse. État/province et code postal sont obligatoires.
                      </AlertDescription>
                    </Alert>
                  )}
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
                        <p className="font-medium">Portefeuille APEX</p>
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