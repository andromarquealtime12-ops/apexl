CREATE OR REPLACE FUNCTION public.cancel_pending_moncash_deposits(p_reason text DEFAULT 'Transfert MonCash non confirmé'::text, p_older_than_minutes integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_wallet_id uuid;
  v_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Non authentifié');
  END IF;
  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = auth.uid();
  IF v_wallet_id IS NULL THEN
    RETURN json_build_object('success', true, 'cancelled', 0);
  END IF;

  UPDATE public.wallet_transactions
     SET status = 'failed',
         description = COALESCE(description, '') || ' — annulé: ' || p_reason
   WHERE wallet_id = v_wallet_id
     AND type = 'deposit'
     AND status = 'pending'
     AND payment_method = 'moncash'
     AND created_at < now() - make_interval(mins => GREATEST(COALESCE(p_older_than_minutes, 0), 0));
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN json_build_object('success', true, 'cancelled', v_count);
END;
$function$;