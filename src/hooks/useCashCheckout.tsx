import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { Currency } from "@/types/database";
import { notifyNewOrder } from "@/hooks/useOrderNotifications";

interface CashCheckoutParams {
  deliveryAddress: string;
  deliveryCity: string;
  deliveryNotes?: string;
  currency: Currency;
  buyerLatitude?: number | null;
  buyerLongitude?: number | null;
  deliveryFee: number;
  // Accepted but ignored for cash (not relevant since Printful blocks cash)
  deliveryAddress2?: string;
  deliveryState?: string;
  deliveryZip?: string;
  deliveryCountry?: string;
}

export function useCashCheckout() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { items, clearCart } = useCart();

  return useMutation({
    mutationFn: async ({ deliveryAddress, deliveryCity, deliveryNotes, currency, buyerLatitude, buyerLongitude, deliveryFee }: CashCheckoutParams) => {
      if (!user) throw new Error("Utilisateur non connecté");
      if (items.length === 0) throw new Error("Le panier est vide");

      // Block cash payment for Shopify/Printful products (wallet-only)
      const hasShopifyItem = items.some((it) => (it.product as any).is_shopify === true);
      const hasPrintfulItem = items.some((it) => (it.product as any).is_printful === true);
      if (hasShopifyItem || hasPrintfulItem) {
        throw new Error("Les produits Shopify/Printful nécessitent un paiement par portefeuille. Veuillez utiliser le paiement Wallet.");
      }

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

      const { data, error } = await supabase.rpc("process_cash_checkout" as any, {
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
      if (!result.success) throw new Error(result.error || "Cash checkout failed");

      if (result.order_id && (buyerLatitude || buyerLongitude)) {
        await supabase
          .from("orders")
          .update({ buyer_latitude: buyerLatitude, buyer_longitude: buyerLongitude })
          .eq("id", result.order_id);
      }

      if (result.order_id) {
        notifyNewOrder(result.order_id);
      }

      return { id: result.order_id };
    },
    onSuccess: () => {
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
      queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
    },
  });
}
