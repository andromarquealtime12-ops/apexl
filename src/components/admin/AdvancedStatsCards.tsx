 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Skeleton } from "@/components/ui/skeleton";
 import { Badge } from "@/components/ui/badge";
 import { 
   Users, TrendingUp, ShoppingCart, DollarSign, 
   UserCheck, Truck, Store, AlertTriangle, 
   MessageSquare, Shield
 } from "lucide-react";
 import { useAdminAdvancedStats } from "@/hooks/useAdminAdvanced";
 
 export default function AdvancedStatsCards() {
   const { data: stats, isLoading } = useAdminAdvancedStats();
 
   const formatCurrency = (amount: number) => {
     return new Intl.NumberFormat("es-DO", {
       style: "decimal",
       minimumFractionDigits: 0,
       maximumFractionDigits: 0,
     }).format(amount);
   };
 
   if (isLoading) {
     return (
       <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
         {[...Array(10)].map((_, i) => (
           <Skeleton key={i} className="h-24" />
         ))}
       </div>
     );
   }
 
   const statsCards = [
     { 
       label: "Total Utilisateurs", 
       value: stats?.totalUsers || 0, 
       icon: Users, 
       color: "text-blue-500" 
     },
     { 
       label: "Acheteurs", 
       value: stats?.buyersCount || 0, 
       icon: UserCheck, 
       color: "text-green-500" 
     },
     { 
       label: "Vendeurs", 
       value: stats?.sellersCount || 0, 
       icon: Store, 
       color: "text-purple-500" 
     },
     { 
       label: "Livreurs", 
       value: stats?.driversCount || 0, 
       icon: Truck, 
       color: "text-orange-500" 
     },
     { 
       label: "Revenus (30j)", 
       value: `RD$ ${formatCurrency(stats?.totalRevenue || 0)}`, 
       icon: DollarSign, 
       color: "text-emerald-500" 
     },
     { 
       label: "Commandes Aujourd'hui", 
       value: stats?.ordersToday || 0, 
       icon: ShoppingCart, 
       color: "text-cyan-500" 
     },
     { 
       label: "Commandes en cours", 
       value: stats?.ordersInProgress || 0, 
       icon: ShoppingCart, 
       color: "text-yellow-500" 
     },
     { 
       label: "Croissance (7j)", 
       value: `${stats?.userGrowth || 0}%`, 
       icon: TrendingUp, 
       color: stats?.userGrowth && stats.userGrowth > 0 ? "text-green-500" : "text-red-500" 
     },
     { 
       label: "Vérifications en attente", 
       value: stats?.pendingVerifications || 0, 
       icon: Shield, 
       color: "text-amber-500",
       badge: stats?.pendingVerifications && stats.pendingVerifications > 0 ? true : false
     },
     { 
       label: "Tickets Support", 
       value: stats?.openTickets || 0, 
       icon: MessageSquare, 
       color: "text-pink-500",
       badge: stats?.openTickets && stats.openTickets > 0 ? true : false
     }
   ];
 
   return (
     <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
       {statsCards.map((stat, index) => (
         <Card key={index} className="relative">
           <CardHeader className="pb-2 pt-4 px-4">
             <CardDescription className="text-xs">{stat.label}</CardDescription>
             <CardTitle className="text-xl flex items-center gap-2">
               <stat.icon className={`h-5 w-5 ${stat.color}`} />
               {stat.value}
               {stat.badge && (
                 <Badge variant="destructive" className="ml-auto h-5 w-5 p-0 flex items-center justify-center text-xs">
                   !
                 </Badge>
               )}
             </CardTitle>
           </CardHeader>
         </Card>
       ))}
     </div>
   );
 }