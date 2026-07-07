
-- 1) approve_deposit / reject_deposit: drop admin_id_input, use auth.uid()
DROP FUNCTION IF EXISTS public.approve_deposit(uuid, uuid);
DROP FUNCTION IF EXISTS public.reject_deposit(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.approve_deposit(transaction_id_input uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  VALUES (v_admin, 'approve_deposit', 'wallet_transaction', transaction_id_input);

  RETURN json_build_object('success', true, 'message', 'Deposit approved successfully');
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_deposit(transaction_id_input uuid, reason_input text DEFAULT 'Rejected by administrator'::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  VALUES (v_admin, 'reject_deposit', 'wallet_transaction', transaction_id_input, jsonb_build_object('reason', reason_input));

  RETURN json_build_object('success', true, 'message', 'Deposit rejected');
END;
$$;

REVOKE ALL ON FUNCTION public.approve_deposit(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_deposit(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_deposit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_deposit(uuid, text) TO authenticated;

-- 2) Add admin-only guard + revoke public execute on robot_auto_* functions.
-- These wrap SECURITY DEFINER logic; add caller check so only admins (or run_admin_robot) can invoke.
DO $$
DECLARE
  v_fn text;
  v_fns text[] := ARRAY[
    'robot_auto_approve_deposit(uuid)',
    'robot_auto_approve_withdrawal(uuid)',
    'robot_auto_approve_seller(uuid)',
    'robot_auto_approve_driver(uuid)',
    'robot_auto_verify_identity(uuid)',
    'robot_auto_suspend_reported()',
    'robot_auto_suspend_lost_packages()'
  ];
BEGIN
  FOREACH v_fn IN ARRAY v_fns LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', v_fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', v_fn);
    EXCEPTION WHEN undefined_function THEN
      -- skip if function doesn't exist in this env
      NULL;
    END;
  END LOOP;
END$$;

-- Add a defense-in-depth caller check inside each robot function.
-- They run as SECURITY DEFINER so auth.uid() reflects the true caller.
-- run_admin_robot() itself already checks admin and stays SECURITY DEFINER,
-- but auth.uid() is preserved across nested calls, so we allow either admin
-- role or NULL auth (cron/service_role invocation).

CREATE OR REPLACE FUNCTION public.robot_auto_approve_deposit(p_transaction_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_transaction RECORD;
  v_balance_field text;
  v_settings jsonb;
  v_max_amount numeric;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'admin') THEN
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
    RETURN json_build_object('success', false, 'error', 'Amount exceeds limit, requires manual review');
  END IF;

  IF (v_settings->>'require_proof')::boolean AND v_transaction.proof_image_url IS NULL THEN
    INSERT INTO admin_robot_logs (action_type, target_id, target_type, details, status)
    VALUES ('deposit_approved', p_transaction_id, 'transaction',
            json_build_object('reason', 'Proof required but not provided'), 'skipped');
    RETURN json_build_object('success', false, 'error', 'Proof required');
  END IF;

  v_balance_field := CASE v_transaction.currency WHEN 'DOP' THEN 'balance_dop' WHEN 'HTG' THEN 'balance_htg' ELSE 'balance_usd' END;

  EXECUTE format('UPDATE wallets SET %I = COALESCE(%I, 0) + $1, updated_at = now() WHERE id = $2', v_balance_field, v_balance_field)
  USING v_transaction.amount, v_transaction.wallet_id;

  UPDATE wallet_transactions
  SET status = 'completed', description = COALESCE(description, '') || ' (Auto-approved by Robot)', reference = 'ROBOT_AUTO'
  WHERE id = p_transaction_id;

  INSERT INTO admin_robot_logs (action_type, target_id, target_type, details, status)
  VALUES ('deposit_approved', p_transaction_id, 'transaction',
          json_build_object('amount', v_transaction.amount, 'currency', v_transaction.currency), 'success');

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_transaction.wallet_user_id, 'Dépôt approuvé ✓',
          format('Votre dépôt de %s %s a été approuvé automatiquement.', v_transaction.amount, v_transaction.currency), 'success');

  RETURN json_build_object('success', true, 'message', 'Deposit auto-approved by robot');
END;
$$;

CREATE OR REPLACE FUNCTION public.robot_auto_verify_identity(p_verification_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_verification RECORD;
  v_settings jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'admin') THEN
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
$$;

CREATE OR REPLACE FUNCTION public.robot_auto_approve_seller(p_application_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_app RECORD;
  v_settings jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'admin') THEN
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
$$;

-- robot_auto_approve_withdrawal and robot_auto_approve_driver: add same guard by wrapping existing body
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'robot_auto_approve_withdrawal') THEN
    EXECUTE $q$
      CREATE OR REPLACE FUNCTION public.robot_auto_approve_withdrawal(p_transaction_id uuid)
      RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
      AS $body$
      DECLARE v_result json;
      BEGIN
        IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'admin') THEN
          RETURN json_build_object('success', false, 'error', 'Unauthorized');
        END IF;
        -- delegate to admin approval path
        SELECT approve_withdrawal(p_transaction_id) INTO v_result;
        RETURN v_result;
      END;
      $body$;
    $q$;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'robot_auto_approve_driver') THEN
    EXECUTE $q$
      CREATE OR REPLACE FUNCTION public.robot_auto_approve_driver(p_application_id uuid)
      RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
      AS $body$
      DECLARE v_app RECORD; v_settings jsonb;
      BEGIN
        IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'admin') THEN
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
      $body$;
    $q$;
  END IF;
END$$;

-- Re-apply revoke after recreation
DO $$
DECLARE
  v_fn text;
  v_fns text[] := ARRAY[
    'robot_auto_approve_deposit(uuid)',
    'robot_auto_approve_withdrawal(uuid)',
    'robot_auto_approve_seller(uuid)',
    'robot_auto_approve_driver(uuid)',
    'robot_auto_verify_identity(uuid)'
  ];
BEGIN
  FOREACH v_fn IN ARRAY v_fns LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', v_fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', v_fn);
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
  END LOOP;
END$$;
