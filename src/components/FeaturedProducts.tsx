import { useProducts } from "@/hooks/useProducts";
import { ProductCard } from "./ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function FeaturedProducts() {
  const { data: products, isLoading } = useProducts({ featured: true, limit: 8 });
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <section className="py-12">
        <div className="container px-4">
          <h2 className="text-2xl font-bold text-center mb-8">{t("featured.title")}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square rounded-none" />
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
          <h2 className="text-2xl font-bold mb-4">{t("featured.title")}</h2>
          <p className="text-muted-foreground">{t("featured.empty")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12">
      <div className="container px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{t("featured.title")}</h2>
            <p className="text-muted-foreground">{t("featured.subtitle")}</p>
          </div>
          <Link to="/products">
            <Button variant="outline" className="rounded-none">
              {t("featured.viewAll")}
              <ArrowRight className="ml-2 h-4 w-4 rtl:rotate-180" />
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
