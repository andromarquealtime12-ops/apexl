import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { MapPin, CheckCircle } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useUpdateProfileLocation } from "@/hooks/useGeolocation";
import { GpsAddressField } from "@/components/ui/GpsAddressField";

export function LocationCard() {
  const { data: profile } = useProfile();
  const updateLocation = useUpdateProfileLocation();
  const [addressQuery, setAddressQuery] = useState("");
  const [lat, setLat] = useState<number | null>(profile?.latitude ?? null);
  const [lng, setLng] = useState<number | null>(profile?.longitude ?? null);

  useEffect(() => {
    setLat(profile?.latitude ?? null);
    setLng(profile?.longitude ?? null);
  }, [profile?.latitude, profile?.longitude]);

  const hasLocation = lat != null && lng != null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Ma Position
        </CardTitle>
        <CardDescription>
          Activez « Ma position » pour auto-remplir votre adresse via OpenStreetMap, ou saisissez
          une adresse précise. Sert au calcul exact des frais de livraison.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasLocation && (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div className="flex-1">
              <p className="font-medium text-green-700 dark:text-green-400">
                Position enregistrée
              </p>
              <p className="text-xs text-green-600 dark:text-green-500 font-mono">
                {lat!.toFixed(6)}, {lng!.toFixed(6)}
              </p>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-600">
              Active
            </Badge>
          </div>
        )}

        <div className="space-y-2">
          <Label>Adresse principale</Label>
          <GpsAddressField
            value={addressQuery}
            onChange={setAddressQuery}
            coords={{ lat, lng }}
            onCoords={(la, lo) => {
              setLat(la);
              setLng(lo);
              updateLocation.mutate({ latitude: la, longitude: lo });
            }}
            placeholder="Ex: 123 Av. Winston Churchill, Santo Domingo…"
          />
        </div>
      </CardContent>
    </Card>
  );
}

