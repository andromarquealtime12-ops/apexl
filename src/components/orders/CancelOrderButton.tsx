import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { XCircle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  orderId: string;
  orderStatus: string | null;
  hasDriver: boolean;
  /** "buyer" | "driver" | "seller" — controls messaging + eligibility */
  role: "buyer" | "driver" | "seller";
  invalidateKeys?: string[][];
}

const PRE_PICKUP = ["pending", "confirmed", "preparing", "ready", "ready_for_pickup"];

export default function CancelOrderButton({
  orderId,
  orderStatus,
  hasDriver,
  role,
  invalidateKeys = [["buyer-orders"], ["driver-deliveries"], ["seller-orders"], ["wallet"]],
}: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const eligible =
    PRE_PICKUP.includes(orderStatus || "") &&
    (role !== "seller" || !hasDriver);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("cancel_order" as any, {
        p_order_id: orderId,
        p_reason: reason || null,
      });
      if (error) throw error;
      const r = data as { success: boolean; error?: string; refund?: number; penalty?: number };
      if (!r.success) throw new Error(r.error || t("buyerx.cancel.cancelFailed"));
      return r;
    },
    onSuccess: (r) => {
      const msg =
        role === "driver"
          ? t("buyerx.cancel.deliveryReleased")
          : r.penalty && r.penalty > 0
          ? t("buyerx.cancel.cancelledWithPenalty", { penalty: r.penalty, refund: r.refund })
          : t("buyerx.cancel.cancelledRefunded");
      toast({ title: t("buyerx.cancel.cancelledTitle"), description: msg });
      invalidateKeys.forEach((k) => queryClient.invalidateQueries({ queryKey: k }));
      setOpen(false);
      setReason("");
    },
    onError: (e: any) =>
      toast({ title: t("buyerx.common.error"), description: e.message, variant: "destructive" }),
  });

  if (!eligible) return null;

  const showPenaltyWarning = role === "buyer" && hasDriver;

  return (
    <>
      <Button
        size="sm"
        variant="destructive"
        className="gap-1"
        onClick={() => setOpen(true)}
      >
        <XCircle className="h-3.5 w-3.5" />
        {role === "driver" ? t("buyerx.cancel.withdraw") : t("buyerx.cancel.cancel")}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {role === "driver" ? t("buyerx.cancel.confirmTitleDriver") : t("buyerx.cancel.confirmTitleOrder")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {role === "driver" ? (
                  <p>{t("buyerx.cancel.driverWarning")}</p>
                ) : role === "seller" ? (
                  <p>{t("buyerx.cancel.sellerRefundNote")}</p>
                ) : showPenaltyWarning ? (
                  <p className="text-amber-600">
                    ⚠️ {t("buyerx.cancel.penaltyWarning")}
                  </p>
                ) : (
                  <p>{t("buyerx.cancel.buyerRefundNote")}</p>
                )}
                <Textarea
                  placeholder={t("buyerx.cancel.reasonPlaceholder")}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={200}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>{t("buyerx.cancel.back")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
              disabled={mutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" /> {t("buyerx.cancel.sending")}
                </>
              ) : (
                t("buyerx.cancel.confirmCancel")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
