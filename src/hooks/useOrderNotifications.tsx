import { supabase } from "@/integrations/supabase/client";

/**
 * Send in-app notification and optionally trigger push
 */
export async function notifyUser(
  userId: string,
  title: string,
  message: string,
  type: string = "info",
  actionUrl?: string
) {
  try {
    await supabase.from("notifications").insert({
      user_id: userId,
      title,
      message,
      type,
      action_url: actionUrl,
    });
  } catch (e) {
    console.error("Notification error:", e);
  }
}

/**
 * Notify seller when new order is placed
 */
export async function notifyNewOrder(orderId: string) {
  try {
    const { data: items } = await supabase
      .from("order_items")
      .select("seller_id")
      .eq("order_id", orderId);

    if (!items) return;

    const sellerIds = [...new Set(items.map(i => i.seller_id).filter(Boolean))];
    for (const sellerId of sellerIds) {
      await notifyUser(
        sellerId!,
        "🛒 Nouvelle commande !",
        `Vous avez reçu une nouvelle commande #${orderId.slice(0, 8)}. Préparez-la rapidement.`,
        "order",
        "/seller"
      );
    }
  } catch (e) {
    console.error("notifyNewOrder error:", e);
  }
}

/**
 * Notify all online drivers when a new order is available for delivery
 */
export async function notifyAvailableDrivers(orderId: string) {
  try {
    const { data: onlineDrivers } = await supabase
      .from("driver_locations")
      .select("driver_id")
      .eq("is_online", true);

    if (!onlineDrivers || onlineDrivers.length === 0) return;

    const { data: order } = await supabase
      .from("orders")
      .select("delivery_city")
      .eq("id", orderId)
      .single();

    const notifications = onlineDrivers.map((d) => ({
      user_id: d.driver_id,
      title: "📦 Nouvelle commande disponible !",
      message: `Une commande est disponible${order?.delivery_city ? ` vers ${order.delivery_city}` : ""}. Acceptez-la vite !`,
      type: "info" as const,
      action_url: "/driver",
    }));

    await supabase.from("notifications").insert(notifications);
  } catch (e) {
    console.error("notifyAvailableDrivers error:", e);
  }
}

/**
 * Notify buyer when order status changes
 */
export async function notifyOrderStatusChange(
  orderId: string,
  buyerId: string,
  newStatus: string,
  driverId?: string | null
) {
  const messages: Record<string, { title: string; msg: string }> = {
    confirmed: {
      title: "✅ Commande confirmée",
      msg: `Votre commande #${orderId.slice(0, 8)} a été confirmée par le vendeur.`,
    },
    ready: {
      title: "📦 Commande prête",
      msg: `Votre commande #${orderId.slice(0, 8)} est prête ! Un livreur sera bientôt assigné.`,
    },
    ready_for_pickup: {
      title: "📦 Commande prête au retrait",
      msg: `Votre commande #${orderId.slice(0, 8)} est prête pour le retrait par le livreur.`,
    },
    picked_up: {
      title: "🛵 Commande récupérée",
      msg: `Le livreur a récupéré votre commande #${orderId.slice(0, 8)}. Livraison en cours !`,
    },
    in_transit: {
      title: "🚀 En route vers vous",
      msg: `Votre commande #${orderId.slice(0, 8)} est en cours de livraison.`,
    },
    delivered: {
      title: "🎉 Commande livrée !",
      msg: `Votre commande #${orderId.slice(0, 8)} a été livrée. N'oubliez pas de laisser un avis !`,
    },
  };

  const info = messages[newStatus];
  if (!info) return;

  // Notify buyer
  await notifyUser(buyerId, info.title, info.msg, "order", `/track/${orderId}`);

  // Notify driver on assignment
  if (newStatus === "ready" || newStatus === "ready_for_pickup") {
    // Notify nearby drivers (they'll see it via realtime)
  }
}

/**
 * Notify when driver is assigned
 */
export async function notifyDriverAssigned(orderId: string, driverId: string, buyerId: string) {
  await notifyUser(
    buyerId,
    "🛵 Livreur assigné !",
    `Un livreur a été assigné à votre commande #${orderId.slice(0, 8)}. Suivez-le en temps réel.`,
    "delivery",
    `/track/${orderId}`
  );

  await notifyUser(
    driverId,
    "📦 Nouvelle livraison !",
    `Vous avez été assigné à la commande #${orderId.slice(0, 8)}. Rendez-vous chez le vendeur.`,
    "delivery",
    "/driver"
  );
}

/**
 * Notify when delivery is completed - ask for review
 */
export async function notifyDeliveryComplete(orderId: string, buyerId: string, driverId: string) {
  await notifyUser(
    buyerId,
    "⭐ Notez votre expérience",
    `Votre commande #${orderId.slice(0, 8)} est livrée ! Comment s'est passée la livraison ?`,
    "review",
    `/orders`
  );

  await notifyUser(
    driverId,
    "✅ Livraison terminée",
    `Vous avez livré la commande #${orderId.slice(0, 8)} avec succès. Commission ajoutée.`,
    "earning",
    "/driver"
  );
}
