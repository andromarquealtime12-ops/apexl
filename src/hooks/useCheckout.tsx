import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
 import { useCart } from "@/contexts/CartContext";
import { PaymentMethodType, Currency } from "@/types/database";

interface CheckoutParams {
  deliveryAddress: string;
  deliveryCity: string;
  deliveryNotes?: string;
  currency: Currency;
}

export function useCheckout() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { items, getSubtotal, getDeliveryFee, clearCart } = useCart();

  return useMutation({
    mutationFn: async ({ deliveryAddress, deliveryCity, deliveryNotes, currency }: CheckoutParams) => {
      if (!user) throw new Error("Utilisateur non connecté");
      if (items.length === 0) throw new Error("Le panier est vide");

      const subtotal = getSubtotal();
      const deliveryFee = getDeliveryFee(deliveryCity);
      const totalAmount = subtotal + deliveryFee;

       // Prepare order items for the RPC call
       const orderItems = items.map((item) => ({
        product_id: item.product.id,
        seller_id: item.product.seller_id,
        quantity: item.quantity,
        unit_price: item.product.price,
        total_price: item.product.price * item.quantity,
      }));

       // Use the secure server-side RPC function to process checkout
       // This prevents race conditions and ensures atomic operations
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
       
       if (!result.success) {
         throw new Error(result.error || "Checkout failed");
       }

       return { id: result.order_id };
    },
    onSuccess: () => {
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
