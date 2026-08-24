import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";
import { startLoudAlarm } from "@/utils/notificationSound";

const ALARM_DURATION = 5 * 60 * 1000;

/**
 * Global alarm for sellers / restaurants: when a new order arrives,
 * play a loud repeating alarm for up to 5 minutes, until the seller
 * opens the seller dashboard or dismisses the banner.
 */
export default function SellerOrderAlarm() {
  const { user, isSeller } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  const stopAlarm = () => {
    stopRef.current?.();
    stopRef.current = null;
    setActive(false);
  };

  const triggerAlarm = () => {
    if (stopRef.current) return; // already ringing
    stopRef.current = startLoudAlarm(ALARM_DURATION);
    setActive(true);
    window.setTimeout(() => {
      stopRef.current = null;
      setActive(false);
    }, ALARM_DURATION);
  };

  // Stop as soon as the seller is on the dashboard
  useEffect(() => {
    if (location.pathname.startsWith("/seller")) stopAlarm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!user || !isSeller) return;

    const channel = supabase
      .channel(`seller-order-alarm-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_items",
          filter: `seller_id=eq.${user.id}`,
        },
        () => {
          if (!window.location.pathname.startsWith("/seller")) triggerAlarm();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as { type?: string; action_url?: string | null };
          if (n?.type === "order" && n?.action_url?.startsWith("/seller")) {
            if (!window.location.pathname.startsWith("/seller")) triggerAlarm();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      stopAlarm();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isSeller]);

  if (!active) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] p-3">
      <div className="mx-auto flex max-w-xl items-center gap-3 rounded-xl border border-primary/40 bg-background px-4 py-3 shadow-lg">
        <Bell className="h-5 w-5 shrink-0 animate-bounce text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Nouvelle commande !</p>
          <p className="truncate text-xs text-muted-foreground">
            Ouvrez le tableau de bord vendeur pour la traiter.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            stopAlarm();
            navigate("/seller");
          }}
        >
          Voir
        </Button>
        <Button size="sm" variant="ghost" onClick={stopAlarm} aria-label="Arrêter l'alarme">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
