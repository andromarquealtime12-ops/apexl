import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Truck, Radio, WifiOff, CheckCircle2, XCircle, PackageX, Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DriverRow {
  driver_id: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  identity_status: string | null;
  account_status: string | null;
  is_online: boolean;
  last_location_update: string | null;
  delivered_count: number;
  cancelled_count: number;
  in_progress_count: number;
  total_orders: number;
  earnings_dop: number;
  earnings_htg: number;
  earnings_usd: number;
}

interface ActiveOrder {
  id: string;
  status: string;
  total_amount: number;
  delivery_fee: number | null;
  currency: string | null;
  delivery_city: string | null;
}

function useDriverOverview() {
  return useQuery({
    queryKey: ["admin-driver-overview"],
    queryFn: async (): Promise<DriverRow[]> => {
      const { data, error } = await (supabase as any).rpc("admin_driver_overview");
      if (error) throw error;
      return (data ?? []) as DriverRow[];
    },
    refetchInterval: 30000,
  });
}

export default function AdminDriversManager() {
  const { data: drivers, isLoading } = useDriverOverview();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all");
  const [selected, setSelected] = useState<DriverRow | null>(null);

  const filtered = useMemo(() => {
    return (drivers ?? []).filter((d) => {
      if (filter === "online" && !d.is_online) return false;
      if (filter === "offline" && d.is_online) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (d.full_name ?? "").toLowerCase().includes(q) ||
        (d.phone ?? "").toLowerCase().includes(q) ||
        (d.city ?? "").toLowerCase().includes(q)
      );
    });
  }, [drivers, search, filter]);

  const onlineCount = (drivers ?? []).filter((d) => d.is_online).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Livreurs — performances
          <Badge className="bg-green-500 gap-1">
            <Radio className="h-3 w-3 animate-pulse" /> {onlineCount} en ligne
          </Badge>
          <Badge variant="secondary">{drivers?.length ?? 0} inscrits</Badge>
        </CardTitle>
        <CardDescription>
          Livraisons effectuées, annulées et prises mais non livrées. Vous pouvez annuler une
          livraison non remise et créditer une compensation au livreur.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label className="text-xs">Rechercher</Label>
            <Input
              placeholder="Nom, téléphone, ville…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {(["all", "online", "offline"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "Tous" : f === "online" ? "En ligne" : "Hors ligne"}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Aucun livreur trouvé</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Livreur</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-center">Livrées</TableHead>
                  <TableHead className="text-center">Annulées</TableHead>
                  <TableHead className="text-center">Prises non livrées</TableHead>
                  <TableHead className="text-right">Gains</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.driver_id}>
                    <TableCell>
                      <p className="font-medium">{d.full_name || "Livreur"}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.phone || "—"} {d.city ? `• ${d.city}` : ""}
                      </p>
                    </TableCell>
                    <TableCell>
                      {d.is_online ? (
                        <Badge className="bg-green-500 gap-1">
                          <Radio className="h-3 w-3" /> En ligne
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <WifiOff className="h-3 w-3" /> Hors ligne
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                        <CheckCircle2 className="h-4 w-4" /> {d.delivered_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 text-destructive font-medium">
                        <XCircle className="h-4 w-4" /> {d.cancelled_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 text-orange-500 font-medium">
                        <PackageX className="h-4 w-4" /> {d.in_progress_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {Number(d.earnings_dop || 0) > 0 && <div>RD$ {Number(d.earnings_dop).toLocaleString()}</div>}
                      {Number(d.earnings_htg || 0) > 0 && <div>HTG {Number(d.earnings_htg).toLocaleString()}</div>}
                      {Number(d.earnings_usd || 0) > 0 && <div>US$ {Number(d.earnings_usd).toLocaleString()}</div>}
                      {!Number(d.earnings_dop) && !Number(d.earnings_htg) && !Number(d.earnings_usd) && "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelected(d)}>
                        Livraisons en cours
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <DriverDeliveriesDialog driver={selected} onClose={() => setSelected(null)} />
    </Card>
  );
}

function DriverDeliveriesDialog({
  driver,
  onClose,
}: {
  driver: DriverRow | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [creditDriver, setCreditDriver] = useState(true);
  const [amount, setAmount] = useState<string>("");
  const [targetOrder, setTargetOrder] = useState<ActiveOrder | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-driver-active-orders", driver?.driver_id],
    queryFn: async (): Promise<ActiveOrder[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, total_amount, delivery_fee, currency, delivery_city")
        .eq("driver_id", driver!.driver_id)
        .in("status", ["ready_for_pickup", "picked_up", "in_transit"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ActiveOrder[];
    },
    enabled: !!driver,
  });

  const cancelDelivery = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_cancel_delivery", {
        p_order_id: targetOrder!.id,
        p_reason: reason || null,
        p_credit_driver: creditDriver,
        p_credit_amount: amount ? Number(amount) : null,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erreur inconnue");
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(
        `Livraison annulée. Remboursement: ${data.refund} • Compensation livreur: ${data.driver_credit}`
      );
      setTargetOrder(null);
      setReason("");
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["admin-driver-active-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-driver-overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur lors de l'annulation"),
  });

  return (
    <Dialog open={!!driver} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Livraisons en cours — {driver?.full_name || "Livreur"}</DialogTitle>
          <DialogDescription>
            Annulez une livraison qui n'a pas été remise à l'acheteur. L'acheteur est remboursé et
            vous pouvez créditer une compensation sur les gains du livreur.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !orders?.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Aucune livraison en cours pour ce livreur.
          </p>
        ) : (
          <div className="space-y-3 max-h-[45vh] overflow-auto">
            {orders.map((o) => (
              <div key={o.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-mono text-sm">#{o.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.status} • {o.delivery_city || "—"} • {o.total_amount} {o.currency}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setTargetOrder(o);
                      setAmount(String(o.delivery_fee ?? ""));
                    }}
                  >
                    <Ban className="h-4 w-4 mr-1" /> Annuler
                  </Button>
                </div>

                {targetOrder?.id === o.id && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="space-y-1">
                      <Label className="text-xs">Motif</Label>
                      <Textarea
                        rows={2}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Colis non remis à l'acheteur…"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Créditer une compensation au livreur</Label>
                      <Switch checked={creditDriver} onCheckedChange={setCreditDriver} />
                    </div>
                    {creditDriver && (
                      <div className="space-y-1">
                        <Label className="text-xs">Montant ({o.currency})</Label>
                        <Input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder={String(o.delivery_fee ?? 0)}
                        />
                      </div>
                    )}
                    <DialogFooter className="gap-2">
                      <Button variant="outline" size="sm" onClick={() => setTargetOrder(null)}>
                        Retour
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={cancelDelivery.isPending}
                        onClick={() => cancelDelivery.mutate()}
                      >
                        {cancelDelivery.isPending && (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        )}
                        Confirmer l'annulation
                      </Button>
                    </DialogFooter>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
