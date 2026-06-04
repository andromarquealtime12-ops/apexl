import { useParams, Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Store, MapPin, ArrowLeft, Package } from "lucide-react";

export default function SellerShop() {
  const { sellerId } = useParams<{ sellerId: string }>();

  const { data: shop } = useQuery({
    queryKey: ["shop-info", sellerId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .rpc("get_public_seller_shops", { p_user_id: sellerId! });
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    },
    enabled: !!sellerId,
  });

  const { data: seller } = useQuery({
    queryKey: ["shop-seller-profile", sellerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, city, created_at")
        .eq("user_id", sellerId!)
        .maybeSingle();
      return data;
    },
    enabled: !!sellerId,
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["shop-products", sellerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, category:categories(*)")
        .eq("seller_id", sellerId!)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!sellerId,
  });

  const shopName = shop?.shop_name || seller?.full_name || "Boutique";
  const shopCity = shop?.shop_city || seller?.city;

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container px-4 py-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/shops"><ArrowLeft className="h-4 w-4 mr-2" />Toutes les boutiques</Link>
        </Button>

        {/* Shop header */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="bg-primary/20 p-4 rounded-full">
              <Store className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{shopName}</h1>
              {shopCity && (
                <p className="text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-4 w-4" />{shopCity}
                </p>
              )}
              {shop?.shop_description && (
                <p className="text-sm text-muted-foreground mt-2">{shop.shop_description}</p>
              )}
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Badge variant="secondary">{products?.length || 0} produits</Badge>
            {shop?.business_type && <Badge variant="outline">{shop.business_type}</Badge>}
          </div>
        </div>

        {/* Products */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product: any) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Aucun produit disponible</p>
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
