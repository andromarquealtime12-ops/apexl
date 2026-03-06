import { useState } from "react";
import { Navigate } from "react-router-dom";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Store, Package, ShoppingCart, TrendingUp, BarChart3, Truck } from "lucide-react";
import SellerStatsCards from "@/components/seller/SellerStatsCards";
import ProductsManager from "@/components/seller/ProductsManager";
import SellerOrdersTable from "@/components/seller/SellerOrdersTable";
import { NearbyDriversCard } from "@/components/seller/NearbyDriversCard";
import { useSellerStats, useSellerOrders } from "@/hooks/useSellerStats";

const SellerDashboard = () => {
  const { user, isSeller, loading } = useAuth();
  const { data: stats, isLoading: statsLoading } = useSellerStats();
  const { data: orders } = useSellerOrders();
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="container px-4 py-8">
          <Skeleton className="h-48 w-full" />
        </div>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!isSeller) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="container px-4 py-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <Store className="h-16 w-16 mx-auto text-primary mb-4" />
              <CardTitle className="text-2xl">Devenir Vendeur</CardTitle>
              <CardDescription>
                Vous n'êtes pas encore enregistré comme vendeur. Contactez l'administration pour obtenir l'accès vendeur.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground">
                Une fois approuvé, vous pourrez ajouter vos produits et gérer vos ventes depuis ce tableau de bord.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  // Orders ready for driver assignment
  const readyOrders = orders?.filter(o => 
    ["confirmed", "ready", "ready_for_pickup"].includes(o.status || "") && !o.driver_id
  ) || [];

  return (
    <main className="min-h-screen bg-background">
      <Header />

      <div className="container px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Store className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Tableau de bord vendeur
              <Badge variant="secondary" className="text-xs">Vendeur</Badge>
            </h1>
            <p className="text-muted-foreground">Gérez vos produits et suivez vos ventes</p>
          </div>
        </div>

        <div className="mb-8">
          <SellerStatsCards stats={stats} isLoading={statsLoading} />
        </div>

        <Tabs defaultValue="products" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-lg">
            <TabsTrigger value="products" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Produits</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Commandes</span>
            </TabsTrigger>
            <TabsTrigger value="drivers" className="gap-2">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Livreurs</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Stats</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Mes produits
                </CardTitle>
                <CardDescription>Gérez votre catalogue de produits</CardDescription>
              </CardHeader>
              <CardContent>
                <ProductsManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Mes commandes
                </CardTitle>
                <CardDescription>Suivez les commandes de vos produits</CardDescription>
              </CardHeader>
              <CardContent>
                <SellerOrdersTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drivers">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {readyOrders.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Assigner un livreur à une commande</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Label>Commande à assigner</Label>
                        <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionnez une commande..." />
                          </SelectTrigger>
                          <SelectContent>
                            {readyOrders.map(order => (
                              <SelectItem key={order.id} value={order.id}>
                                #{order.id.slice(0, 8)} - {order.items?.length || 0} produit(s)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <NearbyDriversCard
                  orderId={selectedOrderId || undefined}
                  selectedDriverId={selectedDriverId}
                  onSelectDriver={(id) => setSelectedDriverId(id)}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Comment ça marche
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">1</div>
                      <div>
                        <p className="font-medium">Marquez la commande prête</p>
                        <p className="text-sm text-muted-foreground">Un code PIN sera généré automatiquement</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">2</div>
                      <div>
                        <p className="font-medium">Sélectionnez une commande puis un livreur</p>
                        <p className="text-sm text-muted-foreground">Choisissez parmi les livreurs à proximité</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">3</div>
                      <div>
                        <p className="font-medium">Donnez le code au livreur</p>
                        <p className="text-sm text-muted-foreground">Il confirmera le retrait avec ce code</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Statistiques de vente
                </CardTitle>
                <CardDescription>Analysez vos performances</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Résumé</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Produits vendus</span>
                        <span className="font-medium">{stats?.totalOrders || 0}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Taux de conversion</span>
                        <span className="font-medium">--%</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Panier moyen</span>
                        <span className="font-medium">--</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center text-center p-8 bg-muted/30 rounded-lg">
                    <div>
                      <BarChart3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-muted-foreground">Graphiques détaillés bientôt disponibles</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
};

export default SellerDashboard;
