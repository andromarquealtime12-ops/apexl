CREATE OR REPLACE FUNCTION public.submit_deposit_request(
  p_amount numeric,
  p_currency text,
  p_payment_method payment_method_type,
  p_transaction_reference text,
  p_proof_path text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
  v_tx_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Non authentifié');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Montant invalide');
  END IF;
  IF p_currency NOT IN ('DOP','HTG','USD') THEN
    RETURN json_build_object('success', false, 'error', 'Devise invalide');
  END IF;
  IF p_proof_path IS NULL OR length(trim(p_proof_path)) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Preuve requise');
  END IF;

  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = auth.uid();
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id) VALUES (auth.uid()) RETURNING id INTO v_wallet_id;
  END IF;

  INSERT INTO public.wallet_transactions (
    wallet_id, type, amount, currency, payment_method, status,
    description, transaction_reference, proof_image_url
  ) VALUES (
    v_wallet_id, 'deposit', p_amount, p_currency, p_payment_method, 'pending',
    'Dépôt via ' || p_payment_method::text, p_transaction_reference, p_proof_path
  ) RETURNING id INTO v_tx_id;

  RETURN json_build_object('success', true, 'transaction_id', v_tx_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_deposit_request(numeric, text, payment_method_type, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_deposit_request(numeric, text, payment_method_type, text, text) TO authenticated;

-- Cancel all pending MonCash deposits (used when the MonCash API fails / does not confirm)
CREATE OR REPLACE FUNCTION public.cancel_pending_moncash_deposits(p_reason text DEFAULT 'Transfert MonCash non confirmé')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
  v_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Non authentifié');
  END IF;
  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = auth.uid();
  IF v_wallet_id IS NULL THEN
    RETURN json_build_object('success', true, 'cancelled', 0);
  END IF;

  UPDATE public.wallet_transactions
     SET status = 'failed',
         description = COALESCE(description, '') || ' — annulé: ' || p_reason
   WHERE wallet_id = v_wallet_id
     AND type = 'deposit'
     AND status = 'pending'
     AND payment_method = 'moncash';
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN json_build_object('success', true, 'cancelled', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_pending_moncash_deposits(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_pending_moncash_deposits(text) TO authenticated;