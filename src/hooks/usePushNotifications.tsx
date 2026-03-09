import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function usePushNotifications() {
  const { user, isDriver } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported("Notification" in window && "serviceWorker" in navigator);
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error("Les notifications ne sont pas supportées par votre navigateur");
      return false;
    }

    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === "granted") {
      toast.success("Notifications activées !");
      return true;
    } else {
      toast.error("Notifications refusées. Activez-les dans les paramètres du navigateur.");
      return false;
    }
  }, [isSupported]);

  const sendLocalNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (permission !== "granted") return;

    try {
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, {
            icon: "/icons/icon-192x192.png",
            badge: "/icons/icon-96x96.png",
            tag: "ayiti-marche",
            renotify: true,
            ...options,
          });
        });
      } else {
        new Notification(title, {
          icon: "/icons/icon-192x192.png",
          ...options,
        });
      }
    } catch (e) {
      console.warn("Notification error:", e);
    }
  }, [permission]);

  return {
    permission,
    isSupported,
    requestPermission,
    sendLocalNotification,
  };
}

// Hook for drivers: listen for new nearby orders in real-time
export function useDriverOrderNotifications() {
  const { user, isDriver } = useAuth();
  const { permission, sendLocalNotification } = usePushNotifications();

  useEffect(() => {
    if (!user || !isDriver || permission !== "granted") return;

    const channel = supabase
      .channel(`driver-new-orders-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          const order = payload.new as any;
          if (order.status === "confirmed" && !order.driver_id) {
            sendLocalNotification("🛵 Nouvelle commande disponible !", {
              body: `Commande #${(order.id as string).slice(0, 8)} - ${order.total_amount} ${order.currency}\n${order.delivery_city || "Adresse non spécifiée"}`,
              data: { url: `/driver` },
              tag: `order-${order.id}`,
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `driver_id=eq.${user.id}`,
        },
        (payload) => {
          const order = payload.new as any;
          if (order.status === "ready_for_pickup") {
            sendLocalNotification("📦 Commande prête à récupérer !", {
              body: `La commande #${(order.id as string).slice(0, 8)} est prête pour le retrait.`,
              data: { url: `/driver` },
              tag: `pickup-${order.id}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isDriver, permission, sendLocalNotification]);
}
