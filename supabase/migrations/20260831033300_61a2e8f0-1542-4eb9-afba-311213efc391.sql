CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Restaurants + menu items
  DELETE FROM restaurant_items WHERE restaurant_id IN (SELECT id FROM restaurants WHERE seller_id = p_user_id);
  DELETE FROM restaurants WHERE seller_id = p_user_id;

  -- Shop products (detach from past order items first)
  UPDATE order_items SET product_id = NULL WHERE product_id IN (SELECT id FROM products WHERE seller_id = p_user_id);
  DELETE FROM products WHERE seller_id = p_user_id;

  DELETE FROM shopify_connections WHERE seller_id = p_user_id;
  DELETE FROM push_subscriptions WHERE user_id = p_user_id;
  DELETE FROM reviews WHERE reviewer_id = p_user_id OR reviewed_user_id = p_user_id;
  DELETE FROM reports WHERE reporter_id = p_user_id OR reported_user_id = p_user_id;
  DELETE FROM notifications WHERE user_id = p_user_id;
  DELETE FROM user_roles WHERE user_id = p_user_id;
  DELETE FROM identity_verifications WHERE user_id = p_user_id;
  DELETE FROM support_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE user_id = p_user_id);
  DELETE FROM support_tickets WHERE user_id = p_user_id;
  DELETE FROM referrals WHERE referrer_id = p_user_id OR referred_id = p_user_id;
  DELETE FROM driver_locations WHERE driver_id = p_user_id;
  DELETE FROM driver_applications WHERE user_id = p_user_id;
  DELETE FROM seller_applications WHERE user_id = p_user_id;
  DELETE FROM user_auth_secrets WHERE user_id = p_user_id;

  DELETE FROM wallet_transactions WHERE wallet_id IN (SELECT id FROM wallets WHERE user_id = p_user_id);
  DELETE FROM wallets WHERE user_id = p_user_id;

  DELETE FROM profiles WHERE user_id = p_user_id;

  INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id)
  VALUES (auth.uid(), 'delete_user', 'user', p_user_id);

  RETURN json_build_object('success', true, 'message', 'User account deleted');
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_my_restaurant()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rest RECORD;
  v_active int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_rest FROM restaurants WHERE seller_id = auth.uid() LIMIT 1;
  IF v_rest.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'NO_RESTAURANT');
  END IF;

  SELECT count(*) INTO v_active
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.seller_id = auth.uid()
    AND o.status NOT IN ('delivered', 'cancelled', 'refunded');

  IF v_active > 0 THEN
    RETURN json_build_object('success', false, 'error', 'ACTIVE_ORDERS');
  END IF;

  DELETE FROM restaurant_items WHERE restaurant_id = v_rest.id;
  DELETE FROM restaurants WHERE id = v_rest.id;

  RETURN json_build_object('success', true, 'message', 'Restaurant deleted');
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

REVOKE ALL ON FUNCTION public.delete_my_shop() FROM public;
REVOKE ALL ON FUNCTION public.delete_my_restaurant() FROM public;
GRANT EXECUTE ON FUNCTION public.delete_my_shop() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_restaurant() TO authenticated;