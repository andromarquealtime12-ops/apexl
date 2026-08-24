import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { RotateCcw, Loader2 } from "lucide-react";
import { useRequestReturn, useReturnForOrder } from "@/hooks/useReturns";
import { Badge } from "@/components/ui/badge";
import { differenceInHours } from "date-fns";
import { useTranslation } from "react-i18next";

interface ReturnRequestButtonProps {
  orderId: string;
  orderStatus: string;
  deliveredAt: string;
}

export default function ReturnRequestButton({ orderId, orderStatus, deliveredAt }: ReturnRequestButtonProps) {
  const { t } = useTranslation();
  const returnStatusLabels: Record<string, string> = {
    pending: t("buyerx.returns.status.pending"),
    approved: t("buyerx.returns.status.approved"),
    return_pickup_ready: t("buyerx.returns.status.return_pickup_ready"),
    return_in_transit: t("buyerx.returns.status.return_in_transit"),
    returned: t("buyerx.returns.status.returned"),
    refunded: t("buyerx.returns.status.refunded"),
    rejected: t("buyerx.returns.status.rejected"),
    redelivery: t("buyerx.returns.status.redelivery"),
  };
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const requestReturn = useRequestReturn();
  const { data: existingReturn } = useReturnForOrder(orderId);

  if (orderStatus !== "delivered" && !existingReturn) return null;

  const hoursElapsed = differenceInHours(new Date(), new Date(deliveredAt));
  const canReturn = hoursElapsed <= 2 && !existingReturn;

  if (existingReturn) {
    return (
      <Badge variant="outline" className="gap-1">
        <RotateCcw className="h-3 w-3" />
        {returnStatusLabels[existingReturn.status] || existingReturn.status}
      </Badge>
    );
  }

  if (!canReturn) return null;

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <RotateCcw className="h-3.5 w-3.5" />
        {t("buyerx.returns.returnButton")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              {t("buyerx.returns.requestTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("buyerx.returns.timeRemaining", { hours: 2 - hoursElapsed })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder={t("buyerx.returns.reasonPlaceholder")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={!reason.trim() || requestReturn.isPending}
                onClick={async () => {
                  await requestReturn.mutateAsync({ orderId, reason });
                  setOpen(false);
                  setReason("");
                }}
              >
                {requestReturn.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {t("buyerx.returns.confirmReturn")}
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>{t("buyerx.returns.cancel")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
