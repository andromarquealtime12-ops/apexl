import { Navigate } from "react-router-dom";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Store, Package, ShoppingCart, TrendingUp, BarChart3 } from "lucide-react";
import SellerStatsCards from "@/components/seller/SellerStatsCards";
import ProductsManager from "@/components/seller/ProductsManager";
import SellerOrdersTable from "@/components/seller/SellerOrdersTable";
import { useSellerStats } from "@/hooks/useSellerStats";

const SellerDashboard = () => {
  const { user, isSeller, loading } = useAuth();
  const { data: stats, isLoading: statsLoading } = useSellerStats();

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

  // If not a seller, show option to become one
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

        {/* Stats Cards */}
        <div className="mb-8">
          <SellerStatsCards stats={stats} isLoading={statsLoading} />
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="products" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="products" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Produits</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Commandes</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Mes produits
                </CardTitle>
                <CardDescription>
                  Gérez votre catalogue de produits
                </CardDescription>
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
                <CardDescription>
                  Suivez les commandes de vos produits
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SellerOrdersTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Statistiques de vente
                </CardTitle>
                <CardDescription>
                  Analysez vos performances
                </CardDescription>
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
