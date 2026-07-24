
-- 1) Delivery verification guard: honor bypass flag so RPCs can update attempt_count/status
CREATE OR REPLACE FUNCTION public.guard_delivery_verification_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_bypass text;
BEGIN
  BEGIN
    v_bypass := current_setting('app.bypass_order_guard', true);
  EXCEPTION WHEN OTHERS THEN
    v_bypass := NULL;
  END;
  IF v_bypass = 'on' THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NULL OR public.has_role(v_uid, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.pickup_code           IS DISTINCT FROM OLD.pickup_code           THEN RAISE EXCEPTION 'pickup_code is not directly editable'; END IF;
  IF NEW.delivery_code         IS DISTINCT FROM OLD.delivery_code         THEN RAISE EXCEPTION 'delivery_code is not directly editable'; END IF;
  IF NEW.status                IS DISTINCT FROM OLD.status                THEN RAISE EXCEPTION 'status is not directly editable'; END IF;
  IF NEW.pickup_verified_at    IS DISTINCT FROM OLD.pickup_verified_at    THEN RAISE EXCEPTION 'pickup_verified_at is not directly editable'; END IF;
  IF NEW.delivery_verified_at  IS DISTINCT FROM OLD.delivery_verified_at  THEN RAISE EXCEPTION 'delivery_verified_at is not directly editable'; END IF;
  IF NEW.attempt_count         IS DISTINCT FROM OLD.attempt_count         THEN RAISE EXCEPTION 'attempt_count is not directly editable'; END IF;
  IF NEW.order_id              IS DISTINCT FROM OLD.order_id              THEN RAISE EXCEPTION 'order_id is immutable'; END IF;

  RETURN NEW;
END;
$$;

-- 2) verify_pickup_code: enable bypass around delivery_verification updates
CREATE OR REPLACE FUNCTION public.verify_pickup_code(p_order_id uuid, p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_verification RECORD;
    v_delivery_code text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM orders WHERE id = p_order_id AND driver_id = auth.uid()) THEN
      RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    SELECT * INTO v_verification FROM public.delivery_verification WHERE order_id = p_order_id AND status = 'pending_pickup';
    IF v_verification.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Verification record not found');
    END IF;
    IF v_verification.created_at < now() - interval '24 hours' THEN
        RETURN json_build_object('success', false, 'error', 'Code expiré. Demandez au vendeur de régénérer un nouveau code.');
    END IF;
    IF v_verification.attempt_count >= 10 THEN
        RETURN json_build_object('success', false, 'error', 'Too many attempts. Contact support.');
    END IF;

    PERFORM set_config('app.bypass_order_guard', 'on', true);

    UPDATE public.delivery_verification SET attempt_count = attempt_count + 1 WHERE id = v_verification.id;
    IF v_verification.pickup_code != p_code THEN
        PERFORM set_config('app.bypass_order_guard', 'off', true);
        RETURN json_build_object('success', false, 'error', 'Code de récupération invalide');
    END IF;

    v_delivery_code := generate_pin_code();

    UPDATE public.delivery_verification
    SET status = 'picked_up', pickup_verified_at = now(), pickup_code = NULL,
        delivery_code = v_delivery_code, attempt_count = 0, updated_at = now()
    WHERE id = v_verification.id;

    UPDATE public.orders SET status = 'picked_up', payment_status = 'reserved', updated_at = now() WHERE id = p_order_id;
    PERFORM set_config('app.bypass_order_guard', 'off', true);

    INSERT INTO notifications (user_id, title, message, type, action_url)
    SELECT buyer_id, '📦 Colis récupéré !',
      'Le livreur a récupéré votre colis. Code de livraison: ' || v_delivery_code || '. Communiquez ce code au livreur à la réception.',
      'info', '/track/' || p_order_id::text
    FROM orders WHERE id = p_order_id AND buyer_id IS NOT NULL;

    RETURN json_build_object('success', true, 'delivery_code', v_delivery_code, 'message', 'Pickup verified successfully');
END;
$$;

-- 3) verify_delivery_code: same bypass pattern
CREATE OR REPLACE FUNCTION public.verify_delivery_code(p_order_id uuid, p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_verification RECORD;
    v_order RECORD;
    v_seller_wallet_id uuid;
    v_driver_wallet_id uuid;
    v_item RECORD;
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

    FOR v_item IN
        SELECT seller_id, SUM(total_price) as seller_total
        FROM public.order_items WHERE order_id = p_order_id GROUP BY seller_id
    LOOP
        IF v_item.seller_id IS NOT NULL THEN
            SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = v_item.seller_id;
            IF v_seller_wallet_id IS NOT NULL THEN
                UPDATE public.wallets SET balance_dop = balance_dop + v_item.seller_total, updated_at = now() WHERE id = v_seller_wallet_id;
                INSERT INTO public.wallet_transactions (wallet_id, type, amount, currency, status, description, reference)
                VALUES (v_seller_wallet_id, 'payment', v_item.seller_total, v_order.currency, 'completed', 'Vente commande #' || substring(p_order_id::text, 1, 8), p_order_id::text);
            END IF;
        END IF;
    END LOOP;

    IF v_order.driver_id IS NOT NULL AND v_order.delivery_fee > 0 THEN
        SELECT id INTO v_driver_wallet_id FROM public.wallets WHERE user_id = v_order.driver_id;
        IF v_driver_wallet_id IS NOT NULL THEN
            UPDATE public.wallets SET balance_dop = balance_dop + v_order.delivery_fee, updated_at = now() WHERE id = v_driver_wallet_id;
            INSERT INTO public.wallet_transactions (wallet_id, type, amount, currency, status, description, reference)
            VALUES (v_driver_wallet_id, 'delivery_fee', v_order.delivery_fee, v_order.currency, 'completed', 'Frais livraison commande #' || substring(p_order_id::text, 1, 8), p_order_id::text);
        END IF;
    END IF;

    INSERT INTO notifications (user_id, title, message, type, action_url)
    VALUES (v_order.buyer_id, '✅ Commande livrée', 'Votre commande a été livrée avec succès.', 'success', '/track/' || p_order_id::text);

    RETURN json_build_object('success', true, 'message', 'Delivery verified successfully');
END;
$$;

-- 4) cancel_order: cast enum to text so 'wallet'/'balance' comparison works regardless of enum values
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid, p_reason text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_uid uuid := auth.uid();
  v_role text;
  v_is_seller boolean := false;
  v_wallet_id uuid;
  v_balance_field text;
  v_refund_amount numeric;
  v_penalty numeric := 0;
  v_pre_pickup_statuses text[] := ARRAY['pending','confirmed','preparing','ready','ready_for_pickup'];
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Commande introuvable');
  END IF;

  IF v_order.status = ANY (ARRAY['cancelled','refunded','delivered','returned']) THEN
    RETURN json_build_object('success', false, 'error', 'Commande déjà cloturée');
  END IF;

  IF has_role(v_uid, 'admin') THEN
    v_role := 'admin';
  ELSIF v_order.buyer_id = v_uid THEN
    v_role := 'buyer';
  ELSIF v_order.driver_id = v_uid THEN
    v_role := 'driver';
  ELSE
    SELECT EXISTS(SELECT 1 FROM order_items WHERE order_id = p_order_id AND seller_id = v_uid) INTO v_is_seller;
    IF v_is_seller THEN v_role := 'seller'; END IF;
  END IF;

  IF v_role IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  v_balance_field := CASE v_order.currency WHEN 'DOP' THEN 'balance_dop' WHEN 'HTG' THEN 'balance_htg' ELSE 'balance_usd' END;

  IF v_role = 'driver' THEN
    IF NOT (v_order.status = ANY (v_pre_pickup_statuses)) THEN
      RETURN json_build_object('success', false, 'error', 'Impossible d''annuler : colis déjà récupéré');
    END IF;

    PERFORM set_config('app.bypass_order_guard', 'on', true);
    UPDATE orders SET driver_id = NULL, status = 'ready_for_pickup', updated_at = now() WHERE id = p_order_id;
    PERFORM set_config('app.bypass_order_guard', 'off', true);

    UPDATE profiles SET trust_score = GREATEST(0, COALESCE(trust_score, 100) - 1), updated_at = now() WHERE user_id = v_uid;

    INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_order.buyer_id, '🔄 Livreur annulé',
            'Le livreur s''est désisté pour la commande #' || LEFT(p_order_id::text, 8) || '. Recherche d''un autre livreur en cours.',
            'warning');

    RETURN json_build_object('success', true, 'message', 'Livraison annulée. Commande remise en attente d''un livreur.');
  END IF;

  IF v_role = 'seller' AND v_order.driver_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Un livreur a déjà accepté cette commande');
  END IF;

  IF NOT (v_order.status = ANY (v_pre_pickup_statuses)) THEN
    RETURN json_build_object('success', false, 'error', 'Impossible d''annuler à ce stade');
  END IF;

  IF v_role = 'buyer' AND v_order.driver_id IS NOT NULL THEN
    v_penalty := ROUND(COALESCE(v_order.delivery_fee, 0) * 0.10, 2);
  END IF;

  v_refund_amount := GREATEST(0, COALESCE(v_order.total_amount, 0) - v_penalty);

  -- Cast enum to text to avoid invalid enum literal errors
  IF v_order.payment_method::text IN ('wallet', 'balance', 'cash') AND v_order.payment_status IN ('paid', 'completed') AND v_refund_amount > 0 THEN
    SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_order.buyer_id FOR UPDATE;
    IF v_wallet_id IS NOT NULL THEN
      EXECUTE format('UPDATE wallets SET %I = COALESCE(%I, 0) + $1, updated_at = now() WHERE id = $2',
                     v_balance_field, v_balance_field)
      USING v_refund_amount, v_wallet_id;

      INSERT INTO wallet_transactions (wallet_id, type, amount, currency, status, reference, description)
      VALUES (v_wallet_id, 'refund', v_refund_amount, v_order.currency, 'completed', p_order_id::text,
              'Remboursement annulation commande #' || LEFT(p_order_id::text, 8) ||
              CASE WHEN v_penalty > 0 THEN ' (pénalité: ' || v_penalty || ')' ELSE '' END);
    END IF;
  END IF;

  PERFORM set_config('app.bypass_order_guard', 'on', true);
  UPDATE orders
     SET status = 'cancelled',
         payment_status = CASE WHEN payment_status IN ('paid','completed') THEN 'refunded' ELSE payment_status END,
         updated_at = now()
   WHERE id = p_order_id;
  PERFORM set_config('app.bypass_order_guard', 'off', true);

  IF v_order.driver_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_order.driver_id, '❌ Commande annulée',
            'La commande #' || LEFT(p_order_id::text, 8) || ' a été annulée par ' ||
            CASE v_role WHEN 'buyer' THEN 'l''acheteur' WHEN 'seller' THEN 'le vendeur' ELSE 'un admin' END,
            'warning');
  END IF;

  INSERT INTO notifications (user_id, title, message, type)
  SELECT DISTINCT oi.seller_id, '❌ Commande annulée',
         'La commande #' || LEFT(p_order_id::text, 8) || ' a été annulée' ||
         CASE WHEN p_reason IS NOT NULL AND p_reason <> '' THEN ' — ' || p_reason ELSE '' END,
         'warning'
  FROM order_items oi WHERE oi.order_id = p_order_id AND oi.seller_id <> v_uid;

  IF v_role <> 'buyer' THEN
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_order.buyer_id, '❌ Commande annulée',
            'Votre commande #' || LEFT(p_order_id::text, 8) || ' a été annulée. Remboursement: ' ||
            v_refund_amount || ' ' || v_order.currency, 'warning');
  END IF;

  RETURN json_build_object('success', true, 'refund', v_refund_amount, 'penalty', v_penalty);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid, text) TO authenticated, service_role;
