ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS available_colors text[] NOT NULL DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS available_sizes text[] NOT NULL DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS size_type text NOT NULL DEFAULT 'standard';

ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS selected_color text,
ADD COLUMN IF NOT EXISTS selected_size text;

CREATE OR REPLACE FUNCTION public.process_checkout(
  p_buyer_id uuid,
  p_total_amount numeric,
  p_delivery_fee numeric,
  p_currency text,
  p_delivery_address text,
  p_delivery_city text,
  p_delivery_notes text,
  p_order_items jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_wallet RECORD;
  v_balance_field text;
  v_current_balance numeric;
  v_order_id uuid;
  v_item jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_buyer_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF p_total_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  IF p_order_items IS NULL OR jsonb_array_length(p_order_items) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Cart is empty');
  END IF;

  v_balance_field := CASE p_currency
    WHEN 'DOP' THEN 'balance_dop'
    WHEN 'HTG' THEN 'balance_htg'
    ELSE 'balance_usd'
  END;

  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_buyer_id
  FOR UPDATE;

  IF v_wallet.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  EXECUTE format('SELECT COALESCE(%I, 0) FROM public.wallets WHERE id = $1', v_balance_field)
  INTO v_current_balance
  USING v_wallet.id;

  IF v_current_balance < p_total_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', format('Insufficient balance. Current: %s, Required: %s', v_current_balance, p_total_amount)
    );
  END IF;

  EXECUTE format('UPDATE public.wallets SET %I = %I - $1, updated_at = now() WHERE id = $2',
    v_balance_field, v_balance_field)
  USING p_total_amount, v_wallet.id;

  INSERT INTO public.orders (
    buyer_id,
    total_amount,
    delivery_fee,
    currency,
    payment_method,
    delivery_address,
    delivery_city,
    delivery_notes,
    status,
    payment_status
  ) VALUES (
    p_buyer_id,
    p_total_amount,
    p_delivery_fee,
    p_currency,
    'card_visa',
    p_delivery_address,
    p_delivery_city,
    NULLIF(p_delivery_notes, ''),
    'confirmed',
    'pending'
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
  LOOP
    INSERT INTO public.order_items (
      order_id,
      product_id,
      seller_id,
      quantity,
      unit_price,
      total_price,
      selected_color,
      selected_size
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

  INSERT INTO public.wallet_transactions (
    wallet_id,
    type,
    amount,
    currency,
    status,
    reference,
    description
  ) VALUES (
    v_wallet.id,
    'payment',
    -p_total_amount,
    p_currency,
    'completed',
    v_order_id::text,
    'Paiement commande #' || LEFT(v_order_id::text, 8)
  );

  RETURN json_build_object(
    'success', true,
    'order_id', v_order_id,
    'message', 'Order created successfully'
  );
END;
$function$;