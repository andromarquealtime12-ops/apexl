import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { 
  MapPin, Loader2, Users, Navigation, Phone, Clock,
  RefreshCw, Truck, AlertTriangle, CheckCircle, Star, Package, Shield, Map
} from "lucide-react";
import { 
  useCurrentPosition, 
  useNearbyDrivers,
  useDriverLocationsRealtime
} from "@/hooks/useGeolocation";
import OpenStreetMap from "@/components/map/OpenStreetMap";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { estimateDeliveryTime } from "@/utils/deliveryEstimation";

interface DriverProfile {
  driver_id: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  updated_at: string;
  profile?: {
    full_name: string;
    phone?: string;
  };
  stats?: {
    totalDeliveries: number;
    completedDeliveries: number;
    avgRating: number;
    reviewCount: number;
  };
  vehicle?: {
    vehicle_type: string;
    vehicle_brand: string;
    vehicle_model: string | null;
    license_plate: string;
    city: string;
  };
}

interface NearbyDriversCardProps {
  onSelectDriver?: (driverId: string) => void;
  selectedDriverId?: string;
  orderId?: string;
}

export function NearbyDriversCard({ onSelectDriver, selectedDriverId, orderId }: NearbyDriversCardProps) {
  const { position, error, loading: posLoading, getCurrentPosition } = useCurrentPosition();
  const { data: rawDrivers, isLoading, error: queryError, refetch } = useNearbyDrivers(position, 15);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [assigning, setAssigning] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<DriverProfile | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [showMap, setShowMap] = useState(true);

  useEffect(() => {
    getCurrentPosition();
  }, []);

  // Enrich drivers with stats and vehicle info
  useEffect(() => {
    if (!rawDrivers || rawDrivers.length === 0) {
      setDrivers([]);
      return;
    }

    const enrichDrivers = async () => {
      setEnriching(true);
      const driverIds = rawDrivers.map(d => d.driver_id);

      const [ordersRes, reviewsRes, appsRes] = await Promise.all([
        supabase.from("orders").select("driver_id, status").in("driver_id", driverIds),
        supabase.from("reviews").select("reviewed_user_id, rating").in("reviewed_user_id", driverIds).eq("review_type", "driver"),
        supabase.from("driver_applications").select("user_id, vehicle_type, vehicle_brand, vehicle_model, license_plate, city").in("user_id", driverIds).eq("status", "approved"),
      ]);

      const enriched: DriverProfile[] = rawDrivers.map(driver => {
        const driverOrders = ordersRes.data?.filter(o => o.driver_id === driver.driver_id) || [];
        const completedDeliveries = driverOrders.filter(o => o.status === "delivered").length;
        const driverReviews = reviewsRes.data?.filter(r => r.reviewed_user_id === driver.driver_id) || [];
        const avgRating = driverReviews.length > 0
          ? driverReviews.reduce((sum, r) => sum + r.rating, 0) / driverReviews.length
          : 0;
        const app = appsRes.data?.find(a => a.user_id === driver.driver_id);

        return {
          ...driver,
          stats: {
            totalDeliveries: driverOrders.length,
            completedDeliveries,
            avgRating: Math.round(avgRating * 10) / 10,
            reviewCount: driverReviews.length,
          },
          vehicle: app ? {
            vehicle_type: app.vehicle_type,
            vehicle_brand: app.vehicle_brand,
            vehicle_model: app.vehicle_model,
            license_plate: app.license_plate,
            city: app.city,
          } : undefined,
        };
      });

      setDrivers(enriched);
      setEnriching(false);
    };

    enrichDrivers();
  }, [rawDrivers]);

  useDriverLocationsRealtime(() => {
    refetch();
    setLastRefresh(new Date());
  });

  const handleRefresh = () => {
    getCurrentPosition();
    refetch();
    setLastRefresh(new Date());
    toast.success("Liste actualisée");
  };

  const handleSelectDriver = async (driverId: string) => {
    if (onSelectDriver) {
      onSelectDriver(driverId);
    }

    if (orderId) {
      setAssigning(driverId);
      try {
        const { data, error } = await supabase.rpc("assign_driver_to_order" as any, {
          p_order_id: orderId,
          p_driver_id: driverId,
        });
        if (error) throw error;
        const result = data as any;
        if (!result?.success) throw new Error(result?.error || "Erreur inconnue");

        toast.success("Livreur assigné et notifié !");
      } catch (err: any) {
        toast.error(err.message || "Erreur lors de l'assignation du livreur");
      } finally {
        setAssigning(null);
      }
      return;
    }

    if (!onSelectDriver) {
      toast.info("Sélectionnez une commande d'abord pour assigner un livreur");
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`h-3 w-3 ${i < Math.round(rating) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
    ));
  };

  if (error && !position) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Livreurs à proximité</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground mb-2">{error}</p>
            <Button onClick={getCurrentPosition} disabled={posLoading}>
              {posLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MapPin className="h-4 w-4 mr-2" />}
              Réessayer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!position && !posLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Livreurs à proximité</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">Activez votre position pour voir les livreurs proches</p>
            <Button onClick={getCurrentPosition} disabled={posLoading}>
              {posLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Activer la position
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><Truck className="h-5 w-5" /> Livreurs à proximité</span>
            <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </CardTitle>
          <CardDescription className="flex items-center justify-between">
            <span>Dans un rayon de 15 km</span>
            <span className="text-xs">Actualisé: {lastRefresh.toLocaleTimeString()}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Map toggle */}
          <div className="flex items-center justify-between mb-3">
            <Button
              variant={showMap ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => setShowMap(!showMap)}
            >
              <Map className="h-4 w-4" />
              {showMap ? "Masquer la carte" : "Voir sur la carte"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {drivers.length} livreur{drivers.length !== 1 ? "s" : ""} en ligne
            </span>
          </div>

          {/* OpenStreetMap with drivers */}
          {showMap && position && (
            <div className="mb-4">
              <OpenStreetMap
                center={{ lat: position.latitude, lng: position.longitude }}
                zoom={13}
                showUserLocation
                userPosition={{ lat: position.latitude, lng: position.longitude }}
                markers={drivers.map((d) => ({
                  lat: d.latitude,
                  lng: d.longitude,
                  color: selectedDriverId === d.driver_id ? "green" as const : "orange" as const,
                  popup: `🛵 ${d.profile?.full_name || "Livreur"} — ${d.distance_km.toFixed(1)} km${d.stats ? ` • ${d.stats.completedDeliveries} livrées` : ""}`,
                }))}
                className="h-[280px] w-full rounded-lg border"
              />
            </div>
          )}

          {queryError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Erreur lors de la recherche. Veuillez réessayer.</AlertDescription>
            </Alert>
          )}

          {isLoading || posLoading || enriching ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1"><Skeleton className="h-4 w-24 mb-1" /><Skeleton className="h-3 w-16" /></div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : drivers.length > 0 ? (
            <div className="space-y-3">
              {drivers.map((driver) => (
                <div
                  key={driver.driver_id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                    selectedDriverId === driver.driver_id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedProfile(driver)}
                >
                  <Avatar>
                    <AvatarFallback>{driver.profile?.full_name?.charAt(0) || "L"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{driver.profile?.full_name || "Livreur"}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Navigation className="h-3 w-3" />
                      <span>{driver.distance_km.toFixed(1)} km</span>
                      <span>•</span>
                      <Clock className="h-3 w-3" />
                      <span>~{estimateDeliveryTime(
                        driver.latitude, driver.longitude,
                        position!.latitude, position!.longitude,
                        driver.vehicle?.vehicle_type
                      ).label}</span>
                      {driver.stats && driver.stats.completedDeliveries > 0 && (
                        <>
                          <span>•</span>
                          <Package className="h-3 w-3" />
                          <span>{driver.stats.completedDeliveries} livrées</span>
                        </>
                      )}
                    </div>
                    {driver.stats && driver.stats.reviewCount > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        {renderStars(driver.stats.avgRating)}
                        <span className="text-xs text-muted-foreground ml-1">({driver.stats.reviewCount})</span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant={selectedDriverId === driver.driver_id ? "default" : "outline"}
                    size="sm"
                    disabled={assigning === driver.driver_id}
                    onClick={(e) => { e.stopPropagation(); handleSelectDriver(driver.driver_id); }}
                  >
                    {assigning === driver.driver_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : selectedDriverId === driver.driver_id ? (
                      <><CheckCircle className="h-3 w-3 mr-1" /> Sélectionné</>
                    ) : (
                      "Choisir"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Aucun livreur disponible</p>
              <p className="text-sm text-muted-foreground mt-1">Réessayez dans quelques minutes</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" /> Actualiser
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Driver Profile Dialog */}
      <Dialog open={!!selectedProfile} onOpenChange={() => setSelectedProfile(null)}>
        <DialogContent className="max-w-md">
          {selectedProfile && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="text-lg">{selectedProfile.profile?.full_name?.charAt(0) || "L"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p>{selectedProfile.profile?.full_name || "Livreur"}</p>
                    <p className="text-sm font-normal text-muted-foreground flex items-center gap-1">
                      <Navigation className="h-3 w-3" /> {selectedProfile.distance_km.toFixed(1)} km de vous
                    </p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Rating */}
                <div className="flex items-center justify-center gap-2 py-3 bg-muted/50 rounded-lg">
                  {selectedProfile.stats && selectedProfile.stats.reviewCount > 0 ? (
                    <>
                      <div className="flex">{renderStars(selectedProfile.stats.avgRating)}</div>
                      <span className="font-bold">{selectedProfile.stats.avgRating}</span>
                      <span className="text-sm text-muted-foreground">({selectedProfile.stats.reviewCount} avis)</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Pas encore d'avis</span>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg border">
                    <p className="text-2xl font-bold">{selectedProfile.stats?.totalDeliveries || 0}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="p-3 rounded-lg border">
                    <p className="text-2xl font-bold text-green-600">{selectedProfile.stats?.completedDeliveries || 0}</p>
                    <p className="text-xs text-muted-foreground">Complétées</p>
                  </div>
                  <div className="p-3 rounded-lg border">
                    <p className="text-2xl font-bold">{selectedProfile.stats ? Math.round((selectedProfile.stats.completedDeliveries / Math.max(selectedProfile.stats.totalDeliveries, 1)) * 100) : 0}%</p>
                    <p className="text-xs text-muted-foreground">Succès</p>
                  </div>
                </div>

                <Separator />

                {/* Vehicle Info */}
                {selectedProfile.vehicle && (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2"><Truck className="h-4 w-4" /> Véhicule</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="p-2 rounded border">
                        <p className="text-muted-foreground text-xs">Type</p>
                        <p className="font-medium capitalize">{selectedProfile.vehicle.vehicle_type}</p>
                      </div>
                      <div className="p-2 rounded border">
                        <p className="text-muted-foreground text-xs">Marque</p>
                        <p className="font-medium">{selectedProfile.vehicle.vehicle_brand} {selectedProfile.vehicle.vehicle_model || ""}</p>
                      </div>
                      <div className="p-2 rounded border">
                        <p className="text-muted-foreground text-xs">Plaque</p>
                        <p className="font-medium">{selectedProfile.vehicle.license_plate}</p>
                      </div>
                      <div className="p-2 rounded border">
                        <p className="text-muted-foreground text-xs">Ville</p>
                        <p className="font-medium">{selectedProfile.vehicle.city}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {selectedProfile.profile?.phone && (
                    <Button variant="outline" className="flex-1 gap-2" asChild>
                      <a href={`tel:${selectedProfile.profile.phone}`}>
                        <Phone className="h-4 w-4" /> Appeler
                      </a>
                    </Button>
                  )}
                  <Button
                    className="flex-1 gap-2"
                    disabled={assigning === selectedProfile.driver_id}
                    onClick={() => {
                      handleSelectDriver(selectedProfile.driver_id);
                      setSelectedProfile(null);
                    }}
                  >
                    {assigning === selectedProfile.driver_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <><CheckCircle className="h-4 w-4" /> Choisir ce livreur</>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
