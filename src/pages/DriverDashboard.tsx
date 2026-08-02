import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, Package, MapPin, DollarSign } from "lucide-react";
import DriverReturnsList from "@/components/returns/DriverReturnsList";
import DriverStatsCards from "@/components/driver/DriverStatsCards";
import AvailableDeliveriesTable from "@/components/driver/AvailableDeliveriesTable";
import MyDeliveriesTable from "@/components/driver/MyDeliveriesTable";
import { DriverLocationTracker } from "@/components/driver/DriverLocationTracker";
import { PushNotificationBanner } from "@/components/notifications/PushNotificationBanner";
import { useDriverOrderNotifications } from "@/hooks/usePushNotifications";
import { useDriverStats, useAvailableDeliveries } from "@/hooks/useDriverStats";
import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";
import { IdentityRequiredBanner } from "@/components/identity/IdentityRequiredBanner";
import EarningsTransferCard from "@/components/wallet/EarningsTransferCard";


const DriverDashboard = () => {
  const { t } = useTranslation();
  useRealtimeOrders();
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

  if (!user) return <Navigate to="/" replace />;

  if (!isDriver) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="container px-4 py-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <Truck className="h-16 w-16 mx-auto text-primary mb-4" />
              <CardTitle className="text-2xl">{t("driverPage.becomeTitle")}</CardTitle>
              <CardDescription>{t("driverPage.becomeDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground">{t("driverPage.approvedInfo")}</p>
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
        <PushNotificationBanner />
        <div className="flex items-center gap-3 mb-6">
          <Truck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {t("driverPage.title")}
              <Badge variant="secondary" className="text-xs">{t("driverPage.badge")}</Badge>
            </h1>
            <p className="text-muted-foreground">{t("driverPage.subtitle")}</p>
          </div>
        </div>

        <div className="mb-6">
          <IdentityRequiredBanner role="driver" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1">
            <DriverLocationTracker />
          </div>
          <div className="lg:col-span-2">
            <DriverStatsCards stats={stats} isLoading={statsLoading} />
          </div>
        </div>

        <Tabs defaultValue="available" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="available" className="gap-2 relative">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">{t("driverPage.tabs.available")}</span>
              {availableDeliveries && availableDeliveries.length > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {availableDeliveries.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="my-deliveries" className="gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">{t("driverPage.tabs.myDeliveries")}</span>
            </TabsTrigger>
            <TabsTrigger value="earnings" className="gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">{t("driverPage.tabs.earnings")}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="available">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {t("driverPage.availableTitle")}
                  {availableDeliveries && availableDeliveries.length > 0 && (
                    <Badge variant="destructive">{availableDeliveries.length}</Badge>
                  )}
                </CardTitle>
                <CardDescription>{t("driverPage.availableDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <AvailableDeliveriesTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="my-deliveries" className="space-y-6">
            <DriverReturnsList />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  {t("driverPage.myDeliveriesTitle")}
                </CardTitle>
                <CardDescription>{t("driverPage.myDeliveriesDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <MyDeliveriesTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="earnings" className="space-y-6">
            <EarningsTransferCard />
            <Card>

              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  {t("driverPage.earningsTitle")}
                </CardTitle>
                <CardDescription>{t("driverPage.earningsDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">{t("driverPage.summary")}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between py-3 border-b">
                        <span className="text-muted-foreground">{t("driverPage.totalEarnings")}</span>
                        <span className="font-bold text-lg text-green-600">
                          RD$ {(stats?.totalEarnings || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between py-3 border-b">
                        <span className="text-muted-foreground">{t("driverPage.completed")}</span>
                        <span className="font-medium">{stats?.completedDeliveries || 0}</span>
                      </div>
                      <div className="flex justify-between py-3 border-b">
                        <span className="text-muted-foreground">{t("driverPage.average")}</span>
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
                      <p className="text-sm text-muted-foreground mb-1">{t("driverPage.availableBalance")}</p>
                      <p className="text-3xl font-bold text-green-600">
                        RD$ {(stats?.totalEarnings || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">{t("driverPage.autoWallet")}</p>
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
