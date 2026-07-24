// Detects the user's ISO country code (e.g. "DO", "HT", "US") using:
//   1. Persisted GPS position → Nominatim reverse-geocode (cached 24h)
//   2. Profile.country as a fallback
//   3. Navigator locale as a last resort
//
// Powers country-first product/restaurant/shop ordering.

import { useEffect, useState } from "react";
import { getLastPosition } from "./persistentLocation";
import { reverseGeocode } from "./reverseGeocode";
import { useProfile } from "@/hooks/useProfile";

const STORAGE_KEY = "ma_user_country_v1";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 h

interface Cached {
  code: string;
  savedAt: number;
}

function readCache(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached;
    if (Date.now() - parsed.savedAt > TTL_MS) return null;
    return parsed.code;
  } catch {
    return null;
  }
}

function writeCache(code: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, savedAt: Date.now() } as Cached));
  } catch {}
}

function guessFromNavigator(): string | null {
  if (typeof navigator === "undefined") return null;
  const lang = (navigator.language || "").toUpperCase();
  const match = lang.match(/-([A-Z]{2})/);
  return match?.[1] ?? null;
}

/**
 * React hook: returns the user's best-known ISO country code.
 * Priority: GPS reverse-geocode > profile.country > navigator locale > "DO".
 */
export function useUserCountry(): string {
  const { data: profile } = useProfile();
  const [country, setCountry] = useState<string>(() =>
    readCache() ?? profile?.country ?? guessFromNavigator() ?? "DO"
  );

  // Refresh from profile as soon as it loads
  useEffect(() => {
    if (profile?.country && !readCache()) {
      setCountry(profile.country);
    }
  }, [profile?.country]);

  // Try GPS-based detection (best precision) — runs once per session
  useEffect(() => {
    if (readCache()) return;
    const pos = getLastPosition();
    if (!pos) return;
    let cancelled = false;
    (async () => {
      const r = await reverseGeocode(pos.latitude, pos.longitude);
      if (cancelled) return;
      if (r?.countryCode) {
        writeCache(r.countryCode);
        setCountry(r.countryCode);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return country;
}

/**
 * Two-key comparator: local country first, then by numeric `_distance`.
 * Attach `_distance` (km) yourself; missing / non-local items fall to the end.
 */
export function compareByLocalThenDistance<T extends { seller_country?: string | null; _distance?: number }>(
  userCountry: string
) {
  return (a: T, b: T) => {
    const al = a.seller_country === userCountry ? 0 : 1;
    const bl = b.seller_country === userCountry ? 0 : 1;
    if (al !== bl) return al - bl;
    const ad = a._distance ?? Infinity;
    const bd = b._distance ?? Infinity;
    return ad - bd;
  };
}
