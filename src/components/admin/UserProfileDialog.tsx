import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Star, AlertTriangle, Ban, Snowflake, Image, User, 
  Shield, History, Store, Truck, MapPin, Phone as PhoneIcon, 
  Calendar, Mail
} from "lucide-react";
import { AdvancedUserProfile, useUserTransactions } from "@/hooks/useAdminAdvanced";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface UserProfileDialogProps {
  user: AdvancedUserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnfreezeWallet: (user: AdvancedUserProfile) => void;
}

export default function UserProfileDialog({ user, open, onOpenChange, onUnfreezeWallet }: UserProfileDialogProps) {
  const [sellerApp, setSellerApp] = useState<any>(null);
  const [driverApp, setDriverApp] = useState<any>(null);
  const [loadingApps, setLoadingApps] = useState(false);
  const { data: userTxs } = useUserTransactions(user?.user_id || null);

  useEffect(() => {
    if (user && open) {
      setLoadingApps(true);
      Promise.all([
        supabase.from("seller_applications").select("*").eq("user_id", user.user_id).maybeSingle(),
        supabase.from("driver_applications").select("*").eq("user_id", user.user_id).maybeSingle(),
      ]).then(([sellerRes, driverRes]) => {
        setSellerApp(sellerRes.data);
        setDriverApp(driverRes.data);
        setLoadingApps(false);
      });
    }
  }, [user, open]);

  const getDocumentUrl = (path: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from("identity-documents").getPublicUrl(path);
    return data.publicUrl;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-DO", { style: "decimal", minimumFractionDigits: 0 }).format(amount);
  };

  const getRoleBadge = (roles: string[]) => {
    if (roles.includes("admin")) return <Badge variant="destructive">Admin</Badge>;
    if (roles.includes("seller")) return <Badge className="bg-purple-500">Vendeur</Badge>;
    if (roles.includes("driver")) return <Badge className="bg-orange-500">Livreur</Badge>;
    return <Badge variant="secondary">Acheteur</Badge>;
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Profil complet - {user.full_name}
            {getRoleBadge(user.roles)}
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="info">Infos</TabsTrigger>
            <TabsTrigger value="roles">Rôles</TabsTrigger>
            <TabsTrigger value="identity">Identité</TabsTrigger>
            <TabsTrigger value="wallet">Finances</TabsTrigger>
            <TabsTrigger value="transactions">Historique</TabsTrigger>
          </TabsList>
          
          {/* Info Tab */}
          <TabsContent value="info" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <PhoneIcon className="h-3 w-3" />
                    <span>{user.phone || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-3 w-3" />
                    <span>{user.city || "Ville non renseignée"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-3 w-3" />
                    <span>Inscrit le {format(new Date(user.created_at), "dd MMM yyyy", { locale: fr })}</span>
                  </div>
                  {user.last_login_at && (
                    <div className="text-xs text-muted-foreground">
                      Dernière connexion: {format(new Date(user.last_login_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Score de confiance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-muted rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full ${
                          (user.trust_score || 50) >= 70 ? 'bg-green-500' : 
                          (user.trust_score || 50) >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${user.trust_score || 50}%` }}
                      />
                    </div>
                    <span className="font-bold">{user.trust_score || 50}%</span>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Signalements</p>
                  <p className="text-2xl font-bold text-red-500">{user.report_count || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Colis perdus</p>
                  <p className="text-2xl font-bold text-orange-500">{user.lost_packages_count || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Statut identité</p>
                  <Badge variant={user.identity_status === "verified" ? "default" : "secondary"} className="mt-1">
                    {user.identity_status || "Non vérifié"}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {user.suspension_reason && (
              <Card className="border-destructive">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-destructive">Suspension</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{user.suspension_reason}</p>
                  {user.suspension_until && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Jusqu'au {format(new Date(user.suspension_until), "dd MMM yyyy HH:mm", { locale: fr })}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {user.admin_notes && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Notes admin</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm whitespace-pre-wrap">{user.admin_notes}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Roles Tab - Seller/Driver application details */}
          <TabsContent value="roles" className="space-y-4">
            {loadingApps ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <>
                {sellerApp && (
                  <Card className="border-purple-200 dark:border-purple-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Store className="h-4 w-4 text-purple-500" />
                        Informations vendeur
                        <Badge className={sellerApp.status === "approved" ? "bg-green-500" : sellerApp.status === "pending" ? "bg-yellow-500" : "bg-red-500"}>
                          {sellerApp.status}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Boutique</p>
                          <p className="font-medium">{sellerApp.shop_name}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Type</p>
                          <p className="font-medium">{sellerApp.business_type || "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Adresse</p>
                          <p className="font-medium">{sellerApp.shop_address}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Ville</p>
                          <p className="font-medium">{sellerApp.shop_city}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Téléphone boutique</p>
                          <p className="font-medium">{sellerApp.shop_phone}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Description</p>
                          <p className="font-medium">{sellerApp.shop_description || "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Date candidature</p>
                          <p className="font-medium">{format(new Date(sellerApp.created_at), "dd MMM yyyy", { locale: fr })}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {driverApp && (
                  <Card className="border-orange-200 dark:border-orange-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Truck className="h-4 w-4 text-orange-500" />
                        Informations livreur
                        <Badge className={driverApp.status === "approved" ? "bg-green-500" : driverApp.status === "pending" ? "bg-yellow-500" : "bg-red-500"}>
                          {driverApp.status}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Véhicule</p>
                          <p className="font-medium">{driverApp.vehicle_brand} {driverApp.vehicle_model || ""}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Type</p>
                          <p className="font-medium">{driverApp.vehicle_type}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Année</p>
                          <p className="font-medium">{driverApp.vehicle_year || "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Plaque</p>
                          <p className="font-medium">{driverApp.license_plate}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Permis</p>
                          <p className="font-medium">{driverApp.driver_license_number}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Téléphone</p>
                          <p className="font-medium">{driverApp.phone}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Ville</p>
                          <p className="font-medium">{driverApp.city}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Disponibilité</p>
                          <p className="font-medium">{driverApp.availability || "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Date candidature</p>
                          <p className="font-medium">{format(new Date(driverApp.created_at), "dd MMM yyyy", { locale: fr })}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!sellerApp && !driverApp && (
                  <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">
                      <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Cet utilisateur est un acheteur simple</p>
                      <p className="text-sm">Aucune candidature vendeur ou livreur</p>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Rôles actifs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 flex-wrap">
                      {user.roles.map(role => (
                        <Badge key={role} variant="outline" className="text-sm">
                          {role === "admin" ? "Administrateur" : 
                           role === "seller" ? "Vendeur" : 
                           role === "driver" ? "Livreur" : "Acheteur"}
                        </Badge>
                      ))}
                      {user.roles.length === 0 && <Badge variant="outline">Acheteur</Badge>}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
          
          {/* Identity Tab */}
          <TabsContent value="identity" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Pièce d'identité (Recto)", field: user.id_document_front, icon: Image },
                { label: "Pièce d'identité (Verso)", field: user.id_document_back, icon: Image },
                { label: "Selfie", field: user.selfie_photo, icon: User },
              ].map(({ label, field, icon: Icon }) => (
                <Card key={label}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {field ? (
                      <a href={getDocumentUrl(field) || "#"} target="_blank" rel="noopener noreferrer" className="block">
                        <img 
                          src={getDocumentUrl(field) || ""} 
                          alt={label} 
                          className="w-full h-32 object-cover rounded border hover:opacity-80 transition"
                        />
                      </a>
                    ) : (
                      <div className="h-32 bg-muted rounded flex items-center justify-center text-muted-foreground text-sm">
                        Non fourni
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Statut de vérification</p>
                    <p className="text-sm text-muted-foreground">
                      {user.identity_status === "verified" 
                        ? "Identité vérifiée et validée" 
                        : user.identity_status === "pending"
                        ? "En attente de vérification"
                        : user.identity_status === "rejected"
                        ? "Documents refusés"
                        : "Documents non soumis"}
                    </p>
                  </div>
                  <Badge variant={user.identity_status === "verified" ? "default" : "secondary"} className="text-lg px-4 py-1">
                    {user.identity_status || "Non vérifié"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Wallet Tab */}
          <TabsContent value="wallet" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Balance DOP</p>
                  <p className="text-2xl font-bold">RD$ {formatCurrency(user.wallet_balance_dop || 0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Balance HTG</p>
                  <p className="text-2xl font-bold">HTG {formatCurrency(user.wallet_balance_htg || 0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Balance USD</p>
                  <p className="text-2xl font-bold">$ {formatCurrency(user.wallet_balance_usd || 0)}</p>
                </CardContent>
              </Card>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Total dépensé</p>
                  <p className="text-xl font-bold text-red-500">-RD$ {formatCurrency(user.total_spent || 0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Total gagné</p>
                  <p className="text-xl font-bold text-green-500">+RD$ {formatCurrency(user.total_earned || 0)}</p>
                </CardContent>
              </Card>
            </div>
            {user.wallet_frozen && (
              <Card className="border-blue-500">
                <CardContent className="pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-500">
                    <Snowflake className="h-5 w-5" />
                    <span className="font-medium">Portefeuille gelé</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => onUnfreezeWallet(user)}>
                    Dégeler
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Historique des transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {userTxs && userTxs.length > 0 ? (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {userTxs.map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between p-2 rounded border text-sm">
                        <div>
                          <span className="font-medium capitalize">{tx.type}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {format(new Date(tx.created_at), "dd/MM/yy HH:mm", { locale: fr })}
                          </span>
                          {tx.description && <p className="text-xs text-muted-foreground">{tx.description}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={tx.type === "deposit" ? "text-green-600" : "text-red-600"}>
                            {tx.type === "deposit" ? "+" : "-"}{tx.currency} {Number(tx.amount).toLocaleString()}
                          </span>
                          <Badge variant={tx.status === "completed" ? "default" : tx.status === "pending" ? "secondary" : "destructive"}>
                            {tx.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">Aucune transaction</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
