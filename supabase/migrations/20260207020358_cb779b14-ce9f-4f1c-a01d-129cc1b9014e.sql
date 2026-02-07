-- Add new payment methods to the enum
ALTER TYPE payment_method_type ADD VALUE IF NOT EXISTS 'paypal';
ALTER TYPE payment_method_type ADD VALUE IF NOT EXISTS 'wise';
ALTER TYPE payment_method_type ADD VALUE IF NOT EXISTS 'popular';
ALTER TYPE payment_method_type ADD VALUE IF NOT EXISTS 'bank_other';

-- Create table to track admin robot automation settings
CREATE TABLE IF NOT EXISTS public.admin_robot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_robot_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can access
CREATE POLICY "Only admins can manage robot settings"
  ON public.admin_robot_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Create table to log robot automated actions
CREATE TABLE IF NOT EXISTS public.admin_robot_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL, -- 'deposit_approved', 'identity_verified', 'seller_approved', 'driver_approved', 'user_suspended'
  target_id uuid NOT NULL,
  target_type text NOT NULL, -- 'transaction', 'verification', 'application', 'user'
  details jsonb DEFAULT '{}',
  status text DEFAULT 'success', -- 'success', 'failed', 'skipped'
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_robot_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view robot logs"
  ON public.admin_robot_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert robot logs"
  ON public.admin_robot_logs
  FOR INSERT
  WITH CHECK (true);

-- Insert default robot settings
INSERT INTO public.admin_robot_settings (setting_key, setting_value, is_enabled) VALUES
  ('auto_approve_deposits', '{"max_amount": 50000, "require_proof": true}', true),
  ('auto_verify_identity', '{"require_all_documents": true}', true),
  ('auto_approve_sellers', '{"enabled": true}', true),
  ('auto_approve_drivers', '{"enabled": true}', true),
  ('auto_suspend_suspicious', '{"trust_threshold": 20}', true)
ON CONFLICT (setting_key) DO NOTHING;

-- Create function for robot to auto-approve deposits
CREATE OR REPLACE FUNCTION public.robot_auto_approve_deposit(p_transaction_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_transaction RECORD;
  v_balance_field text;
  v_settings jsonb;
  v_max_amount numeric;
BEGIN
  -- Get robot settings
  SELECT setting_value INTO v_settings
  FROM admin_robot_settings
  WHERE setting_key = 'auto_approve_deposits' AND is_enabled = true;

  IF v_settings IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Robot auto-approval disabled');
  END IF;

  v_max_amount := COALESCE((v_settings->>'max_amount')::numeric, 50000);

  -- Get transaction
  SELECT wt.*, w.user_id as wallet_user_id INTO v_transaction
  FROM wallet_transactions wt
  JOIN wallets w ON w.id = wt.wallet_id
  WHERE wt.id = p_transaction_id
  AND wt.type = 'deposit'
  AND wt.status = 'pending'
  FOR UPDATE OF wt;

  IF v_transaction.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Transaction not found or already processed');
  END IF;

  -- Check amount limit
  IF v_transaction.amount > v_max_amount THEN
    -- Log as skipped (manual review required)
    INSERT INTO admin_robot_logs (action_type, target_id, target_type, details, status)
    VALUES ('deposit_approved', p_transaction_id, 'transaction', 
            json_build_object('reason', 'Amount exceeds auto-approval limit', 'amount', v_transaction.amount),
            'skipped');
    RETURN json_build_object('success', false, 'error', 'Amount exceeds limit, requires manual review');
  END IF;

  -- Check if proof is required and present
  IF (v_settings->>'require_proof')::boolean AND v_transaction.proof_image_url IS NULL THEN
    INSERT INTO admin_robot_logs (action_type, target_id, target_type, details, status)
    VALUES ('deposit_approved', p_transaction_id, 'transaction',
            json_build_object('reason', 'Proof required but not provided'),
            'skipped');
    RETURN json_build_object('success', false, 'error', 'Proof required');
  END IF;

  -- Determine balance field
  v_balance_field := CASE v_transaction.currency
    WHEN 'DOP' THEN 'balance_dop'
    WHEN 'HTG' THEN 'balance_htg'
    ELSE 'balance_usd'
  END;

  -- Update wallet balance
  EXECUTE format('UPDATE wallets SET %I = COALESCE(%I, 0) + $1, updated_at = now() WHERE id = $2',
    v_balance_field, v_balance_field)
  USING v_transaction.amount, v_transaction.wallet_id;

  -- Update transaction status
  UPDATE wallet_transactions
  SET status = 'completed',
      description = COALESCE(description, '') || ' (Auto-approved by Robot)',
      reference = 'ROBOT_AUTO'
  WHERE id = p_transaction_id;

  -- Log success
  INSERT INTO admin_robot_logs (action_type, target_id, target_type, details, status)
  VALUES ('deposit_approved', p_transaction_id, 'transaction',
          json_build_object('amount', v_transaction.amount, 'currency', v_transaction.currency),
          'success');

  -- Notify user
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_transaction.wallet_user_id, 'Dépôt approuvé ✓', 
          format('Votre dépôt de %s %s a été approuvé automatiquement.', v_transaction.amount, v_transaction.currency),
          'success');

  RETURN json_build_object('success', true, 'message', 'Deposit auto-approved by robot');
END;
$$;

-- Create function for robot to auto-verify identity
CREATE OR REPLACE FUNCTION public.robot_auto_verify_identity(p_verification_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_verification RECORD;
  v_settings jsonb;
BEGIN
  -- Get robot settings
  SELECT setting_value INTO v_settings
  FROM admin_robot_settings
  WHERE setting_key = 'auto_verify_identity' AND is_enabled = true;

  IF v_settings IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Robot auto-verification disabled');
  END IF;

  -- Get verification
  SELECT * INTO v_verification
  FROM identity_verifications
  WHERE id = p_verification_id AND status = 'pending'
  FOR UPDATE;

  IF v_verification.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Verification not found or already processed');
  END IF;

  -- Check if all documents are provided
  IF (v_settings->>'require_all_documents')::boolean THEN
    IF v_verification.id_document_front IS NULL OR 
       v_verification.id_document_back IS NULL OR 
       v_verification.selfie_photo IS NULL THEN
      INSERT INTO admin_robot_logs (action_type, target_id, target_type, details, status)
      VALUES ('identity_verified', p_verification_id, 'verification',
              json_build_object('reason', 'Missing documents'),
              'skipped');
      RETURN json_build_object('success', false, 'error', 'Missing required documents');
    END IF;
  END IF;

  -- Auto-approve
  UPDATE identity_verifications
  SET status = 'approved',
      admin_comment = 'Auto-verified by Robot Admin',
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_verification_id;

  -- Update user profile
  UPDATE profiles
  SET identity_status = 'verified',
      trust_score = LEAST(COALESCE(trust_score, 50) + 20, 100),
      updated_at = now()
  WHERE user_id = v_verification.user_id;

  -- Log success
  INSERT INTO admin_robot_logs (action_type, target_id, target_type, details, status)
  VALUES ('identity_verified', p_verification_id, 'verification',
          json_build_object('user_id', v_verification.user_id),
          'success');

  -- Notify user
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_verification.user_id, 'Identité vérifiée ✓', 
          'Votre identité a été vérifiée automatiquement. Votre score de confiance a augmenté!',
          'success');

  RETURN json_build_object('success', true, 'message', 'Identity auto-verified by robot');
END;
$$;

-- Create function for robot to auto-approve seller applications
CREATE OR REPLACE FUNCTION public.robot_auto_approve_seller(p_application_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_app RECORD;
  v_settings jsonb;
BEGIN
  SELECT setting_value INTO v_settings
  FROM admin_robot_settings
  WHERE setting_key = 'auto_approve_sellers' AND is_enabled = true;

  IF v_settings IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Robot auto-approval disabled');
  END IF;

  SELECT * INTO v_app
  FROM seller_applications
  WHERE id = p_application_id AND status = 'pending'
  FOR UPDATE;

  IF v_app.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Application not found or already processed');
  END IF;

  -- Auto-approve
  INSERT INTO user_roles (user_id, role) VALUES (v_app.user_id, 'seller')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE seller_applications
  SET status = 'approved',
      reviewed_at = now()
  WHERE id = p_application_id;

  INSERT INTO admin_robot_logs (action_type, target_id, target_type, details, status)
  VALUES ('seller_approved', p_application_id, 'application',
          json_build_object('user_id', v_app.user_id, 'shop_name', v_app.shop_name),
          'success');

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_app.user_id, 'Demande vendeur approuvée ✓', 
          'Félicitations! Votre boutique "' || v_app.shop_name || '" a été approuvée automatiquement.',
          'success');

  RETURN json_build_object('success', true, 'message', 'Seller auto-approved by robot');
END;
$$;

-- Create function for robot to auto-approve driver applications
CREATE OR REPLACE FUNCTION public.robot_auto_approve_driver(p_application_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_app RECORD;
  v_settings jsonb;
BEGIN
  SELECT setting_value INTO v_settings
  FROM admin_robot_settings
  WHERE setting_key = 'auto_approve_drivers' AND is_enabled = true;

  IF v_settings IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Robot auto-approval disabled');
  END IF;

  SELECT * INTO v_app
  FROM driver_applications
  WHERE id = p_application_id AND status = 'pending'
  FOR UPDATE;

  IF v_app.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Application not found or already processed');
  END IF;

  INSERT INTO user_roles (user_id, role) VALUES (v_app.user_id, 'driver')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE driver_applications
  SET status = 'approved',
      reviewed_at = now()
  WHERE id = p_application_id;

  INSERT INTO admin_robot_logs (action_type, target_id, target_type, details, status)
  VALUES ('driver_approved', p_application_id, 'application',
          json_build_object('user_id', v_app.user_id, 'vehicle', v_app.vehicle_brand || ' ' || COALESCE(v_app.vehicle_model, '')),
          'success');

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_app.user_id, 'Demande livreur approuvée ✓', 
          'Félicitations! Vous êtes maintenant livreur officiel sur Ayiti Marché.',
          'success');

  RETURN json_build_object('success', true, 'message', 'Driver auto-approved by robot');
END;
$$;

-- Master function to run the robot on all pending items
CREATE OR REPLACE FUNCTION public.run_admin_robot()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deposits_processed int := 0;
  v_identities_processed int := 0;
  v_sellers_processed int := 0;
  v_drivers_processed int := 0;
  v_record RECORD;
  v_result json;
BEGIN
  -- Only admins can manually trigger
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Process pending deposits
  FOR v_record IN SELECT id FROM wallet_transactions WHERE type = 'deposit' AND status = 'pending' LOOP
    SELECT robot_auto_approve_deposit(v_record.id) INTO v_result;
    IF (v_result->>'success')::boolean THEN
      v_deposits_processed := v_deposits_processed + 1;
    END IF;
  END LOOP;

  -- Process pending identity verifications
  FOR v_record IN SELECT id FROM identity_verifications WHERE status = 'pending' LOOP
    SELECT robot_auto_verify_identity(v_record.id) INTO v_result;
    IF (v_result->>'success')::boolean THEN
      v_identities_processed := v_identities_processed + 1;
    END IF;
  END LOOP;

  -- Process pending seller applications
  FOR v_record IN SELECT id FROM seller_applications WHERE status = 'pending' LOOP
    SELECT robot_auto_approve_seller(v_record.id) INTO v_result;
    IF (v_result->>'success')::boolean THEN
      v_sellers_processed := v_sellers_processed + 1;
    END IF;
  END LOOP;

  -- Process pending driver applications
  FOR v_record IN SELECT id FROM driver_applications WHERE status = 'pending' LOOP
    SELECT robot_auto_approve_driver(v_record.id) INTO v_result;
    IF (v_result->>'success')::boolean THEN
      v_drivers_processed := v_drivers_processed + 1;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'deposits_processed', v_deposits_processed,
    'identities_processed', v_identities_processed,
    'sellers_processed', v_sellers_processed,
    'drivers_processed', v_drivers_processed,
    'total', v_deposits_processed + v_identities_processed + v_sellers_processed + v_drivers_processed
  );
END;
$$;