CREATE OR REPLACE FUNCTION public.admin_delete_restaurant(p_restaurant_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rest RECORD;
  v_items int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'NOT_ADMIN');
  END IF;

  SELECT * INTO v_rest FROM restaurants WHERE id = p_restaurant_id;
  IF v_rest.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  SELECT count(*) INTO v_items FROM restaurant_items WHERE restaurant_id = p_restaurant_id;

  DELETE FROM restaurant_items WHERE restaurant_id = p_restaurant_id;
  DELETE FROM restaurants WHERE id = p_restaurant_id;

  INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, new_value)
  VALUES (auth.uid(), 'delete_restaurant', 'user', v_rest.seller_id,
          json_build_object('restaurant_id', p_restaurant_id, 'name', v_rest.name, 'deleted_items', v_items)::jsonb);

  RETURN json_build_object('success', true, 'deleted_items', v_items);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_delete_restaurant(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_delete_restaurant(uuid) TO authenticated;

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
  DELETE FROM restaurant_items WHERE restaurant_id IN (SELECT id FROM restaurants WHERE seller_id = p_user_id);
  DELETE FROM restaurants WHERE seller_id = p_user_id;
  DELETE FROM user_roles WHERE user_id = p_user_id AND role = 'seller';

  UPDATE profiles SET shop_address = NULL, shop_latitude = NULL, shop_longitude = NULL
  WHERE user_id = p_user_id;

  INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, new_value)
  VALUES (auth.uid(), 'delete_shop', 'user', p_user_id, json_build_object('deleted_products', v_count, 'forced', p_force)::jsonb);

  RETURN json_build_object('success', true, 'deleted_products', v_count);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_my_shop()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_active int;
  v_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT count(*) INTO v_active
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.seller_id = auth.uid()
    AND o.status NOT IN ('delivered', 'cancelled', 'refunded');

  IF v_active > 0 THEN
    RETURN json_build_object('success', false, 'error', 'ACTIVE_ORDERS');
  END IF;

  SELECT count(*) INTO v_count FROM products WHERE seller_id = auth.uid();

  UPDATE order_items SET product_id = NULL WHERE product_id IN (SELECT id FROM products WHERE seller_id = auth.uid());
  DELETE FROM products WHERE seller_id = auth.uid();
  DELETE FROM shopify_connections WHERE seller_id = auth.uid();
  DELETE FROM seller_applications WHERE user_id = auth.uid();
  DELETE FROM user_roles WHERE user_id = auth.uid() AND role = 'seller';

  UPDATE profiles SET shop_address = NULL, shop_latitude = NULL, shop_longitude = NULL
  WHERE user_id = auth.uid();

  RETURN json_build_object('success', true, 'deleted_products', v_count, 'message', 'Shop deleted');
END;
$function$;