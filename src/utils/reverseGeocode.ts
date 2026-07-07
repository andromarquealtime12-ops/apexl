// Nominatim reverse geocoding (lat/lng → address)
// Free — respect fair-use: cache in memory + 1s min throttle.

export interface ReverseGeocodeResult {
  address: string;      // formatted full display name
  street?: string;      // road + house number
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  countryCode?: string; // ISO 3166-1 alpha-2 upper case
}

const cache = new Map<string, ReverseGeocodeResult>();
let lastCall = 0;

function key(lat: number, lng: number) {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult | null> {
  const k = key(lat, lng);
  if (cache.has(k)) return cache.get(k)!;

  // Throttle: Nominatim asks for max 1 req/s.
  const now = Date.now();
  const wait = Math.max(0, 1000 - (now - lastCall));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "json");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("zoom", "18");

    const res = await fetch(url.toString(), {
      headers: { "Accept-Language": "fr" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.error) return null;

    const a = data.address || {};
    const street = [a.house_number, a.road].filter(Boolean).join(" ") || undefined;
    const result: ReverseGeocodeResult = {
      address: data.display_name || "",
      street,
      city: a.city || a.town || a.village || a.municipality || a.county,
      state: a.state,
      postcode: a.postcode,
      country: a.country,
      countryCode: (a.country_code || "").toUpperCase() || undefined,
    };
    cache.set(k, result);
    return result;
  } catch {
    return null;
  }
}
