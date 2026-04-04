
-- Update verify_pickup_code to check 24h expiration
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
    IF NOT EXISTS (
      SELECT 1 FROM orders WHERE id = p_order_id AND driver_id = auth.uid()
    ) THEN
      RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    SELECT * INTO v_verification 
    FROM public.delivery_verification 
    WHERE order_id = p_order_id AND status = 'pending_pickup';
    
    IF v_verification.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Verification record not found');
    END IF;

    -- Check 24h expiration
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
    SET status = 'picked_up',
        pickup_verified_at = now(),
        pickup_code = NULL,
        delivery_code = v_delivery_code,
        attempt_count = 0,
        updated_at = now()
    WHERE id = v_verification.id;
    
    UPDATE public.orders
    SET status = 'picked_up',
        payment_status = 'reserved',
        updated_at = now()
    WHERE id = p_order_id;

    INSERT INTO notifications (user_id, title, message, type, action_url)
    SELECT buyer_id, '📦 Colis récupéré !',
      'Le livreur a récupéré votre colis. Code de livraison: ' || v_delivery_code || '. Communiquez ce code au livreur à la réception.',
      'info', '/track/' || p_order_id::text
    FROM orders WHERE id = p_order_id AND buyer_id IS NOT NULL;
    
    RETURN json_build_object(
        'success', true, 
        'delivery_code', v_delivery_code,
        'message', 'Pickup verified successfully'
    );
END;
$function$;

-- Update verify_delivery_code to check 24h expiration from pickup time
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
    v_seller_amount numeric;
    v_driver_amount numeric;
    v_item RECORD;
BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM orders WHERE id = p_order_id AND driver_id = auth.uid()
    ) THEN
      RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    SELECT * INTO v_verification 
    FROM public.delivery_verification 
    WHERE order_id = p_order_id AND status = 'picked_up';
    
    IF v_verification.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Verification record not found');
    END IF;

    -- Check 24h expiration from pickup time
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
    SET status = 'delivered',
        delivery_verified_at = now(),
        attempt_count = 0,
        updated_at = now()
    WHERE id = v_verification.id;
    
    UPDATE public.orders
    SET status = 'delivered',
        payment_status = 'paid_to_seller',
        updated_at = now()
    WHERE id = p_order_id;
    
    FOR v_item IN 
        SELECT seller_id, SUM(total_price) as seller_total
        FROM public.order_items 
        WHERE order_id = p_order_id
        GROUP BY seller_id
    LOOP
        IF v_item.seller_id IS NOT NULL THEN
            SELECT id INTO v_seller_wallet_id 
            FROM public.wallets 
            WHERE user_id = v_item.seller_id;
            
            IF v_seller_wallet_id IS NOT NULL THEN
                UPDATE public.wallets
                SET balance_dop = balance_dop + v_item.seller_total,
                    updated_at = now()
                WHERE id = v_seller_wallet_id;
                
                INSERT INTO public.wallet_transactions (wallet_id, type, amount, currency, status, description, reference)
                VALUES (v_seller_wallet_id, 'payment', v_item.seller_total, v_order.currency, 'completed', 
                        'Vente commande #' || LEFT(p_order_id::text, 8), p_order_id::text);
            END IF;
        END IF;
    END LOOP;
    
    IF v_order.driver_id IS NOT NULL AND v_order.delivery_fee > 0 THEN
        SELECT id INTO v_driver_wallet_id 
        FROM public.wallets 
        WHERE user_id = v_order.driver_id;
        
        IF v_driver_wallet_id IS NOT NULL THEN
            UPDATE public.wallets
            SET balance_dop = balance_dop + v_order.delivery_fee,
                updated_at = now()
            WHERE id = v_driver_wallet_id;
            
            INSERT INTO public.wallet_transactions (wallet_id, type, amount, currency, status, description, reference)
            VALUES (v_driver_wallet_id, 'payment', v_order.delivery_fee, v_order.currency, 'completed', 
                    'Livraison commande #' || LEFT(p_order_id::text, 8), p_order_id::text);
        END IF;
    END IF;

    -- Notify buyer
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_order.buyer_id, '✅ Commande livrée !', 
            'Votre commande #' || LEFT(p_order_id::text, 8) || ' a été livrée avec succès.',
            'success');

    -- Notify sellers
    FOR v_item IN 
        SELECT DISTINCT seller_id FROM public.order_items WHERE order_id = p_order_id AND seller_id IS NOT NULL
    LOOP
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (v_item.seller_id, '💰 Paiement reçu', 
                'Le paiement pour la commande #' || LEFT(p_order_id::text, 8) || ' a été crédité sur votre portefeuille.',
                'success');
    END LOOP;

    RETURN json_build_object('success', true, 'message', 'Delivery confirmed');
END;
$function$;

-- Create regenerate_pickup_code function for sellers
CREATE OR REPLACE FUNCTION public.regenerate_pickup_code(p_order_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_verification RECORD;
    v_new_code text;
    v_seller_id uuid;
BEGIN
    -- Verify caller is seller of this order
    SELECT oi.seller_id INTO v_seller_id
    FROM order_items oi
    WHERE oi.order_id = p_order_id AND oi.seller_id = auth.uid()
    LIMIT 1;

    IF v_seller_id IS NULL AND NOT has_role(auth.uid(), 'admin') THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    SELECT * INTO v_verification
    FROM delivery_verification
    WHERE order_id = p_order_id AND status = 'pending_pickup';

    IF v_verification.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Aucune vérification en attente trouvée');
    END IF;

    v_new_code := generate_pin_code();

    UPDATE delivery_verification
    SET pickup_code = v_new_code,
        attempt_count = 0,
        created_at = now(),
        updated_at = now()
    WHERE id = v_verification.id;

    -- Notify driver
    INSERT INTO notifications (user_id, title, message, type, action_url)
    SELECT driver_id, '🔄 Nouveau code de récupération',
      'Le vendeur a généré un nouveau code pour la commande #' || LEFT(p_order_id::text, 8),
      'info', '/driver'
    FROM orders WHERE id = p_order_id AND driver_id IS NOT NULL;

    RETURN json_build_object('success', true, 'pickup_code', v_new_code);
END;
$function$;
