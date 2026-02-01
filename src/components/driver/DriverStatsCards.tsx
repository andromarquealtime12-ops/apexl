import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, CheckCircle, Clock, DollarSign } from "lucide-react";

interface DriverStatsCardsProps {
  stats: {
    totalDeliveries: number;
    completedDeliveries: number;
    pendingDeliveries: number;
    inProgressDeliveries: number;
    totalEarnings: number;
    monthlyEarnings: number;
  } | undefined;
  isLoading: boolean;
}

export default function DriverStatsCards({ stats, isLoading }: DriverStatsCardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const statCards = [
    {
      title: "Livraisons totales",
      value: stats?.totalDeliveries ?? 0,
      subtitle: `${stats?.completedDeliveries ?? 0} terminées`,
      icon: Truck,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "En attente",
      value: stats?.pendingDeliveries ?? 0,
      subtitle: "À récupérer",
      icon: Clock,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      title: "En cours",
      value: stats?.inProgressDeliveries ?? 0,
      subtitle: "En livraison",
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Gains totaux",
      value: formatCurrency(stats?.totalEarnings ?? 0),
      subtitle: "Commission de livraison",
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
