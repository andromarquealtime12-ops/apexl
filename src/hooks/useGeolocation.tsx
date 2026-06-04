import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface GeolocationPosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number | null;
}

interface NearbyDriver {
  driver_id: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  updated_at: string;
  profile?: {
    full_name: string;
    phone?: string;
  };
}

// Continuous watch-based position tracking
export function useWatchPosition() {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas supportée par votre navigateur");
      return;
    }

    if (watchIdRef.current !== null) return; // Already watching

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
        });
        setError(null);
      },
      (err) => {
        setError(
          err.code === 1
            ? "Veuillez autoriser l'accès à votre position"
            : "Impossible d'obtenir votre position"
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    setIsWatching(true);
  }, []);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { position, error, isWatching, startWatching, stopWatching };
}

// One-shot position (kept for backward compat)
export function useCurrentPosition() {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getCurrentPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas supportée par votre navigateur");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(
          err.code === 1
            ? "Veuillez autoriser l'accès à votre position"
            : "Impossible d'obtenir votre position"
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  return { position, error, loading, getCurrentPosition };
}

export function useUpdateDriverLocation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (position: GeolocationPosition) => {
      if (!user) throw new Error("Not authenticated");

      const { data: existing } = await supabase
        .from("driver_locations")
        .select("id")
        .eq("driver_id", user.id)
        .maybeSingle();

      const payload = {
        latitude: position.latitude,
        longitude: position.longitude,
        is_online: true,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await supabase
          .from("driver_locations")
          .update(payload)
          .eq("driver_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("driver_locations")
          .insert({ driver_id: user.id, ...payload });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-location"] });
    },
  });
}

export function useSetDriverOnlineStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ isOnline, latitude, longitude }: { isOnline: boolean; latitude?: number; longitude?: number }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: existing } = await supabase
        .from("driver_locations")
        .select("id")
        .eq("driver_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("driver_locations")
          .update({
            is_online: isOnline,
            updated_at: new Date().toISOString(),
            ...(latitude !== undefined && longitude !== undefined ? { latitude, longitude } : {}),
          })
          .eq("driver_id", user.id);
        if (error) throw error;
      } else if (latitude !== undefined && longitude !== undefined) {
        const { error } = await supabase
          .from("driver_locations")
          .insert({
            driver_id: user.id,
            latitude,
            longitude,
            is_online: isOnline,
            updated_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
    },
    onSuccess: (_, { isOnline }) => {
      queryClient.invalidateQueries({ queryKey: ["driver-location"] });
      toast.success(isOnline ? "Vous êtes maintenant en ligne" : "Vous êtes hors ligne");
    },
  });
}

export function useNearbyDrivers(position: GeolocationPosition | null, radiusKm: number = 10) {
  return useQuery({
    queryKey: ["nearby-drivers", position?.latitude, position?.longitude, radiusKm],
    queryFn: async () => {
      if (!position) return [];

      const { data, error } = await supabase
        .from("driver_locations")
        .select("driver_id, latitude, longitude, updated_at")
        .eq("is_online", true);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const driversWithDistance = data
        .map((driver) => ({
          ...driver,
          distance_km: calculateDistance(
            position.latitude, position.longitude,
            driver.latitude, driver.longitude
          ),
        }))
        .filter((d) => d.distance_km <= radiusKm)
        .sort((a, b) => a.distance_km - b.distance_km);

      if (driversWithDistance.length > 0) {
        const driverIds = driversWithDistance.map((d) => d.driver_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", driverIds);

        return driversWithDistance.map((driver) => ({
          ...driver,
          profile: profiles?.find((p) => p.user_id === driver.driver_id),
        })) as NearbyDriver[];
      }

      return [] as NearbyDriver[];
    },
    enabled: !!position,
    refetchInterval: 30000,
  });
}

export function useDriverLocation() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["driver-location", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("driver_locations")
        .select("*")
        .eq("driver_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useUpdateProfileLocation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (position: GeolocationPosition) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("profiles")
        .update({ latitude: position.latitude, longitude: position.longitude })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Position enregistrée");
    },
  });
}

export function useDriverLocationsRealtime(onUpdate: (payload: any) => void) {
  useEffect(() => {
    const channel = supabase
      .channel("driver-locations-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations" }, onUpdate)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [onUpdate]);
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
