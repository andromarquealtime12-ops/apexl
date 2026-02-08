
-- Add fund blocking capability to wallets
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS is_frozen boolean DEFAULT false;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS frozen_reason text;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS frozen_at timestamp with time zone;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS frozen_by uuid;

-- Add report count tracking to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS report_count integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lost_packages_count integer DEFAULT 0;

-- Add new robot settings for auto-suspension
INSERT INTO public.admin_robot_settings (setting_key, setting_value, is_enabled) 
VALUES 
  ('auto_suspend_reported', '{"min_reports": 3, "suspension_days": 7}'::jsonb, true),
  ('auto_suspend_lost_packages', '{"min_lost": 2, "suspension_days": 14}'::jsonb, true)
ON CONFLICT (setting_key) DO NOTHING;

-- Function to freeze/unfreeze wallet
CREATE OR REPLACE FUNCTION public.freeze_wallet(p_user_id uuid, p_reason text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT has_role(auth.uid(), 'admin') THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    UPDATE public.wallets
    SET is_frozen = true,
        frozen_reason = p_reason,
        frozen_at = now(),
        frozen_by = auth.uid(),
        updated_at = now()
    WHERE user_id = p_user_id;
    
    INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, new_value)
    VALUES (auth.uid(), 'freeze_wallet', 'wallet', p_user_id, json_build_object('reason', p_reason));
    
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (p_user_id, 'Portefeuille gelé', 'Votre portefeuille a été temporairement gelé. Raison: ' || p_reason, 'error');
    
    RETURN json_build_object('success', true, 'message', 'Wallet frozen');
END;
$$;

-- Function to unfreeze wallet
CREATE OR REPLACE FUNCTION public.unfreeze_wallet(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT has_role(auth.uid(), 'admin') THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    UPDATE public.wallets
    SET is_frozen = false,
        frozen_reason = NULL,
        frozen_at = NULL,
        frozen_by = NULL,
        updated_at = now()
    WHERE user_id = p_user_id;
    
    INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id)
    VALUES (auth.uid(), 'unfreeze_wallet', 'wallet', p_user_id);
    
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (p_user_id, 'Portefeuille dégelé', 'Votre portefeuille a été réactivé.', 'success');
    
    RETURN json_build_object('success', true, 'message', 'Wallet unfrozen');
END;
$$;

-- Function for robot to auto-suspend based on reports
CREATE OR REPLACE FUNCTION public.robot_auto_suspend_reported()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings jsonb;
  v_min_reports int;
  v_suspension_days int;
  v_count int := 0;
  v_user RECORD;
BEGIN
  SELECT setting_value INTO v_settings
  FROM admin_robot_settings
  WHERE setting_key = 'auto_suspend_reported' AND is_enabled = true;

  IF v_settings IS NULL THEN
    RETURN json_build_object('success', false, 'processed', 0);
  END IF;

  v_min_reports := COALESCE((v_settings->>'min_reports')::int, 3);
  v_suspension_days := COALESCE((v_settings->>'suspension_days')::int, 7);

  FOR v_user IN 
    SELECT p.user_id, p.report_count, p.full_name
    FROM profiles p
    WHERE p.report_count >= v_min_reports
    AND p.account_status = 'active'
  LOOP
    UPDATE profiles
    SET account_status = 'suspended',
        suspension_reason = 'Suspension automatique: ' || v_user.report_count || ' signalements reçus',
        suspension_until = now() + (v_suspension_days || ' days')::interval,
        updated_at = now()
    WHERE user_id = v_user.user_id;

    INSERT INTO admin_robot_logs (action_type, target_id, target_type, details, status)
    VALUES ('user_suspended', v_user.user_id, 'user',
            json_build_object('reason', 'multiple_reports', 'report_count', v_user.report_count, 'days', v_suspension_days),
            'success');

    INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_user.user_id, 'Compte suspendu', 
            'Votre compte a été suspendu pour ' || v_suspension_days || ' jours suite à plusieurs signalements.',
            'error');

    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'processed', v_count);
END;
$$;

-- Function for robot to auto-suspend for lost packages
CREATE OR REPLACE FUNCTION public.robot_auto_suspend_lost_packages()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings jsonb;
  v_min_lost int;
  v_suspension_days int;
  v_count int := 0;
  v_user RECORD;
BEGIN
  SELECT setting_value INTO v_settings
  FROM admin_robot_settings
  WHERE setting_key = 'auto_suspend_lost_packages' AND is_enabled = true;

  IF v_settings IS NULL THEN
    RETURN json_build_object('success', false, 'processed', 0);
  END IF;

  v_min_lost := COALESCE((v_settings->>'min_lost')::int, 2);
  v_suspension_days := COALESCE((v_settings->>'suspension_days')::int, 14);

  FOR v_user IN 
    SELECT p.user_id, p.lost_packages_count, p.full_name
    FROM profiles p
    WHERE p.lost_packages_count >= v_min_lost
    AND p.account_status = 'active'
  LOOP
    UPDATE profiles
    SET account_status = 'suspended',
        suspension_reason = 'Suspension automatique: ' || v_user.lost_packages_count || ' colis perdus',
        suspension_until = now() + (v_suspension_days || ' days')::interval,
        updated_at = now()
    WHERE user_id = v_user.user_id;

    -- Also freeze wallet
    UPDATE wallets
    SET is_frozen = true,
        frozen_reason = 'Suspension pour colis perdus',
        frozen_at = now()
    WHERE user_id = v_user.user_id;

    INSERT INTO admin_robot_logs (action_type, target_id, target_type, details, status)
    VALUES ('user_suspended', v_user.user_id, 'user',
            json_build_object('reason', 'lost_packages', 'count', v_user.lost_packages_count, 'days', v_suspension_days),
            'success');

    INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_user.user_id, 'Compte et portefeuille suspendus', 
            'Votre compte a été suspendu et votre portefeuille gelé suite à ' || v_user.lost_packages_count || ' colis perdus.',
            'error');

    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'processed', v_count);
END;
$$;

-- Update the main robot function to include new auto-suspensions
CREATE OR REPLACE FUNCTION public.run_admin_robot()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposits_processed int := 0;
  v_identities_processed int := 0;
  v_sellers_processed int := 0;
  v_drivers_processed int := 0;
  v_suspensions_reports int := 0;
  v_suspensions_lost int := 0;
  v_record RECORD;
  v_result json;
BEGIN
  -- Only admins can manually trigger (or system with null auth)
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

  -- Auto-suspend users with multiple reports
  SELECT robot_auto_suspend_reported() INTO v_result;
  v_suspensions_reports := COALESCE((v_result->>'processed')::int, 0);

  -- Auto-suspend users with lost packages
  SELECT robot_auto_suspend_lost_packages() INTO v_result;
  v_suspensions_lost := COALESCE((v_result->>'processed')::int, 0);

  RETURN json_build_object(
    'success', true,
    'deposits_processed', v_deposits_processed,
    'identities_processed', v_identities_processed,
    'sellers_processed', v_sellers_processed,
    'drivers_processed', v_drivers_processed,
    'suspensions_reports', v_suspensions_reports,
    'suspensions_lost_packages', v_suspensions_lost,
    'total', v_deposits_processed + v_identities_processed + v_sellers_processed + v_drivers_processed + v_suspensions_reports + v_suspensions_lost
  );
END;
$$;

-- Trigger to update report count when a report is created
CREATE OR REPLACE FUNCTION public.update_report_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reported_user_id IS NOT NULL THEN
    UPDATE profiles
    SET report_count = COALESCE(report_count, 0) + 1,
        updated_at = now()
    WHERE user_id = NEW.reported_user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_report_created ON public.reports;
CREATE TRIGGER on_report_created
  AFTER INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_report_count();
