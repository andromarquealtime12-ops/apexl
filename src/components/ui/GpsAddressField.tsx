import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Navigation, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { AddressAutocomplete, AddressSuggestion } from "@/components/ui/address-autocomplete";
import { reverseGeocode } from "@/utils/reverseGeocode";

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Called with GPS coords whenever the user picks a suggestion OR uses GPS. */
  onCoords: (lat: number, lng: number) => void;
  onSelect?: (s: AddressSuggestion) => void;
  coords?: { lat: number | null; lng: number | null };
  placeholder?: string;
  countryCodes?: string;
  id?: string;
  disabled?: boolean;
}

/**
 * Unified address input:
 * - "Ma position" button: GPS + reverse-geocode → fills field & coords
 * - Manual typing: OpenStreetMap autocomplete → picking a suggestion sets coords precisely
 * - If the user types a custom address WITHOUT picking a suggestion, we warn
 *   that we can't guarantee GPS accuracy for delivery pricing.
 */
export function GpsAddressField({
  value,
  onChange,
  onCoords,
  onSelect,
  coords,
  placeholder,
  countryCodes = "do,ht",
  id,
  disabled,
}: Props) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [pickedFromList, setPickedFromList] = useState(false);
  const [pickedFromGps, setPickedFromGps] = useState(false);

  const handleGps = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Géolocalisation non supportée");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        onCoords(latitude, longitude);
        const rev = await reverseGeocode(latitude, longitude);
        if (rev?.address) {
          onChange(rev.address);
          if (onSelect) {
            onSelect({
              address: rev.address,
              lat: latitude,
              lng: longitude,
              city: rev.city,
              state: rev.state,
              postcode: rev.postcode,
              country: rev.country,
            });
          }
          setPickedFromGps(true);
          setPickedFromList(false);
          toast.success("Adresse trouvée via votre position ✓");
        } else {
          toast.warning("Position enregistrée. Précisez l'adresse manuellement.");
        }
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        toast.error(
          err.code === 1
            ? "Autorisez l'accès à votre position"
            : "Impossible d'obtenir votre position"
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [onChange, onCoords, onSelect]);

  const hasCoords = coords?.lat != null && coords?.lng != null;
  // User typed something but never picked a suggestion or GPS
  const typedButNoPickedCoords = value.length > 3 && !pickedFromList && !pickedFromGps;

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <AddressAutocomplete
            id={id}
            value={value}
            onChange={(v) => {
              onChange(v);
              if (pickedFromList || pickedFromGps) {
                setPickedFromList(false);
                setPickedFromGps(false);
              }
            }}
            onSelect={(s) => {
              onChange(s.address);
              onCoords(s.lat, s.lng);
              if (onSelect) onSelect(s);
              setPickedFromList(true);
              setPickedFromGps(false);
            }}
            placeholder={placeholder}
            countryCodes={countryCodes}
            disabled={disabled}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGps}
          disabled={gpsLoading || disabled}
          className="shrink-0 mt-0.5"
          aria-label="Utiliser ma position GPS"
        >
          {gpsLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
          <span className="ml-1 hidden sm:inline">Ma position</span>
        </Button>
      </div>

      {hasCoords && (pickedFromGps || pickedFromList) && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Position GPS exacte enregistrée ({coords!.lat!.toFixed(5)}, {coords!.lng!.toFixed(5)})
        </p>
      )}

      {typedButNoPickedCoords && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Adresse manuelle : choisissez une suggestion ou cliquez « Ma position » pour un calcul de frais précis.
        </p>
      )}
    </div>
  );
}
