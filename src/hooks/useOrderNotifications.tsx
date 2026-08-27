import { supabase } from "@/integrations/supabase/client";
import i18n from "@/i18n";

const langCache = new Map<string, string>();

/** Resolve the recipient's configured language (falls back to app default). */
export async function recipientLang(userId: string): Promise<string> {
  const cached = langCache.get(userId);
  if (cached) return cached;
  try {
    const { data } = await supabase.rpc("get_user_language", { _user_id: userId });
    const lng = (data as string) || "fr";
    langCache.set(userId, lng);
    return lng;
  } catch {
    return "fr";
  }
}

/** Translate a key in the recipient's language. */
async function tFor(userId: string, key: string, opts?: Record<string, unknown>) {
  const lng = await recipientLang(userId);
  return i18n.t(key, { ...(opts ?? {}), lng }) as string;
}

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
        await tFor(sellerId!, "buyerx.orderNotif.newOrderTitle"),
        await tFor(sellerId!, "buyerx.orderNotif.newOrderMsg", { id: orderId.slice(0, 8) }),
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
    await supabase.rpc("notify_available_drivers_for_order", { p_order_id: orderId });
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
  const shortId = orderId.slice(0, 8);
  const lng = await recipientLang(buyerId);
  const tr = (k: string, o?: Record<string, unknown>) =>
    i18n.t(k, { ...(o ?? {}), lng }) as string;
  const messages: Record<string, { title: string; msg: string }> = {
    confirmed: {
      title: tr("buyerx.orderNotif.confirmedTitle"),
      msg: tr("buyerx.orderNotif.confirmedMsg", { id: shortId }),
    },
    ready: {
      title: tr("buyerx.orderNotif.readyTitle"),
      msg: tr("buyerx.orderNotif.readyMsg", { id: shortId }),
    },
    ready_for_pickup: {
      title: tr("buyerx.orderNotif.readyForPickupTitle"),
      msg: tr("buyerx.orderNotif.readyForPickupMsg", { id: shortId }),
    },
    picked_up: {
      title: tr("buyerx.orderNotif.pickedUpTitle"),
      msg: tr("buyerx.orderNotif.pickedUpMsg", { id: shortId }),
    },
    in_transit: {
      title: tr("buyerx.orderNotif.inTransitTitle"),
      msg: tr("buyerx.orderNotif.inTransitMsg", { id: shortId }),
    },
    delivered: {
      title: tr("buyerx.orderNotif.deliveredTitle"),
      msg: tr("buyerx.orderNotif.deliveredMsg", { id: shortId }),
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
    await tFor(buyerId, "buyerx.orderNotif.driverAssignedTitle"),
    await tFor(buyerId, "buyerx.orderNotif.driverAssignedMsg", { id: orderId.slice(0, 8) }),
    "delivery",
    `/track/${orderId}`
  );

  await notifyUser(
    driverId,
    await tFor(driverId, "buyerx.orderNotif.newDeliveryTitle"),
    await tFor(driverId, "buyerx.orderNotif.newDeliveryMsg", { id: orderId.slice(0, 8) }),
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
    await tFor(buyerId, "buyerx.orderNotif.rateExperienceTitle"),
    await tFor(buyerId, "buyerx.orderNotif.rateExperienceMsg", { id: orderId.slice(0, 8) }),
    "review",
    `/orders`
  );

  await notifyUser(
    driverId,
    await tFor(driverId, "buyerx.orderNotif.deliveryCompleteTitle"),
    await tFor(driverId, "buyerx.orderNotif.deliveryCompleteMsg", { id: orderId.slice(0, 8) }),
    "earning",
    "/driver"
  );
}
