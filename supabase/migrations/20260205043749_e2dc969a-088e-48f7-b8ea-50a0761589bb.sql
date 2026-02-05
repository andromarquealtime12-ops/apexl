-- =====================================================
-- FIX 1: Missing RPC functions for deposit approval/rejection
-- =====================================================

-- Approve deposit function with proper validation and atomic operations
CREATE OR REPLACE FUNCTION public.approve_deposit(
  transaction_id_input uuid,
  admin_id_input uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction RECORD;
  v_balance_field text;
  v_wallet_id uuid;
BEGIN
  -- Verify caller is admin
  IF NOT has_role(admin_id_input, 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: Admin role required');
  END IF;
  
  -- Get and lock transaction to prevent concurrent modifications
  SELECT wt.*, w.id as wallet_id INTO v_transaction
  FROM wallet_transactions wt
  JOIN wallets w ON w.id = wt.wallet_id
  WHERE wt.id = transaction_id_input
  AND wt.type = 'deposit'
  AND wt.status = 'pending'
  FOR UPDATE OF wt, w;
  
  IF v_transaction.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Transaction not found or already processed');
  END IF;
  
  -- Determine balance field based on currency
  v_balance_field := CASE v_transaction.currency
    WHEN 'DOP' THEN 'balance_dop'
    WHEN 'HTG' THEN 'balance_htg'
    ELSE 'balance_usd'
  END;
  
  -- Update wallet balance atomically
  EXECUTE format('UPDATE wallets SET %I = COALESCE(%I, 0) + $1, updated_at = now() WHERE id = $2',
    v_balance_field, v_balance_field)
  USING v_transaction.amount, v_transaction.wallet_id;
  
  -- Update transaction status with audit trail
  UPDATE wallet_transactions
  SET status = 'completed',
      description = COALESCE(description, '') || ' (Approved by admin)',
      reference = admin_id_input::text
  WHERE id = transaction_id_input;
  
  RETURN json_build_object('success', true, 'message', 'Deposit approved successfully');
END;
$$;

-- Reject deposit function with reason tracking
CREATE OR REPLACE FUNCTION public.reject_deposit(
  transaction_id_input uuid,
  admin_id_input uuid,
  reason_input text DEFAULT 'Rejected by administrator'
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated boolean;
BEGIN
  -- Verify caller is admin
  IF NOT has_role(admin_id_input, 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: Admin role required');
  END IF;
  
  -- Update transaction to failed status with reason
  UPDATE wallet_transactions
  SET status = 'failed',
      description = COALESCE(description, '') || ' - ' || reason_input,
      reference = admin_id_input::text
  WHERE id = transaction_id_input
  AND type = 'deposit'
  AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Transaction not found or already processed');
  END IF;
  
  RETURN json_build_object('success', true, 'message', 'Deposit rejected');
END;
$$;

-- =====================================================
-- FIX 2: Secure checkout function to prevent race conditions
-- =====================================================

CREATE OR REPLACE FUNCTION public.process_checkout(
  p_buyer_id uuid,
  p_total_amount numeric,
  p_delivery_fee numeric,
  p_currency text,
  p_delivery_address text,
  p_delivery_city text,
  p_delivery_notes text,
  p_order_items jsonb
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet RECORD;
  v_balance_field text;
  v_current_balance numeric;
  v_order_id uuid;
  v_item jsonb;
BEGIN
  -- Verify the caller is the buyer (using auth.uid())
  IF auth.uid() IS NULL OR auth.uid() != p_buyer_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Validate inputs
  IF p_total_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  IF p_order_items IS NULL OR jsonb_array_length(p_order_items) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Cart is empty');
  END IF;

  -- Determine balance field based on currency
  v_balance_field := CASE p_currency
    WHEN 'DOP' THEN 'balance_dop'
    WHEN 'HTG' THEN 'balance_htg'
    ELSE 'balance_usd'
  END;

  -- Get and lock wallet to prevent concurrent modifications
  SELECT * INTO v_wallet
  FROM wallets
  WHERE user_id = p_buyer_id
  FOR UPDATE;

  IF v_wallet.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Get current balance
  EXECUTE format('SELECT COALESCE(%I, 0) FROM wallets WHERE id = $1', v_balance_field)
  INTO v_current_balance
  USING v_wallet.id;

  -- Check if balance is sufficient
  IF v_current_balance < p_total_amount THEN
    RETURN json_build_object(
      'success', false, 
      'error', format('Insufficient balance. Current: %s, Required: %s', v_current_balance, p_total_amount)
    );
  END IF;

  -- Atomically deduct balance
  EXECUTE format('UPDATE wallets SET %I = %I - $1, updated_at = now() WHERE id = $2',
    v_balance_field, v_balance_field)
  USING p_total_amount, v_wallet.id;

  -- Create order
  INSERT INTO orders (
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

  -- Create order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
  LOOP
    INSERT INTO order_items (
      order_id,
      product_id,
      seller_id,
      quantity,
      unit_price,
      total_price
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'seller_id')::uuid,
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'total_price')::numeric
    );
  END LOOP;

  -- Create payment transaction record
  INSERT INTO wallet_transactions (
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
$$;

-- =====================================================
-- FIX 3: Secure demo wallet top-up function
-- =====================================================

CREATE OR REPLACE FUNCTION public.demo_wallet_topup(
  p_amount numeric,
  p_currency text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
  v_balance_field text;
  v_rate_limit_count integer;
BEGIN
  -- Ensure user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Validate amount (limit to reasonable demo amounts)
  IF p_amount <= 0 OR p_amount > 50000 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid amount. Must be between 1 and 50,000');
  END IF;

  -- Validate currency
  IF p_currency NOT IN ('DOP', 'HTG', 'USD') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid currency');
  END IF;

  -- Rate limit: max 5 demo topups per hour per user
  SELECT COUNT(*) INTO v_rate_limit_count
  FROM wallet_transactions wt
  JOIN wallets w ON w.id = wt.wallet_id
  WHERE w.user_id = auth.uid()
  AND wt.type = 'deposit'
  AND wt.description LIKE '%Demo%'
  AND wt.created_at > now() - interval '1 hour';

  IF v_rate_limit_count >= 5 THEN
    RETURN json_build_object('success', false, 'error', 'Rate limit exceeded. Try again in an hour.');
  END IF;

  -- Get user's wallet
  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = auth.uid();

  IF v_wallet_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Determine balance field
  v_balance_field := CASE p_currency
    WHEN 'DOP' THEN 'balance_dop'
    WHEN 'HTG' THEN 'balance_htg'
    ELSE 'balance_usd'
  END;

  -- Update wallet balance
  EXECUTE format('UPDATE wallets SET %I = COALESCE(%I, 0) + $1, updated_at = now() WHERE id = $2',
    v_balance_field, v_balance_field)
  USING p_amount, v_wallet_id;

  -- Create transaction record for audit
  INSERT INTO wallet_transactions (
    wallet_id,
    type,
    amount,
    currency,
    status,
    payment_method,
    description
  ) VALUES (
    v_wallet_id,
    'deposit',
    p_amount,
    p_currency,
    'completed',
    'card_visa',
    'Demo Stripe payment (test mode)'
  );

  RETURN json_build_object('success', true, 'message', 'Demo topup successful');
END;
$$;