import { useProducts } from "@/hooks/useProducts";
import { ProductCard } from "./ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function FeaturedProducts() {
  const { data: products, isLoading } = useProducts({ featured: true, limit: 8 });

  if (isLoading) {
    return (
      <section className="py-12">
        <div className="container px-4">
          <h2 className="text-2xl font-bold text-center mb-8">Produits en vedette</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!products?.length) {
    return (
      <section className="py-12">
        <div className="container px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Produits en vedette</h2>
          <p className="text-muted-foreground">
            Aucun produit en vedette pour le moment. Revenez bientôt !
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12">
      <div className="container px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">Produits en vedette</h2>
            <p className="text-muted-foreground">Les meilleurs produits sélectionnés pour vous</p>
          </div>
          <Link to="/products">
            <Button variant="outline">
              Voir tout
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
