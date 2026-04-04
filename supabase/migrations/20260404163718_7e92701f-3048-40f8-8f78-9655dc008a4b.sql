-- Create order_returns table
CREATE TABLE public.order_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  buyer_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  fault_type text DEFAULT 'other',
  return_pickup_code text,
  return_delivery_code text,
  return_driver_id uuid,
  return_delivery_fee numeric DEFAULT 0,
  seller_confirmed boolean DEFAULT false,
  seller_notes text,
  refund_amount numeric DEFAULT 0,
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_returns ENABLE ROW LEVEL SECURITY;

-- Create return_messages table
CREATE TABLE public.return_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES order_returns(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  message text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.return_messages ENABLE ROW LEVEL SECURITY;

-- RLS for order_returns
CREATE POLICY "Buyers can view own returns"
ON order_returns FOR SELECT TO authenticated
USING (auth.uid() = buyer_id);

CREATE POLICY "Buyers can create returns"
ON order_returns FOR INSERT TO authenticated
WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Sellers can view returns for their orders"
ON order_returns FOR SELECT TO authenticated
USING (order_id IN (SELECT get_seller_order_ids()));

CREATE POLICY "Sellers can update returns for their orders"
ON order_returns FOR UPDATE TO authenticated
USING (order_id IN (SELECT get_seller_order_ids()));

CREATE POLICY "Drivers can view assigned returns"
ON order_returns FOR SELECT TO authenticated
USING (auth.uid() = return_driver_id);

CREATE POLICY "Admins can manage all returns"
ON order_returns FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS for return_messages
CREATE POLICY "Return participants can view messages"
ON return_messages FOR SELECT TO authenticated
USING (
  return_id IN (
    SELECT id FROM order_returns WHERE buyer_id = auth.uid()
    UNION SELECT id FROM order_returns WHERE return_driver_id = auth.uid()
    UNION SELECT id FROM order_returns WHERE order_id IN (SELECT get_seller_order_ids())
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Return participants can send messages"
ON return_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id AND (
    return_id IN (
      SELECT id FROM order_returns WHERE buyer_id = auth.uid()
      UNION SELECT id FROM order_returns WHERE return_driver_id = auth.uid()
      UNION SELECT id FROM order_returns WHERE order_id IN (SELECT get_seller_order_ids())
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Admins can manage return messages"
ON return_messages FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_order_returns_updated_at
BEFORE UPDATE ON order_returns
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.return_messages;

-- Function: Request return (within 2h of delivery)
CREATE OR REPLACE FUNCTION public.request_return(p_order_id uuid, p_reason text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_existing RECORD;
  v_return_id uuid;
  v_seller_ids uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id AND buyer_id = auth.uid();
  IF v_order.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Commande introuvable');
  END IF;

  IF v_order.status != 'delivered' THEN
    RETURN json_build_object('success', false, 'error', 'La commande doit être livrée pour demander un retour');
  END IF;

  -- Check 2h window from delivery
  IF v_order.updated_at < now() - interval '2 hours' THEN
    RETURN json_build_object('success', false, 'error', 'Le délai de retour de 2h est expiré');
  END IF;

  -- Check no existing pending return
  SELECT * INTO v_existing FROM order_returns WHERE order_id = p_order_id AND status NOT IN ('rejected', 'refunded');
  IF v_existing.id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Une demande de retour existe déjà');
  END IF;

  -- Calculate refund amount (product only, not delivery)
  INSERT INTO order_returns (order_id, buyer_id, reason, refund_amount)
  VALUES (p_order_id, auth.uid(), p_reason, v_order.total_amount - COALESCE(v_order.delivery_fee, 0))
  RETURNING id INTO v_return_id;

  -- Notify sellers
  SELECT array_agg(DISTINCT seller_id) INTO v_seller_ids
  FROM order_items WHERE order_id = p_order_id AND seller_id IS NOT NULL;

  IF v_seller_ids IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, action_url)
    SELECT unnest(v_seller_ids), '🔄 Demande de retour',
      'L''acheteur demande le retour de la commande #' || LEFT(p_order_id::text, 8) || '. Raison: ' || p_reason,
      'info', '/seller';
  END IF;

  -- Notify admins
  INSERT INTO notifications (user_id, title, message, type)
  SELECT ur.user_id, '🔄 Nouvelle demande de retour',
    'Commande #' || LEFT(p_order_id::text, 8) || ' - Raison: ' || p_reason, 'info'
  FROM user_roles ur WHERE ur.role = 'admin';

  RETURN json_build_object('success', true, 'return_id', v_return_id);
END;
$$;

-- Function: Seller approves return
CREATE OR REPLACE FUNCTION public.approve_return(p_return_id uuid, p_fault_type text DEFAULT 'other')
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_return RECORD;
  v_pickup_code text;
BEGIN
  SELECT r.*, o.buyer_id as order_buyer_id
  INTO v_return FROM order_returns r
  JOIN orders o ON o.id = r.order_id
  WHERE r.id = p_return_id;

  IF v_return.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Retour introuvable');
  END IF;

  -- Verify caller is seller of this order or admin
  IF NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = v_return.order_id AND seller_id = auth.uid())
    AND NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  v_pickup_code := generate_pin_code();

  UPDATE order_returns
  SET status = 'approved',
      fault_type = p_fault_type,
      return_pickup_code = v_pickup_code,
      updated_at = now()
  WHERE id = p_return_id;

  -- Update order status
  UPDATE orders SET status = 'return_approved', updated_at = now() WHERE id = v_return.order_id;

  -- Notify buyer
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_return.buyer_id, '✅ Retour approuvé',
    'Votre demande de retour a été approuvée. Marquez le colis comme prêt quand il est emballé. Code: ' || v_pickup_code, 'success');

  -- Notify nearby drivers
  INSERT INTO notifications (user_id, title, message, type, action_url)
  SELECT dl.driver_id, '🔄 Retour à récupérer',
    'Un colis retour est disponible pour récupération.', 'info', '/driver'
  FROM driver_locations dl WHERE dl.is_online = true;

  RETURN json_build_object('success', true, 'pickup_code', v_pickup_code);
END;
$$;

-- Function: Driver accepts return pickup
CREATE OR REPLACE FUNCTION public.driver_accept_return(p_return_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_return RECORD;
BEGIN
  IF NOT has_role(auth.uid(), 'driver') THEN
    RETURN json_build_object('success', false, 'error', 'Not a driver');
  END IF;

  SELECT * INTO v_return FROM order_returns
  WHERE id = p_return_id AND status IN ('approved', 'return_pickup_ready')
    AND return_driver_id IS NULL
  FOR UPDATE SKIP LOCKED;

  IF v_return.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Retour non disponible');
  END IF;

  UPDATE order_returns
  SET return_driver_id = auth.uid(),
      status = 'return_pickup_ready',
      updated_at = now()
  WHERE id = p_return_id;

  -- Notify buyer
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_return.buyer_id, '🚚 Livreur en route pour le retour',
    'Un livreur va récupérer votre colis retour.', 'info');

  RETURN json_build_object('success', true, 'message', 'Return pickup accepted');
END;
$$;

-- Function: Verify return pickup code (driver at buyer's place)
CREATE OR REPLACE FUNCTION public.verify_return_pickup(p_return_id uuid, p_code text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_return RECORD;
  v_delivery_code text;
BEGIN
  SELECT * INTO v_return FROM order_returns WHERE id = p_return_id AND return_driver_id = auth.uid();
  IF v_return.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  IF v_return.return_pickup_code != p_code THEN
    RETURN json_build_object('success', false, 'error', 'Code invalide');
  END IF;

  v_delivery_code := generate_pin_code();

  UPDATE order_returns
  SET status = 'return_in_transit',
      return_pickup_code = NULL,
      return_delivery_code = v_delivery_code,
      updated_at = now()
  WHERE id = p_return_id;

  -- Notify seller with delivery code
  INSERT INTO notifications (user_id, title, message, type)
  SELECT DISTINCT oi.seller_id, '📦 Colis retour en route',
    'Le livreur a récupéré le colis retour. Code de réception: ' || v_delivery_code,
    'info'
  FROM order_items oi WHERE oi.order_id = v_return.order_id AND oi.seller_id IS NOT NULL;

  RETURN json_build_object('success', true, 'delivery_code', v_delivery_code);
END;
$$;

-- Function: Verify return delivery code (driver at seller's place)
CREATE OR REPLACE FUNCTION public.verify_return_delivery(p_return_id uuid, p_code text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_return RECORD;
BEGIN
  SELECT * INTO v_return FROM order_returns WHERE id = p_return_id AND return_driver_id = auth.uid();
  IF v_return.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  IF v_return.return_delivery_code != p_code THEN
    RETURN json_build_object('success', false, 'error', 'Code invalide');
  END IF;

  UPDATE order_returns
  SET status = 'returned',
      return_delivery_code = NULL,
      updated_at = now()
  WHERE id = p_return_id;

  -- Update order status
  UPDATE orders SET status = 'returned', updated_at = now() WHERE id = v_return.order_id;

  -- Notify seller to inspect
  INSERT INTO notifications (user_id, title, message, type)
  SELECT DISTINCT oi.seller_id, '📦 Colis retour reçu',
    'Le colis retour a été livré. Veuillez inspecter et confirmer l''état du produit.',
    'info'
  FROM order_items oi WHERE oi.order_id = v_return.order_id AND oi.seller_id IS NOT NULL;

  -- Pay return driver if seller fault
  IF v_return.fault_type = 'seller_fault' AND v_return.return_delivery_fee > 0 THEN
    UPDATE wallets SET balance_dop = balance_dop + v_return.return_delivery_fee, updated_at = now()
    WHERE user_id = auth.uid();
    INSERT INTO wallet_transactions (wallet_id, type, amount, currency, status, description)
    SELECT id, 'payment', v_return.return_delivery_fee, 'DOP', 'completed', 'Retour livraison #' || LEFT(v_return.order_id::text, 8)
    FROM wallets WHERE user_id = auth.uid();
  END IF;

  RETURN json_build_object('success', true, 'message', 'Return delivered to seller');
END;
$$;

-- Function: Seller confirms return condition and decides
CREATE OR REPLACE FUNCTION public.confirm_return_received(p_return_id uuid, p_confirmed boolean, p_notes text DEFAULT NULL, p_action text DEFAULT 'refund')
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_return RECORD;
  v_order RECORD;
  v_buyer_wallet_id uuid;
  v_seller_wallet_id uuid;
BEGIN
  SELECT r.*, o.total_amount, o.delivery_fee, o.currency, o.buyer_id as order_buyer_id
  INTO v_return FROM order_returns r
  JOIN orders o ON o.id = r.order_id
  WHERE r.id = p_return_id;

  IF v_return.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Retour introuvable');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = v_return.order_id AND seller_id = auth.uid())
    AND NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  UPDATE order_returns
  SET seller_confirmed = p_confirmed,
      seller_notes = p_notes,
      updated_at = now()
  WHERE id = p_return_id;

  IF p_confirmed AND p_action = 'refund' THEN
    -- Refund buyer (product amount only, not delivery)
    SELECT id INTO v_buyer_wallet_id FROM wallets WHERE user_id = v_return.order_buyer_id;
    IF v_buyer_wallet_id IS NOT NULL THEN
      UPDATE wallets SET balance_dop = balance_dop + v_return.refund_amount, updated_at = now()
      WHERE id = v_buyer_wallet_id;
      INSERT INTO wallet_transactions (wallet_id, type, amount, currency, status, description, reference)
      VALUES (v_buyer_wallet_id, 'refund', v_return.refund_amount, COALESCE(v_return.currency, 'DOP'), 'completed',
        'Remboursement commande #' || LEFT(v_return.order_id::text, 8), v_return.order_id::text);
    END IF;

    -- Deduct from seller wallet
    SELECT id INTO v_seller_wallet_id FROM wallets WHERE user_id = auth.uid();
    IF v_seller_wallet_id IS NOT NULL THEN
      UPDATE wallets SET balance_dop = balance_dop - v_return.refund_amount, updated_at = now()
      WHERE id = v_seller_wallet_id;
      INSERT INTO wallet_transactions (wallet_id, type, amount, currency, status, description, reference)
      VALUES (v_seller_wallet_id, 'refund', -v_return.refund_amount, COALESCE(v_return.currency, 'DOP'), 'completed',
        'Remboursement retour commande #' || LEFT(v_return.order_id::text, 8), v_return.order_id::text);
    END IF;

    -- If seller fault, charge seller for return delivery
    IF v_return.fault_type = 'seller_fault' AND v_return.return_delivery_fee > 0 AND v_seller_wallet_id IS NOT NULL THEN
      UPDATE wallets SET balance_dop = balance_dop - v_return.return_delivery_fee, updated_at = now()
      WHERE id = v_seller_wallet_id;
      INSERT INTO wallet_transactions (wallet_id, type, amount, currency, status, description)
      VALUES (v_seller_wallet_id, 'fee', -v_return.return_delivery_fee, 'DOP', 'completed',
        'Frais retour commande #' || LEFT(v_return.order_id::text, 8));
    END IF;

    UPDATE order_returns SET status = 'refunded', updated_at = now() WHERE id = p_return_id;
    UPDATE orders SET status = 'refunded', updated_at = now() WHERE id = v_return.order_id;

    INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_return.order_buyer_id, '💰 Remboursement effectué',
      'Vous avez été remboursé de ' || v_return.refund_amount || ' pour la commande #' || LEFT(v_return.order_id::text, 8) || ' (hors frais de livraison).',
      'success');

  ELSIF p_confirmed AND p_action = 'redeliver' THEN
    -- Re-deliver the same order
    UPDATE orders SET status = 'confirmed', updated_at = now() WHERE id = v_return.order_id;
    UPDATE order_returns SET status = 'redelivery', updated_at = now() WHERE id = p_return_id;

    INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_return.order_buyer_id, '🔄 Nouvelle livraison',
      'Le vendeur va re-livrer votre commande #' || LEFT(v_return.order_id::text, 8), 'info');
  END IF;

  RETURN json_build_object('success', true, 'message', 'Return processed');
END;
$$;