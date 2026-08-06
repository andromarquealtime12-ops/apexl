CREATE OR REPLACE FUNCTION public.reject_withdrawal(p_transaction_id uuid, p_reason text DEFAULT 'Refusé par admin')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tx RECORD;
  v_balance_field text;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR auth.role() = 'service_role') THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT wt.*, w.user_id as wallet_user_id INTO v_tx
  FROM wallet_transactions wt
  JOIN wallets w ON w.id = wt.wallet_id
  WHERE wt.id = p_transaction_id AND wt.type = 'withdrawal' AND wt.status = 'pending';

  IF v_tx.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Transaction not found');
  END IF;

  v_balance_field := CASE v_tx.currency
    WHEN 'DOP' THEN 'balance_dop'
    WHEN 'HTG' THEN 'balance_htg'
    ELSE 'balance_usd'
  END;

  EXECUTE format('UPDATE wallets SET %I = COALESCE(%I, 0) + $1, updated_at = now() WHERE id = $2',
    v_balance_field, v_balance_field)
  USING v_tx.amount, v_tx.wallet_id;

  UPDATE wallet_transactions
  SET status = 'failed',
      description = COALESCE(description, '') || ' (Refusé: ' || COALESCE(p_reason, '') || ')'
  WHERE id = p_transaction_id;

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_tx.wallet_user_id, 'Retrait refusé',
    format('Votre retrait de %s %s a été refusé. Motif: %s. Le montant a été remboursé sur votre portefeuille.',
      v_tx.amount, v_tx.currency, COALESCE(p_reason, 'Non spécifié')), 'warning');

  RETURN json_build_object('success', true, 'message', 'Withdrawal rejected and refunded');
END;
$$;