import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  usePendingSellerApplications,
  usePendingDriverApplications,
  useApproveSellerApplication,
  useApproveDriverApplication,
  useRejectApplication,
} from "@/hooks/useApplications";
import { Store, Truck, CheckCircle, XCircle, Loader2, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

function DocPhoto({ url, label }: { url?: string | null; label: string }) {
  if (!url) return <div className="text-xs text-muted-foreground">{label}: manquant</div>;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">{label}</p>
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={label} className="h-40 w-full object-cover rounded border hover:opacity-80 transition" />
      </a>
    </div>
  );
}

const VEHICLE_TYPES: Record<string, string> = {
  motorcycle: "Moto",
  car: "Voiture",
  bicycle: "Vélo",
  truck: "Camion",
};

export function ApplicationsManager() {
  const { data: sellerApps, isLoading: loadingSellers } = usePendingSellerApplications();
  const { data: driverApps, isLoading: loadingDrivers } = usePendingDriverApplications();
  const approveSeller = useApproveSellerApplication();
  const approveDriver = useApproveDriverApplication();
  const rejectApp = useRejectApplication();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📋 Demandes d'inscription
        </CardTitle>
        <CardDescription>
          Approuvez ou rejetez les demandes des vendeurs et livreurs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sellers">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sellers" className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              Vendeurs ({sellerApps?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="drivers" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Livreurs ({driverApps?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sellers" className="mt-4">
            {loadingSellers ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : sellerApps?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucune demande en attente
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Boutique</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellerApps?.map((app: any) => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{app.shop_name}</p>
                          {app.shop_description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {app.shop_description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{app.shop_city}</TableCell>
                      <TableCell>{app.shop_phone}</TableCell>
                      <TableCell>
                        {format(new Date(app.created_at), "dd MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          onClick={() => approveSeller.mutate(app.id)}
                          disabled={approveSeller.isPending}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approuver
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <XCircle className="h-4 w-4 mr-1" />
                              Rejeter
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Rejeter cette demande ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action ne peut pas être annulée. Le vendeur devra soumettre une nouvelle demande.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => rejectApp.mutate({ type: "seller", id: app.id })}
                              >
                                Rejeter
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="drivers" className="mt-4">
            {loadingDrivers ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : driverApps?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucune demande en attente
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Véhicule</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Permis</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {driverApps?.map((app: any) => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <div>
                          <Badge variant="outline" className="mb-1">
                            {VEHICLE_TYPES[app.vehicle_type] || app.vehicle_type}
                          </Badge>
                          <p className="font-medium">
                            {app.vehicle_brand} {app.vehicle_model}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {app.license_plate}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{app.city}</TableCell>
                      <TableCell>{app.phone}</TableCell>
                      <TableCell>{app.driver_license_number}</TableCell>
                      <TableCell>
                        {format(new Date(app.created_at), "dd MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          onClick={() => approveDriver.mutate(app.id)}
                          disabled={approveDriver.isPending}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approuver
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <XCircle className="h-4 w-4 mr-1" />
                              Rejeter
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Rejeter cette demande ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action ne peut pas être annulée. Le livreur devra soumettre une nouvelle demande.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => rejectApp.mutate({ type: "driver", id: app.id })}
                              >
                                Rejeter
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
