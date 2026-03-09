import { Navigate } from "react-router-dom";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, Package, MapPin, DollarSign, Navigation } from "lucide-react";
import DriverStatsCards from "@/components/driver/DriverStatsCards";
import AvailableDeliveriesTable from "@/components/driver/AvailableDeliveriesTable";
import MyDeliveriesTable from "@/components/driver/MyDeliveriesTable";
import { DriverLocationTracker } from "@/components/driver/DriverLocationTracker";
import { PushNotificationBanner } from "@/components/notifications/PushNotificationBanner";
import { useDriverOrderNotifications } from "@/hooks/usePushNotifications";
import { useDriverStats, useAvailableDeliveries } from "@/hooks/useDriverStats";

const DriverDashboard = () => {
  const { user, isDriver, loading } = useAuth();
  const { data: stats, isLoading: statsLoading } = useDriverStats();
  const { data: availableDeliveries } = useAvailableDeliveries();
  useDriverOrderNotifications();

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

  // If not a driver, show option to become one
  if (!isDriver) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="container px-4 py-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <Truck className="h-16 w-16 mx-auto text-primary mb-4" />
              <CardTitle className="text-2xl">Devenir Livreur</CardTitle>
              <CardDescription>
                Vous n'êtes pas encore enregistré comme livreur. Contactez l'administration pour obtenir l'accès livreur.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground">
                Une fois approuvé, vous pourrez accepter des livraisons et gagner de l'argent.
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
          <Truck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Tableau de bord livreur
              <Badge variant="secondary" className="text-xs">Livreur</Badge>
            </h1>
            <p className="text-muted-foreground">Gérez vos livraisons et suivez vos gains</p>
          </div>
        </div>

        {/* Location Tracker + Stats Cards */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1">
            <DriverLocationTracker />
          </div>
          <div className="lg:col-span-2">
            <DriverStatsCards stats={stats} isLoading={statsLoading} />
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="available" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="available" className="gap-2 relative">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Disponibles</span>
              {availableDeliveries && availableDeliveries.length > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {availableDeliveries.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="my-deliveries" className="gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Mes livraisons</span>
            </TabsTrigger>
            <TabsTrigger value="earnings" className="gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Gains</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="available">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Livraisons disponibles
                  {availableDeliveries && availableDeliveries.length > 0 && (
                    <Badge variant="destructive">{availableDeliveries.length}</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Acceptez des livraisons pour commencer à gagner
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AvailableDeliveriesTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="my-deliveries">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Mes livraisons
                </CardTitle>
                <CardDescription>
                  Gérez vos livraisons en cours et consultez l'historique
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MyDeliveriesTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="earnings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Mes gains
                </CardTitle>
                <CardDescription>
                  Consultez vos revenus de livraison
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Résumé des gains</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between py-3 border-b">
                        <span className="text-muted-foreground">Total des gains</span>
                        <span className="font-bold text-lg text-green-600">
                          RD$ {(stats?.totalEarnings || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between py-3 border-b">
                        <span className="text-muted-foreground">Livraisons complétées</span>
                        <span className="font-medium">{stats?.completedDeliveries || 0}</span>
                      </div>
                      <div className="flex justify-between py-3 border-b">
                        <span className="text-muted-foreground">Gain moyen par livraison</span>
                        <span className="font-medium">
                          RD$ {stats?.completedDeliveries 
                            ? Math.round((stats.totalEarnings || 0) / stats.completedDeliveries).toLocaleString() 
                            : 0}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-lg p-6">
                    <div className="text-center">
                      <DollarSign className="h-12 w-12 mx-auto mb-3 text-green-600" />
                      <p className="text-sm text-muted-foreground mb-1">Solde disponible</p>
                      <p className="text-3xl font-bold text-green-600">
                        RD$ {(stats?.totalEarnings || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Les gains sont ajoutés automatiquement à votre portefeuille
                      </p>
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

export default DriverDashboard;
