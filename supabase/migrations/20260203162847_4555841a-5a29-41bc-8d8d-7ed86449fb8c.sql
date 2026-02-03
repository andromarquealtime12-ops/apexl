-- Add verification fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_code text,
ADD COLUMN IF NOT EXISTS verification_code_expires_at timestamp with time zone;

-- Add payment_status to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'reserved', 'paid_to_seller', 'refunded'));

-- Create delivery_verification table for PIN system
CREATE TABLE public.delivery_verification (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    pickup_code text NOT NULL,
    delivery_code text,
    status text NOT NULL DEFAULT 'pending_pickup' CHECK (status IN ('pending_pickup', 'picked_up', 'pending_delivery', 'delivered', 'cancelled')),
    pickup_verified_at timestamp with time zone,
    delivery_verified_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(order_id)
);

-- Enable RLS on delivery_verification
ALTER TABLE public.delivery_verification ENABLE ROW LEVEL SECURITY;

-- Sellers can view verifications for their order items
CREATE POLICY "Sellers can view their order verifications"
ON public.delivery_verification FOR SELECT
USING (
    order_id IN (
        SELECT DISTINCT oi.order_id FROM public.order_items oi
        WHERE oi.seller_id = auth.uid()
    )
);

-- Drivers can view verifications for their assigned orders
CREATE POLICY "Drivers can view assigned order verifications"
ON public.delivery_verification FOR SELECT
USING (
    order_id IN (
        SELECT id FROM public.orders WHERE driver_id = auth.uid()
    )
);

-- Drivers can update verifications for their assigned orders
CREATE POLICY "Drivers can update assigned order verifications"
ON public.delivery_verification FOR UPDATE
USING (
    order_id IN (
        SELECT id FROM public.orders WHERE driver_id = auth.uid()
    )
);

-- Buyers can view their order verifications
CREATE POLICY "Buyers can view own order verifications"
ON public.delivery_verification FOR SELECT
USING (
    order_id IN (
        SELECT id FROM public.orders WHERE buyer_id = auth.uid()
    )
);

-- Admins can manage all verifications
CREATE POLICY "Admins can manage all verifications"
ON public.delivery_verification FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- System can create verifications (via order creation)
CREATE POLICY "Authenticated users can create verifications"
ON public.delivery_verification FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create function to generate random 4-digit PIN
CREATE OR REPLACE FUNCTION public.generate_pin_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
    RETURN lpad(floor(random() * 10000)::text, 4, '0');
END;
$$;

-- Create function to verify pickup code
CREATE OR REPLACE FUNCTION public.verify_pickup_code(
    p_order_id uuid,
    p_code text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_verification RECORD;
    v_delivery_code text;
BEGIN
    -- Get the verification record
    SELECT * INTO v_verification 
    FROM public.delivery_verification 
    WHERE order_id = p_order_id AND status = 'pending_pickup';
    
    IF v_verification.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Verification record not found');
    END IF;
    
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
$$;

-- Create function to verify delivery code
CREATE OR REPLACE FUNCTION public.verify_delivery_code(
    p_order_id uuid,
    p_code text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_verification RECORD;
    v_order RECORD;
    v_seller_wallet_id uuid;
    v_driver_wallet_id uuid;
    v_seller_amount numeric;
    v_driver_amount numeric;
    v_item RECORD;
BEGIN
    -- Get the verification record
    SELECT * INTO v_verification 
    FROM public.delivery_verification 
    WHERE order_id = p_order_id AND status = 'picked_up';
    
    IF v_verification.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Verification record not found');
    END IF;
    
    IF v_verification.delivery_code != p_code THEN
        RETURN json_build_object('success', false, 'error', 'Invalid delivery code');
    END IF;
    
    -- Get order details
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    
    -- Update verification record
    UPDATE public.delivery_verification
    SET status = 'delivered',
        delivery_verified_at = now(),
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
            -- Get seller wallet
            SELECT id INTO v_seller_wallet_id 
            FROM public.wallets 
            WHERE user_id = v_item.seller_id;
            
            IF v_seller_wallet_id IS NOT NULL THEN
                -- Credit seller wallet
                UPDATE public.wallets
                SET balance_dop = balance_dop + v_item.seller_total,
                    updated_at = now()
                WHERE id = v_seller_wallet_id;
                
                -- Create transaction record
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
            -- Credit driver wallet
            UPDATE public.wallets
            SET balance_dop = balance_dop + v_order.delivery_fee,
                updated_at = now()
            WHERE id = v_driver_wallet_id;
            
            -- Create transaction record for delivery fee
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
$$;

-- Create function to create delivery verification when order is ready
CREATE OR REPLACE FUNCTION public.create_delivery_verification(p_order_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_pickup_code text;
    v_existing RECORD;
BEGIN
    -- Check if verification already exists
    SELECT * INTO v_existing FROM public.delivery_verification WHERE order_id = p_order_id;
    
    IF v_existing.id IS NOT NULL THEN
        RETURN json_build_object('success', true, 'pickup_code', v_existing.pickup_code, 'already_exists', true);
    END IF;
    
    -- Generate pickup code
    v_pickup_code := generate_pin_code();
    
    -- Create verification record
    INSERT INTO public.delivery_verification (order_id, pickup_code)
    VALUES (p_order_id, v_pickup_code);
    
    RETURN json_build_object('success', true, 'pickup_code', v_pickup_code);
END;
$$;

-- Update trigger for delivery_verification
CREATE TRIGGER update_delivery_verification_updated_at
BEFORE UPDATE ON public.delivery_verification
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();