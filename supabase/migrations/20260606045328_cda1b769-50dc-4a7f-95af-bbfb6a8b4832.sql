-- 1) Atomic wallet credit RPC to eliminate read-then-write race conditions
CREATE OR REPLACE FUNCTION public.credit_wallet_atomic(
  p_user_id uuid,
  p_amount numeric,
  p_currency text,
  p_payment_method text,
  p_description text,
  p_transaction_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
  v_balance_col text;
  v_existing_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;

  v_balance_col := CASE upper(p_currency)
    WHEN 'DOP' THEN 'balance_dop'
    WHEN 'HTG' THEN 'balance_htg'
    WHEN 'USD' THEN 'balance_usd'
    ELSE NULL
  END;
  IF v_balance_col IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_currency');
  END IF;

  -- Idempotency: skip if this reference already credited
  IF p_transaction_reference IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.wallet_transactions
    WHERE transaction_reference = p_transaction_reference
    LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true);
    END IF;
  END IF;

  -- Lock the wallet row and credit atomically
  SELECT id INTO v_wallet_id
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'wallet_not_found');
  END IF;

  EXECUTE format(
    'UPDATE public.wallets SET %I = COALESCE(%I, 0) + $1, updated_at = now() WHERE id = $2',
    v_balance_col, v_balance_col
  ) USING p_amount, v_wallet_id;

  INSERT INTO public.wallet_transactions (
    wallet_id, type, amount, currency, status, payment_method, description, transaction_reference
  ) VALUES (
    v_wallet_id, 'deposit', p_amount, upper(p_currency), 'completed',
    p_payment_method, p_description, p_transaction_reference
  );

  RETURN jsonb_build_object('success', true, 'wallet_id', v_wallet_id);
END;
$$;

-- Restrict execution: only service_role should call this from edge functions
REVOKE ALL ON FUNCTION public.credit_wallet_atomic(uuid, numeric, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_wallet_atomic(uuid, numeric, text, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_wallet_atomic(uuid, numeric, text, text, text, text) TO service_role;

-- 2) Hide deposit_agents phone/whatsapp from anonymous scrapers — require auth
DROP POLICY IF EXISTS "Anyone can view active verified agents" ON public.deposit_agents;
CREATE POLICY "Authenticated users can view active verified agents"
  ON public.deposit_agents
  FOR SELECT
  TO authenticated
  USING (is_active = true AND is_verified = true);

-- 3) Explicit deny for direct client writes on wallet_transactions
-- (RLS already denies by default, but make it explicit and auditable)
DROP POLICY IF EXISTS "Block direct client inserts on wallet_transactions" ON public.wallet_transactions;
CREATE POLICY "Block direct client inserts on wallet_transactions"
  ON public.wallet_transactions
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

DROP POLICY IF EXISTS "Block direct client updates on wallet_transactions" ON public.wallet_transactions;
CREATE POLICY "Block direct client updates on wallet_transactions"
  ON public.wallet_transactions
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated, anon
  USING (false);

DROP POLICY IF EXISTS "Block direct client deletes on wallet_transactions" ON public.wallet_transactions;
CREATE POLICY "Block direct client deletes on wallet_transactions"
  ON public.wallet_transactions
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated, anon
  USING (false);
