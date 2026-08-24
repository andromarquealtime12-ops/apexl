-- 1. Driver acceptance rules: must be online, single active order unless same seller + buyers within 2km
CREATE OR REPLACE FUNCTION public.driver_accept_order(p_order_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_driver_id uuid := auth.uid();
  v_online boolean := false;
  v_active_count integer := 0;
  v_compatible integer := 0;
  v_new_lat double precision;
  v_new_lng double precision;
BEGIN
  IF v_driver_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  IF NOT has_role(v_driver_id, 'driver') THEN
    RETURN json_build_object('success', false, 'error', 'Not a driver');
  END IF;

  SELECT COALESCE(dl.is_online, false) INTO v_online
  FROM driver_locations dl WHERE dl.driver_id = v_driver_id;

  IF NOT COALESCE(v_online, false) THEN
    RETURN json_build_object('success', false, 'error', 'Vous devez être en ligne pour accepter une livraison');
  END IF;

  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
    AND driver_id IS NULL
    AND status IN ('confirmed', 'ready', 'ready_for_pickup')
  FOR UPDATE SKIP LOCKED;

  IF v_order.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Commande non disponible ou déjà prise');
  END IF;

  v_new_lat := COALESCE(v_order.buyer_latitude, v_order.delivery_lat);
  v_new_lng := COALESCE(v_order.buyer_longitude, v_order.delivery_lng);

  SELECT count(*) INTO v_active_count
  FROM orders o
  WHERE o.driver_id = v_driver_id
    AND o.status IN ('ready_for_pickup', 'picked_up', 'in_transit');

  IF v_active_count > 0 THEN
    -- Allowed only when the new order shares a seller with an active one
    -- AND both buyers are within 2 km of each other.
    SELECT count(*) INTO v_compatible
    FROM orders o
    WHERE o.driver_id = v_driver_id
      AND o.status IN ('ready_for_pickup', 'picked_up', 'in_transit')
      AND EXISTS (
        SELECT 1 FROM order_items a
        JOIN order_items b ON b.seller_id = a.seller_id
        WHERE a.order_id = o.id AND b.order_id = p_order_id AND a.seller_id IS NOT NULL
      )
      AND v_new_lat IS NOT NULL AND v_new_lng IS NOT NULL
      AND COALESCE(o.buyer_latitude, o.delivery_lat) IS NOT NULL
      AND COALESCE(o.buyer_longitude, o.delivery_lng) IS NOT NULL
      AND calculate_distance(
            v_new_lat, v_new_lng,
            COALESCE(o.buyer_latitude, o.delivery_lat),
            COALESCE(o.buyer_longitude, o.delivery_lng)
          ) <= 2;

    IF v_compatible = 0 THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Vous avez déjà une livraison en cours. Vous ne pouvez en accepter une autre que si elle vient du même vendeur et que les clients sont à moins de 2 km.'
      );
    END IF;
  END IF;

  UPDATE orders
  SET driver_id = v_driver_id,
      status = 'ready_for_pickup',
      updated_at = now()
  WHERE id = p_order_id;

  PERFORM create_delivery_verification(p_order_id);

  IF v_order.buyer_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, action_url)
    VALUES (v_order.buyer_id, '🚚 Livreur assigné !',
      'Un livreur a accepté votre commande #' || LEFT(p_order_id::text, 8) || '. Suivez votre livraison en temps réel.',
      'info', '/track/' || p_order_id::text);
  END IF;

  INSERT INTO notifications (user_id, title, message, type, action_url)
  SELECT DISTINCT oi.seller_id, '📦 Livreur en route !',
    'Un livreur va récupérer la commande #' || LEFT(p_order_id::text, 8) || '.',
    'info', '/seller'
  FROM order_items oi
  WHERE oi.order_id = p_order_id AND oi.seller_id IS NOT NULL;

  RETURN json_build_object('success', true, 'message', 'Commande acceptée');
END;
$function$;

-- 2. Admin overview of every driver (online or not) with delivery stats
CREATE OR REPLACE FUNCTION public.admin_driver_overview()
RETURNS TABLE(
  driver_id uuid,
  full_name text,
  phone text,
  city text,
  identity_status text,
  account_status text,
  is_online boolean,
  last_location_update timestamp with time zone,
  latitude double precision,
  longitude double precision,
  delivered_count integer,
  cancelled_count integer,
  in_progress_count integer,
  total_orders integer,
  earnings_dop numeric,
  earnings_htg numeric,
  earnings_usd numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    ur.user_id AS driver_id,
    p.full_name,
    p.phone,
    COALESCE(da.city, p.city) AS city,
    p.identity_status,
    p.account_status,
    COALESCE(dl.is_online, false) AS is_online,
    dl.updated_at AS last_location_update,
    dl.latitude,
    dl.longitude,
    COALESCE(s.delivered_count, 0)::int,
    COALESCE(s.cancelled_count, 0)::int,
    COALESCE(s.in_progress_count, 0)::int,
    COALESCE(s.total_orders, 0)::int,
    COALESCE(w.earnings_dop, 0),
    COALESCE(w.earnings_htg, 0),
    COALESCE(w.earnings_usd, 0)
  FROM user_roles ur
  LEFT JOIN profiles p ON p.user_id = ur.user_id
  LEFT JOIN driver_locations dl ON dl.driver_id = ur.user_id
  LEFT JOIN wallets w ON w.user_id = ur.user_id
  LEFT JOIN LATERAL (
    SELECT da2.city FROM driver_applications da2
    WHERE da2.user_id = ur.user_id ORDER BY da2.created_at DESC LIMIT 1
  ) da ON true
  LEFT JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE o.status = 'delivered') AS delivered_count,
      count(*) FILTER (WHERE o.status IN ('cancelled','refunded')) AS cancelled_count,
      count(*) FILTER (WHERE o.status IN ('ready_for_pickup','picked_up','in_transit')) AS in_progress_count,
      count(*) AS total_orders
    FROM orders o WHERE o.driver_id = ur.user_id
  ) s ON true
  WHERE ur.role = 'driver'
    AND has_role(auth.uid(), 'admin');
$function$;

-- 3. Admin can cancel an undelivered delivery, refund the buyer and optionally
--    credit a compensation on the driver's earnings balance.
CREATE OR REPLACE FUNCTION public.admin_cancel_delivery(
  p_order_id uuid,
  p_reason text DEFAULT NULL,
  p_credit_driver boolean DEFAULT false,
  p_credit_amount numeric DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_uid uuid := auth.uid();
  v_wallet_id uuid;
  v_balance_field text;
  v_earnings_field text;
  v_refund numeric := 0;
  v_credit numeric := 0;
BEGIN
  IF v_uid IS NULL OR NOT has_role(v_uid, 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Commande introuvable');
  END IF;

  IF v_order.status IN ('delivered', 'cancelled', 'refunded', 'returned') THEN
    RETURN json_build_object('success', false, 'error', 'Commande déjà cloturée ou déjà livrée');
  END IF;

  v_balance_field := CASE v_order.currency WHEN 'DOP' THEN 'balance_dop' WHEN 'HTG' THEN 'balance_htg' ELSE 'balance_usd' END;
  v_earnings_field := CASE v_order.currency WHEN 'DOP' THEN 'earnings_dop' WHEN 'HTG' THEN 'earnings_htg' ELSE 'earnings_usd' END;

  -- Refund buyer (paid orders only)
  IF v_order.payment_status IN ('paid', 'completed') THEN
    v_refund := COALESCE(v_order.total_amount, 0);
    SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_order.buyer_id FOR UPDATE;
    IF v_wallet_id IS NOT NULL AND v_refund > 0 THEN
      EXECUTE format('UPDATE wallets SET %I = COALESCE(%I,0) + $1, updated_at = now() WHERE id = $2', v_balance_field, v_balance_field)
      USING v_refund, v_wallet_id;

      INSERT INTO wallet_transactions (wallet_id, type, amount, currency, status, reference, description)
      VALUES (v_wallet_id, 'refund', v_refund, v_order.currency, 'completed', p_order_id::text,
              'Remboursement (annulation admin) commande #' || LEFT(p_order_id::text, 8));
    END IF;
  END IF;

  -- Optional driver compensation
  IF p_credit_driver AND v_order.driver_id IS NOT NULL THEN
    v_credit := COALESCE(p_credit_amount, v_order.delivery_fee, 0);
    IF v_credit > 0 THEN
      SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_order.driver_id FOR UPDATE;
      IF v_wallet_id IS NULL THEN
        INSERT INTO wallets (user_id) VALUES (v_order.driver_id) RETURNING id INTO v_wallet_id;
      END IF;

      EXECUTE format('UPDATE wallets SET %I = COALESCE(%I,0) + $1, updated_at = now() WHERE id = $2', v_earnings_field, v_earnings_field)
      USING v_credit, v_wallet_id;

      INSERT INTO wallet_transactions (wallet_id, type, amount, currency, status, reference, description)
      VALUES (v_wallet_id, 'earning', v_credit, v_order.currency, 'completed', p_order_id::text,
              'Compensation livraison annulée #' || LEFT(p_order_id::text, 8));

      INSERT INTO notifications (user_id, title, message, type, action_url)
      VALUES (v_order.driver_id, '💰 Compensation créditée',
              'Une compensation de ' || v_credit || ' ' || v_order.currency || ' a été créditée sur vos gains pour la commande #' || LEFT(p_order_id::text, 8) || '.',
              'success', '/driver');
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
    INSERT INTO notifications (user_id, title, message, type, action_url)
    VALUES (v_order.driver_id, '❌ Livraison annulée par l''administration',
            'La commande #' || LEFT(p_order_id::text, 8) || ' a été annulée' ||
            CASE WHEN p_reason IS NOT NULL AND p_reason <> '' THEN ' — ' || p_reason ELSE '' END,
            'warning', '/driver');
  END IF;

  IF v_order.buyer_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, action_url)
    VALUES (v_order.buyer_id, '❌ Commande annulée',
            'Votre commande #' || LEFT(p_order_id::text, 8) || ' a été annulée par l''administration. Remboursement: ' || v_refund || ' ' || v_order.currency,
            'warning', '/orders');
  END IF;

  INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, new_value)
  VALUES (v_uid, 'cancel_delivery', 'order', p_order_id,
          json_build_object('reason', p_reason, 'refund', v_refund, 'driver_credit', v_credit)::jsonb);

  RETURN json_build_object('success', true, 'refund', v_refund, 'driver_credit', v_credit);
END;
$function$;