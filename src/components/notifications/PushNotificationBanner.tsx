import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bell, X } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function PushNotificationBanner() {
  const { permission, isSupported, requestPermission } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);

  if (!isSupported || permission === "granted" || permission === "denied" || dismissed) {
    return null;
  }

  return (
    <Alert className="mb-4 border-primary/30 bg-primary/5">
      <Bell className="h-4 w-4 text-primary" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <span className="text-sm">
          Activez les notifications pour être alerté des nouvelles commandes à proximité.
        </span>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" onClick={requestPermission}>
            Activer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
