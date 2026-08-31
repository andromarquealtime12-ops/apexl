import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Store, Package, ShoppingCart, TrendingUp, BarChart3, UtensilsCrossed } from "lucide-react";
import RestaurantManager from "@/components/seller/RestaurantManager";
import SellerReturnManager from "@/components/returns/SellerReturnManager";
import SellerStatsCards from "@/components/seller/SellerStatsCards";
import ProductsManager from "@/components/seller/ProductsManager";
import SellerOrdersTable from "@/components/seller/SellerOrdersTable";
import { useSellerStats } from "@/hooks/useSellerStats";
import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";
import { IdentityRequiredBanner } from "@/components/identity/IdentityRequiredBanner";
import EarningsTransferCard from "@/components/wallet/EarningsTransferCard";
import DangerZoneCard from "@/components/seller/DangerZoneCard";



import { useTranslation } from "react-i18next";

const SellerDashboard = () => {
  useRealtimeOrders();
  const { t } = useTranslation();
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

  if (!user) return <Navigate to="/" replace />;

  if (!isSeller) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="container px-4 py-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <Store className="h-16 w-16 mx-auto text-primary mb-4" />
              <CardTitle className="text-2xl">{t("sellerDash.notSeller.title")}</CardTitle>
              <CardDescription>{t("sellerDash.notSeller.desc")}</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground">{t("sellerDash.notSeller.footer")}</p>
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
              {t("sellerDash.title")}
              <Badge variant="secondary" className="text-xs">{t("sellerDash.badge")}</Badge>
            </h1>
            <p className="text-muted-foreground">{t("sellerDash.subtitle")}</p>
          </div>
        </div>

        <div className="mb-6 space-y-4">
          <IdentityRequiredBanner role="seller" />
        </div>

        <div className="mb-8 space-y-6">

          <SellerStatsCards stats={stats} isLoading={statsLoading} />
          <EarningsTransferCard />
        </div>


        <Tabs defaultValue="products" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="products" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">{t("sellerDash.tabs.products")}</span>
            </TabsTrigger>
            <TabsTrigger value="restaurant" className="gap-2">
              <UtensilsCrossed className="h-4 w-4" />
              <span className="hidden sm:inline">{t("sellerDash.tabs.restaurant")}</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2 relative">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">{t("sellerDash.tabs.orders")}</span>
              {stats && stats.pendingOrders > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 min-w-5 px-1 flex items-center justify-center text-xs">
                  {stats.pendingOrders}
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">{t("sellerDash.tabs.analytics")}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {t("sellerDash.myProducts")}
                </CardTitle>
                <CardDescription>{t("sellerDash.myProductsDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <ProductsManager />
              </CardContent>
            </Card>
            <DangerZoneCard kind="shop" />
          </TabsContent>


          <TabsContent value="restaurant">
            <RestaurantManager />
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            <SellerReturnManager />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  {t("sellerDash.myOrders")}
                  {stats && stats.pendingOrders > 0 && (
                    <Badge variant="destructive">{stats.pendingOrders}</Badge>
                  )}
                </CardTitle>

                <CardDescription>{t("sellerDash.myOrdersDesc")}</CardDescription>
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
                  {t("sellerDash.analytics.title")}
                </CardTitle>
                <CardDescription>{t("sellerDash.analytics.desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">{t("sellerDash.analytics.summary")}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">{t("sellerDash.analytics.sold")}</span>
                        <span className="font-medium">{stats?.totalOrders || 0}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">{t("sellerDash.analytics.conversion")}</span>
                        <span className="font-medium">--%</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">{t("sellerDash.analytics.avg")}</span>
                        <span className="font-medium">--</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center text-center p-8 bg-muted/30 rounded-lg">
                    <div>
                      <BarChart3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-muted-foreground">{t("sellerDash.analytics.chartsComing")}</p>
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
