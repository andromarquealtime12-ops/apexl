import { useState } from "react";
import { useOrderReturns, useDriverAcceptReturn, useVerifyReturnPickup, useVerifyReturnDelivery } from "@/hooks/useReturns";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { RotateCcw, Key, Loader2, CheckCircle, Truck } from "lucide-react";

export default function DriverReturnsList() {
  const { user } = useAuth();
  const { data: returns } = useOrderReturns("driver");
  const acceptReturn = useDriverAcceptReturn();
  const verifyPickup = useVerifyReturnPickup();
  const verifyDelivery = useVerifyReturnDelivery();
  const [codeModal, setCodeModal] = useState<{ open: boolean; returnId: string; type: "pickup" | "delivery" }>({ open: false, returnId: "", type: "pickup" });
  const [code, setCode] = useState("");

  // Available returns (not yet assigned)
  const availableReturns = returns?.filter(r => r.status === "approved" && !r.return_driver_id) || [];
  // My assigned returns
  const myReturns = returns?.filter(r => r.return_driver_id === user?.id && !["refunded", "rejected", "redelivery"].includes(r.status)) || [];

  const handleVerify = async () => {
    if (code.length !== 4) return;
    if (codeModal.type === "pickup") {
      await verifyPickup.mutateAsync({ returnId: codeModal.returnId, code });
    } else {
      await verifyDelivery.mutateAsync({ returnId: codeModal.returnId, code });
    }
    setCode("");
    setCodeModal({ open: false, returnId: "", type: "pickup" });
  };

  if (availableReturns.length === 0 && myReturns.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Retours
            {(availableReturns.length + myReturns.length) > 0 && (
              <Badge variant="destructive">{availableReturns.length + myReturns.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {availableReturns.map((ret) => (
            <Card key={ret.id} className="border-orange-200">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <Badge variant="outline" className="font-mono text-xs">#{ret.order_id.slice(0, 8)}</Badge>
                  <p className="text-sm mt-1">Retour à récupérer chez l'acheteur</p>
                </div>
                <Button
                  size="sm"
                  disabled={acceptReturn.isPending}
                  onClick={() => acceptReturn.mutate(ret.id)}
                >
                  {acceptReturn.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Truck className="h-3 w-3 mr-1" />}
                  Accepter
                </Button>
              </CardContent>
            </Card>
          ))}

          {myReturns.map((ret) => (
            <Card key={ret.id} className="border-primary/20 bg-primary/5">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-xs">#{ret.order_id.slice(0, 8)}</Badge>
                  <Badge>{ret.status === "return_pickup_ready" ? "Récupérer chez acheteur" : ret.status === "return_in_transit" ? "Livrer chez vendeur" : ret.status}</Badge>
                </div>

                {ret.status === "return_pickup_ready" && (
                  <Button
                    size="sm"
                    className="w-full gap-1"
                    onClick={() => setCodeModal({ open: true, returnId: ret.id, type: "pickup" })}
                  >
                    <Key className="h-3 w-3" /> Entrer code récupération
                  </Button>
                )}

                {ret.status === "return_in_transit" && (
                  <Button
                    size="sm"
                    className="w-full gap-1"
                    onClick={() => setCodeModal({ open: true, returnId: ret.id, type: "delivery" })}
                  >
                    <Key className="h-3 w-3" /> Entrer code livraison vendeur
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Dialog open={codeModal.open} onOpenChange={(o) => { if (!o) setCodeModal({ ...codeModal, open: false }); }}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              {codeModal.type === "pickup" ? "Code récupération retour" : "Code livraison vendeur"}
            </DialogTitle>
            <DialogDescription>
              Entrez le code PIN à 4 chiffres
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <InputOTP maxLength={4} value={code} onChange={setCode}>
              <InputOTPGroup>
                <InputOTPSlot index={0} className="w-14 h-14 text-2xl" />
                <InputOTPSlot index={1} className="w-14 h-14 text-2xl" />
                <InputOTPSlot index={2} className="w-14 h-14 text-2xl" />
                <InputOTPSlot index={3} className="w-14 h-14 text-2xl" />
              </InputOTPGroup>
            </InputOTP>
            <Button
              className="w-full"
              disabled={code.length !== 4 || verifyPickup.isPending || verifyDelivery.isPending}
              onClick={handleVerify}
            >
              {(verifyPickup.isPending || verifyDelivery.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Confirmer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
