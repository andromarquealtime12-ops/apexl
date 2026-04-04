
-- Add whatsapp field to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp text;

-- Create a reliable RPC for drivers to accept orders
CREATE OR REPLACE FUNCTION public.driver_accept_order(p_order_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_driver_id uuid := auth.uid();
BEGIN
  IF v_driver_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check driver role
  IF NOT has_role(v_driver_id, 'driver') THEN
    RETURN json_build_object('success', false, 'error', 'Not a driver');
  END IF;

  -- Lock and get the order
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
    AND driver_id IS NULL
    AND status IN ('confirmed', 'ready', 'ready_for_pickup')
  FOR UPDATE SKIP LOCKED;

  IF v_order.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Order not available or already taken');
  END IF;

  -- Assign driver
  UPDATE orders
  SET driver_id = v_driver_id,
      status = 'ready_for_pickup',
      updated_at = now()
  WHERE id = p_order_id;

  -- Create delivery verification if not exists
  PERFORM create_delivery_verification(p_order_id);

  -- Notify buyer
  IF v_order.buyer_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, action_url)
    VALUES (v_order.buyer_id, '🚚 Livreur assigné !',
      'Un livreur a accepté votre commande #' || LEFT(p_order_id::text, 8) || '. Suivez votre livraison en temps réel.',
      'info', '/track/' || p_order_id::text);
  END IF;

  -- Notify sellers
  INSERT INTO notifications (user_id, title, message, type, action_url)
  SELECT DISTINCT oi.seller_id, '📦 Livreur en route !',
    'Un livreur va récupérer la commande #' || LEFT(p_order_id::text, 8) || '.',
    'info', '/seller'
  FROM order_items oi
  WHERE oi.order_id = p_order_id AND oi.seller_id IS NOT NULL;

  RETURN json_build_object('success', true, 'message', 'Order accepted');
END;
$$;

-- Allow anyone authenticated to read basic public profile info (for contact buttons)
CREATE POLICY "Authenticated can read basic profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);
