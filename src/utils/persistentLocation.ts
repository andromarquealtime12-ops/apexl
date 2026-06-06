// Persistent geolocation: keeps last known position in localStorage so the app
// can still display proximity-based content even after the device sleeps or
// the app is reopened without an immediate GPS lock.

const STORAGE_KEY = "ma_last_position_v1";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export interface PersistedPosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
  savedAt: number;
}

export function savePosition(lat: number, lng: number, accuracy?: number) {
  try {
    const payload: PersistedPosition = {
      latitude: lat,
      longitude: lng,
      accuracy,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

export function getLastPosition(): PersistedPosition | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPosition;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Request the current position, falling back to the last persisted one.
 * Always saves a fresh fix when it succeeds.
 */
export function getPositionOrLast(
  options: PositionOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
): Promise<PersistedPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      const last = getLastPosition();
      if (last) return resolve(last);
      return reject(new Error("Geolocation not supported"));
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        savePosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          savedAt: Date.now(),
        });
      },
      () => {
        const last = getLastPosition();
        if (last) return resolve(last);
        reject(new Error("Position unavailable"));
      },
      options
    );
  });
}

/** Start a long-lived watch that keeps localStorage up to date. */
export function startBackgroundWatch(): number | null {
  if (!("geolocation" in navigator)) return null;
  try {
    return navigator.geolocation.watchPosition(
      (pos) => savePosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );
  } catch {
    return null;
  }
}

export function stopBackgroundWatch(id: number | null) {
  if (id != null && "geolocation" in navigator) {
    try { navigator.geolocation.clearWatch(id); } catch {}
  }
}
