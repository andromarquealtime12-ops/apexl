import { calculateDistance } from "@/hooks/useGeolocation";

interface ETAResult {
  distanceKm: number;
  estimatedMinutes: number;
  label: string;
}

// Average speeds in km/h for different vehicle types
const VEHICLE_SPEEDS: Record<string, number> = {
  moto: 30,
  voiture: 25,
  velo: 15,
  scooter: 28,
  camion: 20,
  default: 25,
};

export function estimateDeliveryTime(
  driverLat: number,
  driverLng: number,
  destLat: number,
  destLng: number,
  vehicleType?: string
): ETAResult {
  const distanceKm = calculateDistance(driverLat, driverLng, destLat, destLng);
  
  // Add 20% for non-straight routes
  const adjustedDistance = distanceKm * 1.2;
  
  const speed = VEHICLE_SPEEDS[vehicleType?.toLowerCase() || "default"] || VEHICLE_SPEEDS.default;
  const estimatedMinutes = Math.max(Math.round((adjustedDistance / speed) * 60), 1);

  let label: string;
  if (estimatedMinutes < 1) {
    label = "< 1 min";
  } else if (estimatedMinutes <= 60) {
    label = `${estimatedMinutes} min`;
  } else {
    const hours = Math.floor(estimatedMinutes / 60);
    const mins = estimatedMinutes % 60;
    label = mins > 0 ? `${hours}h${mins}` : `${hours}h`;
  }

  return {
    distanceKm: Math.round(adjustedDistance * 10) / 10,
    estimatedMinutes,
    label,
  };
}
