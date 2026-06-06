import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Store, MapPin, Package, ArrowRight, MapPinned, Navigation, Loader2, X } from "lucide-react";
import { calculateDistance } from "@/hooks/useGeolocation";
import { getPositionOrLast, getLastPosition, savePosition } from "@/utils/persistentLocation";
import { toast } from "@/hooks/use-toast";

export default function Shops() {
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [usingCached, setUsingCached] = useState(false);
  const [maxRadius, setMaxRadius] = useState<number>(60); // km - default 60 per request
  const [nearMe, setNearMe] = useState<boolean>(false);

  // Bootstrap from last known position so we can show distances even before GPS responds
  useEffect(() => {
    const last = getLastPosition();
    if (last) {
      setUserLat(last.latitude);
      setUserLng(last.longitude);
      setUsingCached(true);
      setNearMe(true);
    }
    // Try to refresh in background
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude);
          setUserLng(pos.coords.longitude);
          setUsingCached(false);
          setNearMe(true);
          savePosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
      );
    }
  }, []);

  const { data: shops, isLoading } = useQuery({
    queryKey: ["all-shops"],
    queryFn: async () => {
      const { data: applicationsRaw } = await (supabase as any)
        .rpc("get_public_seller_shops", { p_user_id: null });
      const applications = (applicationsRaw || []).sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      if (!applications?.length) return [];

      const sellerIds = applications.map((a: any) => a.user_id);
      const { data: products } = await supabase
        .from("products")
        .select("seller_id")
        .eq("is_active", true)
        .in("seller_id", sellerIds);

      const productCounts: Record<string, number> = {};
      products?.forEach((p) => {
        productCounts[p.seller_id] = (productCounts[p.seller_id] || 0) + 1;
      });

      return applications.map((app: any) => ({
        ...app,
        product_count: productCounts[app.user_id] || 0,
      }));
    },
  });

  const enableLocation = async () => {
    setLoadingGeo(true);
    try {
      const pos = await getPositionOrLast();
      setUserLat(pos.latitude);
      setUserLng(pos.longitude);
      setNearMe(true);
      setUsingCached(Date.now() - pos.savedAt > 60000);
      toast({ title: "Position activée ✓", description: `Boutiques dans ${maxRadius} km` });
    } catch {
      toast({ title: "Erreur", description: "Impossible d'obtenir votre position", variant: "destructive" });
    } finally {
      setLoadingGeo(false);
    }
  };

  const displayedShops = useMemo(() => {
    if (!shops) return [];
    if (!nearMe || userLat == null || userLng == null) return shops;
    return shops
      .map((s: any) => {
        const hasCoords = s.latitude != null && s.longitude != null;
        const distance = hasCoords
          ? calculateDistance(userLat, userLng, s.latitude, s.longitude)
          : Infinity;
        return { ...s, _distance: distance };
      })
      .filter((s: any) => s._distance <= maxRadius)
      .sort((a: any, b: any) => a._distance - b._distance);
  }, [shops, nearMe, userLat, userLng, maxRadius]);

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container px-4 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Store className="h-8 w-8 text-primary" />
              Boutiques
            </h1>
            <p className="text-muted-foreground mt-2">
              {nearMe ? `Triées par proximité — rayon ${maxRadius} km` : "Découvrez toutes les boutiques"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {nearMe ? (
              <>
                <Select value={String(maxRadius)} onValueChange={(v) => setMaxRadius(parseInt(v))}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">≤ 5 km</SelectItem>
                    <SelectItem value="10">≤ 10 km</SelectItem>
                    <SelectItem value="25">≤ 25 km</SelectItem>
                    <SelectItem value="60">≤ 60 km</SelectItem>
                    <SelectItem value="100">≤ 100 km</SelectItem>
                    <SelectItem value="250">≤ 250 km</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => setNearMe(false)}>
                  <X className="h-4 w-4 mr-1" /> Toutes
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={enableLocation} disabled={loadingGeo}>
                {loadingGeo ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <MapPinned className="h-4 w-4 mr-1" />}
                Boutiques près de moi
              </Button>
            )}
          </div>
        </div>

        {nearMe && userLat != null && userLng != null && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 bg-muted/30 rounded-md mb-4">
            <Navigation className="h-3 w-3" />
            Position: {userLat.toFixed(4)}, {userLng.toFixed(4)} · Rayon: {maxRadius} km
            {usingCached && <span className="ml-2 text-amber-600">(dernière position connue)</span>}
          </div>
        )}

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : displayedShops && displayedShops.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedShops.map((shop: any) => (
              <Link to={`/shop/${shop.user_id}`} key={shop.id}>
                <Card className="hover:shadow-lg transition-all hover:border-primary/50 h-full relative">
                  {nearMe && shop._distance != null && shop._distance !== Infinity && (
                    <Badge className="absolute top-3 right-3 z-10 bg-primary/90 backdrop-blur">
                      <MapPinned className="h-3 w-3 mr-1" />
                      {shop._distance.toFixed(1)} km
                    </Badge>
                  )}
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 p-3 rounded-full flex-shrink-0">
                        <Store className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg truncate">{shop.shop_name}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3.5 w-3.5" />{shop.shop_city}
                        </p>
                        {shop.shop_description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{shop.shop_description}</p>
                        )}
                        <div className="flex items-center justify-between mt-3">
                          <Badge variant="secondary" className="gap-1">
                            <Package className="h-3 w-3" />
                            {shop.product_count} produits
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Store className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              {nearMe ? `Aucune boutique dans un rayon de ${maxRadius} km` : "Aucune boutique pour le moment"}
            </p>
            {nearMe && (
              <Button variant="outline" className="mt-4" onClick={() => setNearMe(false)}>
                Voir toutes les boutiques
              </Button>
            )}
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
