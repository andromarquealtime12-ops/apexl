import { useCategories } from "@/hooks/useCategories";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Utensils, Smartphone, Shirt, ChefHat, Home, Heart, 
  Dumbbell, Book, Car, Briefcase, Package 
} from "lucide-react";
import { Link } from "react-router-dom";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  utensils: Utensils,
  smartphone: Smartphone,
  shirt: Shirt,
  "chef-hat": ChefHat,
  home: Home,
  heart: Heart,
  dumbbell: Dumbbell,
  book: Book,
  car: Car,
  briefcase: Briefcase,
};

export function CategoryGrid() {
  const { data: categories, isLoading } = useCategories();

  if (isLoading) {
    return (
      <section className="py-12 bg-muted/30">
        <div className="container px-4">
          <h2 className="text-2xl font-bold text-center mb-8">Catégories</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 bg-muted/30">
      <div className="container px-4">
        <h2 className="text-2xl font-bold text-center mb-2">Explorez nos catégories</h2>
        <p className="text-muted-foreground text-center mb-8">
          Trouvez tout ce dont vous avez besoin
        </p>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {categories?.map((category) => {
            const IconComponent = iconMap[category.icon || ""] || Package;
            
            return (
              <Link key={category.id} to={`/products?category=${category.id}`}>
                <Card className="group hover:shadow-lg transition-all hover:border-primary cursor-pointer h-full">
                  <CardContent className="p-6 flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                      <IconComponent className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="font-medium text-sm leading-tight">{category.name}</h3>
                    {category.name_ht && (
                      <p className="text-xs text-muted-foreground mt-1">{category.name_ht}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
