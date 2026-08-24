import { supabase } from "@/integrations/supabase/client";
import i18n from "@/i18n";

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
        i18n.t("buyerx.orderNotif.newOrderTitle"),
        i18n.t("buyerx.orderNotif.newOrderMsg", { id: orderId.slice(0, 8) }),
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
  const messages: Record<string, { title: string; msg: string }> = {
    confirmed: {
      title: i18n.t("buyerx.orderNotif.confirmedTitle"),
      msg: i18n.t("buyerx.orderNotif.confirmedMsg", { id: shortId }),
    },
    ready: {
      title: i18n.t("buyerx.orderNotif.readyTitle"),
      msg: i18n.t("buyerx.orderNotif.readyMsg", { id: shortId }),
    },
    ready_for_pickup: {
      title: i18n.t("buyerx.orderNotif.readyForPickupTitle"),
      msg: i18n.t("buyerx.orderNotif.readyForPickupMsg", { id: shortId }),
    },
    picked_up: {
      title: i18n.t("buyerx.orderNotif.pickedUpTitle"),
      msg: i18n.t("buyerx.orderNotif.pickedUpMsg", { id: shortId }),
    },
    in_transit: {
      title: i18n.t("buyerx.orderNotif.inTransitTitle"),
      msg: i18n.t("buyerx.orderNotif.inTransitMsg", { id: shortId }),
    },
    delivered: {
      title: i18n.t("buyerx.orderNotif.deliveredTitle"),
      msg: i18n.t("buyerx.orderNotif.deliveredMsg", { id: shortId }),
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
    i18n.t("buyerx.orderNotif.driverAssignedTitle"),
    i18n.t("buyerx.orderNotif.driverAssignedMsg", { id: orderId.slice(0, 8) }),
    "delivery",
    `/track/${orderId}`
  );

  await notifyUser(
    driverId,
    i18n.t("buyerx.orderNotif.newDeliveryTitle"),
    i18n.t("buyerx.orderNotif.newDeliveryMsg", { id: orderId.slice(0, 8) }),
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
    i18n.t("buyerx.orderNotif.rateExperienceTitle"),
    i18n.t("buyerx.orderNotif.rateExperienceMsg", { id: orderId.slice(0, 8) }),
    "review",
    `/orders`
  );

  await notifyUser(
    driverId,
    i18n.t("buyerx.orderNotif.deliveryCompleteTitle"),
    i18n.t("buyerx.orderNotif.deliveryCompleteMsg", { id: orderId.slice(0, 8) }),
    "earning",
    "/driver"
  );
}
