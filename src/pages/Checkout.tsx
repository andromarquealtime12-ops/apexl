import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n/checkoutx";
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
import { reverseGeocode } from "@/utils/reverseGeocode";
import { Checkbox } from "@/components/ui/checkbox";
import { useUserCountry } from "@/utils/userCountry";



const Checkout = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { items, getSubtotal, getDeliveryFee, getTotal } = useCart();
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: profile } = useProfile();
  const checkout = useCheckout();
  const cashCheckout = useCashCheckout();
  const { data: zones } = useDeliveryZones(false);

  // Restore saved confirmed address from localStorage
  const savedAddress = (() => {
    try { return JSON.parse(localStorage.getItem("apex_confirmed_address") || "null"); } catch { return null; }
  })();

  const [deliveryAddress, setDeliveryAddress] = useState(savedAddress?.address || "");
  const [deliveryCity, setDeliveryCity] = useState(savedAddress?.city || "");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [currency, setCurrency] = useState<Currency>("DOP");
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "cash">("wallet");

  // Printful international address
  const [deliveryAddress2, setDeliveryAddress2] = useState(savedAddress?.address2 || "");
  const [deliveryState, setDeliveryState] = useState(savedAddress?.state || "");
  const [deliveryZip, setDeliveryZip] = useState(savedAddress?.zip || "");
  const [deliveryCountry, setDeliveryCountry] = useState(savedAddress?.country || profile?.country || "DO");

  const hasPrintfulItem = items.some((it) => (it.product as any).is_printful === true);
  const userCountry = useUserCountry();
  const hasInternationalItem = items.some((it) => {
    const p: any = it.product;
    if (p.is_printful || p.is_shopify) return true;
    return !!p.seller_country && p.seller_country !== userCountry;
  });

  // International orders (Printful, Shopify, or foreign seller) must be paid by wallet
  useEffect(() => {
    if (hasInternationalItem && paymentMethod === "cash") setPaymentMethod("wallet");
  }, [hasInternationalItem, paymentMethod]);

  // Printful orders are billed in USD only — force currency
  useEffect(() => {
    if (hasPrintfulItem && currency !== "USD") setCurrency("USD");
  }, [hasPrintfulItem, currency]);


  // Buyer GPS (restore from saved address so distance/fees compute immediately)
  const [buyerLat, setBuyerLat] = useState<number | null>(savedAddress?.lat ?? null);
  const [buyerLng, setBuyerLng] = useState<number | null>(savedAddress?.lng ?? null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [shopDistances, setShopDistances] = useState<Record<string, { distance: number; shopName: string; fee: number }>>({});
  // Auto-address confirmation — pre-confirmed if restored from a previous checkout
  const [addressAutoFilled, setAddressAutoFilled] = useState(!!savedAddress);
  const [addressConfirmed, setAddressConfirmed] = useState(!!savedAddress);

  const [reverseLoading, setReverseLoading] = useState(false);


  // Get current position (one-shot, high accuracy)
  const handleGetLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast({ title: t("checkoutx.toast.error"), description: t("checkoutx.toast.geoErrorDesc"), variant: "destructive" });
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBuyerLat(pos.coords.latitude);
        setBuyerLng(pos.coords.longitude);
        setGettingLocation(false);
        toast({ title: t("checkoutx.toast.positionObtainedTitle"), description: t("checkoutx.toast.positionObtainedDesc", { accuracy: Math.round(pos.coords.accuracy) }) });
      },
      (err) => {
        setGettingLocation(false);
        toast({
          title: t("checkoutx.toast.locationErrorTitle"),
          description: err.code === 1 ? t("checkoutx.toast.locationErrorDenied") : t("checkoutx.toast.locationErrorGeneric"),
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


  // Reverse-geocode buyer GPS → autofill address (only if the user has not typed anything)
  useEffect(() => {
    if (!buyerLat || !buyerLng) return;
    if (addressConfirmed) return; // keep user-confirmed address as-is
    if (deliveryAddress.trim().length > 0 && !addressAutoFilled) return; // don't overwrite user input

    let cancelled = false;
    setReverseLoading(true);
    (async () => {
      const r = await reverseGeocode(buyerLat, buyerLng);
      if (cancelled || !r) { setReverseLoading(false); return; }
      // Prefer street; fall back to full display name shortened
      const shortAddress = r.street || r.address.split(",").slice(0, 2).join(",");
      setDeliveryAddress(shortAddress);
      if (r.city) setDeliveryCity(r.city);
      if (r.state) setDeliveryState(r.state);
      if (r.postcode) setDeliveryZip(r.postcode);
      if (r.countryCode) setDeliveryCountry(r.countryCode);
      setAddressAutoFilled(true);
      setAddressConfirmed(false); // require explicit confirmation
      setReverseLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyerLat, buyerLng]);

  // Prefill phone from profile
  useEffect(() => {
    if (profile?.phone && !buyerPhone) setBuyerPhone(profile.phone);
  }, [profile?.phone, buyerPhone]);


  const subtotal = getSubtotal();
  // Calculate total delivery fee from all shops
  const sellerIds = [...new Set(items.map(i => i.product.seller_id))];
  // When seller coords / distance unknown, fall back to the ZONE base fee
  // (not a hardcoded 150) so a nearby buyer never overpays.
  const activeZone = getZoneForPoint(buyerLat, buyerLng, zones);
  const fallbackFee = calculateFee(0, activeZone); // = zone.base_fee
  const deliveryFee = sellerIds.reduce((total, sid) => {
    const shopInfo = shopDistances[sid];
    return total + (shopInfo ? shopInfo.fee : fallbackFee);
  }, 0);
  const total = subtotal + deliveryFee;

  const balanceField = currency === "DOP" ? "balance_dop" : currency === "HTG" ? "balance_htg" : "balance_usd";
  const currentBalance = wallet ? (wallet[balanceField] || 0) : 0;
  const hasEnoughBalance = currentBalance >= total;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({ title: t("checkoutx.toast.error"), description: t("checkoutx.toast.mustBeLoggedIn"), variant: "destructive" });
      return;
    }

    if (!deliveryAddress || !deliveryCity) {
      toast({ title: t("checkoutx.toast.error"), description: t("checkoutx.toast.fillAddress"), variant: "destructive" });
      return;
    }

    if (!deliveryAddress2.trim()) {
      toast({ title: t("checkoutx.toast.houseNumberRequiredTitle"), description: t("checkoutx.toast.houseNumberRequiredDesc"), variant: "destructive" });
      return;
    }

    if (deliveryNotes.trim().length < 10) {
      toast({ title: t("checkoutx.toast.instructionsRequiredTitle"), description: t("checkoutx.toast.instructionsRequiredDesc"), variant: "destructive" });
      return;
    }

    const phoneClean = buyerPhone.replace(/\s+/g, "");
    if (!phoneClean || phoneClean.length < 7) {
      toast({ title: t("checkoutx.toast.phoneRequiredTitle"), description: t("checkoutx.toast.phoneRequiredDesc"), variant: "destructive" });
      return;
    }

    // Persist phone on profile if changed
    if (profile && profile.phone !== buyerPhone) {
      await supabase.from("profiles").update({ phone: buyerPhone }).eq("user_id", user.id);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    }

    if (paymentMethod === "wallet" && !hasEnoughBalance) {
      toast({ title: t("checkoutx.toast.insufficientBalanceTitle"), description: t("checkoutx.toast.insufficientBalanceDesc"), variant: "destructive" });
      return;
    }

    if (hasPrintfulItem && (!deliveryAddress || !deliveryState || !deliveryZip || !deliveryCountry)) {
      toast({ title: t("checkoutx.toast.incompleteAddressTitle"), description: t("checkoutx.toast.incompleteAddressDesc"), variant: "destructive" });
      return;
    }

    if (!addressConfirmed) {
      toast({
        title: t("checkoutx.toast.confirmAddressTitle"),
        description: t("checkoutx.toast.confirmAddressDesc"),
        variant: "destructive",
      });
      return;
    }

    // Persist the confirmed address so the next checkout is pre-filled and pre-confirmed
    try {
      localStorage.setItem("apex_confirmed_address", JSON.stringify({
        address: deliveryAddress,
        city: deliveryCity,
        address2: deliveryAddress2,
        state: deliveryState,
        zip: deliveryZip,
        country: deliveryCountry,
        lat: buyerLat,
        lng: buyerLng,
      }));
    } catch {}

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
      toast({ title: t("checkoutx.toast.orderConfirmedTitle"), description: paymentMethod === "cash" ? t("checkoutx.toast.orderConfirmedCash") : t("checkoutx.toast.orderConfirmedSuccess") });
    } catch (error: any) {
      toast({ title: t("checkoutx.toast.error"), description: error.message || t("checkoutx.toast.genericError"), variant: "destructive" });
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
              <h2 className="text-xl font-semibold mb-2">{t("checkoutx.loginRequired.title")}</h2>
              <p className="text-muted-foreground mb-4">{t("checkoutx.loginRequired.description")}</p>
              <Button onClick={() => navigate("/")}>{t("checkoutx.loginRequired.backHome")}</Button>
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
              <h2 className="text-xl font-semibold mb-2">{t("checkoutx.emptyCart.title")}</h2>
              <p className="text-muted-foreground mb-4">{t("checkoutx.emptyCart.description")}</p>
              <Button onClick={() => navigate("/products")}>{t("checkoutx.emptyCart.viewProducts")}</Button>
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
              <h2 className="text-xl font-semibold mb-2">{t("checkoutx.success.title")}</h2>
              <p className="text-muted-foreground mb-4">
                {t("checkoutx.success.description")}
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => navigate("/")}>{t("checkoutx.success.backHome")}</Button>
                <Button onClick={() => navigate("/orders")}>{t("checkoutx.success.viewOrders")}</Button>
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
          {t("checkoutx.title")}
        </h1>

        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Adresse de livraison */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MapPin className="h-5 w-5" />
                    {t("checkoutx.address.heading")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* GPS Location button */}
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-medium text-sm">{t("checkoutx.address.gpsLabel")}</p>
                        {buyerLat && buyerLng ? (
                          <p className="text-xs text-green-600">{t("checkoutx.address.gpsSaved", { lat: buyerLat.toFixed(4), lng: buyerLng.toFixed(4) })}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">{t("checkoutx.address.gpsHint")}</p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button type="button" variant="outline" size="sm" onClick={handleGetLocation} disabled={gettingLocation}>
                          {gettingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                          <span className="ml-1">{buyerLat ? t("checkoutx.address.refresh") : t("checkoutx.address.useMyPosition")}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            if (!buyerLat || !buyerLng) {
                              toast({ title: t("checkoutx.toast.positionRequiredTitle"), description: t("checkoutx.toast.positionRequiredDesc"), variant: "destructive" });
                              return;
                            }
                            navigate(`/products?near=1&lat=${buyerLat}&lng=${buyerLng}`);
                          }}
                        >
                          <MapPinned className="h-4 w-4" />
                          <span className="ml-1">{t("checkoutx.address.localProducts")}</span>
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
                            {t("checkoutx.address.shopFeeLine", { shop: info.shopName, distance: info.distance.toFixed(1), fee: info.fee.toLocaleString() })}
                            {idx > 0 && info.distance <= 10 && (
                              <span className="text-amber-600 ml-1">{t("checkoutx.address.multiVendorSurcharge")}</span>
                            )}
                          </p>
                        ))}
                        {Object.keys(shopDistances).length > 1 && (
                          <p className="text-[11px] text-muted-foreground italic mt-1">
                            {t("checkoutx.address.multiVendorNote")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="country">{t("checkoutx.address.countryLabel")}</Label>
                      <Select value={deliveryCountry} onValueChange={setDeliveryCountry}>
                        <SelectTrigger><SelectValue placeholder={t("checkoutx.address.countryPlaceholder")} /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          <SelectItem value="DO">{t("checkoutx.countries.DO")}</SelectItem>
                          <SelectItem value="HT">{t("checkoutx.countries.HT")}</SelectItem>
                          <SelectItem value="US">{t("checkoutx.countries.US")}</SelectItem>
                          <SelectItem value="CA">{t("checkoutx.countries.CA")}</SelectItem>
                          <SelectItem value="MX">{t("checkoutx.countries.MX")}</SelectItem>
                          <SelectItem value="FR">{t("checkoutx.countries.FR")}</SelectItem>
                          <SelectItem value="ES">{t("checkoutx.countries.ES")}</SelectItem>
                          <SelectItem value="GB">{t("checkoutx.countries.GB")}</SelectItem>
                          <SelectItem value="DE">{t("checkoutx.countries.DE")}</SelectItem>
                          <SelectItem value="IT">{t("checkoutx.countries.IT")}</SelectItem>
                          <SelectItem value="PT">{t("checkoutx.countries.PT")}</SelectItem>
                          <SelectItem value="BE">{t("checkoutx.countries.BE")}</SelectItem>
                          <SelectItem value="CH">{t("checkoutx.countries.CH")}</SelectItem>
                          <SelectItem value="NL">{t("checkoutx.countries.NL")}</SelectItem>
                          <SelectItem value="BR">{t("checkoutx.countries.BR")}</SelectItem>
                          <SelectItem value="AR">{t("checkoutx.countries.AR")}</SelectItem>
                          <SelectItem value="CL">{t("checkoutx.countries.CL")}</SelectItem>
                          <SelectItem value="CO">{t("checkoutx.countries.CO")}</SelectItem>
                          <SelectItem value="PE">{t("checkoutx.countries.PE")}</SelectItem>
                          <SelectItem value="VE">{t("checkoutx.countries.VE")}</SelectItem>
                          <SelectItem value="PR">{t("checkoutx.countries.PR")}</SelectItem>
                          <SelectItem value="CU">{t("checkoutx.countries.CU")}</SelectItem>
                          <SelectItem value="JM">{t("checkoutx.countries.JM")}</SelectItem>
                          <SelectItem value="BS">{t("checkoutx.countries.BS")}</SelectItem>
                          <SelectItem value="GP">{t("checkoutx.countries.GP")}</SelectItem>
                          <SelectItem value="MQ">{t("checkoutx.countries.MQ")}</SelectItem>
                          <SelectItem value="GF">{t("checkoutx.countries.GF")}</SelectItem>
                          <SelectItem value="SN">{t("checkoutx.countries.SN")}</SelectItem>
                          <SelectItem value="CI">{t("checkoutx.countries.CI")}</SelectItem>
                          <SelectItem value="CM">{t("checkoutx.countries.CM")}</SelectItem>
                          <SelectItem value="MA">{t("checkoutx.countries.MA")}</SelectItem>
                          <SelectItem value="DZ">{t("checkoutx.countries.DZ")}</SelectItem>
                          <SelectItem value="TN">{t("checkoutx.countries.TN")}</SelectItem>
                          <SelectItem value="CN">{t("checkoutx.countries.CN")}</SelectItem>
                          <SelectItem value="JP">{t("checkoutx.countries.JP")}</SelectItem>
                          <SelectItem value="KR">{t("checkoutx.countries.KR")}</SelectItem>
                          <SelectItem value="IN">{t("checkoutx.countries.IN")}</SelectItem>
                          <SelectItem value="AU">{t("checkoutx.countries.AU")}</SelectItem>
                          <SelectItem value="OTHER">{t("checkoutx.countries.OTHER")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">{t("checkoutx.address.cityLabel")}</Label>
                      <Select value={deliveryCity} onValueChange={setDeliveryCity}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("checkoutx.address.cityPlaceholder")} />
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
                    <Label htmlFor="address">{t("checkoutx.address.addressLine1Label")}</Label>
                    <GpsAddressField
                      id="address"
                      value={deliveryAddress}
                      onChange={(v) => {
                        setDeliveryAddress(v);
                        // User edited the auto-filled value → force re-confirmation
                        if (addressAutoFilled) setAddressConfirmed(false);
                      }}
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
                        setAddressConfirmed(false);
                      }}
                      placeholder={t("checkoutx.address.addressPlaceholder")}
                      countryCodes={deliveryCountry === "HT" ? "ht" : deliveryCountry === "DO" ? "do" : "do,ht"}
                    />
                    {reverseLoading && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {t("checkoutx.address.reverseLoading")}
                      </p>
                    )}
                    {addressAutoFilled && !reverseLoading && (
                      <p className="text-xs text-emerald-600">
                        {t("checkoutx.address.autoFilledNote")}
                      </p>
                    )}
                  </div>

                  {/* Address confirmation checkbox */}
                  {deliveryAddress && (
                    <div className={`flex items-start gap-3 p-3 rounded-lg border ${addressConfirmed ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-amber-400 bg-amber-50 dark:bg-amber-950/20"}`}>
                      <Checkbox
                        id="confirm-address"
                        checked={addressConfirmed}
                        onCheckedChange={(v) => setAddressConfirmed(v === true)}
                        className="mt-0.5"
                      />
                      <Label htmlFor="confirm-address" className="text-sm cursor-pointer leading-snug">
                        <span dangerouslySetInnerHTML={{ __html: t("checkoutx.address.confirmCheckbox", { address: deliveryAddress, city: deliveryCity ? t("checkoutx.address.confirmCheckboxCityPart", { city: deliveryCity }) : "" }) }} />
                        {!addressAutoFilled && buyerLat && buyerLng && (
                          <span className="block text-xs text-amber-700 dark:text-amber-400 mt-1">
                            {t("checkoutx.address.gpsMismatchWarning")}
                          </span>
                        )}
                      </Label>
                    </div>
                  )}


                  <div className="space-y-2">
                    <Label htmlFor="address2">
                      {t("checkoutx.address.houseNumberLabel")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="address2"
                      placeholder={t("checkoutx.address.houseNumberPlaceholder")}
                      value={deliveryAddress2}
                      onChange={(e) => setDeliveryAddress2(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("checkoutx.address.houseNumberHint")}
                    </p>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="state">{t("checkoutx.address.stateLabel")} {hasPrintfulItem && <span className="text-destructive">*</span>}</Label>
                      <Input
                        id="state"
                        placeholder={t("checkoutx.address.statePlaceholder")}
                        value={deliveryState}
                        onChange={(e) => setDeliveryState(e.target.value)}
                        required={hasPrintfulItem}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zip">{t("checkoutx.address.zipLabel")} {hasPrintfulItem && <span className="text-destructive">*</span>}</Label>
                      <Input
                        id="zip"
                        placeholder={t("checkoutx.address.zipPlaceholder")}
                        value={deliveryZip}
                        onChange={(e) => setDeliveryZip(e.target.value)}
                        required={hasPrintfulItem}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">{t("checkoutx.address.currencyLabel")}</Label>
                    <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)} disabled={hasPrintfulItem}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DOP" disabled={hasPrintfulItem}>{t("checkoutx.address.currencyDOP")}</SelectItem>
                        <SelectItem value="HTG" disabled={hasPrintfulItem}>{t("checkoutx.address.currencyHTG")}</SelectItem>
                        <SelectItem value="USD">{t("checkoutx.address.currencyUSD")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {hasPrintfulItem && (
                      <p className="text-xs text-muted-foreground">{t("checkoutx.address.printfulCurrencyNote")}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="buyer_phone">
                      {t("checkoutx.address.phoneLabel")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="buyer_phone"
                      type="tel"
                      placeholder={t("checkoutx.address.phonePlaceholder")}
                      value={buyerPhone}
                      onChange={(e) => setBuyerPhone(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("checkoutx.address.phoneHint")}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">
                      {t("checkoutx.address.notesLabel")} <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="notes"
                      placeholder={t("checkoutx.address.notesPlaceholder")}
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      rows={3}
                      required
                      minLength={10}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("checkoutx.address.notesHint")}
                    </p>
                  </div>
                  {hasPrintfulItem && (
                    <Alert>
                      <Globe className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {t("checkoutx.address.printfulAlert")}
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
                    {t("checkoutx.payment.heading")}
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
                        <p className="font-medium">{t("checkoutx.payment.walletName")}</p>
                        <p className="text-sm text-muted-foreground">
                          {t("checkoutx.payment.walletBalance", { symbol: CURRENCY_SYMBOLS[currency], balance: currentBalance.toLocaleString() })}
                        </p>
                      </div>
                    </div>
                    {paymentMethod === "wallet" && <CheckCircle className="h-5 w-5 text-primary" />}
                  </div>

                  {paymentMethod === "wallet" && !hasEnoughBalance && (
                    <p className="text-destructive text-sm flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {t("checkoutx.payment.insufficientBalance", { symbol: CURRENCY_SYMBOLS[currency], amount: (total - currentBalance).toLocaleString() })}
                      <Button type="button" variant="link" className="h-auto p-0 pl-1" onClick={() => navigate("/wallet")}>
                        {t("checkoutx.payment.recharge")}
                      </Button>
                    </p>
                  )}

                  {/* Cash payment option — hidden for international orders (wallet-only) */}
                  {hasInternationalItem ? (
                    <Alert>
                      <Globe className="h-4 w-4" />
                      <AlertDescription>
                        {t("checkoutx.payment.internationalNote")}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div
                      className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-all ${paymentMethod === "cash" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "bg-muted/30 hover:bg-muted/50"}`}
                      onClick={() => setPaymentMethod("cash")}
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-accent/50 p-2 rounded-full">
                          <Banknote className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{t("checkoutx.payment.cashName")}</p>
                          <p className="text-sm text-muted-foreground">
                            {t("checkoutx.payment.cashDesc")}
                          </p>
                        </div>
                      </div>
                      {paymentMethod === "cash" && <CheckCircle className="h-5 w-5 text-primary" />}
                    </div>
                  )}

                </CardContent>
              </Card>
            </div>

            {/* Résumé */}
            <div>
              <Card className="sticky top-20">
                <CardHeader>
                  <CardTitle className="text-lg">{t("checkoutx.summary.heading")}</CardTitle>
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
                            {t("checkoutx.summary.qtyPrice", { qty: item.quantity, symbol: CURRENCY_SYMBOLS[item.product.currency], price: item.product.price.toLocaleString() })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("checkoutx.summary.subtotal")}</span>
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
                          {t("checkoutx.summary.delivery")}
                        </span>
                        <span>{CURRENCY_SYMBOLS[currency]} {deliveryFee.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="border-t pt-2">
                      <div className="flex justify-between font-bold text-lg">
                        <span>{t("checkoutx.summary.total")}</span>
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
                    {paymentMethod === "cash" ? t("checkoutx.summary.submitCash") : t("checkoutx.summary.submitDefault")}
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