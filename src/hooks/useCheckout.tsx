import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { Currency } from "@/types/database";
import { notifyNewOrder, notifyAvailableDrivers } from "@/hooks/useOrderNotifications";

interface CheckoutParams {
  deliveryAddress: string;
  deliveryCity: string;
  deliveryNotes?: string;
  currency: Currency;
  buyerLatitude?: number | null;
  buyerLongitude?: number | null;
  deliveryFee: number;
  // Extended international address (Printful)
  deliveryAddress2?: string;
  deliveryState?: string;
  deliveryZip?: string;
  deliveryCountry?: string;
}

export function useCheckout() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { items, clearCart } = useCart();

  return useMutation({
    mutationFn: async ({ deliveryAddress, deliveryCity, deliveryNotes, currency, buyerLatitude, buyerLongitude, deliveryFee, deliveryAddress2, deliveryState, deliveryZip, deliveryCountry }: CheckoutParams) => {
      if (!user) throw new Error("Utilisateur non connecté");
      if (items.length === 0) throw new Error("Le panier est vide");

      const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
      const totalAmount = subtotal + deliveryFee;

      const orderItems = items.map((item) => ({
        product_id: item.product.id,
        seller_id: item.product.seller_id,
        quantity: item.quantity,
        unit_price: item.product.price,
        total_price: item.product.price * item.quantity,
        selected_color: item.selectedColor,
        selected_size: item.selectedSize,
      }));

      const { data, error } = await supabase.rpc("process_checkout" as any, {
        p_buyer_id: user.id,
        p_total_amount: totalAmount,
        p_delivery_fee: deliveryFee,
        p_currency: currency,
        p_delivery_address: deliveryAddress,
        p_delivery_city: deliveryCity,
        p_delivery_notes: deliveryNotes || "",
        p_order_items: orderItems,
      });

      if (error) throw error;

      const result = data as { success: boolean; order_id?: string; error?: string };
      if (!result.success) throw new Error(result.error || "Checkout failed");

      // Save buyer GPS + extended international address on the order
      if (result.order_id) {
        const extraUpdate: any = {};
        if (buyerLatitude || buyerLongitude) {
          extraUpdate.buyer_latitude = buyerLatitude;
          extraUpdate.buyer_longitude = buyerLongitude;
        }
        if (deliveryAddress2) extraUpdate.delivery_address2 = deliveryAddress2;
        if (deliveryState) extraUpdate.delivery_state = deliveryState;
        if (deliveryZip) extraUpdate.delivery_zip = deliveryZip;
        if (deliveryCountry) extraUpdate.delivery_country = deliveryCountry;
        if (Object.keys(extraUpdate).length > 0) {
          await supabase.from("orders").update(extraUpdate).eq("id", result.order_id);
        }
      }

      if (result.order_id) {
        notifyNewOrder(result.order_id);
        notifyAvailableDrivers(result.order_id);

        // If order contains Shopify products, forward to Shopify for fulfillment
        const hasShopifyItem = items.some((it) => (it.product as any).is_shopify === true);
        if (hasShopifyItem) {
          try {
            await supabase.functions.invoke("shopify-create-order", {
              body: { order_id: result.order_id },
            });
          } catch (e) {
            console.error("Shopify order forward failed:", e);
          }
        }

        // If order contains Printful (POD) products, forward to Printful for fulfillment
        const hasPrintfulItem = items.some((it) => (it.product as any).is_printful === true);
        if (hasPrintfulItem) {
          try {
            await supabase.functions.invoke("printful-create-order", {
              body: { order_id: result.order_id },
            });
          } catch (e) {
            console.error("Printful order forward failed:", e);
          }
        }
      }

      return { id: result.order_id };
    },
    onSuccess: () => {
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
      queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
      queryClient.invalidateQueries({ queryKey: ["seller-stats"] });
    },
  });
}