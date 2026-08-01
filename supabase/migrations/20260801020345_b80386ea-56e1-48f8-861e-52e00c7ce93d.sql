-- Internal guard helper: allowed when invoked from run_admin_robot (session flag),
-- by service_role/cron (no auth.uid()), or by an admin user.
CREATE OR REPLACE FUNCTION public.robot_caller_allowed()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_flag text;
BEGIN
  BEGIN
    v_flag := current_setting('app.robot_internal', true);
  EXCEPTION WHEN OTHERS THEN
    v_flag := NULL;
  END;
  IF v_flag = 'on' THEN RETURN true; END IF;
  IF auth.uid() IS NULL THEN RETURN true; END IF;
  RETURN public.has_role(auth.uid(), 'admin');
END;
$$;

REVOKE ALL ON FUNCTION public.robot_caller_allowed() FROM PUBLIC, anon, authenticated;

-- robot_auto_approve_deposit
CREATE OR REPLACE FUNCTION public.robot_auto_approve_deposit(p_transaction_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_transaction RECORD;
  v_balance_field text;
  v_settings jsonb;
  v_max_amount numeric;
BEGIN
  IF NOT public.robot_caller_allowed() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT setting_value INTO v_settings
  FROM admin_robot_settings
  WHERE setting_key = 'auto_approve_deposits' AND is_enabled = true;

  IF v_settings IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Robot auto-approval disabled');
  END IF;

  v_max_amount := COALESCE((v_settings->>'max_amount')::numeric, 50000);

  SELECT wt.*, w.user_id as wallet_user_id INTO v_transaction
  FROM wallet_transactions wt
  JOIN wallets w ON w.id = wt.wallet_id
  WHERE wt.id = p_transaction_id AND wt.type = 'deposit' AND wt.status = 'pending'
  FOR UPDATE OF wt;

  IF v_transaction.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Transaction not found or already processed');
  END IF;

  IF v_transaction.amount > v_max_amount THEN
    INSERT INTO admin_robot_logs (action_type, target_id, target_type, details, status)
    VALUES ('deposit_approved', p_transaction_id, 'transaction',
            json_build_object('reason', 'Amount exceeds auto-approval limit', 'amount', v_transaction.amount), 'skipped');
    RETURN json_build_object('success', false, 'error', 'Amount exceeds auto-approval limit');
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
      description = COALESCE(description, '') || ' (Auto-approved by Robot Admin)'
  WHERE id = p_transaction_id;

  INSERT INTO admin_robot_logs (action_type, target_id, target_type, details, status)
  VALUES ('deposit_approved', p_transaction_id, 'transaction',
          json_build_object('amount', v_transaction.amount, 'currency', v_transaction.currency), 'success');

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_transaction.wallet_user_id, 'Dépôt approuvé ✓',
          'Votre dépôt de ' || v_transaction.amount || ' ' || v_transaction.currency || ' a été approuvé automatiquement.', 'success');

  RETURN json_build_object('success', true, 'message', 'Deposit auto-approved by robot');
END;
$function$;

-- robot_auto_approve_withdrawal
CREATE OR REPLACE FUNCTION public.robot_auto_approve_withdrawal(p_transaction_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_result json;
BEGIN
  IF NOT public.robot_caller_allowed() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  SELECT approve_withdrawal(p_transaction_id) INTO v_result;
  RETURN v_result;
END;
$function$;

-- robot_auto_approve_seller
CREATE OR REPLACE FUNCTION public.robot_auto_approve_seller(p_application_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_app RECORD;
  v_settings jsonb;
BEGIN
  IF NOT public.robot_caller_allowed() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT setting_value INTO v_settings FROM admin_robot_settings
  WHERE setting_key = 'auto_approve_sellers' AND is_enabled = true;

  IF v_settings IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Robot auto-approval disabled');
  END IF;

  SELECT * INTO v_app FROM seller_applications WHERE id = p_application_id AND status = 'pending' FOR UPDATE;
  IF v_app.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Application not found or already processed');
  END IF;

  INSERT INTO user_roles (user_id, role) VALUES (v_app.user_id, 'seller')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE seller_applications SET status = 'approved', reviewed_at = now() WHERE id = p_application_id;

  INSERT INTO admin_robot_logs (action_type, target_id, target_type, details, status)
  VALUES ('seller_approved', p_application_id, 'application',
          json_build_object('user_id', v_app.user_id, 'shop_name', v_app.shop_name), 'success');

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_app.user_id, 'Demande vendeur approuvée ✓',
          'Félicitations! Votre boutique "' || v_app.shop_name || '" a été approuvée automatiquement.', 'success');

  RETURN json_build_object('success', true, 'message', 'Seller auto-approved by robot');
END;
$function$;

-- robot_auto_approve_driver
CREATE OR REPLACE FUNCTION public.robot_auto_approve_driver(p_application_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_app RECORD;
  v_settings jsonb;
BEGIN
  IF NOT public.robot_caller_allowed() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT setting_value INTO v_settings FROM admin_robot_settings
  WHERE setting_key = 'auto_approve_drivers' AND is_enabled = true;
  IF v_settings IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Robot auto-approval disabled');
  END IF;

  SELECT * INTO v_app FROM driver_applications WHERE id = p_application_id AND status = 'pending' FOR UPDATE;
  IF v_app.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Application not found');
  END IF;

  INSERT INTO user_roles (user_id, role) VALUES (v_app.user_id, 'driver')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE driver_applications SET status = 'approved', reviewed_at = now() WHERE id = p_application_id;

  INSERT INTO admin_robot_logs (action_type, target_id, target_type, details, status)
  VALUES ('driver_approved', p_application_id, 'application',
          json_build_object('user_id', v_app.user_id), 'success');

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_app.user_id, 'Demande livreur approuvée ✓',
          'Félicitations! Votre demande de livreur a été approuvée automatiquement.', 'success');

  RETURN json_build_object('success', true);
END;
$function$;

-- robot_auto_verify_identity
CREATE OR REPLACE FUNCTION public.robot_auto_verify_identity(p_verification_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_verification RECORD;
  v_settings jsonb;
BEGIN
  IF NOT public.robot_caller_allowed() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT setting_value INTO v_settings FROM admin_robot_settings
  WHERE setting_key = 'auto_verify_identity' AND is_enabled = true;

  IF v_settings IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Robot auto-verification disabled');
  END IF;

  SELECT * INTO v_verification FROM identity_verifications
  WHERE id = p_verification_id AND status = 'pending' FOR UPDATE;

  IF v_verification.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Verification not found or already processed');
  END IF;

  IF (v_settings->>'require_all_documents')::boolean THEN
    IF v_verification.id_document_front IS NULL OR v_verification.id_document_back IS NULL OR v_verification.selfie_photo IS NULL THEN
      INSERT INTO admin_robot_logs (action_type, target_id, target_type, details, status)
      VALUES ('identity_verified', p_verification_id, 'verification', json_build_object('reason', 'Missing documents'), 'skipped');
      RETURN json_build_object('success', false, 'error', 'Missing required documents');
    END IF;
  END IF;

  UPDATE identity_verifications
  SET status = 'approved', admin_comment = 'Auto-verified by Robot Admin', reviewed_at = now(), updated_at = now()
  WHERE id = p_verification_id;

  UPDATE profiles
  SET identity_status = 'verified', trust_score = LEAST(COALESCE(trust_score, 50) + 20, 100), updated_at = now()
  WHERE user_id = v_verification.user_id;

  INSERT INTO admin_robot_logs (action_type, target_id, target_type, details, status)
  VALUES ('identity_verified', p_verification_id, 'verification', json_build_object('user_id', v_verification.user_id), 'success');

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_verification.user_id, 'Identité vérifiée ✓',
          'Votre identité a été vérifiée automatiquement. Votre score de confiance a augmenté!', 'success');

  RETURN json_build_object('success', true, 'message', 'Identity auto-verified by robot');
END;
$function$;

-- run_admin_robot: strict admin/service check + set internal flag
CREATE OR REPLACE FUNCTION public.run_admin_robot()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  PERFORM set_config('app.robot_internal', 'on', true);

  FOR v_record IN SELECT id FROM wallet_transactions WHERE type = 'deposit' AND status = 'pending' LOOP
    SELECT robot_auto_approve_deposit(v_record.id) INTO v_result;
    IF (v_result->>'success')::boolean THEN v_deposits_processed := v_deposits_processed + 1; END IF;
  END LOOP;

  FOR v_record IN SELECT id FROM wallet_transactions WHERE type = 'withdrawal' AND status = 'pending' LOOP
    SELECT robot_auto_approve_withdrawal(v_record.id) INTO v_result;
    IF (v_result->>'success')::boolean THEN v_withdrawals_processed := v_withdrawals_processed + 1; END IF;
  END LOOP;

  FOR v_record IN SELECT id FROM identity_verifications WHERE status = 'pending' LOOP
    SELECT robot_auto_verify_identity(v_record.id) INTO v_result;
    IF (v_result->>'success')::boolean THEN v_identities_processed := v_identities_processed + 1; END IF;
  END LOOP;

  FOR v_record IN SELECT id FROM seller_applications WHERE status = 'pending' LOOP
    SELECT robot_auto_approve_seller(v_record.id) INTO v_result;
    IF (v_result->>'success')::boolean THEN v_sellers_processed := v_sellers_processed + 1; END IF;
  END LOOP;

  FOR v_record IN SELECT id FROM driver_applications WHERE status = 'pending' LOOP
    SELECT robot_auto_approve_driver(v_record.id) INTO v_result;
    IF (v_result->>'success')::boolean THEN v_drivers_processed := v_drivers_processed + 1; END IF;
  END LOOP;

  SELECT robot_auto_suspend_reported() INTO v_result;
  v_suspensions_reports := COALESCE((v_result->>'processed')::int, 0);

  SELECT robot_auto_suspend_lost_packages() INTO v_result;
  v_suspensions_lost := COALESCE((v_result->>'processed')::int, 0);

  PERFORM set_config('app.robot_internal', 'off', true);

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
$function$;

-- Revoke direct EXECUTE on the internal robot functions from client roles
REVOKE ALL ON FUNCTION public.robot_auto_approve_deposit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.robot_auto_approve_withdrawal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.robot_auto_approve_seller(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.robot_auto_approve_driver(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.robot_auto_verify_identity(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.robot_caller_allowed() TO service_role;
GRANT EXECUTE ON FUNCTION public.robot_auto_approve_deposit(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.robot_auto_approve_withdrawal(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.robot_auto_approve_seller(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.robot_auto_approve_driver(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.robot_auto_verify_identity(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_admin_robot() TO authenticated, service_role;