CREATE OR REPLACE FUNCTION public.notify_available_drivers_for_order(p_order_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_count integer := 0;
BEGIN
  -- Verify caller is the buyer of this order (or admin)
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF auth.uid() IS NULL OR (auth.uid() != v_order.buyer_id AND NOT has_role(auth.uid(), 'admin'::app_role)) THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Insert notifications for all online drivers
  INSERT INTO public.notifications (user_id, title, message, type, action_url)
  SELECT 
    dl.driver_id,
    '📦 Nouvelle commande disponible !',
    'Une commande est disponible' || COALESCE(' vers ' || v_order.delivery_city, '') || '. Acceptez-la vite !',
    'info',
    '/driver'
  FROM public.driver_locations dl
  WHERE dl.is_online = true
    AND has_role(dl.driver_id, 'driver'::app_role);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN json_build_object('success', true, 'notified', v_count);
END;
$$;