
-- Refund requests table
CREATE TABLE public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  requester_id uuid NOT NULL,
  reason text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create refund requests" ON public.refund_requests
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can view own refund requests" ON public.refund_requests
FOR SELECT TO authenticated
USING (auth.uid() = requester_id);

CREATE POLICY "Admins can manage all refund requests" ON public.refund_requests
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Function to request refund (validates 15-day window)
CREATE OR REPLACE FUNCTION public.request_refund(p_order_id uuid, p_reason text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_existing RECORD;
  v_refund_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id AND buyer_id = auth.uid();
  IF v_order.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status != 'delivered' THEN
    RETURN json_build_object('success', false, 'error', 'Order must be delivered to request refund');
  END IF;

  -- Check 15-day window
  IF v_order.updated_at < now() - interval '15 days' THEN
    RETURN json_build_object('success', false, 'error', 'Refund window expired (15 days)');
  END IF;

  -- Check no existing pending request
  SELECT * INTO v_existing FROM refund_requests WHERE order_id = p_order_id AND status = 'pending';
  IF v_existing.id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'A refund request already exists');
  END IF;

  INSERT INTO refund_requests (order_id, requester_id, reason, amount)
  VALUES (p_order_id, auth.uid(), p_reason, v_order.total_amount)
  RETURNING id INTO v_refund_id;

  -- Notify admins
  INSERT INTO notifications (user_id, title, message, type)
  SELECT ur.user_id, '💰 Demande de remboursement',
    'Commande #' || LEFT(p_order_id::text, 8) || ' - ' || v_order.total_amount || ' ' || v_order.currency,
    'info'
  FROM user_roles ur WHERE ur.role = 'admin';

  RETURN json_build_object('success', true, 'refund_id', v_refund_id);
END;
$$;

-- Function to process refund (admin)
CREATE OR REPLACE FUNCTION public.process_refund(p_refund_id uuid, p_approved boolean, p_notes text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_refund RECORD;
  v_order RECORD;
  v_wallet_id uuid;
  v_balance_field text;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_refund FROM refund_requests WHERE id = p_refund_id AND status = 'pending';
  IF v_refund.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Refund request not found');
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = v_refund.order_id;

  IF p_approved THEN
    -- Refund to buyer wallet
    SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_refund.requester_id;
    v_balance_field := CASE v_order.currency WHEN 'DOP' THEN 'balance_dop' WHEN 'HTG' THEN 'balance_htg' ELSE 'balance_usd' END;

    EXECUTE format('UPDATE wallets SET %I = COALESCE(%I, 0) + $1, updated_at = now() WHERE id = $2', v_balance_field, v_balance_field)
    USING v_refund.amount, v_wallet_id;

    INSERT INTO wallet_transactions (wallet_id, type, amount, currency, status, description)
    VALUES (v_wallet_id, 'refund', v_refund.amount, v_order.currency, 'completed',
      'Remboursement commande #' || LEFT(v_refund.order_id::text, 8));

    UPDATE orders SET status = 'refunded', updated_at = now() WHERE id = v_refund.order_id;
  END IF;

  UPDATE refund_requests
  SET status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
      admin_notes = p_notes, reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = p_refund_id;

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_refund.requester_id,
    CASE WHEN p_approved THEN 'Remboursement approuvé ✓' ELSE 'Remboursement refusé' END,
    CASE WHEN p_approved THEN 'Votre remboursement de ' || v_refund.amount || ' a été crédité.' ELSE 'Raison: ' || COALESCE(p_notes, 'N/A') END,
    CASE WHEN p_approved THEN 'success' ELSE 'error' END);

  RETURN json_build_object('success', true);
END;
$$;

-- Function to cleanup old data (15 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notif_count int;
  v_proof_count int;
BEGIN
  -- Delete old read notifications (> 15 days)
  DELETE FROM notifications WHERE is_read = true AND created_at < now() - interval '15 days';
  GET DIAGNOSTICS v_notif_count = ROW_COUNT;

  -- Clear old proof images (> 15 days)
  UPDATE wallet_transactions SET proof_image_url = NULL
  WHERE proof_image_url IS NOT NULL AND created_at < now() - interval '15 days';
  GET DIAGNOSTICS v_proof_count = ROW_COUNT;

  -- Expire old pending refund requests
  UPDATE refund_requests SET status = 'expired'
  WHERE status = 'pending' AND created_at < now() - interval '15 days';

  RETURN json_build_object('success', true, 'notifications_deleted', v_notif_count, 'proofs_cleared', v_proof_count);
END;
$$;

-- Update verify_pickup_code to clear the pickup code after verification
CREATE OR REPLACE FUNCTION public.verify_pickup_code(p_order_id uuid, p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    IF v_verification.attempt_count >= 10 THEN
        RETURN json_build_object('success', false, 'error', 'Too many attempts. Contact support.');
    END IF;

    UPDATE public.delivery_verification SET attempt_count = attempt_count + 1 WHERE id = v_verification.id;
    
    IF v_verification.pickup_code != p_code THEN
        RETURN json_build_object('success', false, 'error', 'Invalid pickup code');
    END IF;
    
    v_delivery_code := generate_pin_code();
    
    -- Clear pickup code and set delivery code
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

    -- Notify buyer with delivery code
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
$$;

-- Add 'refunded' to orders status check
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'confirmed', 'ready', 'ready_for_pickup', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'refunded'));
