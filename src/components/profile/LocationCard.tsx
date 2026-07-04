import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2, CheckCircle, Navigation } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useCurrentPosition, useUpdateProfileLocation } from "@/hooks/useGeolocation";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { toast } from "sonner";

export function LocationCard() {
  const { data: profile } = useProfile();
  const { position, error, loading, getCurrentPosition } = useCurrentPosition();
  const updateLocation = useUpdateProfileLocation();
  const [addressQuery, setAddressQuery] = useState("");

  const hasLocation = profile?.latitude && profile?.longitude;

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
          Utilisez le GPS ou recherchez une adresse. Sert à trouver des boutiques et livreurs
          proches.
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
                {profile.latitude?.toFixed(6)}, {profile.longitude?.toFixed(6)}
              </p>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-600">
              Active
            </Badge>
          </div>
        )}

        <div className="space-y-2">
          <Label>Rechercher une adresse</Label>
          <AddressAutocomplete
            value={addressQuery}
            onChange={setAddressQuery}
            onSelect={(s) => {
              updateLocation.mutate({ latitude: s.lat, longitude: s.lng });
              toast.success(`Position définie sur ${s.address.split(",")[0]}`);
            }}
            placeholder="Ex: 123 Av. Winston Churchill, Santo Domingo…"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          variant={hasLocation ? "outline" : "default"}
          className="w-full"
          onClick={getCurrentPosition}
          disabled={loading || updateLocation.isPending}
        >
          {loading || updateLocation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Navigation className="h-4 w-4 mr-2" />
          )}
          {hasLocation ? "Utiliser ma position GPS actuelle" : "Activer ma position GPS"}
        </Button>
      </CardContent>
    </Card>
  );
}
