import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Store, MapPin, Package, ArrowRight } from "lucide-react";

export default function Shops() {
  // Get all approved seller applications (shops)
  const { data: shops, isLoading } = useQuery({
    queryKey: ["all-shops"],
    queryFn: async () => {
      const { data: applicationsRaw } = await (supabase as any)
        .rpc("get_public_seller_shops", { p_user_id: null });
      const applications = (applicationsRaw || []).sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      if (!applications?.length) return [];

      // Get product counts per seller
      const sellerIds = applications.map(a => a.user_id);
      const { data: products } = await supabase
        .from("products")
        .select("seller_id")
        .eq("is_active", true)
        .in("seller_id", sellerIds);

      const productCounts: Record<string, number> = {};
      products?.forEach(p => {
        productCounts[p.seller_id] = (productCounts[p.seller_id] || 0) + 1;
      });

      return applications.map(app => ({
        ...app,
        product_count: productCounts[app.user_id] || 0,
      }));
    },
  });

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Store className="h-8 w-8 text-primary" />
            Boutiques
          </h1>
          <p className="text-muted-foreground mt-2">Découvrez toutes les boutiques de notre marketplace</p>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : shops && shops.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shops.map((shop) => (
              <Link to={`/shop/${shop.user_id}`} key={shop.id}>
                <Card className="hover:shadow-lg transition-all hover:border-primary/50 h-full">
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
            <p className="text-muted-foreground">Aucune boutique pour le moment</p>
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
