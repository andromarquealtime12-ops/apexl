import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Loader2, CheckCircle, Navigation } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useCurrentPosition, useUpdateProfileLocation } from "@/hooks/useGeolocation";

export function LocationCard() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { position, error, loading, getCurrentPosition } = useCurrentPosition();
  const updateLocation = useUpdateProfileLocation();

  const hasLocation = profile?.latitude && profile?.longitude;

  const handleGetLocation = () => {
    getCurrentPosition();
  };

  useEffect(() => {
    if (position && !updateLocation.isPending) {
      updateLocation.mutate(position);
    }
  }, [position]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Ma Position
        </CardTitle>
        <CardDescription>
          Partagez votre position pour trouver des boutiques et livreurs proches
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasLocation ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div className="flex-1">
                <p className="font-medium text-green-700 dark:text-green-400">Position enregistrée</p>
                <p className="text-xs text-green-600 dark:text-green-500 font-mono">
                  {profile.latitude?.toFixed(6)}, {profile.longitude?.toFixed(6)}
                </p>
              </div>
              <Badge variant="outline" className="text-green-600 border-green-600">
                Active
              </Badge>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleGetLocation}
              disabled={loading || updateLocation.isPending}
            >
              {loading || updateLocation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Navigation className="h-4 w-4 mr-2" />
              )}
              Mettre à jour ma position
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-4 rounded-lg bg-muted border border-dashed">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Position non configurée</p>
                <p className="text-sm text-muted-foreground">
                  Activez la géolocalisation pour une meilleure expérience
                </p>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              className="w-full"
              onClick={handleGetLocation}
              disabled={loading || updateLocation.isPending}
            >
              {loading || updateLocation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <MapPin className="h-4 w-4 mr-2" />
              )}
              Activer ma position
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
