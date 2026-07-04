import { calculateDistance } from "@/hooks/useGeolocation";

export interface DeliveryZone {
  id: string;
  name: string;
  country: string;
  city: string | null;
  center_lat: number | null;
  center_lng: number | null;
  radius_km: number;
  base_fee: number;
  fee_per_km: number;
  currency: string;
  active: boolean;
}

// Global fallback if no matching zone (kept in sync with legacy behaviour)
const FALLBACK_ZONE: DeliveryZone = {
  id: "__fallback",
  name: "Standard",
  country: "DO",
  city: null,
  center_lat: null,
  center_lng: null,
  radius_km: 999,
  base_fee: 50,
  fee_per_km: 30,
  currency: "DOP",
  active: true,
};

/**
 * Pick the best zone for a GPS point. Preference:
 * 1. Point inside a zone's radius (smallest matching radius wins)
 * 2. Nearest zone center overall
 * 3. Fallback zone
 */
export function getZoneForPoint(
  lat: number | null | undefined,
  lng: number | null | undefined,
  zones: DeliveryZone[] | undefined | null
): DeliveryZone {
  const active = (zones || []).filter((z) => z.active);
  if (!active.length || lat == null || lng == null) return FALLBACK_ZONE;

  const withDist = active
    .filter((z) => z.center_lat != null && z.center_lng != null)
    .map((z) => ({
      zone: z,
      distance: calculateDistance(lat, lng, z.center_lat!, z.center_lng!),
    }));

  if (!withDist.length) return active[0] ?? FALLBACK_ZONE;

  const inside = withDist
    .filter((x) => x.distance <= Number(x.zone.radius_km))
    .sort((a, b) => Number(a.zone.radius_km) - Number(b.zone.radius_km));
  if (inside.length) return inside[0].zone;

  withDist.sort((a, b) => a.distance - b.distance);
  return withDist[0].zone;
}

/**
 * Compute delivery fee for a given distance and zone.
 * Formula: base_fee + distance_km * fee_per_km (minimum = base_fee)
 */
export function calculateFee(distanceKm: number, zone: DeliveryZone): number {
  const raw = Number(zone.base_fee) + distanceKm * Number(zone.fee_per_km);
  return Math.max(Number(zone.base_fee), Math.round(raw));
}
