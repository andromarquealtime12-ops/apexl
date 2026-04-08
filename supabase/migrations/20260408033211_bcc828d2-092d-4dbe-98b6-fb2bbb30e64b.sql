
-- Add 'cash' to payment_method_type enum
ALTER TYPE public.payment_method_type ADD VALUE IF NOT EXISTS 'cash';

-- Create function for cash checkout
CREATE OR REPLACE FUNCTION public.process_cash_checkout(
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
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_item jsonb;
  v_seller_id uuid;
  v_seller_wallet RECORD;
  v_commission_rate numeric;
  v_commission numeric;
  v_balance_field text;
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

  -- Get commission rate from platform settings (default 5%)
  SELECT COALESCE(value::numeric, 5) INTO v_commission_rate
  FROM public.platform_settings WHERE key = 'cash_commission_percent';
  IF v_commission_rate IS NULL THEN
    v_commission_rate := 5;
  END IF;

  v_balance_field := CASE p_currency
    WHEN 'DOP' THEN 'balance_dop'
    WHEN 'HTG' THEN 'balance_htg'
    ELSE 'balance_usd'
  END;

  -- Create the order with cash payment
  INSERT INTO public.orders (
    buyer_id, total_amount, delivery_fee, currency,
    payment_method, delivery_address, delivery_city,
    delivery_notes, status, payment_status
  ) VALUES (
    p_buyer_id, p_total_amount, p_delivery_fee, p_currency,
    'cash', p_delivery_address, p_delivery_city,
    NULLIF(p_delivery_notes, ''), 'confirmed', 'cash'
  ) RETURNING id INTO v_order_id;

  -- Insert order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
  LOOP
    v_seller_id := (v_item->>'seller_id')::uuid;

    INSERT INTO public.order_items (
      order_id, product_id, seller_id, quantity,
      unit_price, total_price, selected_color, selected_size
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      v_seller_id,
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'total_price')::numeric,
      NULLIF(v_item->>'selected_color', ''),
      NULLIF(v_item->>'selected_size', '')
    );

    -- Deduct commission from seller wallet (creates negative balance)
    v_commission := ROUND((v_item->>'total_price')::numeric * v_commission_rate / 100, 2);

    SELECT * INTO v_seller_wallet FROM public.wallets WHERE user_id = v_seller_id FOR UPDATE;
    IF v_seller_wallet.id IS NOT NULL THEN
      EXECUTE format('UPDATE public.wallets SET %I = COALESCE(%I, 0) - $1, updated_at = now() WHERE id = $2',
        v_balance_field, v_balance_field)
      USING v_commission, v_seller_wallet.id;

      INSERT INTO public.wallet_transactions (
        wallet_id, type, amount, currency, status, reference, description
      ) VALUES (
        v_seller_wallet.id, 'payment', -v_commission, p_currency, 'completed',
        v_order_id::text, 'Commission cash (' || v_commission_rate || '%) commande #' || LEFT(v_order_id::text, 8)
      );
    END IF;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'order_id', v_order_id,
    'message', 'Cash order created successfully'
  );
END;
$$;

-- Admin function to clear negative balances
CREATE OR REPLACE FUNCTION public.admin_clear_negative_balance(
  p_user_id uuid,
  p_currency text DEFAULT 'DOP'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet RECORD;
  v_balance_field text;
  v_current_balance numeric;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Admin only');
  END IF;

  v_balance_field := CASE p_currency
    WHEN 'DOP' THEN 'balance_dop'
    WHEN 'HTG' THEN 'balance_htg'
    ELSE 'balance_usd'
  END;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  EXECUTE format('SELECT COALESCE(%I, 0) FROM public.wallets WHERE id = $1', v_balance_field)
  INTO v_current_balance USING v_wallet.id;

  IF v_current_balance >= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Balance is not negative');
  END IF;

  -- Clear the negative balance to zero
  EXECUTE format('UPDATE public.wallets SET %I = 0, updated_at = now() WHERE id = $1', v_balance_field)
  USING v_wallet.id;

  -- Log the adjustment
  INSERT INTO public.wallet_transactions (
    wallet_id, type, amount, currency, status, description
  ) VALUES (
    v_wallet.id, 'transfer', ABS(v_current_balance), p_currency, 'completed',
    'Correction solde négatif par admin'
  );

  -- Audit log
  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, new_value)
  VALUES (auth.uid(), 'clear_negative_balance', 'wallet', v_wallet.id,
    json_build_object('currency', p_currency, 'cleared_amount', v_current_balance)::jsonb);

  RETURN json_build_object('success', true, 'cleared_amount', ABS(v_current_balance));
END;
$$;
