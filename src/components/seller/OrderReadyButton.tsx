import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { notifyOrderStatusChange } from "@/hooks/useOrderNotifications";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateDeliveryVerification, useDeliveryVerification, useRegeneratePickupCode } from "@/hooks/useDeliveryVerification";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Package, Key, CheckCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface OrderReadyButtonProps {
  orderId: string;
  currentStatus: string;
}

export function OrderReadyButton({ orderId, currentStatus }: OrderReadyButtonProps) {
  const [showCode, setShowCode] = useState(false);
  const [pickupCode, setPickupCode] = useState<string | null>(null);
  const { data: verification } = useDeliveryVerification(orderId);
  const createVerification = useCreateDeliveryVerification();
  const regenerateCode = useRegeneratePickupCode();
  const queryClient = useQueryClient();

  const markReady = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("mark_seller_items_ready", { p_order_id: orderId });
      if (error) throw error;
      return data as { ready_sellers: number; total_sellers: number; all_ready: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
      queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
      queryClient.invalidateQueries({ queryKey: ["available-deliveries"] });
    },
  });

  // Notify all nearby online drivers
  const notifyNearbyDrivers = async () => {
    try {
      // Get all online driver locations
      const { data: onlineDrivers } = await supabase
        .from("driver_locations")
        .select("driver_id")
        .eq("is_online", true);

      if (!onlineDrivers || onlineDrivers.length === 0) return;

      // Get order info for notification
      const { data: order } = await supabase
        .from("orders")
        .select("delivery_city, delivery_address")
        .eq("id", orderId)
        .single();

      // Insert notifications for all online drivers
      const notifications = onlineDrivers.map(d => ({
        user_id: d.driver_id,
        title: "📦 Nouvelle commande disponible !",
        message: `Une commande est prête à être récupérée${order?.delivery_city ? ` vers ${order.delivery_city}` : ""}. Acceptez-la vite !`,
        type: "info" as const,
        action_url: "/driver",
      }));

      await supabase.from("notifications").insert(notifications);
    } catch (err) {
      console.error("Error notifying drivers:", err);
    }
  };

  const handleMarkReady = async () => {
    try {
      const result = await markReady.mutateAsync();
      // Always create/get pickup verification for this seller
      const verif = await createVerification.mutateAsync(orderId);
      setPickupCode(verif.pickup_code);
      setShowCode(true);

      if (result.all_ready) {
        const { data: order } = await supabase
          .from("orders")
          .select("buyer_id")
          .eq("id", orderId)
          .single();

        if (order?.buyer_id) {
          notifyOrderStatusChange(orderId, order.buyer_id, "ready");
        }

        // Notify ALL nearby drivers automatically (only when fully ready)
        await notifyNearbyDrivers();
        toast.success("Commande complète prête ! Les livreurs ont été notifiés.");
      } else {
        const remaining = result.total_sellers - result.ready_sellers;
        toast.success(`Vos articles sont prêts (${result.ready_sellers}/${result.total_sellers}). En attente de ${remaining} autre vendeur${remaining > 1 ? "s" : ""}.`);
      }
    } catch (error: any) {
      toast.error(error?.message || "Erreur lors de la mise à jour");
    }
  };

  // PIN code dialog - always rendered
  const pinDialog = (
    <Dialog open={showCode} onOpenChange={setShowCode}>
      <DialogContent className="sm:max-w-[350px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Commande prête !
          </DialogTitle>
          <DialogDescription>
            Donnez ce code PIN au livreur lorsqu'il viendra récupérer la commande
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <div className="text-center">
            <Badge variant="outline" className="text-xs mb-4">
              Commande #{orderId.slice(0, 8)}
            </Badge>
            
            <div className="bg-primary/10 rounded-xl p-6 mb-4">
              <p className="text-sm text-muted-foreground mb-2">Code de récupération</p>
              <p className="text-5xl font-mono font-bold tracking-[0.3em] text-primary">
                {pickupCode}
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              <strong>Important :</strong> Ne donnez ce code qu'au livreur autorisé. 
              Il doit l'entrer dans son application pour confirmer la récupération.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              ⏳ Ce code expire dans 24h
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => setShowCode(false)} className="flex-1">
            Compris
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const result = await regenerateCode.mutateAsync(orderId);
              if (result.pickup_code) setPickupCode(result.pickup_code);
            }}
            disabled={regenerateCode.isPending}
            className="gap-1"
          >
            {regenerateCode.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Régénérer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  // If verification already exists, show the "view code" button + dialog
  if (verification && verification.pickup_code) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setPickupCode(verification.pickup_code);
            setShowCode(true);
          }}
          className="gap-1"
        >
          <Key className="h-3 w-3" />
          Voir code PIN
        </Button>
        {pinDialog}
      </>
    );
  }

  // Only show for confirmed orders
  if (currentStatus !== "confirmed" && currentStatus !== "preparing") {
    return null;
  }

  return (
    <>
      <Button
        size="sm"
        onClick={handleMarkReady}
        disabled={createVerification.isPending || updateOrderStatus.isPending}
        className="gap-1"
      >
        {(createVerification.isPending || updateOrderStatus.isPending) ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Package className="h-3 w-3" />
        )}
        Marquer prête
      </Button>
      {pinDialog}
    </>
  );
}
