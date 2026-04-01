import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Package, MapPin, Clock, Truck, CheckCircle,
  Navigation, AlertCircle, ShoppingBag, User
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { CURRENCY_SYMBOLS } from "@/types/database";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "En attente", color: "bg-yellow-500", icon: Clock },
  confirmed: { label: "Confirmée", color: "bg-blue-500", icon: CheckCircle },
  preparing: { label: "En préparation", color: "bg-indigo-500", icon: Package },
  ready: { label: "Prête", color: "bg-purple-500", icon: Package },
  ready_for_pickup: { label: "Prête au retrait", color: "bg-purple-500", icon: Package },
  picked_up: { label: "Récupérée", color: "bg-orange-500", icon: Truck },
  in_transit: { label: "En route", color: "bg-primary", icon: Truck },
  delivered: { label: "Livrée", color: "bg-green-500", icon: CheckCircle },
  cancelled: { label: "Annulée", color: "bg-destructive", icon: AlertCircle },
};

const statusOrder = ["pending", "confirmed", "preparing", "ready", "ready_for_pickup", "picked_up", "in_transit", "delivered"];

export default function OrderSearch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setResults(null);

    try {
      const trimmed = query.trim().toLowerCase();

      // Search by order ID prefix
      const { data, error: err } = await supabase
        .from("orders")
        .select(`
          *,
          items:order_items(
            id, quantity, unit_price, total_price,
            products(name, images)
          )
        `)
        .or(`id.ilike.${trimmed}%`)
        .order("created_at", { ascending: false })
        .limit(10);

      if (err) throw err;

      if (!data || data.length === 0) {
        setError("Aucune commande trouvée. Vérifiez le numéro.");
      } else {
        setResults(data);
      }
    } catch (e: any) {
      setError(e.message || "Erreur lors de la recherche");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Search className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Rechercher une commande</h1>
            <p className="text-muted-foreground text-sm">Entrez le numéro de commande pour voir son statut</p>
          </div>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2">
            <Input
              placeholder="Numéro de commande (ex: a1b2c3d4)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="text-base"
            />
            <Button type="submit" disabled={loading} className="gap-2 shrink-0">
              {loading ? <Clock className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Rechercher
            </Button>
          </div>
        </form>

        {error && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
              <p className="text-destructive font-medium">{error}</p>
            </CardContent>
          </Card>
        )}

        {results && results.map((order) => {
          const status = statusConfig[order.status || "pending"] || statusConfig.pending;
          const StatusIcon = status.icon;
          const currencySymbol = CURRENCY_SYMBOLS[order.currency as keyof typeof CURRENCY_SYMBOLS] || "$";
          const currentStepIndex = statusOrder.indexOf(order.status || "pending");

          return (
            <Card key={order.id} className="mb-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">#{order.id.slice(0, 8)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(order.created_at), "dd MMM yyyy à HH:mm", { locale: fr })}
                    </span>
                  </div>
                  <Badge className="gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status timeline */}
                <div className="relative">
                  <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2">
                    {statusOrder.filter(s => s !== "ready_for_pickup").map((step, i) => {
                      const stepConfig = statusConfig[step];
                      const isActive = statusOrder.indexOf(step) <= currentStepIndex;
                      const isCurrent = step === order.status;
                      return (
                        <div key={step} className="flex flex-col items-center gap-1 min-w-0 flex-1">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs
                            ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}
                            ${isCurrent ? "ring-2 ring-primary ring-offset-2" : ""}
                          `}>
                            {isActive ? <CheckCircle className="h-3 w-3" /> : i + 1}
                          </div>
                          <span className={`text-[10px] text-center leading-tight ${isActive ? "text-primary font-medium" : "text-muted-foreground"}`}>
                            {stepConfig.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Order items */}
                {order.items?.length > 0 && (
                  <div className="space-y-2">
                    {order.items.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-3 text-sm">
                        <img
                          src={item.products?.images?.[0] || "/placeholder.svg"}
                          alt={item.products?.name || "Produit"}
                          className="w-10 h-10 rounded object-cover bg-muted"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.products?.name || "Produit"}</p>
                          <p className="text-muted-foreground text-xs">
                            {item.quantity} × {currencySymbol} {item.unit_price}
                          </p>
                        </div>
                        <span className="font-medium">{currencySymbol} {item.total_price}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Delivery info */}
                {order.delivery_address && (
                  <div className="flex items-start gap-2 text-sm border-t pt-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">{order.delivery_city}</p>
                      <p className="text-muted-foreground">{order.delivery_address}</p>
                    </div>
                  </div>
                )}

                {/* Total + Actions */}
                <div className="flex items-center justify-between border-t pt-3">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Total: </span>
                    <span className="font-bold text-lg">{currencySymbol} {order.total_amount?.toLocaleString()}</span>
                  </div>
                  {["picked_up", "in_transit"].includes(order.status || "") && (
                    <Button size="sm" className="gap-1.5" onClick={() => navigate(`/track/${order.id}`)}>
                      <Navigation className="h-3.5 w-3.5" />
                      Suivre en direct
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Quick links */}
        {!results && !error && user && (
          <div className="grid grid-cols-2 gap-4 mt-8">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/orders")}>
              <CardContent className="pt-6 text-center">
                <ShoppingBag className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="font-medium">Mes commandes</p>
                <p className="text-xs text-muted-foreground">Voir toutes vos commandes</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/products")}>
              <CardContent className="pt-6 text-center">
                <Package className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="font-medium">Acheter</p>
                <p className="text-xs text-muted-foreground">Parcourir les produits</p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
