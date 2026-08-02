
CREATE OR REPLACE FUNCTION public.process_cash_checkout(
  p_buyer_id uuid, p_total_amount numeric, p_delivery_fee numeric, p_currency text,
  p_delivery_address text, p_delivery_city text, p_delivery_notes text, p_order_items jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_order_id uuid;
  v_item jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_buyer_id THEN
    RETURN json_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  IF p_total_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Montant invalide');
  END IF;

  IF p_order_items IS NULL OR jsonb_array_length(p_order_items) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Le panier est vide');
  END IF;

  INSERT INTO public.orders (
    buyer_id, total_amount, delivery_fee, currency,
    payment_method, delivery_address, delivery_city,
    delivery_notes, status, payment_status
  ) VALUES (
    p_buyer_id, p_total_amount, p_delivery_fee, p_currency,
    'cash', p_delivery_address, p_delivery_city,
    NULLIF(p_delivery_notes, ''), 'confirmed', 'pending'
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
  LOOP
    INSERT INTO public.order_items (
      order_id, product_id, seller_id, quantity,
      unit_price, total_price, selected_color, selected_size
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'seller_id')::uuid,
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'total_price')::numeric,
      NULLIF(v_item->>'selected_color', ''),
      NULLIF(v_item->>'selected_size', '')
    );
  END LOOP;

  RETURN json_build_object('success', true, 'order_id', v_order_id, 'message', 'Commande cash créée avec succès');
END;
$fn$;
