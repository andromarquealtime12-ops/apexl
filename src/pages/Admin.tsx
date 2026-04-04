import { Navigate } from "react-router-dom";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ShieldCheck, Users, Package, ShoppingCart, 
  Wallet, Settings, UserCog, Shield, 
  MessageSquare, Flag, History, Sliders
} from "lucide-react";
import PendingDepositsTable from "@/components/admin/PendingDepositsTable";
import PendingWithdrawalsTable from "@/components/admin/PendingWithdrawalsTable";
import TransactionHistoryTable from "@/components/admin/TransactionHistoryTable";
import AdminCodesManager from "@/components/admin/AdminCodesManager";
import { ApplicationsManager } from "@/components/admin/ApplicationsManager";
import { useAdminPendingDeposits } from "@/hooks/useAdminWallet";
import { usePendingSellerApplications, usePendingDriverApplications } from "@/hooks/useApplications";
import AdvancedStatsCards from "@/components/admin/AdvancedStatsCards";
import UsersManagementTable from "@/components/admin/UsersManagementTable";
import IdentityVerificationsManager from "@/components/admin/IdentityVerificationsManager";
import SupportTicketsManager from "@/components/admin/SupportTicketsManager";
import ReportsManager from "@/components/admin/ReportsManager";
import AuditLogsViewer from "@/components/admin/AuditLogsViewer";
import PlatformSettingsManager from "@/components/admin/PlatformSettingsManager";
import RefundRequestsManager from "@/components/admin/RefundRequestsManager";

import { usePendingIdentityVerifications, useSupportTickets, useReports } from "@/hooks/useAdminAdvanced";

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const { data: pendingDeposits } = useAdminPendingDeposits();
  const { data: pendingSellerApps } = usePendingSellerApplications();
  const { data: pendingDriverApps } = usePendingDriverApplications();
  const { data: pendingVerifications } = usePendingIdentityVerifications();
  const { data: openTickets } = useSupportTickets("open");
  const { data: pendingReports } = useReports("pending");

  const pendingApplicationsCount = (pendingSellerApps?.length || 0) + (pendingDriverApps?.length || 0);
  const pendingVerificationsCount = pendingVerifications?.length || 0;
  const openTicketsCount = openTickets?.length || 0;
  const pendingReportsCount = pendingReports?.length || 0;

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
              SuperAdmin Dashboard
              <Badge className="text-xs">Accès restreint</Badge>
            </h1>
            <p className="text-muted-foreground">Gestion avancée de Ayiti Marché RD</p>
          </div>
        </div>

        {/* Advanced Stats Overview */}
        <div className="mb-8">
          <AdvancedStatsCards />
        </div>

        {/* Admin Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid grid-cols-4 md:grid-cols-7 w-full">
            <TabsTrigger value="users" className="relative">
              <Users className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Utilisateurs</span>
              {pendingApplicationsCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {pendingApplicationsCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="identity" className="relative">
              <Shield className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Identité</span>
              {pendingVerificationsCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {pendingVerificationsCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="support" className="relative">
              <MessageSquare className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Support</span>
              {openTicketsCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {openTicketsCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reports" className="relative">
              <Flag className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Signalements</span>
              {pendingReportsCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {pendingReportsCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="products">
              <Package className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Produits</span>
            </TabsTrigger>
            <TabsTrigger value="wallets">
              <Wallet className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Finance</span>
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
          </TabsList>


          <TabsContent value="users" className="space-y-6">
            {/* Applications Manager */}
            <ApplicationsManager />
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="h-5 w-5" />
                  Gestion des utilisateurs
                </CardTitle>
                <CardDescription>Visualisez, suspendez et gérez tous les utilisateurs</CardDescription>
              </CardHeader>
              <CardContent>
                <UsersManagementTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="identity" className="space-y-6">
            <IdentityVerificationsManager />
          </TabsContent>

          <TabsContent value="support" className="space-y-6">
            <SupportTicketsManager />
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <ReportsManager />
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Gestion des produits</CardTitle>
                <CardDescription>Approuvez, modifiez ou supprimez des produits</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  Module de gestion des produits en cours de développement
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wallets" className="space-y-6">
            <RefundRequestsManager />
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
                <CardTitle className="flex items-center gap-2">
                  Demandes de retrait en attente
                </CardTitle>
                <CardDescription>Approuvez ou rejetez les demandes de retrait</CardDescription>
              </CardHeader>
              <CardContent>
                <PendingWithdrawalsTable />
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

          <TabsContent value="settings" className="space-y-6">
            <PlatformSettingsManager />
            
            <AdminCodesManager />
            
            <AuditLogsViewer />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
};

export default Admin;
