import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ShoppingCart, TrendingUp, DollarSign } from "lucide-react";

interface SellerStatsCardsProps {
  stats: {
    totalProducts: number;
    activeProducts: number;
    totalOrders: number;
    pendingOrders: number;
    totalRevenue: number;
    monthlyRevenue: number;
  } | undefined;
  isLoading: boolean;
}

export default function SellerStatsCards({ stats, isLoading }: SellerStatsCardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const statCards = [
    {
      title: "Produits actifs",
      value: stats?.activeProducts ?? 0,
      subtitle: `${stats?.totalProducts ?? 0} au total`,
      icon: Package,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Commandes",
      value: stats?.totalOrders ?? 0,
      subtitle: `${stats?.pendingOrders ?? 0} en attente`,
      icon: ShoppingCart,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      title: "Revenus total",
      value: formatCurrency(stats?.totalRevenue ?? 0),
      subtitle: "Toutes les ventes",
      icon: TrendingUp,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      isLarge: true,
    },
    {
      title: "Ce mois",
      value: formatCurrency(stats?.monthlyRevenue ?? 0),
      subtitle: "Revenus mensuels",
      icon: DollarSign,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      isLarge: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat, index) => (
        <Card key={index} className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className={`font-bold ${stat.isLarge ? "text-xl" : "text-2xl"}`}>
                  {stat.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
