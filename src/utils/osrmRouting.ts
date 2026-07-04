// OSRM (Open Source Routing Machine) — free public routing.
// No account, no API key. Usage policy: reasonable rate + client-side cache.
// https://router.project-osrm.org

import { calculateDistance } from "@/hooks/useGeolocation";

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface OsrmRoute {
  coordinates: Array<{ lat: number; lng: number }>;
  distanceKm: number;
  durationMin: number;
  isFallback: boolean;
}

// In-memory cache keyed by rounded coordinates
const cache = new Map<string, { route: OsrmRoute; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 min

function cacheKey(from: RoutePoint, to: RoutePoint) {
  const r = (n: number) => n.toFixed(4);
  return `${r(from.lat)},${r(from.lng)}|${r(to.lat)},${r(to.lng)}`;
}

function haversineFallback(from: RoutePoint, to: RoutePoint): OsrmRoute {
  const km = calculateDistance(from.lat, from.lng, to.lat, to.lng);
  // Assume ~30 km/h urban avg → 2 min per km
  return {
    coordinates: [from, to],
    distanceKm: km,
    durationMin: Math.max(1, Math.round(km * 2)),
    isFallback: true,
  };
}

/**
 * Fetch a driving route between two points.
 * Falls back to straight line + Haversine if OSRM is unavailable.
 */
export async function getRoute(from: RoutePoint, to: RoutePoint): Promise<OsrmRoute> {
  if (!from || !to) return haversineFallback(from, to);

  const key = cacheKey(from, to);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.route;
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json();

    const route = data?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) throw new Error("No route");

    const coordinates = (route.geometry.coordinates as Array<[number, number]>).map(
      ([lng, lat]) => ({ lat, lng })
    );

    const result: OsrmRoute = {
      coordinates,
      distanceKm: route.distance / 1000,
      durationMin: Math.max(1, Math.round(route.duration / 60)),
      isFallback: false,
    };

    cache.set(key, { route: result, ts: Date.now() });
    return result;
  } catch (err) {
    // Silent fallback — never break the UI
    return haversineFallback(from, to);
  }
}

/**
 * Chain multiple points: A → B → C → D
 * Fetches each leg in parallel, aggregates distance and duration.
 */
export async function getMultiLegRoute(points: RoutePoint[]): Promise<OsrmRoute> {
  if (points.length < 2) {
    return { coordinates: points, distanceKm: 0, durationMin: 0, isFallback: true };
  }

  const legs: Array<[RoutePoint, RoutePoint]> = [];
  for (let i = 0; i < points.length - 1; i++) {
    legs.push([points[i], points[i + 1]]);
  }

  const routes = await Promise.all(legs.map(([a, b]) => getRoute(a, b)));

  const coordinates: RoutePoint[] = [];
  let distanceKm = 0;
  let durationMin = 0;
  let isFallback = false;

  routes.forEach((r, idx) => {
    if (idx === 0) coordinates.push(...r.coordinates);
    else coordinates.push(...r.coordinates.slice(1));
    distanceKm += r.distanceKm;
    durationMin += r.durationMin;
    if (r.isFallback) isFallback = true;
  });

  return { coordinates, distanceKm, durationMin, isFallback };
}
