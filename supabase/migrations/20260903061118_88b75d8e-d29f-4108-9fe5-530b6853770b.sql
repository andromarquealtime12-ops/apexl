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
  DELETE FROM reviews WHERE reviewed_user_id = p_user_id AND review_type = 'seller';
  DELETE FROM user_roles WHERE user_id = p_user_id AND role = 'seller';

  UPDATE profiles SET shop_address = NULL, shop_latitude = NULL, shop_longitude = NULL
  WHERE user_id = p_user_id;

  INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, new_value)
  VALUES (auth.uid(), 'delete_shop', 'user', p_user_id, json_build_object('deleted_products', v_count, 'forced', p_force)::jsonb);

  RETURN json_build_object('success', true, 'deleted_products', v_count);
END;
$function$;