
-- 1. Helper: always get (or create) a wallet
CREATE OR REPLACE FUNCTION public.ensure_wallet(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_id FROM public.wallets WHERE user_id = p_user_id;
  IF v_id IS NULL THEN
    INSERT INTO public.wallets (user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      SELECT id INTO v_id FROM public.wallets WHERE user_id = p_user_id;
    END IF;
  END IF;
  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.ensure_wallet(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.ensure_wallet(uuid) TO authenticated, service_role;

-- 2. Backfill missing wallets
INSERT INTO public.wallets (user_id)
SELECT u.id FROM auth.users u
LEFT JOIN public.wallets w ON w.user_id = u.id
WHERE w.id IS NULL
ON CONFLICT DO NOTHING;

-- 3. Patch settlement + transfer functions to auto-create wallets
DO $do$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='verify_delivery_code';

  v_def := replace(v_def,
    'SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = v_item.seller_id;',
    'v_seller_wallet_id := public.ensure_wallet(v_item.seller_id);');
  v_def := replace(v_def,
    'SELECT id INTO v_driver_wallet_id FROM public.wallets WHERE user_id = v_order.driver_id;',
    'v_driver_wallet_id := public.ensure_wallet(v_order.driver_id);');
  EXECUTE v_def;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='transfer_earnings_to_wallet';

  v_def := replace(v_def,
    'SELECT * INTO v_wallet FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;',
    'PERFORM public.ensure_wallet(auth.uid()); SELECT * INTO v_wallet FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;');
  EXECUTE v_def;
END;
$do$;

-- 4. Retro-credit delivered orders whose driver settlement was never recorded
DO $do$
DECLARE
  o RECORD;
  v_wid uuid;
  v_rate numeric := 5;
  v_comm numeric;
  v_field text;
BEGIN
  SELECT COALESCE(value::numeric,5) INTO v_rate FROM public.platform_settings WHERE key='cash_commission_percent';
  IF v_rate IS NULL THEN v_rate := 5; END IF;

  FOR o IN
    SELECT ord.* FROM public.orders ord
    WHERE ord.status = 'delivered' AND ord.driver_id IS NOT NULL AND ord.delivery_fee > 0
  LOOP
    v_wid := public.ensure_wallet(o.driver_id);
    IF EXISTS (SELECT 1 FROM public.wallet_transactions t
               WHERE t.wallet_id = v_wid AND t.reference = o.id::text) THEN
      CONTINUE;
    END IF;

    v_field := CASE o.currency WHEN 'DOP' THEN 'earnings_dop' WHEN 'HTG' THEN 'earnings_htg' ELSE 'earnings_usd' END;
    v_comm := ROUND(o.delivery_fee * v_rate / 100, 2);

    IF o.payment_method = 'cash' THEN
      EXECUTE format('UPDATE public.wallets SET %I = COALESCE(%I,0) - $1, updated_at = now() WHERE id = $2', v_field, v_field)
        USING v_comm, v_wid;
      INSERT INTO public.wallet_transactions (wallet_id, type, amount, currency, status, description, reference)
      VALUES (v_wid, 'commission', -v_comm, o.currency, 'completed',
        'Commission livraison cash (' || v_rate || '%) commande #' || substring(o.id::text,1,8) || ' (régularisation)', o.id::text);
    ELSE
      EXECUTE format('UPDATE public.wallets SET %I = COALESCE(%I,0) + $1, updated_at = now() WHERE id = $2', v_field, v_field)
        USING (o.delivery_fee - v_comm), v_wid;
      INSERT INTO public.wallet_transactions (wallet_id, type, amount, currency, status, description, reference)
      VALUES (v_wid, 'delivery_fee', o.delivery_fee - v_comm, o.currency, 'completed',
        'Gains livraison commande #' || substring(o.id::text,1,8) || ' (-' || v_rate || '%, régularisation)', o.id::text);
    END IF;
  END LOOP;
END;
$do$;
