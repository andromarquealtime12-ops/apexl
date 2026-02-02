import { useState } from "react";
import Header from "@/components/Header";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Store, Truck, CheckCircle, Clock, XCircle } from "lucide-react";
import { SellerApplicationForm } from "@/components/auth/SellerApplicationForm";
import { DriverApplicationForm } from "@/components/auth/DriverApplicationForm";
import { useMySellerApplication, useMyDriverApplication } from "@/hooks/useApplications";

const STATUS_CONFIG = {
  pending: { icon: Clock, color: "text-yellow-500", label: "En attente" },
  approved: { icon: CheckCircle, color: "text-green-500", label: "Approuvée" },
  rejected: { icon: XCircle, color: "text-red-500", label: "Rejetée" },
};

const Profile = () => {
  const { user, loading, isSeller, isDriver } = useAuth();
  const [showSellerForm, setShowSellerForm] = useState(false);
  const [showDriverForm, setShowDriverForm] = useState(false);
  
  const { data: sellerApplication, isLoading: loadingSeller } = useMySellerApplication();
  const { data: driverApplication, isLoading: loadingDriver } = useMyDriverApplication();

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

  return (
    <main className="min-h-screen bg-background">
      <Header />

      <div className="container px-4 py-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <User className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Mon Profil</h1>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Seller Application Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Devenir Vendeur
              </CardTitle>
              <CardDescription>
                Vendez vos produits sur notre marketplace
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSeller ? (
                <Skeleton className="h-20 w-full" />
              ) : isSeller ? (
                <div className="flex items-center gap-2 p-4 rounded-lg bg-green-50 border border-green-200">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-green-700">Vous êtes vendeur !</p>
                    <p className="text-sm text-green-600">Accédez à votre dashboard vendeur</p>
                  </div>
                </div>
              ) : sellerApplication ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const config = STATUS_CONFIG[sellerApplication.status as keyof typeof STATUS_CONFIG];
                      const Icon = config.icon;
                      return (
                        <>
                          <Icon className={`h-5 w-5 ${config.color}`} />
                          <span className="font-medium">{config.label}</span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p><strong>Boutique:</strong> {sellerApplication.shop_name}</p>
                    <p><strong>Ville:</strong> {sellerApplication.shop_city}</p>
                  </div>
                  {sellerApplication.status === "rejected" && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowSellerForm(true)}
                    >
                      Soumettre à nouveau
                    </Button>
                  )}
                </div>
              ) : (
                <Button onClick={() => setShowSellerForm(true)} className="w-full">
                  <Store className="h-4 w-4 mr-2" />
                  Postuler comme vendeur
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Driver Application Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Devenir Livreur
              </CardTitle>
              <CardDescription>
                Livrez des commandes et gagnez de l'argent
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDriver ? (
                <Skeleton className="h-20 w-full" />
              ) : isDriver ? (
                <div className="flex items-center gap-2 p-4 rounded-lg bg-green-50 border border-green-200">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-green-700">Vous êtes livreur !</p>
                    <p className="text-sm text-green-600">Accédez à votre dashboard livreur</p>
                  </div>
                </div>
              ) : driverApplication ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const config = STATUS_CONFIG[driverApplication.status as keyof typeof STATUS_CONFIG];
                      const Icon = config.icon;
                      return (
                        <>
                          <Icon className={`h-5 w-5 ${config.color}`} />
                          <span className="font-medium">{config.label}</span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p><strong>Véhicule:</strong> {driverApplication.vehicle_brand} {driverApplication.vehicle_model}</p>
                    <p><strong>Ville:</strong> {driverApplication.city}</p>
                  </div>
                  {driverApplication.status === "rejected" && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowDriverForm(true)}
                    >
                      Soumettre à nouveau
                    </Button>
                  )}
                </div>
              ) : (
                <Button onClick={() => setShowDriverForm(true)} className="w-full">
                  <Truck className="h-4 w-4 mr-2" />
                  Postuler comme livreur
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Roles Badge */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Mes rôles</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge>Acheteur</Badge>
            {isSeller && <Badge variant="secondary">Vendeur</Badge>}
            {isDriver && <Badge variant="secondary">Livreur</Badge>}
          </CardContent>
        </Card>
      </div>

      <SellerApplicationForm 
        isOpen={showSellerForm} 
        onClose={() => setShowSellerForm(false)} 
      />
      
      <DriverApplicationForm 
        isOpen={showDriverForm} 
        onClose={() => setShowDriverForm(false)} 
      />
    </main>
  );
};

export default Profile;
