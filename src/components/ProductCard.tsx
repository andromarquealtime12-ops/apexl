import { Product, CURRENCY_SYMBOLS } from "@/types/database";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Heart, Check, Globe, MapPin, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useProfile } from "@/hooks/useProfile";
import { useCurrencyRates, convertCurrency } from "@/hooks/useCurrencyRates";
import { useShopLocations } from "@/hooks/useShopLocations";
import { useDeliveryZones } from "@/hooks/useDeliveryZones";
import { calculateDistance } from "@/hooks/useGeolocation";
import { getZoneForPoint, calculateFee } from "@/utils/deliveryPricing";


interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { t } = useTranslation();
  const { addItem, items } = useCart();
  const { data: profile } = useProfile();
  const { data: rates } = useCurrencyRates();
  const [added, setAdded] = useState(false);
  const currencySymbol = CURRENCY_SYMBOLS[product.currency];
  const mainImage = product.images?.[0] || "/placeholder.svg";
  const hasVariants = Boolean(product.available_colors?.length || product.available_sizes?.length);

  const isInCart = items.some((item) => item.product.id === product.id);

  const isShopify = (product as any).is_shopify === true;
  const isPrintful = (product as any).is_printful === true;
  const sellerCountry: string | undefined = (product as any).seller_country;
  const availableCountries: string[] = (product as any).available_countries || [];

  // Detect buyer country: profile.country > navigator
  const userCountry: string = profile?.country
    ?? (typeof navigator !== "undefined" && navigator.language?.includes("HT") ? "HT" : "DO");

  // Country availability rules:
  // - Printful: worldwide (always available)
  // - Shopify: based on available_countries
  // - Local products: must share seller_country with buyer
  let outOfCountry = false;
  if (isPrintful) {
    outOfCountry = false;
  } else if (isShopify) {
    outOfCountry = availableCountries.length > 0 && !availableCountries.includes(userCountry);
  } else if (sellerCountry) {
    outOfCountry = sellerCountry !== userCountry;
  }

  // Converted display price for Printful (USD → user currency)
  const userCurrency = userCountry === "HT" ? "HTG" : userCountry === "DO" ? "DOP" : "USD";
  const convertedPrice = useMemo(() => {
    if (!isPrintful || !rates || userCurrency === product.currency) return null;
    const v = convertCurrency(product.price, product.currency, userCurrency, rates);
    return v > 0 ? v : null;
  }, [isPrintful, rates, userCurrency, product.currency, product.price]);

  // Distance + estimated delivery fee (local products only)
  const { data: shops } = useShopLocations();
  const { data: zones } = useDeliveryZones(false);
  const distanceInfo = useMemo(() => {
    if (isPrintful || isShopify) return null;
    if (!profile?.latitude || !profile?.longitude) return null;
    const shop = shops?.find((s) => s.user_id === product.seller_id);
    if (!shop?.latitude || !shop?.longitude) return null;
    const km = calculateDistance(profile.latitude, profile.longitude, shop.latitude, shop.longitude);
    const zone = getZoneForPoint(profile.latitude, profile.longitude, zones);
    return { km, fee: calculateFee(km, zone), currency: zone.currency };
  }, [isPrintful, isShopify, profile?.latitude, profile?.longitude, shops, zones, product.seller_id]);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (outOfCountry) return;

    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-all">
      <Link to={`/product/${product.id}`}>
        <div className="relative aspect-square overflow-hidden bg-muted">
          <img
            src={mainImage}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 rounded-none shadow-sm" />

          {product.is_featured && (
            <Badge className="absolute top-2 left-2 bg-primary">{t("product.featured")}</Badge>
          )}
          {isShopify && (
            <Badge variant="secondary" className="absolute top-2 left-2 mt-8">Shopify</Badge>
          )}
          {isPrintful && (
            <Badge variant="secondary" className="absolute top-2 left-2 mt-8 gap-1">
              <Globe className="h-3 w-3" />
              {t("product.worldwide")}
            </Badge>
          )}
          {outOfCountry && (
            <Badge variant="destructive" className="absolute bottom-2 left-2">
              {sellerCountry ? `${sellerCountry}` : "Hors pays"}
            </Badge>
          )}
          {product.stock_quantity === 0 && (
            <Badge variant="destructive" className="absolute top-2 right-2">
              {t("product.outOfStock")}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 bg-background/80 hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}>
            <Heart className="h-4 w-4" />
          </Button>
        </div>
      </Link>

      <CardContent className="p-4">
        <Link to={`/product/${product.id}`}>
          <h3 className="font-semibold line-clamp-2 hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>
        {product.category && (
          <p className="text-xs text-muted-foreground mt-1">{t(`categories.items.${product.category.icon}`, { defaultValue: product.category.name })}</p>
        )}
        <div className="mt-2">
          <p className="text-lg font-bold text-primary">
            {currencySymbol} {product.price.toLocaleString()}
          </p>
          {convertedPrice !== null && (
            <p className="text-xs text-muted-foreground">
              {t("product.approxPrice", {
                symbol: CURRENCY_SYMBOLS[userCurrency as keyof typeof CURRENCY_SYMBOLS],
                amount: Math.round(convertedPrice).toLocaleString(),
              })}
              {" · "}
              {t("product.billedIn", { currency: product.currency })}
            </p>
          )}
          {distanceInfo && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {distanceInfo.km < 1
                  ? `${Math.round(distanceInfo.km * 1000)} m`
                  : `${distanceInfo.km.toFixed(1)} km`}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                <Truck className="h-3 w-3" />
                Livraison ~{distanceInfo.currency} {distanceInfo.fee.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </CardContent>


      <CardFooter className="p-4 pt-0">
        {hasVariants ? (
          <Button className="w-full" size="sm" asChild>
            <Link to={`/product/${product.id}`}>{t("product.chooseVariant")}</Link>
          </Button>
        ) : (
          <Button
            className="w-full"
            size="sm"
            disabled={product.stock_quantity === 0 || outOfCountry}
            variant={added || isInCart ? "secondary" : "default"}
            onClick={handleAddToCart}>
            {outOfCountry ? (
              <>{t("product.outOfCountry")}</>
            ) : added ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                {t("product.added")}
              </>
            ) : isInCart ? (
              <>
                <ShoppingCart className="h-4 w-4 mr-2" />
                {t("product.inCart")}
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 mr-2" />
                {t("product.addToCart")}
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
