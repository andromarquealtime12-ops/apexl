import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Store, Truck, CheckCircle, Clock, XCircle, Shield } from "lucide-react";
import { SellerApplicationForm } from "@/components/auth/SellerApplicationForm";
import { DriverApplicationForm } from "@/components/auth/DriverApplicationForm";
import { EmailVerificationCard } from "@/components/profile/EmailVerificationCard";
import { LocationCard } from "@/components/profile/LocationCard";
import ShopLocationCard from "@/components/seller/ShopLocationCard";
import IdentityVerificationForm from "@/components/identity/IdentityVerificationForm";

import ReferralCard from "@/components/referral/ReferralCard";
import { useMySellerApplication, useMyDriverApplication } from "@/hooks/useApplications";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const Profile = () => {
  const { t } = useTranslation();
  const { user, loading, isSeller, isDriver, isAdmin } = useAuth();
  const [showSellerForm, setShowSellerForm] = useState(false);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [versionClicks, setVersionClicks] = useState(0);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const { data: sellerApplication, isLoading: loadingSeller } = useMySellerApplication();
  const { data: driverApplication, isLoading: loadingDriver } = useMyDriverApplication();

  // Toast when returning from the email verification link
  useEffect(() => {
    if (searchParams.get("verified") === "1") {
      toast.success("Email vérifié avec succès ! Vous pouvez continuer votre inscription.");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      searchParams.delete("verified");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);


  const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; label: string }> = {
    pending: { icon: Clock, color: "text-yellow-500", label: t("profile.pending") },
    approved: { icon: CheckCircle, color: "text-green-500", label: t("profile.approved") },
    rejected: { icon: XCircle, color: "text-red-500", label: t("profile.rejected") },
  };

  const handleVersionClick = () => {
    const newCount = versionClicks + 1;
    setVersionClicks(newCount);
    if (newCount >= 7) {
      if (isAdmin) {
        toast.success(t("profile.adminUnlocked"));
        navigate("/admin");
      } else {
        toast.error(t("profile.notAdmin"));
      }
      setVersionClicks(0);
    } else if (newCount >= 3) {
      toast.info(t("profile.clicksLeft", { n: 7 - newCount }), { duration: 1000 });
    }
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

  if (!user) return <Navigate to="/" replace />;

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container px-4 py-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <User className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">{t("profile.title")}</h1>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleVersionClick}
            className="text-xs text-muted-foreground hover:text-muted-foreground/80 transition-colors cursor-default select-none"
          >
            Version 1.0
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <EmailVerificationCard />
          <LocationCard />
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("profile.myRoles")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge>{t("profile.buyer")}</Badge>
            {isSeller && <Badge variant="secondary">{t("profile.seller")}</Badge>}
            {isDriver && <Badge variant="secondary">{t("profile.driver")}</Badge>}
            {isAdmin && (
              <Badge className="bg-primary">
                <Shield className="h-3 w-3 mr-1" />
                {t("profile.admin")}
              </Badge>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {!(isSeller || isDriver) && <IdentityVerificationForm />}
          <ReferralCard />
        </div>

        {isSeller && (
          <div className="mt-6">
            <ShopLocationCard />
          </div>
        )}


        <div className="grid gap-6 md:grid-cols-2 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                {t("profile.becomeSellerTitle")}
              </CardTitle>
              <CardDescription>{t("profile.becomeSellerDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSeller ? (
                <Skeleton className="h-20 w-full" />
              ) : isSeller ? (
                <div className="flex items-center gap-2 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400">{t("profile.youAreSeller")}</p>
                    <p className="text-sm text-green-600 dark:text-green-500">{t("profile.youAreSellerDesc")}</p>
                  </div>
                </div>
              ) : sellerApplication ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const config = STATUS_CONFIG[sellerApplication.status];
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
                    <p><strong>{t("profile.shop")}:</strong> {sellerApplication.shop_name}</p>
                    <p><strong>{t("profile.city")}:</strong> {sellerApplication.shop_city}</p>
                  </div>
                  {sellerApplication.status === "rejected" && (
                    <Button variant="outline" size="sm" onClick={() => setShowSellerForm(true)}>
                      {t("profile.resubmit")}
                    </Button>
                  )}
                </div>
              ) : isDriver || (driverApplication && driverApplication.status !== "rejected") ? (
                <p className="text-sm text-muted-foreground p-4 rounded-lg bg-muted">
                  {t("profile.roleLockedSeller")}
                </p>
              ) : (
                <Button onClick={() => setShowSellerForm(true)} className="w-full">
                  <Store className="h-4 w-4 mr-2" />
                  {t("profile.applySeller")}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                {t("profile.becomeDriverTitle")}
              </CardTitle>
              <CardDescription>{t("profile.becomeDriverDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDriver ? (
                <Skeleton className="h-20 w-full" />
              ) : isDriver ? (
                <div className="flex items-center gap-2 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400">{t("profile.youAreDriver")}</p>
                    <p className="text-sm text-green-600 dark:text-green-500">{t("profile.youAreDriverDesc")}</p>
                  </div>
                </div>
              ) : driverApplication ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const config = STATUS_CONFIG[driverApplication.status];
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
                    <p><strong>{t("profile.vehicle")}:</strong> {driverApplication.vehicle_brand} {driverApplication.vehicle_model}</p>
                    <p><strong>{t("profile.city")}:</strong> {driverApplication.city}</p>
                  </div>
                  {driverApplication.status === "rejected" && (
                    <Button variant="outline" size="sm" onClick={() => setShowDriverForm(true)}>
                      {t("profile.resubmit")}
                    </Button>
                  )}
                </div>
              ) : (
                <Button onClick={() => setShowDriverForm(true)} className="w-full">
                  <Truck className="h-4 w-4 mr-2" />
                  {t("profile.applyDriver")}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <SellerApplicationForm isOpen={showSellerForm} onClose={() => setShowSellerForm(false)} />
      <DriverApplicationForm isOpen={showDriverForm} onClose={() => setShowDriverForm(false)} />
    </main>
  );
};

export default Profile;
