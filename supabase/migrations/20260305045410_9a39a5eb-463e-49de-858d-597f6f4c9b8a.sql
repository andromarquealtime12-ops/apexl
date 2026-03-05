
-- Create withdrawal request function
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_amount numeric,
  p_currency text,
  p_payment_method payment_method_type,
  p_account_details text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet RECORD;
  v_balance_field text;
  v_current_balance numeric;
  v_transaction_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  v_balance_field := CASE p_currency
    WHEN 'DOP' THEN 'balance_dop'
    WHEN 'HTG' THEN 'balance_htg'
    ELSE 'balance_usd'
  END;

  -- Lock wallet
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

  -- Deduct balance immediately (hold)
  EXECUTE format('UPDATE wallets SET %I = %I - $1, updated_at = now() WHERE id = $2',
    v_balance_field, v_balance_field)
  USING p_amount, v_wallet.id;

  -- Create withdrawal transaction
  INSERT INTO wallet_transactions (
    wallet_id, type, amount, currency, payment_method,
    status, description, transaction_reference
  ) VALUES (
    v_wallet.id, 'withdrawal', p_amount, p_currency, p_payment_method,
    'pending', 'Retrait vers ' || p_account_details, p_account_details
  ) RETURNING id INTO v_transaction_id;

  -- Notify admins
  INSERT INTO notifications (user_id, title, message, type)
  SELECT ur.user_id, 'Nouvelle demande de retrait',
    format('Un retrait de %s %s a été demandé.', p_amount, p_currency), 'info'
  FROM user_roles ur WHERE ur.role = 'admin';

  RETURN json_build_object('success', true, 'transaction_id', v_transaction_id, 'message', 'Withdrawal request submitted');
END;
$$;

-- Approve withdrawal
CREATE OR REPLACE FUNCTION public.approve_withdrawal(p_transaction_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tx RECORD;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT wt.*, w.user_id as wallet_user_id INTO v_tx
  FROM wallet_transactions wt
  JOIN wallets w ON w.id = wt.wallet_id
  WHERE wt.id = p_transaction_id AND wt.type = 'withdrawal' AND wt.status = 'pending';

  IF v_tx.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Transaction not found');
  END IF;

  UPDATE wallet_transactions
  SET status = 'completed',
      description = COALESCE(description, '') || ' (Approved)',
      reference = auth.uid()::text
  WHERE id = p_transaction_id;

  INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, new_value)
  VALUES (auth.uid(), 'approve_withdrawal', 'transaction', p_transaction_id,
    json_build_object('amount', v_tx.amount, 'currency', v_tx.currency));

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_tx.wallet_user_id, 'Retrait approuvé ✓',
    format('Votre retrait de %s %s a été approuvé et sera traité sous 24-48h.', v_tx.amount, v_tx.currency), 'success');

  RETURN json_build_object('success', true, 'message', 'Withdrawal approved');
END;
$$;

-- Reject withdrawal (refund balance)
CREATE OR REPLACE FUNCTION public.reject_withdrawal(p_transaction_id uuid, p_reason text DEFAULT 'Refusé par admin')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tx RECORD;
  v_balance_field text;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT wt.*, w.user_id as wallet_user_id INTO v_tx
  FROM wallet_transactions wt
  JOIN wallets w ON w.id = wt.wallet_id
  WHERE wt.id = p_transaction_id AND wt.type = 'withdrawal' AND wt.status = 'pending';

  IF v_tx.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Transaction not found');
  END IF;

  v_balance_field := CASE v_tx.currency
    WHEN 'DOP' THEN 'balance_dop'
    WHEN 'HTG' THEN 'balance_htg'
    ELSE 'balance_usd'
  END;

  -- Refund balance
  EXECUTE format('UPDATE wallets SET %I = COALESCE(%I, 0) + $1, updated_at = now() WHERE id = $2',
    v_balance_field, v_balance_field)
  USING v_tx.amount, v_tx.wallet_id;

  UPDATE wallet_transactions
  SET status = 'failed',
      description = COALESCE(description, '') || ' - ' || p_reason,
      reference = auth.uid()::text
  WHERE id = p_transaction_id;

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_tx.wallet_user_id, 'Retrait refusé',
    'Votre demande de retrait a été refusée: ' || p_reason || '. Le montant a été remboursé.', 'error');

  RETURN json_build_object('success', true, 'message', 'Withdrawal rejected and refunded');
END;
$$;

-- Robot auto-process withdrawals
CREATE OR REPLACE FUNCTION public.robot_auto_approve_withdrawal(p_transaction_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tx RECORD;
  v_settings jsonb;
  v_max_amount numeric;
BEGIN
  SELECT setting_value INTO v_settings
  FROM admin_robot_settings
  WHERE setting_key = 'auto_approve_withdrawals' AND is_enabled = true;

  IF v_settings IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Robot auto-approval disabled');
  END IF;

  v_max_amount := COALESCE((v_settings->>'max_amount')::numeric, 10000);

  SELECT wt.*, w.user_id as wallet_user_id INTO v_tx
  FROM wallet_transactions wt
  JOIN wallets w ON w.id = wt.wallet_id
  WHERE wt.id = p_transaction_id AND wt.type = 'withdrawal' AND wt.status = 'pending'
  FOR UPDATE OF wt;

  IF v_tx.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not found');
  END IF;

  IF v_tx.amount > v_max_amount THEN
    INSERT INTO admin_robot_logs (action_type, target_id, target_type, details, status)
    VALUES ('withdrawal_approved', p_transaction_id, 'transaction',
      json_build_object('reason', 'Amount exceeds limit', 'amount', v_tx.amount), 'skipped');
    RETURN json_build_object('success', false, 'error', 'Amount exceeds limit');
  END IF;

  UPDATE wallet_transactions
  SET status = 'completed',
      description = COALESCE(description, '') || ' (Auto-approved by Robot)'
  WHERE id = p_transaction_id;

  INSERT INTO admin_robot_logs (action_type, target_id, target_type, details, status)
  VALUES ('withdrawal_approved', p_transaction_id, 'transaction',
    json_build_object('amount', v_tx.amount, 'currency', v_tx.currency), 'success');

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_tx.wallet_user_id, 'Retrait approuvé ✓',
    format('Votre retrait de %s %s a été approuvé automatiquement.', v_tx.amount, v_tx.currency), 'success');

  RETURN json_build_object('success', true, 'message', 'Withdrawal auto-approved');
END;
$$;

-- Update run_admin_robot to include withdrawals
CREATE OR REPLACE FUNCTION public.run_admin_robot()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deposits_processed int := 0;
  v_withdrawals_processed int := 0;
  v_identities_processed int := 0;
  v_sellers_processed int := 0;
  v_drivers_processed int := 0;
  v_suspensions_reports int := 0;
  v_suspensions_lost int := 0;
  v_record RECORD;
  v_result json;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Process pending deposits
  FOR v_record IN SELECT id FROM wallet_transactions WHERE type = 'deposit' AND status = 'pending' LOOP
    SELECT robot_auto_approve_deposit(v_record.id) INTO v_result;
    IF (v_result->>'success')::boolean THEN v_deposits_processed := v_deposits_processed + 1; END IF;
  END LOOP;

  -- Process pending withdrawals
  FOR v_record IN SELECT id FROM wallet_transactions WHERE type = 'withdrawal' AND status = 'pending' LOOP
    SELECT robot_auto_approve_withdrawal(v_record.id) INTO v_result;
    IF (v_result->>'success')::boolean THEN v_withdrawals_processed := v_withdrawals_processed + 1; END IF;
  END LOOP;

  -- Process pending identity verifications
  FOR v_record IN SELECT id FROM identity_verifications WHERE status = 'pending' LOOP
    SELECT robot_auto_verify_identity(v_record.id) INTO v_result;
    IF (v_result->>'success')::boolean THEN v_identities_processed := v_identities_processed + 1; END IF;
  END LOOP;

  -- Process pending seller applications
  FOR v_record IN SELECT id FROM seller_applications WHERE status = 'pending' LOOP
    SELECT robot_auto_approve_seller(v_record.id) INTO v_result;
    IF (v_result->>'success')::boolean THEN v_sellers_processed := v_sellers_processed + 1; END IF;
  END LOOP;

  -- Process pending driver applications
  FOR v_record IN SELECT id FROM driver_applications WHERE status = 'pending' LOOP
    SELECT robot_auto_approve_driver(v_record.id) INTO v_result;
    IF (v_result->>'success')::boolean THEN v_drivers_processed := v_drivers_processed + 1; END IF;
  END LOOP;

  SELECT robot_auto_suspend_reported() INTO v_result;
  v_suspensions_reports := COALESCE((v_result->>'processed')::int, 0);

  SELECT robot_auto_suspend_lost_packages() INTO v_result;
  v_suspensions_lost := COALESCE((v_result->>'processed')::int, 0);

  RETURN json_build_object(
    'success', true,
    'deposits_processed', v_deposits_processed,
    'withdrawals_processed', v_withdrawals_processed,
    'identities_processed', v_identities_processed,
    'sellers_processed', v_sellers_processed,
    'drivers_processed', v_drivers_processed,
    'suspensions_reports', v_suspensions_reports,
    'suspensions_lost_packages', v_suspensions_lost,
    'total', v_deposits_processed + v_withdrawals_processed + v_identities_processed + v_sellers_processed + v_drivers_processed + v_suspensions_reports + v_suspensions_lost
  );
END;
$$;

-- Add delete user function
CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Delete related data
  DELETE FROM notifications WHERE user_id = p_user_id;
  DELETE FROM user_roles WHERE user_id = p_user_id;
  DELETE FROM identity_verifications WHERE user_id = p_user_id;
  DELETE FROM support_tickets WHERE user_id = p_user_id;
  DELETE FROM referrals WHERE referrer_id = p_user_id OR referred_id = p_user_id;
  DELETE FROM driver_locations WHERE driver_id = p_user_id;
  DELETE FROM driver_applications WHERE user_id = p_user_id;
  DELETE FROM seller_applications WHERE user_id = p_user_id;
  
  -- Delete wallet and transactions
  DELETE FROM wallet_transactions WHERE wallet_id IN (SELECT id FROM wallets WHERE user_id = p_user_id);
  DELETE FROM wallets WHERE user_id = p_user_id;
  
  -- Delete profile
  DELETE FROM profiles WHERE user_id = p_user_id;

  INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id)
  VALUES (auth.uid(), 'delete_user', 'user', p_user_id);

  RETURN json_build_object('success', true, 'message', 'User account deleted');
END;
$$;
