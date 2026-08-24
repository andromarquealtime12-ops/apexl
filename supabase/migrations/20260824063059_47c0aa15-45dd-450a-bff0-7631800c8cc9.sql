CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid, p_reason text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_order RECORD;
  v_uid uuid := auth.uid();
  v_role text;
  v_is_seller boolean := false;
  v_wallet_id uuid;
  v_balance_field text;
  v_paid numeric := 0;
  v_refund_amount numeric := 0;
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

  -- Montant réellement débité du portefeuille pour cette commande
  SELECT COALESCE(SUM(ABS(t.amount)), 0) INTO v_paid
  FROM wallet_transactions t
  JOIN wallets w ON w.id = t.wallet_id
  WHERE t.reference = p_order_id::text
    AND t.type = 'payment'
    AND t.status = 'completed'
    AND w.user_id = v_order.buyer_id;

  -- Déduire d'éventuels remboursements déjà effectués
  SELECT GREATEST(0, v_paid - COALESCE(SUM(ABS(t.amount)), 0)) INTO v_paid
  FROM wallet_transactions t
  JOIN wallets w ON w.id = t.wallet_id
  WHERE t.reference = p_order_id::text
    AND t.type = 'refund'
    AND t.status = 'completed'
    AND w.user_id = v_order.buyer_id;

  IF v_paid > 0 THEN
    v_penalty := LEAST(v_penalty, v_paid);
    v_refund_amount := ROUND(v_paid - v_penalty, 2);
  ELSE
    v_penalty := 0;
    v_refund_amount := 0;
  END IF;

  IF v_refund_amount > 0 THEN
    SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_order.buyer_id FOR UPDATE;
    IF v_wallet_id IS NULL THEN
      INSERT INTO wallets (user_id) VALUES (v_order.buyer_id) RETURNING id INTO v_wallet_id;
    END IF;

    EXECUTE format('UPDATE wallets SET %I = COALESCE(%I, 0) + $1, updated_at = now() WHERE id = $2',
                   v_balance_field, v_balance_field)
    USING v_refund_amount, v_wallet_id;

    INSERT INTO wallet_transactions (wallet_id, type, amount, currency, status, reference, description)
    VALUES (v_wallet_id, 'refund', v_refund_amount, v_order.currency, 'completed', p_order_id::text,
            'Remboursement annulation commande #' || LEFT(p_order_id::text, 8) ||
            CASE WHEN v_penalty > 0 THEN ' (pénalité: ' || v_penalty || ')' ELSE '' END);
  END IF;

  PERFORM set_config('app.bypass_order_guard', 'on', true);
  UPDATE orders
     SET status = 'cancelled',
         payment_status = CASE WHEN v_refund_amount > 0 THEN 'refunded' ELSE payment_status END,
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
$function$;