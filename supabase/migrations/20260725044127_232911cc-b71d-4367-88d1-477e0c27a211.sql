
-- 1. Fix "permission denied for table profiles" for authenticated users
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 2. Escrow + 5% commission model on delivery confirmation.
-- Buyer entering the delivery code releases funds. Cash orders show status "cash",
-- driver hands cash to seller in person, and app deducts 5% commission from BOTH
-- seller and driver wallets.
CREATE OR REPLACE FUNCTION public.verify_delivery_code(p_order_id uuid, p_code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_verification RECORD;
    v_order RECORD;
    v_seller_wallet_id uuid;
    v_driver_wallet_id uuid;
    v_item RECORD;
    v_commission_rate numeric;
    v_seller_commission numeric;
    v_driver_commission numeric;
    v_balance_field text;
    v_seller_net numeric;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM orders WHERE id = p_order_id AND driver_id = auth.uid()) THEN
      RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    SELECT * INTO v_verification FROM public.delivery_verification WHERE order_id = p_order_id AND status = 'picked_up';
    IF v_verification.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Verification record not found');
    END IF;
    IF v_verification.pickup_verified_at < now() - interval '24 hours' THEN
        RETURN json_build_object('success', false, 'error', 'Code de livraison expiré. Contactez le support.');
    END IF;
    IF v_verification.attempt_count >= 10 THEN
        RETURN json_build_object('success', false, 'error', 'Too many attempts. Contact support.');
    END IF;

    PERFORM set_config('app.bypass_order_guard', 'on', true);

    UPDATE public.delivery_verification SET attempt_count = attempt_count + 1 WHERE id = v_verification.id;
    IF v_verification.delivery_code != p_code THEN
        PERFORM set_config('app.bypass_order_guard', 'off', true);
        RETURN json_build_object('success', false, 'error', 'Code de livraison invalide');
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;

    UPDATE public.delivery_verification
    SET status = 'delivered', delivery_verified_at = now(), attempt_count = 0, updated_at = now()
    WHERE id = v_verification.id;

    UPDATE public.orders SET status = 'delivered', payment_status = 'paid_to_seller', updated_at = now() WHERE id = p_order_id;
    PERFORM set_config('app.bypass_order_guard', 'off', true);

    SELECT COALESCE(value::numeric, 5) INTO v_commission_rate
    FROM public.platform_settings WHERE key = 'cash_commission_percent';
    IF v_commission_rate IS NULL THEN v_commission_rate := 5; END IF;

    v_balance_field := CASE v_order.currency
      WHEN 'DOP' THEN 'balance_dop'
      WHEN 'HTG' THEN 'balance_htg'
      ELSE 'balance_usd'
    END;

    -- Seller settlement: credit sale net of 5% for wallet-paid orders.
    -- For cash orders, seller already received cash from driver in person AND
    -- was pre-charged 5% at checkout (process_cash_checkout) — skip crediting.
    FOR v_item IN
        SELECT seller_id, SUM(total_price) as seller_total
        FROM public.order_items WHERE order_id = p_order_id GROUP BY seller_id
    LOOP
        IF v_item.seller_id IS NOT NULL THEN
            SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = v_item.seller_id;
            IF v_seller_wallet_id IS NOT NULL THEN
                v_seller_commission := ROUND(v_item.seller_total * v_commission_rate / 100, 2);

                IF v_order.payment_method = 'cash' THEN
                    -- Nothing to credit; commission already taken at checkout.
                    NULL;
                ELSE
                    v_seller_net := v_item.seller_total - v_seller_commission;
                    EXECUTE format('UPDATE public.wallets SET %I = COALESCE(%I,0) + $1, updated_at = now() WHERE id = $2',
                      v_balance_field, v_balance_field)
                    USING v_seller_net, v_seller_wallet_id;

                    INSERT INTO public.wallet_transactions (wallet_id, type, amount, currency, status, description, reference)
                    VALUES (v_seller_wallet_id, 'payment', v_seller_net, v_order.currency, 'completed',
                      'Vente commande #' || substring(p_order_id::text,1,8) || ' (net -' || v_commission_rate || '%)',
                      p_order_id::text);

                    INSERT INTO public.wallet_transactions (wallet_id, type, amount, currency, status, description, reference)
                    VALUES (v_seller_wallet_id, 'commission', -v_seller_commission, v_order.currency, 'completed',
                      'Commission plateforme (' || v_commission_rate || '%) commande #' || substring(p_order_id::text,1,8),
                      p_order_id::text);
                END IF;
            END IF;
        END IF;
    END LOOP;

    -- Driver settlement: for wallet orders, credit full delivery fee then deduct 5%.
    -- For cash orders, driver already collected fee in cash — only deduct 5% commission
    -- (wallet can go negative; 24h grace before suspension via cleanup job).
    IF v_order.driver_id IS NOT NULL AND v_order.delivery_fee > 0 THEN
        SELECT id INTO v_driver_wallet_id FROM public.wallets WHERE user_id = v_order.driver_id;
        IF v_driver_wallet_id IS NOT NULL THEN
            v_driver_commission := ROUND(v_order.delivery_fee * v_commission_rate / 100, 2);

            IF v_order.payment_method = 'cash' THEN
                EXECUTE format('UPDATE public.wallets SET %I = COALESCE(%I,0) - $1, updated_at = now() WHERE id = $2',
                  v_balance_field, v_balance_field)
                USING v_driver_commission, v_driver_wallet_id;

                INSERT INTO public.wallet_transactions (wallet_id, type, amount, currency, status, description, reference)
                VALUES (v_driver_wallet_id, 'commission', -v_driver_commission, v_order.currency, 'completed',
                  'Commission livraison cash (' || v_commission_rate || '%) commande #' || substring(p_order_id::text,1,8),
                  p_order_id::text);
            ELSE
                EXECUTE format('UPDATE public.wallets SET %I = COALESCE(%I,0) + $1, updated_at = now() WHERE id = $2',
                  v_balance_field, v_balance_field)
                USING (v_order.delivery_fee - v_driver_commission), v_driver_wallet_id;

                INSERT INTO public.wallet_transactions (wallet_id, type, amount, currency, status, description, reference)
                VALUES (v_driver_wallet_id, 'delivery_fee', v_order.delivery_fee - v_driver_commission, v_order.currency, 'completed',
                  'Frais livraison net commande #' || substring(p_order_id::text,1,8) || ' (-' || v_commission_rate || '%)',
                  p_order_id::text);

                INSERT INTO public.wallet_transactions (wallet_id, type, amount, currency, status, description, reference)
                VALUES (v_driver_wallet_id, 'commission', -v_driver_commission, v_order.currency, 'completed',
                  'Commission plateforme livraison (' || v_commission_rate || '%) commande #' || substring(p_order_id::text,1,8),
                  p_order_id::text);
            END IF;
        END IF;
    END IF;

    -- Mark wallets with negative balances (grace period starts now, cleanup job suspends after 24h)
    UPDATE public.wallets
    SET frozen_reason = COALESCE(frozen_reason, 'negative_balance_grace:' || now()::text)
    WHERE id IN (v_seller_wallet_id, v_driver_wallet_id)
      AND (balance_dop < 0 OR balance_htg < 0 OR balance_usd < 0)
      AND frozen_reason IS NULL;

    INSERT INTO notifications (user_id, title, message, type, action_url)
    VALUES (v_order.buyer_id, '✅ Commande livrée', 'Votre commande a été livrée avec succès.', 'success', '/track/' || p_order_id::text);

    RETURN json_build_object('success', true, 'message', 'Delivery verified successfully');
END;
$function$;

-- 3. Suspend wallets that remain negative more than 24h
CREATE OR REPLACE FUNCTION public.enforce_negative_balance_suspension()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer := 0;
  v_grace_start timestamptz;
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT id, user_id, frozen_reason
    FROM public.wallets
    WHERE (balance_dop < 0 OR balance_htg < 0 OR balance_usd < 0)
      AND is_frozen = false
      AND frozen_reason LIKE 'negative_balance_grace:%'
  LOOP
    BEGIN
      v_grace_start := substring(v_rec.frozen_reason from 'negative_balance_grace:(.*)')::timestamptz;
      IF v_grace_start < now() - interval '24 hours' THEN
        UPDATE public.wallets
        SET is_frozen = true,
            frozen_at = now(),
            frozen_reason = 'Suspension automatique: solde négatif > 24h'
        WHERE id = v_rec.id;
        v_count := v_count + 1;

        INSERT INTO notifications (user_id, title, message, type)
        VALUES (v_rec.user_id, '⛔ Compte suspendu',
          'Votre portefeuille est suspendu: solde négatif depuis plus de 24h. Rechargez pour réactiver.',
          'error');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Skip malformed timestamps
      NULL;
    END;

    -- Clear grace marker if balance is now positive
    IF v_rec.frozen_reason LIKE 'negative_balance_grace:%' THEN
      UPDATE public.wallets
      SET frozen_reason = NULL
      WHERE id = v_rec.id
        AND balance_dop >= 0 AND balance_htg >= 0 AND balance_usd >= 0;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_negative_balance_suspension() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_negative_balance_suspension() TO service_role;
