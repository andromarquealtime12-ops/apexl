import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, X, MapPinned, Navigation, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { calculateDistance } from "@/hooks/useGeolocation";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const Products = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");

  const categoryId = searchParams.get("category") || undefined;
  const nearMe = searchParams.get("near") === "1";
  const urlLat = searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : null;
  const urlLng = searchParams.get("lng") ? parseFloat(searchParams.get("lng")!) : null;

  const [userLat, setUserLat] = useState<number | null>(urlLat);
  const [userLng, setUserLng] = useState<number | null>(urlLng);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [sellerCoords, setSellerCoords] = useState<Record<string, { lat: number; lng: number; shopName: string }>>({});
  const [maxRadius, setMaxRadius] = useState<number>(50); // km

  const { data: products, isLoading } = useProducts({
    categoryId,
    searchQuery: searchQuery || undefined,
  });
  const { data: categories } = useCategories();

  const selectedCategory = categories?.find((c) => c.id === categoryId);

  // Auto-acquire position when ?near=1 without coords
  useEffect(() => {
    if (nearMe && (userLat == null || userLng == null) && navigator.geolocation) {
      setLoadingGeo(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude);
          setUserLng(pos.coords.longitude);
          setLoadingGeo(false);
        },
        () => {
          setLoadingGeo(false);
          toast({ title: "Position requise", description: "Autorisez la géolocalisation pour voir les produits proches", variant: "destructive" });
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    }
  }, [nearMe, userLat, userLng]);

  // Load seller coordinates when filtering by proximity
  useEffect(() => {
    if (!nearMe || !products || products.length === 0) return;
    const ids = [...new Set(products.map((p) => p.seller_id))];
    (async () => {
      const { data } = await (supabase as any).rpc("get_public_seller_shops", { p_user_id: null });
      const map: Record<string, { lat: number; lng: number; shopName: string }> = {};
      (data || []).forEach((s: any) => {
        if (ids.includes(s.user_id) && s.latitude != null && s.longitude != null) {
          map[s.user_id] = { lat: s.latitude, lng: s.longitude, shopName: s.shop_name };
        }
      });
      setSellerCoords(map);
    })();
  }, [nearMe, products]);

  const enableNearMe = () => {
    if (!navigator.geolocation) {
      toast({ title: "Erreur", description: "Géolocalisation non supportée", variant: "destructive" });
      return;
    }
    setLoadingGeo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        searchParams.set("near", "1");
        searchParams.set("lat", String(pos.coords.latitude));
        searchParams.set("lng", String(pos.coords.longitude));
        setSearchParams(searchParams);
        setLoadingGeo(false);
        toast({ title: "Position activée ✓", description: "Produits triés par proximité" });
      },
      () => {
        setLoadingGeo(false);
        toast({ title: "Erreur", description: "Impossible d'obtenir votre position", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const disableNearMe = () => {
    searchParams.delete("near");
    searchParams.delete("lat");
    searchParams.delete("lng");
    setSearchParams(searchParams);
  };

  // Sort + annotate with distance when near-me active
  const displayedProducts = useMemo(() => {
    if (!nearMe || !userLat || !userLng || !products) return products || [];
    return products
      .map((p) => {
        const coords = sellerCoords[p.seller_id];
        const distance = coords ? calculateDistance(userLat, userLng, coords.lat, coords.lng) : Infinity;
        return { ...p, _distance: distance, _shopName: coords?.shopName };
      })
      .filter((p: any) => p._distance <= maxRadius)
      .sort((a: any, b: any) => a._distance - b._distance);
  }, [nearMe, userLat, userLng, products, sellerCoords, maxRadius]);

  const handleCategoryChange = (value: string) => {
    if (value === "all") {
      searchParams.delete("category");
    } else {
      searchParams.set("category", value);
    }
    setSearchParams(searchParams);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSearchParams({});
  };

  return (
    <main className="min-h-screen bg-background">
      <Header />

      <div className="container px-4 py-8">
        <div className="flex flex-col gap-6">
          {/* Page header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold">Produits</h1>
              <p className="text-muted-foreground mt-1">
                {nearMe ? "Triés par proximité de chez vous" : "Découvrez notre sélection de produits"}
              </p>
            </div>
            {nearMe ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={String(maxRadius)} onValueChange={(v) => setMaxRadius(parseInt(v))}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">≤ 5 km</SelectItem>
                    <SelectItem value="10">≤ 10 km</SelectItem>
                    <SelectItem value="25">≤ 25 km</SelectItem>
                    <SelectItem value="50">≤ 50 km</SelectItem>
                    <SelectItem value="100">≤ 100 km</SelectItem>
                    <SelectItem value="500">≤ 500 km</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={disableNearMe}>
                  <X className="h-4 w-4 mr-1" /> Désactiver
                </Button>
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={enableNearMe} disabled={loadingGeo}>
                {loadingGeo ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <MapPinned className="h-4 w-4 mr-1" />}
                Produits près de moi
              </Button>
            )}
          </div>

          {nearMe && userLat && userLng && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 bg-muted/30 rounded-md">
              <Navigation className="h-3 w-3" />
              Position: {userLat.toFixed(4)}, {userLng.toFixed(4)} · Rayon: {maxRadius} km
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un produit..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={categoryId || "all"} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {t(`categories.items.${category.icon}`, { defaultValue: category.name })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Active filters */}
          {(categoryId || searchQuery) && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Filtres actifs:</span>
              {selectedCategory && (
                <Badge variant="secondary" className="gap-1">
                  {selectedCategory.name}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => handleCategoryChange("all")}
                  />
                </Badge>
              )}
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  "{searchQuery}"
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setSearchQuery("")}
                  />
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Effacer tout
              </Button>
            </div>
          )}

          {/* Products grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-square rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : displayedProducts?.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-lg text-muted-foreground">
                {nearMe ? `Aucun produit dans un rayon de ${maxRadius} km` : "Aucun produit trouvé"}
              </p>
              <Button variant="outline" className="mt-4" onClick={nearMe ? disableNearMe : clearFilters}>
                {nearMe ? "Voir tous les produits" : "Effacer les filtres"}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {displayedProducts?.map((product: any) => (
                <div key={product.id} className="relative">
                  <ProductCard product={product} />
                  {nearMe && product._distance != null && product._distance !== Infinity && (
                    <Badge className="absolute top-2 left-2 z-10 bg-primary/90 backdrop-blur">
                      <MapPinned className="h-3 w-3 mr-1" />
                      {product._distance.toFixed(1)} km
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </main>
  );
};

export default Products;
