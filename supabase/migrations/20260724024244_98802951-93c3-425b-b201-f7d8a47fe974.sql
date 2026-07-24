
-- Allow SECURITY DEFINER RPCs to bypass the orders guard via a session flag
CREATE OR REPLACE FUNCTION public.guard_orders_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  IF NEW.buyer_id       IS DISTINCT FROM OLD.buyer_id       THEN RAISE EXCEPTION 'buyer_id is immutable'; END IF;
  IF NEW.total_amount   IS DISTINCT FROM OLD.total_amount   THEN RAISE EXCEPTION 'total_amount is immutable'; END IF;
  IF NEW.delivery_fee   IS DISTINCT FROM OLD.delivery_fee   THEN RAISE EXCEPTION 'delivery_fee is immutable'; END IF;
  IF NEW.currency       IS DISTINCT FROM OLD.currency       THEN RAISE EXCEPTION 'currency is immutable'; END IF;
  IF NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN RAISE EXCEPTION 'payment_method is immutable'; END IF;
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN RAISE EXCEPTION 'payment_status can only be changed by admin/RPC'; END IF;

  IF NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
    IF OLD.driver_id IS NULL AND NEW.driver_id = v_uid AND public.has_role(v_uid, 'driver'::app_role) THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'driver_id can only be self-assigned by an unassigned driver';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Patch verify_pickup_code to set bypass flag
CREATE OR REPLACE FUNCTION public.verify_pickup_code(p_order_id uuid, p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

    UPDATE public.delivery_verification SET attempt_count = attempt_count + 1 WHERE id = v_verification.id;
    IF v_verification.pickup_code != p_code THEN
        RETURN json_build_object('success', false, 'error', 'Code de récupération invalide');
    END IF;

    v_delivery_code := generate_pin_code();

    UPDATE public.delivery_verification
    SET status = 'picked_up', pickup_verified_at = now(), pickup_code = NULL,
        delivery_code = v_delivery_code, attempt_count = 0, updated_at = now()
    WHERE id = v_verification.id;

    PERFORM set_config('app.bypass_order_guard', 'on', true);
    UPDATE public.orders SET status = 'picked_up', payment_status = 'reserved', updated_at = now() WHERE id = p_order_id;
    PERFORM set_config('app.bypass_order_guard', 'off', true);

    INSERT INTO notifications (user_id, title, message, type, action_url)
    SELECT buyer_id, '📦 Colis récupéré !',
      'Le livreur a récupéré votre colis. Code de livraison: ' || v_delivery_code || '. Communiquez ce code au livreur à la réception.',
      'info', '/track/' || p_order_id::text
    FROM orders WHERE id = p_order_id AND buyer_id IS NOT NULL;

    RETURN json_build_object('success', true, 'delivery_code', v_delivery_code, 'message', 'Pickup verified successfully');
END;
$function$;

-- Patch verify_delivery_code to set bypass flag around the orders update
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

    UPDATE public.delivery_verification SET attempt_count = attempt_count + 1 WHERE id = v_verification.id;
    IF v_verification.delivery_code != p_code THEN
        RETURN json_build_object('success', false, 'error', 'Code de livraison invalide');
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;

    UPDATE public.delivery_verification
    SET status = 'delivered', delivery_verified_at = now(), attempt_count = 0, updated_at = now()
    WHERE id = v_verification.id;

    PERFORM set_config('app.bypass_order_guard', 'on', true);
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
    SELECT buyer_id, '✅ Livraison confirmée', 'Votre commande a été livrée avec succès.', 'success', '/orders'
    FROM orders WHERE id = p_order_id AND buyer_id IS NOT NULL;

    RETURN json_build_object('success', true, 'message', 'Delivery verified successfully');
END;
$function$;
