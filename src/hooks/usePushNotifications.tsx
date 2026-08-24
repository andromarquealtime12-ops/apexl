import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { alertDriver } from "@/utils/notificationSound";

const VAPID_PUBLIC_KEY = "BIqvSGtAQZMBu75_cwoqFPV7ljTNG2TrC7iHaPIyM8z-LcKD2d_FhLhww0sILYbn2Sm4rdT2km4xFngyfdHzXtU";

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported("Notification" in window && "serviceWorker" in navigator && "PushManager" in window);
  }, []);

  const subscribeToPush = useCallback(async () => {
    if (!user || !isSupported) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Check existing subscription
      let subscription = await registration.pushManager.getSubscription();

      // If the existing subscription was created with a different VAPID key,
      // it can never be decrypted by the server: drop it and resubscribe.
      if (subscription) {
        const existingKey = subscription.options?.applicationServerKey;
        const currentKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        const sameKey =
          existingKey &&
          new Uint8Array(existingKey).length === currentKey.length &&
          new Uint8Array(existingKey).every((b, i) => b === currentKey[i]);
        if (!sameKey) {
          const staleEndpoint = subscription.endpoint;
          await subscription.unsubscribe().catch(() => {});
          await supabase.from('push_subscriptions').delete().eq('endpoint', staleEndpoint);
          subscription = null;
        }
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const key = subscription.getKey('p256dh');
      const auth = subscription.getKey('auth');

      if (!key || !auth) return false;

      const p256dh = btoa(String.fromCharCode(...new Uint8Array(key)));
      const authStr = btoa(String.fromCharCode(...new Uint8Array(auth)));

      // Save to database
      await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: p256dh,
        auth: authStr,
      }, { onConflict: 'user_id,endpoint' });

      return true;
    } catch (e) {
      console.error("Push subscription error:", e);
      return false;
    }
  }, [user, isSupported]);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error("Les notifications ne sont pas supportées par votre navigateur");
      return false;
    }

    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === "granted") {
      toast.success("Notifications activées !");
      await subscribeToPush();
      return true;
    } else {
      toast.error("Notifications refusées. Activez-les dans les paramètres du navigateur.");
      return false;
    }
  }, [isSupported, subscribeToPush]);

  // Auto-subscribe when permission already granted
  useEffect(() => {
    if (permission === "granted" && user && isSupported) {
      subscribeToPush();
    }
  }, [permission, user, isSupported, subscribeToPush]);

  const sendLocalNotification = useCallback((title: string, options?: NotificationOptions & { sound?: "newOrder" | "pickup" | "alert" }) => {
    if (permission !== "granted") return;

    alertDriver(options?.sound || "newOrder");

    try {
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, {
            icon: "/icons/icon-192x192.png",
            badge: "/icons/icon-96x96.png",
            tag: "ayiti-marche",
            vibrate: [200, 100, 200],
            ...options,
          } as any);
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
    subscribeToPush,
  };
}

// Hook for drivers: listen for new nearby orders and assignments in real-time
export function useDriverOrderNotifications() {
  const { user, isDriver } = useAuth();
  const { permission, sendLocalNotification } = usePushNotifications();

  useEffect(() => {
    if (!user || !isDriver || permission !== "granted") return;

    const channel = supabase
      .channel(`driver-new-orders-${user.id}`)
      .on(

        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const order = payload.new as any;
          const oldOrder = payload.old as any;

          if (
            ["ready", "ready_for_pickup"].includes(order.status) &&
            !order.driver_id &&
            oldOrder.status !== order.status
          ) {
            sendLocalNotification("📦 Commande prête à récupérer !", {
              body: `La commande #${(order.id as string).slice(0, 8)} est prête. ${order.delivery_city || ""}`,
              data: { url: `/driver` },
              tag: `ready-${order.id}`,
              sound: "newOrder",
            });
          }

          if (order.driver_id === user.id && oldOrder.driver_id !== user.id) {
            sendLocalNotification("🎉 Livraison assignée !", {
              body: `La commande #${(order.id as string).slice(0, 8)} vous a été assignée.`,
              data: { url: `/driver` },
              tag: `assigned-${order.id}`,
              sound: "pickup",
            });
          }

          if (
            order.driver_id === user.id &&
            order.status === "ready_for_pickup" &&
            oldOrder.status !== "ready_for_pickup"
          ) {
            sendLocalNotification("📦 Commande prête au retrait !", {
              body: `La commande #${(order.id as string).slice(0, 8)} est prête pour le retrait.`,
              data: { url: `/driver` },
              tag: `pickup-${order.id}`,
              sound: "pickup",
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
