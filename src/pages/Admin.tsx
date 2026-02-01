import { Navigate } from "react-router-dom";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ShieldCheck, Users, Package, ShoppingCart, 
  Wallet, TrendingUp, Settings, UserCog
} from "lucide-react";
import PendingDepositsTable from "@/components/admin/PendingDepositsTable";
import TransactionHistoryTable from "@/components/admin/TransactionHistoryTable";
import AdminCodesManager from "@/components/admin/AdminCodesManager";
import AdminUsersManager from "@/components/admin/AdminUsersManager";
import RoleAssignmentManager from "@/components/admin/RoleAssignmentManager";
import { useAdminPendingDeposits } from "@/hooks/useAdminWallet";
import { useAdminStats } from "@/hooks/useAdminStats";
const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const { data: pendingDeposits } = useAdminPendingDeposits();
  const { data: stats, isLoading: statsLoading } = useAdminStats();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

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

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="min-h-screen bg-background">
      <Header />

      <div className="container px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Panel Admin
              <Badge className="text-xs">Accès restreint</Badge>
            </h1>
            <p className="text-muted-foreground">Gérez votre marketplace</p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Utilisateurs</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                {statsLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  stats?.usersCount ?? 0
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Produits</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Package className="h-6 w-6 text-primary" />
                {statsLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  stats?.productsCount ?? 0
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Commandes</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <ShoppingCart className="h-6 w-6 text-primary" />
                {statsLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  stats?.ordersCount ?? 0
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Transactions</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-primary" />
                {statsLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  `RD$ ${formatCurrency(stats?.totalTransactions ?? 0)}`
                )}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Admin Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Utilisateurs
            </TabsTrigger>
            <TabsTrigger value="products">
              <Package className="h-4 w-4 mr-2" />
              Produits
            </TabsTrigger>
            <TabsTrigger value="orders">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Commandes
            </TabsTrigger>
            <TabsTrigger value="wallets">
              <Wallet className="h-4 w-4 mr-2" />
              Portefeuilles
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Paramètres
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="h-5 w-5" />
                  Gestion des rôles
                </CardTitle>
                <CardDescription>Assignez des rôles vendeur ou livreur aux utilisateurs</CardDescription>
              </CardHeader>
              <CardContent>
                <RoleAssignmentManager />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Administrateurs</CardTitle>
                <CardDescription>Gérez les utilisateurs ayant des droits administrateur</CardDescription>
              </CardHeader>
              <CardContent>
                <AdminUsersManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Gestion des produits</CardTitle>
                <CardDescription>Approuvez, modifiez ou supprimez des produits</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  Aucun produit ajouté pour le moment
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Gestion des commandes</CardTitle>
                <CardDescription>Suivez et gérez toutes les commandes</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  Aucune commande pour le moment
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wallets" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Demandes de dépôt en attente
                  {pendingDeposits && pendingDeposits.length > 0 && (
                    <Badge variant="destructive">{pendingDeposits.length}</Badge>
                  )}
                </CardTitle>
                <CardDescription>Validez les demandes de recharge de portefeuille</CardDescription>
              </CardHeader>
              <CardContent>
                <PendingDepositsTable />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Historique des transactions</CardTitle>
                <CardDescription>Toutes les transactions validées ou rejetées</CardDescription>
              </CardHeader>
              <CardContent>
                <TransactionHistoryTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Paramètres du système</CardTitle>
                <CardDescription>Configurez les options globales</CardDescription>
              </CardHeader>
              <CardContent>
                <AdminCodesManager />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
};

export default Admin;
