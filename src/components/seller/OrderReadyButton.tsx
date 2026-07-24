import { useState } from "react";
import { Link } from "react-router-dom";
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
import { Loader2, Package, Key, CheckCircle, RefreshCw, MapPin, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface OrderReadyButtonProps {
  orderId: string;
  currentStatus: string;
}

export function OrderReadyButton({ orderId, currentStatus }: OrderReadyButtonProps) {
  const [showCode, setShowCode] = useState(false);
  const [pickupCode, setPickupCode] = useState<string | null>(null);
  const [showAddressConfirm, setShowAddressConfirm] = useState(false);
  const [pickupAddress, setPickupAddress] = useState<{ address: string | null; lat: number | null; lng: number | null } | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);
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

  const notifyNearbyDrivers = async () => {
    try {
      const { error } = await supabase.rpc("notify_available_drivers_for_order", {
        p_order_id: orderId,
      });
      if (error) throw error;
    } catch (err) {
      console.error("Error notifying drivers:", err);
    }
  };

  // Step 1: open the confirmation dialog with the registered pickup address
  const openAddressConfirm = async () => {
    try {
      setLoadingAddress(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("profiles")
        .select("shop_address, shop_latitude, shop_longitude")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      setPickupAddress({
        address: data?.shop_address ?? null,
        lat: data?.shop_latitude ?? null,
        lng: data?.shop_longitude ?? null,
      });
      setShowAddressConfirm(true);
    } catch (e: any) {
      toast.error(e?.message || "Impossible de charger l'adresse de retrait");
    } finally {
      setLoadingAddress(false);
    }
  };

  // Step 2: after seller confirms address, mark ready + issue PIN
  const handleConfirmAndMarkReady = async () => {
    try {
      setShowAddressConfirm(false);
      const result = await markReady.mutateAsync();
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

  const hasAddress = !!(pickupAddress?.address && pickupAddress?.lat != null && pickupAddress?.lng != null);

  const addressConfirmDialog = (
    <Dialog open={showAddressConfirm} onOpenChange={setShowAddressConfirm}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Confirmer le point de retrait
          </DialogTitle>
          <DialogDescription>
            Le livreur viendra chercher le colis à cette adresse enregistrée. Confirmez qu'elle est correcte.
          </DialogDescription>
        </DialogHeader>

        {hasAddress ? (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <p className="text-sm font-medium">{pickupAddress!.address}</p>
            <p className="text-xs font-mono text-muted-foreground">
              {pickupAddress!.lat!.toFixed(6)}, {pickupAddress!.lng!.toFixed(6)}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <span>
              Aucune adresse de retrait enregistrée. Enregistrez-la dans votre tableau de bord vendeur
              (« Emplacement de retrait des colis ») avant de marquer la commande prête.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={handleConfirmAndMarkReady}
            disabled={!hasAddress || markReady.isPending || createVerification.isPending}
            className="flex-1 gap-1"
          >
            {(markReady.isPending || createVerification.isPending) ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle className="h-3 w-3" />
            )}
            Confirmer & marquer prête
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link to="/seller-dashboard">Modifier l'adresse</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

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

  if (currentStatus !== "confirmed" && currentStatus !== "preparing") {
    return null;
  }

  return (
    <>
      <Button
        size="sm"
        onClick={openAddressConfirm}
        disabled={loadingAddress || createVerification.isPending || markReady.isPending}
        className="gap-1"
      >
        {(loadingAddress || createVerification.isPending || markReady.isPending) ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Package className="h-3 w-3" />
        )}
        Marquer prête
      </Button>
      {addressConfirmDialog}
      {pinDialog}
    </>
  );
}
