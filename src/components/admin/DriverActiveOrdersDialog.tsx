import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, User, Store, MapPin, Phone, Package } from "lucide-react";

interface Props {
  driverId: string | null;
  driverName?: string;
  onClose: () => void;
}

interface ProfileLite {
  user_id: string;
  full_name: string | null;
  phone: string | null;
}

interface ActiveOrder {
  id: string;
  status: string;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  buyer_latitude: number | null;
  buyer_longitude: number | null;
  buyer: ProfileLite | null;
  sellers: Array<ProfileLite & { shop_name?: string | null; shop_address?: string | null; latitude?: number | null; longitude?: number | null }>;
}

export default function DriverActiveOrdersDialog({ driverId, driverName, onClose }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["driver-active-orders", driverId],
    enabled: !!driverId,
    queryFn: async (): Promise<{ driver: ProfileLite | null; orders: ActiveOrder[] }> => {
      if (!driverId) return { driver: null, orders: [] };

      const driverProfileRes = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .eq("user_id", driverId)
        .maybeSingle();

      const { data: orders } = await supabase
        .from("orders")
        .select("id, status, delivery_address, delivery_city, delivery_lat, delivery_lng, buyer_latitude, buyer_longitude, buyer_id")
        .eq("driver_id", driverId)
        .in("status", ["ready_for_pickup", "picked_up", "in_transit"])
        .order("created_at", { ascending: false });

      const orderList = orders ?? [];
      if (!orderList.length) return { driver: driverProfileRes.data ?? null, orders: [] };

      const orderIds = orderList.map((o: any) => o.id);
      const buyerIds = [...new Set(orderList.map((o: any) => o.buyer_id).filter(Boolean))];

      const [itemsRes, buyersRes] = await Promise.all([
        supabase.from("order_items").select("order_id, seller_id").in("order_id", orderIds),
        buyerIds.length
          ? supabase.from("profiles").select("user_id, full_name, phone").in("user_id", buyerIds)
          : Promise.resolve({ data: [] as ProfileLite[] }),
      ]);

      const items = (itemsRes.data ?? []) as Array<{ order_id: string; seller_id: string | null }>;
      const sellerIds = [...new Set(items.map((i) => i.seller_id).filter(Boolean) as string[])];

      const [sellerProfilesRes, shopsRes] = await Promise.all([
        sellerIds.length
          ? supabase.from("profiles").select("user_id, full_name, phone").in("user_id", sellerIds)
          : Promise.resolve({ data: [] as ProfileLite[] }),
        sellerIds.length
          ? (supabase as any).rpc("get_public_seller_shops", { p_user_id: null })
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const sellerProfiles = (sellerProfilesRes.data ?? []) as ProfileLite[];
      const shops = ((shopsRes.data as any[]) ?? []).filter((s: any) => sellerIds.includes(s.user_id));
      const buyers = (buyersRes.data ?? []) as ProfileLite[];

      const enriched: ActiveOrder[] = orderList.map((o: any) => {
        const orderSellerIds = [...new Set(items.filter((i) => i.order_id === o.id).map((i) => i.seller_id).filter(Boolean) as string[])];
        const sellers = orderSellerIds.map((sid) => {
          const p = sellerProfiles.find((x) => x.user_id === sid);
          const shop = shops.find((s: any) => s.user_id === sid);
          return {
            user_id: sid,
            full_name: p?.full_name ?? null,
            phone: p?.phone ?? null,
            shop_name: shop?.shop_name ?? null,
            shop_address: shop?.shop_address ?? null,
            latitude: shop?.latitude ?? null,
            longitude: shop?.longitude ?? null,
          };
        });
        return {
          id: o.id,
          status: o.status,
          delivery_address: o.delivery_address,
          delivery_city: o.delivery_city,
          delivery_lat: o.delivery_lat,
          delivery_lng: o.delivery_lng,
          buyer_latitude: o.buyer_latitude,
          buyer_longitude: o.buyer_longitude,
          buyer: buyers.find((b) => b.user_id === o.buyer_id) ?? null,
          sellers,
        };
      });

      return { driver: driverProfileRes.data ?? null, orders: enriched };
    },
  });

  const open = !!driverId;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[720px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            {data?.driver?.full_name || driverName || "Livreur"}
          </DialogTitle>
          <DialogDescription>
            Livraisons en cours et profils des utilisateurs concernés
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Driver profile */}
            <Card>
              <CardContent className="pt-4 space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Truck className="h-4 w-4 text-primary" /> Livreur
                </div>
                <p className="text-sm">{data?.driver?.full_name || "—"}</p>
                {data?.driver?.phone && (
                  <a href={`tel:${data.driver.phone}`} className="text-xs text-primary flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {data.driver.phone}
                  </a>
                )}
              </CardContent>
            </Card>

            {!data?.orders.length && (
              <p className="text-center text-sm text-muted-foreground py-6">
                Ce livreur n'a aucune livraison en cours.
              </p>
            )}

            {data?.orders.map((o) => (
              <Card key={o.id} className="border-primary/20">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Package className="h-4 w-4" />
                      Commande #{o.id.slice(0, 8)}
                    </div>
                    <Badge variant="outline">{o.status}</Badge>
                  </div>

                  {/* Buyer */}
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <div className="flex items-center gap-2 text-xs font-semibold mb-1">
                      <User className="h-3 w-3" /> Acheteur
                    </div>
                    <p className="text-sm">{o.buyer?.full_name || "—"}</p>
                    {o.buyer?.phone ? (
                      <a href={`tel:${o.buyer.phone}`} className="text-xs text-primary flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {o.buyer.phone}
                      </a>
                    ) : (
                      <p className="text-xs text-destructive">Aucun téléphone fourni</p>
                    )}
                    <div className="flex items-start gap-1 text-xs text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3 mt-0.5" />
                      <span>
                        <strong>Livraison :</strong> {o.delivery_address || "—"}
                        {o.delivery_city ? `, ${o.delivery_city}` : ""}
                        {o.delivery_lat != null && o.delivery_lng != null && (
                          <span className="block opacity-70">
                            {o.delivery_lat.toFixed(4)}, {o.delivery_lng.toFixed(4)}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Sellers */}
                  {o.sellers.map((s) => (
                    <div key={s.user_id} className="rounded-lg border p-3">
                      <div className="flex items-center gap-2 text-xs font-semibold mb-1">
                        <Store className="h-3 w-3" /> Vendeur
                      </div>
                      <p className="text-sm">
                        {s.shop_name || s.full_name || "—"}
                        {s.shop_name && s.full_name && (
                          <span className="text-xs text-muted-foreground"> — {s.full_name}</span>
                        )}
                      </p>
                      {s.phone && (
                        <a href={`tel:${s.phone}`} className="text-xs text-primary flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {s.phone}
                        </a>
                      )}
                      <div className="flex items-start gap-1 text-xs text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3 mt-0.5" />
                        <span>
                          <strong>Point de récupération :</strong> {s.shop_address || "—"}
                          {s.latitude != null && s.longitude != null && (
                            <span className="block opacity-70">
                              {Number(s.latitude).toFixed(4)}, {Number(s.longitude).toFixed(4)}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
