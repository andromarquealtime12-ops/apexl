import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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

  const handleMarkReady = async () => {
    try {
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
        toast.success(t("sellerx.orderReady.toasts.allReady"));
      } else {
        const remaining = result.total_sellers - result.ready_sellers;
        toast.success(t("sellerx.orderReady.toasts.partialReady", {
          ready: result.ready_sellers,
          total: result.total_sellers,
          count: remaining,
        }));
      }
    } catch (error: any) {
      toast.error(error?.message || t("sellerx.orderReady.toasts.updateError"));
    }
  };



  const pinDialog = (
    <Dialog open={showCode} onOpenChange={setShowCode}>
      <DialogContent className="sm:max-w-[350px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            {t("sellerx.orderReady.dialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("sellerx.orderReady.dialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <div className="text-center">
            <Badge variant="outline" className="text-xs mb-4">
              {t("sellerx.orderReady.dialog.orderLabel", { id: orderId.slice(0, 8) })}
            </Badge>

            <div className="bg-primary/10 rounded-xl p-6 mb-4">
              <p className="text-sm text-muted-foreground mb-2">{t("sellerx.orderReady.dialog.codeLabel")}</p>
              <p className="text-5xl font-mono font-bold tracking-[0.3em] text-primary">
                {pickupCode}
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              <strong>{t("sellerx.orderReady.dialog.importantLabel")}:</strong> {t("sellerx.orderReady.dialog.importantText")}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              ⏳ {t("sellerx.orderReady.dialog.expiry")}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => setShowCode(false)} className="flex-1">
            {t("sellerx.orderReady.dialog.understood")}
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
            {t("sellerx.orderReady.dialog.regenerate")}
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
          {t("sellerx.orderReady.viewPin")}
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
        onClick={() => handleMarkReady()}
        disabled={createVerification.isPending || markReady.isPending}
        className="gap-1"
      >
        {(createVerification.isPending || markReady.isPending) ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Package className="h-3 w-3" />
        )}
        {t("sellerx.orderReady.markReady")}
      </Button>
      {pinDialog}
    </>
  );
}
