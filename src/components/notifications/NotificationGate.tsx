import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell, BellRing, Lock, Smartphone } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Blocking gate: notifications are mandatory for connected users.
 * It stays open until the browser permission is granted so the user can be
 * alerted while the app is in the background or the screen is locked.
 */
export function NotificationGate() {
  const { user } = useAuth();
  const { permission, isSupported, requestPermission, subscribeToPush } = usePushNotifications();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !isSupported) {
      setOpen(false);
      return;
    }
    setOpen(permission !== "granted");
  }, [user, isSupported, permission]);

  useEffect(() => {
    if (permission === "granted" && user) {
      subscribeToPush();
    }
  }, [permission, user, subscribeToPush]);

  const handleEnable = async () => {
    setBusy(true);
    try {
      await requestPermission();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md [&>button.absolute]:hidden" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            Notifications obligatoires
          </DialogTitle>
          <DialogDescription>
            Pour utiliser APEXL, vous devez autoriser les notifications. Elles sont indispensables
            pour les commandes, les livraisons et les paiements.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <Smartphone className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <span>Recevez les alertes même si vous utilisez une autre application.</span>
          </li>
          <li className="flex items-start gap-3">
            <Lock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <span>Les alertes s'affichent sur l'écran verrouillé, écran éteint.</span>
          </li>
          <li className="flex items-start gap-3">
            <Bell className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <span>Son et vibration pour ne rater aucune commande.</span>
          </li>
        </ul>

        {permission === "denied" ? (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            Les notifications sont bloquées. Ouvrez les paramètres de votre navigateur
            (Site → Notifications → Autoriser), puis rechargez la page.
          </p>
        ) : null}

        <div className="pt-2">
          <Button onClick={handleEnable} disabled={busy} className="w-full" size="lg">
            {busy ? "Activation..." : "Activer les notifications"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default NotificationGate;
