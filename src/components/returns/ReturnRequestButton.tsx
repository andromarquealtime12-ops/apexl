import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { RotateCcw, Loader2 } from "lucide-react";
import { useRequestReturn, useReturnForOrder } from "@/hooks/useReturns";
import { Badge } from "@/components/ui/badge";
import { differenceInHours } from "date-fns";

interface ReturnRequestButtonProps {
  orderId: string;
  orderStatus: string;
  deliveredAt: string;
}

const returnStatusLabels: Record<string, string> = {
  pending: "Retour en attente",
  approved: "Retour approuvé",
  return_pickup_ready: "Livreur en route",
  return_in_transit: "Retour en transit",
  returned: "Retourné - En inspection",
  refunded: "Remboursé",
  rejected: "Retour refusé",
  redelivery: "Re-livraison en cours",
};

export default function ReturnRequestButton({ orderId, orderStatus, deliveredAt }: ReturnRequestButtonProps) {
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
        Retourner
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              Demander un retour
            </DialogTitle>
            <DialogDescription>
              Vous avez {2 - hoursElapsed}h restantes pour demander un retour. 
              Seul le montant du produit sera remboursé (hors frais de livraison).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Décrivez la raison du retour..."
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
                Confirmer le retour
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
