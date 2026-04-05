
CREATE OR REPLACE FUNCTION public.confirm_return_received(
  p_return_id uuid,
  p_confirmed boolean,
  p_notes text DEFAULT '',
  p_action text DEFAULT 'refund'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_return RECORD;
  v_order RECORD;
  v_buyer_wallet_id uuid;
  v_seller_wallet_id uuid;
  v_seller_id uuid;
BEGIN
  SELECT r.*, o.total_amount, o.delivery_fee, o.currency, o.buyer_id as order_buyer_id
  INTO v_return FROM order_returns r
  JOIN orders o ON o.id = r.order_id
  WHERE r.id = p_return_id;

  IF v_return.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Retour introuvable');
  END IF;

  -- Find the actual seller from order items
  SELECT DISTINCT oi.seller_id INTO v_seller_id
  FROM order_items oi WHERE oi.order_id = v_return.order_id AND oi.seller_id IS NOT NULL
  LIMIT 1;

  -- Authorization: must be the seller of this order OR admin
  IF NOT (v_seller_id = auth.uid() OR has_role(auth.uid(), 'admin')) THEN
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

    -- Deduct from SELLER wallet (not admin)
    IF v_seller_id IS NOT NULL THEN
      SELECT id INTO v_seller_wallet_id FROM wallets WHERE user_id = v_seller_id;
      IF v_seller_wallet_id IS NOT NULL THEN
        UPDATE wallets SET balance_dop = balance_dop - v_return.refund_amount, updated_at = now()
        WHERE id = v_seller_wallet_id;
        INSERT INTO wallet_transactions (wallet_id, type, amount, currency, status, description, reference)
        VALUES (v_seller_wallet_id, 'debit', v_return.refund_amount, COALESCE(v_return.currency, 'DOP'), 'completed',
          'Débit remboursement commande #' || LEFT(v_return.order_id::text, 8), v_return.order_id::text);
      END IF;

      -- If seller fault, charge seller for return delivery
      IF v_return.fault_type = 'seller_fault' AND v_return.return_delivery_fee > 0 AND v_seller_wallet_id IS NOT NULL THEN
        UPDATE wallets SET balance_dop = balance_dop - v_return.return_delivery_fee, updated_at = now()
        WHERE id = v_seller_wallet_id;
        INSERT INTO wallet_transactions (wallet_id, type, amount, currency, status, description)
        VALUES (v_seller_wallet_id, 'fee', v_return.return_delivery_fee, 'DOP', 'completed',
          'Frais retour commande #' || LEFT(v_return.order_id::text, 8));
      END IF;
    END IF;

    UPDATE order_returns SET status = 'refunded', updated_at = now() WHERE id = p_return_id;
    UPDATE orders SET status = 'refunded', updated_at = now() WHERE id = v_return.order_id;

    -- Notify buyer
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_return.order_buyer_id, '💰 Remboursement effectué',
      'Vous avez été remboursé de ' || v_return.refund_amount || ' pour la commande #' || LEFT(v_return.order_id::text, 8) || ' (hors frais de livraison).',
      'success');

    -- Notify seller
    IF v_seller_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (v_seller_id, '⚠️ Remboursement débité',
        'Un remboursement de ' || v_return.refund_amount || ' a été débité de votre portefeuille pour la commande #' || LEFT(v_return.order_id::text, 8),
        'warning');
    END IF;

  ELSIF p_confirmed AND p_action = 'redeliver' THEN
    UPDATE orders SET status = 'confirmed', updated_at = now() WHERE id = v_return.order_id;
    UPDATE order_returns SET status = 'redelivery', updated_at = now() WHERE id = p_return_id;

    INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_return.order_buyer_id, '🔄 Nouvelle livraison',
      'Le vendeur va re-livrer votre commande #' || LEFT(v_return.order_id::text, 8), 'info');
  END IF;

  RETURN json_build_object('success', true, 'message', 'Return processed');
END;
$$;
