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
      if (!r.success) throw new Error(r.error || "Annulation impossible");
      return r;
    },
    onSuccess: (r) => {
      const msg =
        role === "driver"
          ? "Livraison libérée."
          : r.penalty && r.penalty > 0
          ? `Commande annulée. Pénalité: ${r.penalty}. Remboursé: ${r.refund}.`
          : "Commande annulée et remboursée.";
      toast({ title: "✅ Annulé", description: msg });
      invalidateKeys.forEach((k) => queryClient.invalidateQueries({ queryKey: k }));
      setOpen(false);
      setReason("");
    },
    onError: (e: any) =>
      toast({ title: "Erreur", description: e.message, variant: "destructive" }),
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
        {role === "driver" ? "Se désister" : "Annuler"}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {role === "driver" ? "Annuler cette livraison ?" : "Annuler la commande ?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {role === "driver" ? (
                  <p>
                    La commande redeviendra disponible pour un autre livreur. Votre note de
                    confiance sera réduite de 1 point.
                  </p>
                ) : role === "seller" ? (
                  <p>L'acheteur sera intégralement remboursé sur son portefeuille.</p>
                ) : showPenaltyWarning ? (
                  <p className="text-amber-600">
                    ⚠️ Un livreur a déjà accepté. Une pénalité de <b>10 % des frais de livraison</b> sera retenue.
                  </p>
                ) : (
                  <p>Vous serez intégralement remboursé sur votre portefeuille.</p>
                )}
                <Textarea
                  placeholder="Motif (optionnel)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={200}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Retour</AlertDialogCancel>
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
                  <Loader2 className="h-4 w-4 animate-spin mr-1" /> Envoi…
                </>
              ) : (
                "Confirmer l'annulation"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
