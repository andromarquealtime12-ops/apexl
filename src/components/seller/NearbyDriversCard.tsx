import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  MapPin, Loader2, Users, Navigation, Phone,
  RefreshCw, Truck, AlertTriangle, CheckCircle
} from "lucide-react";
import { 
  useCurrentPosition, 
  useNearbyDrivers,
  useDriverLocationsRealtime
} from "@/hooks/useGeolocation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NearbyDriversCardProps {
  onSelectDriver?: (driverId: string) => void;
  selectedDriverId?: string;
  orderId?: string;
}

export function NearbyDriversCard({ onSelectDriver, selectedDriverId, orderId }: NearbyDriversCardProps) {
  const { position, error, loading: posLoading, getCurrentPosition } = useCurrentPosition();
  const { data: drivers, isLoading, error: queryError, refetch } = useNearbyDrivers(position, 15);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [assigning, setAssigning] = useState<string | null>(null);

  // Get position on mount
  useEffect(() => {
    getCurrentPosition();
  }, []);

  // Real-time updates
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
      toast.success("Livreur sélectionné");
      return;
    }

    // If orderId provided, assign driver to order directly
    if (orderId) {
      setAssigning(driverId);
      try {
        const { error } = await supabase
          .from("orders")
          .update({ driver_id: driverId, status: "ready_for_pickup", updated_at: new Date().toISOString() })
          .eq("id", orderId);
        
        if (error) throw error;
        toast.success("Livreur assigné à la commande !");
      } catch (err) {
        toast.error("Erreur lors de l'assignation du livreur");
      } finally {
        setAssigning(null);
      }
      return;
    }

    toast.info("Sélectionnez une commande d'abord pour assigner un livreur");
  };

  if (error && !position) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Livreurs à proximité
          </CardTitle>
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
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Livreurs à proximité
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">
              Activez votre position pour voir les livreurs proches
            </p>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Livreurs à proximité
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
        <CardDescription className="flex items-center justify-between">
          <span>Dans un rayon de 15 km</span>
          <span className="text-xs">
            Actualisé: {lastRefresh.toLocaleTimeString()}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {queryError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Erreur lors de la recherche. Veuillez réessayer.</AlertDescription>
          </Alert>
        )}

        {isLoading || posLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        ) : drivers && drivers.length > 0 ? (
          <div className="space-y-3">
            {drivers.map((driver) => (
              <div
                key={driver.driver_id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  selectedDriverId === driver.driver_id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <Avatar>
                  <AvatarFallback>
                    {driver.profile?.full_name?.charAt(0) || "L"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {driver.profile?.full_name || "Livreur"}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Navigation className="h-3 w-3" />
                    <span>{driver.distance_km.toFixed(1)} km</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {driver.profile?.phone && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={`tel:${driver.profile.phone}`}>
                        <Phone className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant={selectedDriverId === driver.driver_id ? "default" : "outline"}
                    size="sm"
                    disabled={assigning === driver.driver_id}
                    onClick={() => handleSelectDriver(driver.driver_id)}
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
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Aucun livreur disponible</p>
            <p className="text-sm text-muted-foreground mt-1">
              Réessayez dans quelques minutes
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={handleRefresh}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
