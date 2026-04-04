import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useRestaurants } from "@/hooks/useRestaurants";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UtensilsCrossed, MapPin, Clock, Phone } from "lucide-react";
import { Link } from "react-router-dom";

export default function Restaurants() {
  const { data: restaurants, isLoading } = useRestaurants();

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container px-4 py-8">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <UtensilsCrossed className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Restaurants</h1>
          </div>
          <p className="text-muted-foreground">Découvrez les meilleurs restaurants et commandez vos plats préférés</p>
        </header>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : !restaurants?.length ? (
          <div className="text-center py-16">
            <UtensilsCrossed className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Aucun restaurant disponible</h2>
            <p className="text-muted-foreground">Les restaurants seront bientôt disponibles !</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {restaurants.map((r) => (
              <Link key={r.id} to={`/restaurant/${r.id}`}>
                <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
                  <div className="h-40 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center relative overflow-hidden">
                    {r.cover_url ? (
                      <img src={r.cover_url} alt={r.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <UtensilsCrossed className="h-16 w-16 text-primary/30" />
                    )}
                    {r.cuisine_type && (
                      <Badge className="absolute top-3 right-3" variant="secondary">
                        {r.cuisine_type}
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {r.logo_url ? (
                        <img src={r.logo_url} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-background -mt-8 relative z-10" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center -mt-8 relative z-10 border-2 border-background">
                          <UtensilsCrossed className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg truncate">{r.name}</h3>
                        {r.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {r.city}
                      </span>
                      {r.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {r.phone}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
