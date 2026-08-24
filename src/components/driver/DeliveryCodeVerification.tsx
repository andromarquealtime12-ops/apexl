import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useVerifyPickupCode, useVerifyDeliveryCode, useDeliveryVerification } from "@/hooks/useDeliveryVerification";
import { Loader2, Package, Truck, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

interface DeliveryCodeVerificationProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  type: "pickup" | "delivery";
}

export function DeliveryCodeVerification({ isOpen, onClose, orderId, type }: DeliveryCodeVerificationProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const { data: verification } = useDeliveryVerification(orderId);
  const verifyPickup = useVerifyPickupCode();
  const verifyDelivery = useVerifyDeliveryCode();

  const isPickup = type === "pickup";
  const mutation = isPickup ? verifyPickup : verifyDelivery;

  const handleVerify = async () => {
    if (code.length !== 4) return;
    
    try {
      await mutation.mutateAsync({ orderId, code });
      setCode("");
      onClose();
    } catch (error) {
      // Error is handled in the hook
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[350px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPickup ? (
              <>
                <Package className="h-5 w-5 text-primary" />
                {t("driverx.codeVerification.pickupTitle")}
              </>
            ) : (
              <>
                <Truck className="h-5 w-5 text-primary" />
                {t("driverx.codeVerification.deliveryTitle")}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isPickup 
              ? t("driverx.codeVerification.pickupDesc")
              : t("driverx.codeVerification.deliveryDesc")
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex flex-col items-center gap-4">
            <Badge variant="outline" className="text-xs">
              {t("driverx.codeVerification.order", { id: orderId.slice(0, 8) })}
            </Badge>
            
            <InputOTP
              maxLength={4}
              value={code}
              onChange={(value) => setCode(value)}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="w-14 h-14 text-2xl" />
                <InputOTPSlot index={1} className="w-14 h-14 text-2xl" />
                <InputOTPSlot index={2} className="w-14 h-14 text-2xl" />
                <InputOTPSlot index={3} className="w-14 h-14 text-2xl" />
              </InputOTPGroup>
            </InputOTP>

            <p className="text-xs text-muted-foreground text-center">
              {isPickup 
                ? t("driverx.codeVerification.pickupHint")
                : t("driverx.codeVerification.deliveryHint")
              }
            </p>
          </div>

          <Button
            onClick={handleVerify}
            className="w-full"
            disabled={mutation.isPending || code.length !== 4}
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            {isPickup ? t("driverx.codeVerification.confirmPickup") : t("driverx.codeVerification.confirmDelivery")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
