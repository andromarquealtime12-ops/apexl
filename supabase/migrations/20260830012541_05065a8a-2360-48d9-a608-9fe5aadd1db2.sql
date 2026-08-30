CREATE OR REPLACE FUNCTION public.can_withdraw(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('seller'::app_role, 'driver'::app_role, 'admin'::app_role)
  )
$$;

GRANT EXECUTE ON FUNCTION public.can_withdraw(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.request_withdrawal(p_amount numeric, p_currency text, p_payment_method payment_method_type, p_account_details text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_wallet RECORD;
  v_balance_field text;
  v_current_balance numeric;
  v_transaction_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT public.can_withdraw(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Withdrawals are only available for seller and driver accounts');
  END IF;

  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  v_balance_field := CASE p_currency
    WHEN 'DOP' THEN 'balance_dop'
    WHEN 'HTG' THEN 'balance_htg'
    ELSE 'balance_usd'
  END;

  SELECT * INTO v_wallet FROM wallets WHERE user_id = auth.uid() FOR UPDATE;

  IF v_wallet.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF v_wallet.is_frozen THEN
    RETURN json_build_object('success', false, 'error', 'Wallet is frozen');
  END IF;

  EXECUTE format('SELECT COALESCE(%I, 0) FROM wallets WHERE id = $1', v_balance_field)
  INTO v_current_balance USING v_wallet.id;

  IF v_current_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  EXECUTE format('UPDATE wallets SET %I = %I - $1, updated_at = now() WHERE id = $2',
    v_balance_field, v_balance_field)
  USING p_amount, v_wallet.id;

  INSERT INTO wallet_transactions (
    wallet_id, type, amount, currency, payment_method,
    status, description, transaction_reference
  ) VALUES (
    v_wallet.id, 'withdrawal', p_amount, p_currency, p_payment_method,
    'pending', 'Retrait vers ' || p_account_details, p_account_details
  ) RETURNING id INTO v_transaction_id;

  INSERT INTO notifications (user_id, title, message, type)
  SELECT ur.user_id, 'Nouvelle demande de retrait',
    format('Un retrait de %s %s a été demandé.', p_amount, p_currency), 'info'
  FROM user_roles ur WHERE ur.role = 'admin';

  RETURN json_build_object('success', true, 'transaction_id', v_transaction_id, 'message', 'Withdrawal request submitted');
END;
$function$;