import { useParams } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useRestaurantById, useRestaurantItems } from "@/hooks/useRestaurants";
import { useCart } from "@/contexts/CartContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UtensilsCrossed, MapPin, Phone, Clock, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

export default function RestaurantDetail() {
  const { restaurantId } = useParams();
  const { data: restaurant, isLoading } = useRestaurantById(restaurantId);
  const { data: items, isLoading: itemsLoading } = useRestaurantItems(restaurantId);

  // Group items by category
  const grouped = items?.reduce((acc, item) => {
    const cat = item.category || "Autre";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, typeof items>) || {};

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="container px-4 py-8">
          <Skeleton className="h-48 w-full rounded-xl mb-4" />
          <Skeleton className="h-8 w-1/3 mb-2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </main>
    );
  }

  if (!restaurant) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="container px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Restaurant introuvable</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <Header />
      
      {/* Cover */}
      <div className="h-48 md:h-64 bg-gradient-to-br from-primary/20 to-primary/5 relative">
        {restaurant.cover_url ? (
          <img src={restaurant.cover_url} alt={restaurant.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <UtensilsCrossed className="h-20 w-20 text-primary/20" />
          </div>
        )}
      </div>

      <div className="container px-4 -mt-8 relative z-10 pb-8">
        {/* Restaurant Info */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              {restaurant.logo_url ? (
                <img src={restaurant.logo_url} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-background" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-background">
                  <UtensilsCrossed className="h-7 w-7 text-primary" />
                </div>
              )}
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{restaurant.name}</h1>
                {restaurant.description && (
                  <p className="text-muted-foreground mt-1">{restaurant.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {restaurant.address}, {restaurant.city}
                  </span>
                  {restaurant.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {restaurant.phone}
                    </span>
                  )}
                  {restaurant.cuisine_type && (
                    <Badge variant="secondary">{restaurant.cuisine_type}</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Menu */}
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5 text-primary" />
          Menu
        </h2>

        {itemsLoading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : !items?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Aucun plat disponible pour le moment</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, categoryItems]) => (
              <div key={category}>
                <h3 className="text-lg font-semibold mb-3 capitalize">{category}</h3>
                <div className="grid gap-3">
                  {categoryItems!.map((item) => (
                    <Card key={item.id} className="overflow-hidden">
                      <CardContent className="p-4 flex gap-4">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <UtensilsCrossed className="h-8 w-8 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold">{item.name}</h4>
                          {item.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <span className="font-bold text-primary">
                              {item.price} {item.currency || "HTG"}
                            </span>
                            {item.preparation_time && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {item.preparation_time} min
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
