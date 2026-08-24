import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell, BellRing, Lock, Smartphone } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

/**
 * Blocking gate: notifications are mandatory for connected users.
 * It stays open until the browser permission is granted so the user can be
 * alerted while the app is in the background or the screen is locked.
 */
export function NotificationGate() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { permission, isSupported, requestPermission, subscribeToPush } = usePushNotifications();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(
    typeof sessionStorage !== "undefined" && sessionStorage.getItem("notif-gate-dismissed") === "1"
  );

  useEffect(() => {
    if (!user || !isSupported || dismissed) {
      setOpen(false);
      return;
    }
    setOpen(permission !== "granted");
  }, [user, isSupported, permission, dismissed]);

  const handleDismiss = () => {
    try { sessionStorage.setItem("notif-gate-dismissed", "1"); } catch { /* ignore */ }
    setDismissed(true);
    setOpen(false);
  };

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
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            {t("buyerx.notifGate.title")}
          </DialogTitle>
          <DialogDescription>
            {t("buyerx.notifGate.description")}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <Smartphone className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <span>{t("buyerx.notifGate.bullet1")}</span>
          </li>
          <li className="flex items-start gap-3">
            <Lock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <span>{t("buyerx.notifGate.bullet2")}</span>
          </li>
          <li className="flex items-start gap-3">
            <Bell className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <span>{t("buyerx.notifGate.bullet3")}</span>
          </li>
        </ul>

        {permission === "denied" ? (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {t("buyerx.notifGate.blocked")}
          </p>
        ) : null}

        <div className="pt-2 space-y-2">
          <Button onClick={handleEnable} disabled={busy} className="w-full" size="lg">
            {busy ? t("buyerx.notifGate.activating") : t("buyerx.notifGate.activate")}
          </Button>
          <Button onClick={handleDismiss} variant="ghost" className="w-full">
            {t("buyerx.notifGate.later")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default NotificationGate;
