
-- 1. Fix wallet: Remove dangerous user UPDATE policy
DROP POLICY IF EXISTS "Users can update own wallet" ON wallets;

-- 2. Fix delivery_verification INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create verifications" ON delivery_verification;

CREATE POLICY "Only order participants can create verifications"
ON delivery_verification FOR INSERT
WITH CHECK (
  order_id IN (
    SELECT o.id FROM orders o
    WHERE o.buyer_id = auth.uid() OR o.driver_id = auth.uid()
  )
  OR
  order_id IN (
    SELECT DISTINCT oi.order_id FROM order_items oi
    WHERE oi.seller_id = auth.uid()
  )
);

-- 3. Fix robot_logs INSERT policy
DROP POLICY IF EXISTS "System can insert robot logs" ON admin_robot_logs;

CREATE POLICY "Only admins can insert robot logs"
ON admin_robot_logs FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. Add attempt tracking to delivery_verification
ALTER TABLE delivery_verification
ADD COLUMN IF NOT EXISTS attempt_count integer DEFAULT 0;

-- 5. Fix verify_pickup_code to check caller is assigned driver + rate limit
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
    -- Verify caller is the assigned driver
    IF NOT EXISTS (
      SELECT 1 FROM orders WHERE id = p_order_id AND driver_id = auth.uid()
    ) THEN
      RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Get the verification record
    SELECT * INTO v_verification 
    FROM public.delivery_verification 
    WHERE order_id = p_order_id AND status = 'pending_pickup';
    
    IF v_verification.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Verification record not found');
    END IF;

    -- Rate limit: max 10 attempts
    IF v_verification.attempt_count >= 10 THEN
        RETURN json_build_object('success', false, 'error', 'Too many attempts. Contact support.');
    END IF;

    -- Increment attempt count
    UPDATE public.delivery_verification SET attempt_count = attempt_count + 1 WHERE id = v_verification.id;
    
    IF v_verification.pickup_code != p_code THEN
        RETURN json_build_object('success', false, 'error', 'Invalid pickup code');
    END IF;
    
    -- Generate new delivery code
    v_delivery_code := generate_pin_code();
    
    -- Update verification record
    UPDATE public.delivery_verification
    SET status = 'picked_up',
        pickup_verified_at = now(),
        delivery_code = v_delivery_code,
        attempt_count = 0,
        updated_at = now()
    WHERE id = v_verification.id;
    
    -- Update order status
    UPDATE public.orders
    SET status = 'picked_up',
        payment_status = 'reserved',
        updated_at = now()
    WHERE id = p_order_id;
    
    RETURN json_build_object(
        'success', true, 
        'delivery_code', v_delivery_code,
        'message', 'Pickup verified successfully'
    );
END;
$function$;

-- 6. Fix verify_delivery_code to check caller is assigned driver + rate limit
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
    -- Verify caller is the assigned driver
    IF NOT EXISTS (
      SELECT 1 FROM orders WHERE id = p_order_id AND driver_id = auth.uid()
    ) THEN
      RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Get the verification record
    SELECT * INTO v_verification 
    FROM public.delivery_verification 
    WHERE order_id = p_order_id AND status = 'picked_up';
    
    IF v_verification.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Verification record not found');
    END IF;

    -- Rate limit: max 10 attempts
    IF v_verification.attempt_count >= 10 THEN
        RETURN json_build_object('success', false, 'error', 'Too many attempts. Contact support.');
    END IF;

    -- Increment attempt count
    UPDATE public.delivery_verification SET attempt_count = attempt_count + 1 WHERE id = v_verification.id;
    
    IF v_verification.delivery_code != p_code THEN
        RETURN json_build_object('success', false, 'error', 'Invalid delivery code');
    END IF;
    
    -- Get order details
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    
    -- Update verification record
    UPDATE public.delivery_verification
    SET status = 'delivered',
        delivery_verified_at = now(),
        attempt_count = 0,
        updated_at = now()
    WHERE id = v_verification.id;
    
    -- Update order status
    UPDATE public.orders
    SET status = 'delivered',
        payment_status = 'paid_to_seller',
        updated_at = now()
    WHERE id = p_order_id;
    
    -- Credit sellers for their items
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
    
    -- Credit driver for delivery fee
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
    
    RETURN json_build_object(
        'success', true,
        'message', 'Delivery verified successfully. Payment distributed.'
    );
END;
$function$;

-- 7. Fix product-images storage policy
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;

CREATE POLICY "Users can upload product images to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' 
  AND auth.uid() IS NOT NULL
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
