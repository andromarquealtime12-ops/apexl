import { Navigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import BuyerOrdersTracker from "@/components/buyer/BuyerOrdersTracker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingBag, Package } from "lucide-react";
import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";
import { useTranslation } from "react-i18next";

const Orders = () => {
  useRealtimeOrders();
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="flex items-center gap-3 mb-6">
          <ShoppingBag className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{t("buyerx.orders.title")}</h1>
            <p className="text-muted-foreground">{t("buyerx.orders.subtitle")}</p>
          </div>
        </div>

        <div className="max-w-2xl">
          <BuyerOrdersTracker />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Orders;
