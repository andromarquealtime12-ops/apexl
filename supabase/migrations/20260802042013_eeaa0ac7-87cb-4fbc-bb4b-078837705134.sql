
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS earnings_dop numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earnings_htg numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earnings_usd numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.verify_delivery_code(p_order_id uuid, p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_verification RECORD;
    v_order RECORD;
    v_seller_wallet_id uuid;
    v_driver_wallet_id uuid;
    v_item RECORD;
    v_commission_rate numeric;
    v_seller_commission numeric;
    v_driver_commission numeric;
    v_earn_field text;
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

    v_earn_field := CASE v_order.currency
      WHEN 'DOP' THEN 'earnings_dop'
      WHEN 'HTG' THEN 'earnings_htg'
      ELSE 'earnings_usd'
    END;

    -- Seller settlement -> EARNINGS balance (not main wallet)
    FOR v_item IN
        SELECT seller_id, SUM(total_price) as seller_total
        FROM public.order_items WHERE order_id = p_order_id GROUP BY seller_id
    LOOP
        IF v_item.seller_id IS NOT NULL THEN
            SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = v_item.seller_id;
            IF v_seller_wallet_id IS NOT NULL THEN
                v_seller_commission := ROUND(v_item.seller_total * v_commission_rate / 100, 2);

                IF v_order.payment_method = 'cash' THEN
                    -- Cash: seller received cash in person; platform commission is auto-debited
                    -- from earnings (may go negative).
                    EXECUTE format('UPDATE public.wallets SET %I = COALESCE(%I,0) - $1, updated_at = now() WHERE id = $2',
                      v_earn_field, v_earn_field)
                    USING v_seller_commission, v_seller_wallet_id;

                    INSERT INTO public.wallet_transactions (wallet_id, type, amount, currency, status, description, reference)
                    VALUES (v_seller_wallet_id, 'commission', -v_seller_commission, v_order.currency, 'completed',
                      'Commission plateforme cash (' || v_commission_rate || '%) commande #' || substring(p_order_id::text,1,8),
                      p_order_id::text);
                ELSE
                    v_seller_net := v_item.seller_total - v_seller_commission;
                    EXECUTE format('UPDATE public.wallets SET %I = COALESCE(%I,0) + $1, updated_at = now() WHERE id = $2',
                      v_earn_field, v_earn_field)
                    USING v_seller_net, v_seller_wallet_id;

                    INSERT INTO public.wallet_transactions (wallet_id, type, amount, currency, status, description, reference)
                    VALUES (v_seller_wallet_id, 'payment', v_seller_net, v_order.currency, 'completed',
                      'Gains vente commande #' || substring(p_order_id::text,1,8) || ' (net -' || v_commission_rate || '%)',
                      p_order_id::text);

                    INSERT INTO public.wallet_transactions (wallet_id, type, amount, currency, status, description, reference)
                    VALUES (v_seller_wallet_id, 'commission', -v_seller_commission, v_order.currency, 'completed',
                      'Commission plateforme (' || v_commission_rate || '%) commande #' || substring(p_order_id::text,1,8),
                      p_order_id::text);
                END IF;
            END IF;
        END IF;
    END LOOP;

    -- Driver settlement -> EARNINGS balance
    IF v_order.driver_id IS NOT NULL AND v_order.delivery_fee > 0 THEN
        SELECT id INTO v_driver_wallet_id FROM public.wallets WHERE user_id = v_order.driver_id;
        IF v_driver_wallet_id IS NOT NULL THEN
            v_driver_commission := ROUND(v_order.delivery_fee * v_commission_rate / 100, 2);

            IF v_order.payment_method = 'cash' THEN
                EXECUTE format('UPDATE public.wallets SET %I = COALESCE(%I,0) - $1, updated_at = now() WHERE id = $2',
                  v_earn_field, v_earn_field)
                USING v_driver_commission, v_driver_wallet_id;

                INSERT INTO public.wallet_transactions (wallet_id, type, amount, currency, status, description, reference)
                VALUES (v_driver_wallet_id, 'commission', -v_driver_commission, v_order.currency, 'completed',
                  'Commission livraison cash (' || v_commission_rate || '%) commande #' || substring(p_order_id::text,1,8),
                  p_order_id::text);
            ELSE
                EXECUTE format('UPDATE public.wallets SET %I = COALESCE(%I,0) + $1, updated_at = now() WHERE id = $2',
                  v_earn_field, v_earn_field)
                USING (v_order.delivery_fee - v_driver_commission), v_driver_wallet_id;

                INSERT INTO public.wallet_transactions (wallet_id, type, amount, currency, status, description, reference)
                VALUES (v_driver_wallet_id, 'delivery_fee', v_order.delivery_fee - v_driver_commission, v_order.currency, 'completed',
                  'Gains livraison commande #' || substring(p_order_id::text,1,8) || ' (-' || v_commission_rate || '%)',
                  p_order_id::text);

                INSERT INTO public.wallet_transactions (wallet_id, type, amount, currency, status, description, reference)
                VALUES (v_driver_wallet_id, 'commission', -v_driver_commission, v_order.currency, 'completed',
                  'Commission plateforme livraison (' || v_commission_rate || '%) commande #' || substring(p_order_id::text,1,8),
                  p_order_id::text);
            END IF;
        END IF;
    END IF;

    UPDATE public.wallets
    SET frozen_reason = COALESCE(frozen_reason, 'negative_balance_grace:' || now()::text)
    WHERE id IN (v_seller_wallet_id, v_driver_wallet_id)
      AND (balance_dop < 0 OR balance_htg < 0 OR balance_usd < 0
           OR earnings_dop < 0 OR earnings_htg < 0 OR earnings_usd < 0)
      AND frozen_reason IS NULL;

    INSERT INTO notifications (user_id, title, message, type, action_url)
    VALUES (v_order.buyer_id, '✅ Commande livrée', 'Votre commande a été livrée avec succès.', 'success', '/track/' || p_order_id::text);

    RETURN json_build_object('success', true, 'message', 'Delivery verified successfully');
END;
$fn$;

CREATE OR REPLACE FUNCTION public.transfer_earnings_to_wallet(p_amount numeric, p_currency text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_wallet RECORD;
  v_earn_field text;
  v_bal_field text;
  v_available numeric;
  v_fee numeric;
  v_net numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Non authentifié');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Montant invalide');
  END IF;
  IF p_currency NOT IN ('DOP','HTG','USD') THEN
    RETURN json_build_object('success', false, 'error', 'Devise invalide');
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF v_wallet.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Portefeuille introuvable');
  END IF;
  IF v_wallet.is_frozen THEN
    RETURN json_build_object('success', false, 'error', 'Portefeuille gelé');
  END IF;

  v_earn_field := CASE p_currency WHEN 'DOP' THEN 'earnings_dop' WHEN 'HTG' THEN 'earnings_htg' ELSE 'earnings_usd' END;
  v_bal_field  := CASE p_currency WHEN 'DOP' THEN 'balance_dop'  WHEN 'HTG' THEN 'balance_htg'  ELSE 'balance_usd'  END;

  EXECUTE format('SELECT COALESCE(%I,0) FROM public.wallets WHERE id = $1', v_earn_field)
    INTO v_available USING v_wallet.id;

  IF v_available <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Aucun gain disponible (solde négatif ou nul)');
  END IF;
  IF p_amount > v_available THEN
    RETURN json_build_object('success', false, 'error', 'Gains insuffisants');
  END IF;

  v_fee := ROUND(p_amount * 1 / 100, 2);
  v_net := p_amount - v_fee;

  EXECUTE format('UPDATE public.wallets SET %I = COALESCE(%I,0) - $1, %I = COALESCE(%I,0) + $2, updated_at = now() WHERE id = $3',
    v_earn_field, v_earn_field, v_bal_field, v_bal_field)
  USING p_amount, v_net, v_wallet.id;

  INSERT INTO public.wallet_transactions (wallet_id, type, amount, currency, status, description)
  VALUES (v_wallet.id, 'transfer', v_net, p_currency, 'completed', 'Transfert gains vers portefeuille principal (frais 1%)');

  INSERT INTO public.wallet_transactions (wallet_id, type, amount, currency, status, description)
  VALUES (v_wallet.id, 'commission', -v_fee, p_currency, 'completed', 'Frais de transfert (1%)');

  RETURN json_build_object('success', true, 'transferred', v_net, 'fee', v_fee);
END;
$fn$;

REVOKE ALL ON FUNCTION public.transfer_earnings_to_wallet(numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_earnings_to_wallet(numeric, text) TO authenticated;
