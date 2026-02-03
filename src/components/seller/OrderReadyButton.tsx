import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateDeliveryVerification, useDeliveryVerification } from "@/hooks/useDeliveryVerification";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Package, Key, CheckCircle } from "lucide-react";
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
  const queryClient = useQueryClient();

  const updateOrderStatus = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("orders")
        .update({ status: "ready" })
        .eq("id", orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
    },
  });

  const handleMarkReady = async () => {
    try {
      // Update order status
      await updateOrderStatus.mutateAsync();
      
      // Create verification codes
      const result = await createVerification.mutateAsync(orderId);
      setPickupCode(result.pickup_code);
      setShowCode(true);
      
      toast.success("Commande marquée comme prête !");
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  // If verification already exists, show the code
  if (verification && verification.pickup_code) {
    return (
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
            </div>
          </div>

          <Button onClick={() => setShowCode(false)} className="w-full">
            Compris
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
