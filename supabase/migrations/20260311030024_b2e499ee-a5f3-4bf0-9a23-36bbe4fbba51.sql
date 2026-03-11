
-- 1. Security definer function for seller to assign driver (bypasses RLS)
CREATE OR REPLACE FUNCTION public.assign_driver_to_order(p_order_id uuid, p_driver_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_seller_id uuid;
BEGIN
  -- Check caller is authenticated
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Verify the caller is a seller who has items in this order
  SELECT oi.seller_id INTO v_seller_id
  FROM order_items oi
  WHERE oi.order_id = p_order_id AND oi.seller_id = auth.uid()
  LIMIT 1;

  IF v_seller_id IS NULL THEN
    -- Also allow admins
    IF NOT has_role(auth.uid(), 'admin') THEN
      RETURN json_build_object('success', false, 'error', 'Unauthorized: not seller of this order');
    END IF;
  END IF;

  -- Get the order
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Update order with driver
  UPDATE orders
  SET driver_id = p_driver_id,
      status = 'ready_for_pickup',
      updated_at = now()
  WHERE id = p_order_id;

  -- Notify the driver
  INSERT INTO notifications (user_id, title, message, type, action_url)
  VALUES (p_driver_id, '🛵 Nouvelle livraison assignée !',
    'La commande #' || LEFT(p_order_id::text, 8) || ' vous a été assignée. Rendez-vous chez le vendeur pour récupérer le colis.',
    'info', '/driver');

  -- Notify the buyer
  IF v_order.buyer_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, action_url)
    VALUES (v_order.buyer_id, '🚚 Livreur assigné !',
      'Un livreur a été assigné à votre commande #' || LEFT(p_order_id::text, 8) || '. Suivez votre livraison en temps réel.',
      'info', '/track/' || p_order_id::text);
  END IF;

  RETURN json_build_object('success', true, 'message', 'Driver assigned successfully');
END;
$$;

-- 2. Create order chat messages table
CREATE TABLE IF NOT EXISTS public.order_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_chat_messages ENABLE ROW LEVEL SECURITY;

-- Buyer and driver of the order can view messages
CREATE POLICY "Order participants can view chat" ON public.order_chat_messages
FOR SELECT TO authenticated
USING (
  order_id IN (
    SELECT id FROM orders WHERE buyer_id = auth.uid() OR driver_id = auth.uid()
  )
);

-- Buyer and driver can send messages
CREATE POLICY "Order participants can send chat" ON public.order_chat_messages
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id AND
  order_id IN (
    SELECT id FROM orders WHERE buyer_id = auth.uid() OR driver_id = auth.uid()
  )
);

-- Admin can view all
CREATE POLICY "Admins can view all chat" ON public.order_chat_messages
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_chat_messages;

-- 3. Add seller SELECT policy for orders (to see orders with their items)
CREATE POLICY "Sellers can view orders with their items" ON public.orders
FOR SELECT TO authenticated
USING (
  id IN (SELECT DISTINCT order_id FROM order_items WHERE seller_id = auth.uid())
);

-- 4. Add seller UPDATE policy for orders (for marking ready)
CREATE POLICY "Sellers can update orders with their items" ON public.orders
FOR UPDATE TO authenticated
USING (
  id IN (SELECT DISTINCT order_id FROM order_items WHERE seller_id = auth.uid())
);
