
CREATE OR REPLACE FUNCTION public.convert_wallet_currency(
  p_amount NUMERIC,
  p_from_currency TEXT,
  p_to_currency TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_rate NUMERIC;
  v_converted NUMERIC;
  v_balance NUMERIC;
  v_from_col TEXT;
  v_to_col TEXT;
BEGIN
  IF p_from_currency = p_to_currency THEN
    RETURN json_build_object('success', false, 'error', 'Les devises source et cible doivent être différentes');
  END IF;

  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Le montant doit être positif');
  END IF;

  -- Get wallet
  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = auth.uid() AND is_active = true;
  IF v_wallet_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Portefeuille introuvable');
  END IF;

  -- Get rate
  SELECT rate INTO v_rate FROM currency_rates WHERE from_currency = p_from_currency AND to_currency = p_to_currency;
  IF v_rate IS NULL THEN
    -- Try reverse
    SELECT 1.0 / rate INTO v_rate FROM currency_rates WHERE from_currency = p_to_currency AND to_currency = p_from_currency;
  END IF;
  IF v_rate IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Taux de change non disponible');
  END IF;

  v_converted := ROUND(p_amount * v_rate, 2);

  -- Check balance
  v_from_col := 'balance_' || LOWER(p_from_currency);
  
  IF LOWER(p_from_currency) = 'dop' THEN
    SELECT balance_dop INTO v_balance FROM wallets WHERE id = v_wallet_id;
  ELSIF LOWER(p_from_currency) = 'htg' THEN
    SELECT balance_htg INTO v_balance FROM wallets WHERE id = v_wallet_id;
  ELSIF LOWER(p_from_currency) = 'usd' THEN
    SELECT balance_usd INTO v_balance FROM wallets WHERE id = v_wallet_id;
  END IF;

  IF v_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Solde insuffisant');
  END IF;

  -- Deduct from source
  IF LOWER(p_from_currency) = 'dop' THEN
    UPDATE wallets SET balance_dop = balance_dop - p_amount, updated_at = now() WHERE id = v_wallet_id;
  ELSIF LOWER(p_from_currency) = 'htg' THEN
    UPDATE wallets SET balance_htg = balance_htg - p_amount, updated_at = now() WHERE id = v_wallet_id;
  ELSIF LOWER(p_from_currency) = 'usd' THEN
    UPDATE wallets SET balance_usd = balance_usd - p_amount, updated_at = now() WHERE id = v_wallet_id;
  END IF;

  -- Add to target
  IF LOWER(p_to_currency) = 'dop' THEN
    UPDATE wallets SET balance_dop = balance_dop + v_converted, updated_at = now() WHERE id = v_wallet_id;
  ELSIF LOWER(p_to_currency) = 'htg' THEN
    UPDATE wallets SET balance_htg = balance_htg + v_converted, updated_at = now() WHERE id = v_wallet_id;
  ELSIF LOWER(p_to_currency) = 'usd' THEN
    UPDATE wallets SET balance_usd = balance_usd + v_converted, updated_at = now() WHERE id = v_wallet_id;
  END IF;

  -- Record transactions
  INSERT INTO wallet_transactions (wallet_id, type, amount, currency, status, description)
  VALUES (v_wallet_id, 'transfer', p_amount, p_from_currency, 'completed',
    'Conversion ' || p_amount || ' ' || p_from_currency || ' → ' || v_converted || ' ' || p_to_currency);

  RETURN json_build_object('success', true, 'converted_amount', v_converted, 'rate', v_rate);
END;
$$;
