CREATE OR REPLACE FUNCTION public.admin_delete_shop(p_user_id uuid, p_force boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_active int;
  v_count int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'NOT_ADMIN');
  END IF;

  SELECT count(*) INTO v_active
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.seller_id = p_user_id
    AND o.status NOT IN ('delivered', 'cancelled', 'refunded');

  IF v_active > 0 AND NOT p_force THEN
    RETURN json_build_object('success', false, 'error', 'ACTIVE_ORDERS', 'active_orders', v_active);
  END IF;

  SELECT count(*) INTO v_count FROM products WHERE seller_id = p_user_id;

  UPDATE order_items SET product_id = NULL WHERE product_id IN (SELECT id FROM products WHERE seller_id = p_user_id);
  DELETE FROM products WHERE seller_id = p_user_id;
  DELETE FROM shopify_connections WHERE seller_id = p_user_id;
  DELETE FROM seller_applications WHERE user_id = p_user_id;
  DELETE FROM user_roles WHERE user_id = p_user_id AND role = 'seller';

  UPDATE profiles SET shop_address = NULL, shop_latitude = NULL, shop_longitude = NULL
  WHERE user_id = p_user_id;

  INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, new_value)
  VALUES (auth.uid(), 'delete_shop', 'user', p_user_id, json_build_object('deleted_products', v_count, 'forced', p_force)::jsonb);

  RETURN json_build_object('success', true, 'deleted_products', v_count);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_shop_overview(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result json;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'NOT_ADMIN');
  END IF;

  SELECT json_build_object(
    'success', true,
    'profile', (
      SELECT json_build_object(
        'full_name', p.full_name, 'phone', p.phone, 'whatsapp', p.whatsapp,
        'email_verified', p.email_verified, 'country', p.country, 'city', p.city,
        'shop_address', p.shop_address, 'identity_status', p.identity_status,
        'account_status', p.account_status, 'trust_score', p.trust_score,
        'total_earned', p.total_earned, 'created_at', p.created_at,
        'avatar_url', p.avatar_url
      ) FROM profiles p WHERE p.user_id = p_user_id
    ),
    'application', (
      SELECT json_build_object(
        'shop_name', sa.shop_name, 'shop_description', sa.shop_description,
        'shop_address', sa.shop_address, 'shop_city', sa.shop_city,
        'shop_phone', sa.shop_phone, 'business_type', sa.business_type,
        'created_at', sa.created_at, 'latitude', sa.latitude, 'longitude', sa.longitude
      ) FROM seller_applications sa
      WHERE sa.user_id = p_user_id AND sa.status = 'approved'
      ORDER BY sa.created_at DESC LIMIT 1
    ),
    'products_total', (SELECT count(*) FROM products WHERE seller_id = p_user_id),
    'products_active', (SELECT count(*) FROM products WHERE seller_id = p_user_id AND is_active),
    'stock_total', (SELECT COALESCE(sum(stock_quantity),0) FROM products WHERE seller_id = p_user_id),
    'orders_total', (SELECT count(DISTINCT oi.order_id) FROM order_items oi WHERE oi.seller_id = p_user_id),
    'orders_delivered', (
      SELECT count(DISTINCT oi.order_id) FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.seller_id = p_user_id AND o.status = 'delivered'
    ),
    'orders_active', (
      SELECT count(DISTINCT oi.order_id) FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.seller_id = p_user_id AND o.status NOT IN ('delivered','cancelled','refunded')
    ),
    'orders_cancelled', (
      SELECT count(DISTINCT oi.order_id) FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.seller_id = p_user_id AND o.status IN ('cancelled','refunded')
    ),
    'items_sold', (
      SELECT COALESCE(sum(oi.quantity),0) FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.seller_id = p_user_id AND o.status = 'delivered'
    ),
    'revenue', (
      SELECT COALESCE(json_agg(x), '[]'::json) FROM (
        SELECT o.currency, sum(oi.total_price) AS amount
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE oi.seller_id = p_user_id AND o.status = 'delivered'
        GROUP BY o.currency
      ) x
    ),
    'wallet', (
      SELECT json_build_object(
        'balance_dop', w.balance_dop, 'balance_htg', w.balance_htg, 'balance_usd', w.balance_usd,
        'earnings_dop', w.earnings_dop, 'earnings_htg', w.earnings_htg, 'earnings_usd', w.earnings_usd,
        'is_frozen', w.is_frozen
      ) FROM wallets w WHERE w.user_id = p_user_id
    ),
    'rating', (
      SELECT json_build_object('avg', ROUND(AVG(r.rating)::numeric, 2), 'count', count(*))
      FROM reviews r WHERE r.reviewed_user_id = p_user_id
    ),
    'top_products', (
      SELECT COALESCE(json_agg(t), '[]'::json) FROM (
        SELECT p.name, p.price, p.currency, p.stock_quantity, p.is_active,
          COALESCE((SELECT sum(oi.quantity) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                    WHERE oi.product_id = p.id AND o.status = 'delivered'), 0) AS sold
        FROM products p WHERE p.seller_id = p_user_id
        ORDER BY sold DESC, p.created_at DESC LIMIT 10
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_shop_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_shop_overview(uuid) TO authenticated;