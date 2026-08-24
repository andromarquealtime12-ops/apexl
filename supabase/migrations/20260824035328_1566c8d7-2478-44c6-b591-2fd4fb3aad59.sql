CREATE OR REPLACE FUNCTION public.approve_deposit(transaction_id_input uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_transaction RECORD;
  v_balance_field text;
  v_admin uuid := auth.uid();
BEGIN
  IF v_admin IS NULL OR NOT has_role(v_admin, 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: Admin role required');
  END IF;

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

  v_balance_field := CASE v_transaction.currency
    WHEN 'DOP' THEN 'balance_dop'
    WHEN 'HTG' THEN 'balance_htg'
    ELSE 'balance_usd'
  END;

  EXECUTE format('UPDATE wallets SET %I = COALESCE(%I, 0) + $1, updated_at = now() WHERE id = $2',
    v_balance_field, v_balance_field)
  USING v_transaction.amount, v_transaction.wallet_id;

  UPDATE wallet_transactions
  SET status = 'completed',
      description = COALESCE(description, '') || ' (Approved by admin)',
      reference = v_admin::text
  WHERE id = transaction_id_input;

  INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id)
  VALUES (v_admin, 'approve_deposit', 'transaction', transaction_id_input);

  RETURN json_build_object('success', true, 'message', 'Deposit approved successfully');
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_deposit(transaction_id_input uuid, reason_input text DEFAULT 'Rejected by administrator'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := auth.uid();
BEGIN
  IF v_admin IS NULL OR NOT has_role(v_admin, 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: Admin role required');
  END IF;

  UPDATE wallet_transactions
  SET status = 'failed',
      description = COALESCE(description, '') || ' - ' || reason_input,
      reference = v_admin::text
  WHERE id = transaction_id_input
    AND type = 'deposit'
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Transaction not found or already processed');
  END IF;

  INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, new_value)
  VALUES (v_admin, 'reject_deposit', 'transaction', transaction_id_input, jsonb_build_object('reason', reason_input));

  RETURN json_build_object('success', true, 'message', 'Deposit rejected');
END;
$function$;