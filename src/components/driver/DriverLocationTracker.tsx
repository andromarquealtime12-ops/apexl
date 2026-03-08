import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2, Radio, Navigation, Wifi, WifiOff, Gauge } from "lucide-react";
import { 
  useWatchPosition, 
  useUpdateDriverLocation, 
  useDriverLocation,
  useSetDriverOnlineStatus 
} from "@/hooks/useGeolocation";

export function DriverLocationTracker() {
  const { position, error, isWatching, startWatching, stopWatching } = useWatchPosition();
  const updateLocation = useUpdateDriverLocation();
  const setOnlineStatus = useSetDriverOnlineStatus();
  const { data: driverLocation } = useDriverLocation();

  const isOnline = driverLocation?.is_online ?? false;

  // Auto-update DB when position changes while online
  useEffect(() => {
    if (position && isOnline) {
      updateLocation.mutate(position);
    }
  }, [position, isOnline]);

  const handleToggleOnline = async (checked: boolean) => {
    if (checked) {
      startWatching();
    } else {
      stopWatching();
    }
    await setOnlineStatus.mutateAsync({ 
      isOnline: checked, 
      latitude: position?.latitude,
      longitude: position?.longitude 
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Suivi de position
          </span>
          <Badge 
            variant={isOnline ? "default" : "secondary"}
            className={isOnline ? "bg-green-500" : ""}
          >
            {isOnline ? (
              <>
                <Radio className="h-3 w-3 mr-1 animate-pulse" />
                En ligne
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 mr-1" />
                Hors ligne
              </>
            )}
          </Badge>
        </CardTitle>
        <CardDescription>
          Activez le suivi continu pour recevoir des livraisons à proximité
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-3">
            {isOnline ? (
              <Wifi className="h-5 w-5 text-green-500" />
            ) : (
              <WifiOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <Label htmlFor="online-toggle" className="font-medium cursor-pointer">
                Disponible pour livrer
              </Label>
              <p className="text-xs text-muted-foreground">
                {isOnline ? "Suivi GPS continu activé" : "Vous ne recevrez pas de demandes"}
              </p>
            </div>
          </div>
          <Switch
            id="online-toggle"
            checked={isOnline}
            onCheckedChange={handleToggleOnline}
            disabled={setOnlineStatus.isPending}
          />
        </div>

        {isOnline && position && (
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-green-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-green-700 dark:text-green-400">Position active</p>
                <p className="text-xs text-green-600 dark:text-green-500 font-mono">
                  {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
                </p>
                {position.accuracy && (
                  <p className="text-xs text-green-600 dark:text-green-500 flex items-center gap-1 mt-1">
                    <Gauge className="h-3 w-3" />
                    Précision: ±{Math.round(position.accuracy)}m
                    {position.speed != null && position.speed > 0 && (
                      <span className="ml-2">• Vitesse: {Math.round(position.speed * 3.6)} km/h</span>
                    )}
                  </p>
                )}
              </div>
              {isWatching && (
                <Badge variant="outline" className="text-green-600 border-green-600 animate-pulse">
                  <Radio className="h-3 w-3 mr-1" />
                  Live
                </Badge>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
