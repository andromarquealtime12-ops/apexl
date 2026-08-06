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
  -- Only real admins, or trusted server-side roles (service_role / postgres), may run the robot.
  IF NOT (
    (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'))
    OR current_user IN ('service_role', 'postgres', 'supabase_admin')
  ) THEN
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

  SELECT COALESCE((robot_auto_suspend_reported()->>'suspended')::int, 0) INTO v_suspensions_reports;
  SELECT COALESCE((robot_auto_suspend_lost_packages()->>'suspended')::int, 0) INTO v_suspensions_lost;

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
    'total', v_deposits_processed + v_withdrawals_processed + v_identities_processed
             + v_sellers_processed + v_drivers_processed + v_suspensions_reports + v_suspensions_lost
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.run_admin_robot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_admin_robot() TO authenticated, service_role;