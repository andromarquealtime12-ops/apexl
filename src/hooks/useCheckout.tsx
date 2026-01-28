import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart, CartItem } from "@/contexts/CartContext";
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

      // Vérifier le solde du portefeuille
      const { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (walletError) throw new Error("Impossible de récupérer le portefeuille");

      // Déterminer quel solde utiliser en fonction de la devise
      const balanceField = currency === "DOP" ? "balance_dop" : currency === "HTG" ? "balance_htg" : "balance_usd";
      const currentBalance = wallet[balanceField] || 0;

      if (currentBalance < totalAmount) {
        throw new Error(`Solde insuffisant. Solde actuel: ${currentBalance}, Montant requis: ${totalAmount}`);
      }

      // Créer la commande
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          buyer_id: user.id,
          total_amount: totalAmount,
          delivery_fee: deliveryFee,
          currency,
          payment_method: "card_visa" as PaymentMethodType, // Paiement via portefeuille
          delivery_address: deliveryAddress,
          delivery_city: deliveryCity,
          delivery_notes: deliveryNotes || null,
          status: "confirmed",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Créer les items de la commande
      const orderItems = items.map((item: CartItem) => ({
        order_id: order.id,
        product_id: item.product.id,
        seller_id: item.product.seller_id,
        quantity: item.quantity,
        unit_price: item.product.price,
        total_price: item.product.price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Déduire le montant du portefeuille
      const newBalance = currentBalance - totalAmount;
      const { error: updateWalletError } = await supabase
        .from("wallets")
        .update({ [balanceField]: newBalance })
        .eq("id", wallet.id);

      if (updateWalletError) throw updateWalletError;

      // Créer la transaction de paiement
      const { error: transactionError } = await supabase
        .from("wallet_transactions")
        .insert({
          wallet_id: wallet.id,
          type: "payment",
          amount: -totalAmount,
          currency,
          status: "completed",
          reference: order.id,
          description: `Paiement commande #${order.id.slice(0, 8)}`,
        });

      if (transactionError) throw transactionError;

      return order;
    },
    onSuccess: () => {
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
