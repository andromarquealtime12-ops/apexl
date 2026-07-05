import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Radio, Truck, Users, MapPin, Timer } from "lucide-react";
import OpenStreetMap from "@/components/map/OpenStreetMap";
import { useDriverLocationsRealtime } from "@/hooks/useGeolocation";
import { useDeliveryZones } from "@/hooks/useDeliveryZones";
import { calculateDistance } from "@/hooks/useGeolocation";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface DriverLive {
  driver_id: string;
  latitude: number;
  longitude: number;
  is_online: boolean;
  updated_at: string;
  profile?: { full_name?: string; phone?: string };
  active_orders?: number;
}

export default function LiveDriversMap() {
  const [search, setSearch] = useState("");
  const [zoneId, setZoneId] = useState<string>("all");
  const [refreshMs, setRefreshMs] = useState<number>(30000);
  const [drivers, setDrivers] = useState<Record<string, DriverLive>>({});
  const { data: zones = [] } = useDeliveryZones(false);

  // Initial load: all online drivers + profiles + active-order counts
  const { data: initial, refetch } = useQuery({
    queryKey: ["admin-live-drivers"],
    queryFn: async (): Promise<DriverLive[]> => {
      const { data: locs, error } = await supabase
        .from("driver_locations")
        .select("driver_id, latitude, longitude, is_online, updated_at")
        .eq("is_online", true);
      if (error) throw error;
      const list = (locs ?? []) as DriverLive[];
      if (!list.length) return [];

      const ids = list.map((d) => d.driver_id);

      const [profilesRes, ordersRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, phone").in("user_id", ids),
        supabase
          .from("orders")
          .select("driver_id, status")
          .in("driver_id", ids)
          .in("status", ["ready_for_pickup", "picked_up", "in_transit"]),
      ]);

      const profiles = profilesRes.data ?? [];
      const orders = ordersRes.data ?? [];
      const activeCount: Record<string, number> = {};
      orders.forEach((o: any) => {
        activeCount[o.driver_id] = (activeCount[o.driver_id] ?? 0) + 1;
      });

      return list.map((d) => ({
        ...d,
        profile: profiles.find((p: any) => p.user_id === d.driver_id),
        active_orders: activeCount[d.driver_id] ?? 0,
      }));
    },
    refetchInterval: refreshMs > 0 ? refreshMs : false, // realtime does most work; this is a safety net
  });

  const activeZone = useMemo(
    () => zones.find((z) => z.id === zoneId) ?? null,
    [zones, zoneId]
  );

  useEffect(() => {
    if (initial) {
      const map: Record<string, DriverLive> = {};
      initial.forEach((d) => (map[d.driver_id] = d));
      setDrivers(map);
    }
  }, [initial]);

  // Realtime updates
  useDriverLocationsRealtime(
    useCallback((payload: any) => {
      const row = payload.new || payload.old;
      if (!row?.driver_id) return;

      if (payload.eventType === "DELETE" || row.is_online === false) {
        setDrivers((prev) => {
          const next = { ...prev };
          delete next[row.driver_id];
          return next;
        });
        return;
      }

      setDrivers((prev) => {
        const prevDriver = prev[row.driver_id];
        return {
          ...prev,
          [row.driver_id]: {
            ...(prevDriver ?? {}),
            driver_id: row.driver_id,
            latitude: row.latitude,
            longitude: row.longitude,
            is_online: row.is_online,
            updated_at: row.updated_at,
          } as DriverLive,
        };
      });

      // If new driver came online, refresh to get profile + orders
      if (payload.eventType === "INSERT") refetch();
    }, [refetch])
  );

  const list = useMemo(() => Object.values(drivers), [drivers]);
  const filtered = useMemo(
    () =>
      list.filter((d) =>
        !search.trim()
          ? true
          : (d.profile?.full_name ?? "").toLowerCase().includes(search.toLowerCase())
      ),
    [list, search]
  );

  const markers = filtered.map((d) => ({
    lat: d.latitude,
    lng: d.longitude,
    color: (d.active_orders && d.active_orders > 0 ? "orange" : "blue") as any,
    popup: `🛵 ${d.profile?.full_name || "Livreur"}${
      d.active_orders ? ` • ${d.active_orders} livraison${d.active_orders > 1 ? "s" : ""}` : ""
    }`,
  }));

  const center = markers.length
    ? { lat: markers[0].lat, lng: markers[0].lng }
    : { lat: 18.4861, lng: -69.9312 };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Livreurs en ligne — carte live
          <Badge className="bg-green-500 gap-1 ml-2">
            <Radio className="h-3 w-3 animate-pulse" /> Temps réel
          </Badge>
        </CardTitle>
        <CardDescription>
          Positions mises à jour automatiquement via Realtime. Orange = livreur avec livraison en
          cours.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Input
            placeholder="Rechercher un livreur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" /> {filtered.length} en ligne
          </Badge>
        </div>

        <OpenStreetMap
          center={center}
          zoom={12}
          markers={markers}
          className="h-[480px] w-full rounded-lg overflow-hidden"
        />

        <div className="space-y-2 max-h-64 overflow-auto">
          {filtered.map((d) => (
            <div
              key={d.driver_id}
              className="flex items-center gap-3 p-2 border rounded-lg text-sm"
            >
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                {d.profile?.full_name?.[0] ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">
                  {d.profile?.full_name || "Livreur inconnu"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}
                  {" • "}
                  {formatDistanceToNow(new Date(d.updated_at), {
                    locale: fr,
                    addSuffix: true,
                  })}
                </p>
              </div>
              {d.active_orders! > 0 && (
                <Badge className="bg-orange-500">
                  {d.active_orders} livraison{d.active_orders! > 1 ? "s" : ""}
                </Badge>
              )}
              {d.profile?.phone && (
                <a
                  href={`tel:${d.profile.phone}`}
                  className="text-xs text-primary hover:underline"
                >
                  {d.profile.phone}
                </a>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-6 text-sm">
              Aucun livreur en ligne
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
