
-- Add default conversion commission setting
INSERT INTO public.platform_settings (key, value, description)
VALUES ('conversion_commission_percent', '2', 'Pourcentage de commission sur les conversions de devises')
ON CONFLICT (key) DO NOTHING;

-- Update convert_wallet_currency to apply commission
CREATE OR REPLACE FUNCTION public.convert_wallet_currency(
  p_amount numeric,
  p_from_currency text,
  p_to_currency text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_wallet_id uuid;
  v_rate numeric;
  v_converted numeric;
  v_commission_percent numeric;
  v_commission_amount numeric;
  v_net_amount numeric;
  v_from_col text;
  v_to_col text;
  v_current_balance numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  IF p_from_currency = p_to_currency THEN
    RETURN json_build_object('success', false, 'error', 'Devises identiques');
  END IF;

  -- Get commission percent from settings
  SELECT COALESCE(value::numeric, 0) INTO v_commission_percent
  FROM platform_settings WHERE key = 'conversion_commission_percent';
  IF v_commission_percent IS NULL THEN v_commission_percent := 0; END IF;

  -- Get rate
  SELECT rate INTO v_rate FROM currency_rates
  WHERE from_currency = p_from_currency AND to_currency = p_to_currency;

  IF v_rate IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Taux de change non trouvé');
  END IF;

  -- Calculate commission and net amounts
  v_commission_amount := ROUND(p_amount * v_commission_percent / 100, 2);
  v_net_amount := p_amount - v_commission_amount;
  v_converted := ROUND(v_net_amount * v_rate, 2);

  -- Determine column names
  v_from_col := 'balance_' || lower(p_from_currency);
  v_to_col := 'balance_' || lower(p_to_currency);

  -- Get wallet
  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_user_id;
  IF v_wallet_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Portefeuille non trouvé');
  END IF;

  -- Check balance
  EXECUTE format('SELECT %I FROM wallets WHERE id = $1', v_from_col)
    INTO v_current_balance USING v_wallet_id;

  IF v_current_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Solde insuffisant');
  END IF;

  -- Update balances (deduct full amount from source, add converted net to target)
  EXECUTE format('UPDATE wallets SET %I = %I - $1, %I = %I + $2, updated_at = now() WHERE id = $3',
    v_from_col, v_from_col, v_to_col, v_to_col)
    USING p_amount, v_converted, v_wallet_id;

  -- Record conversion transaction
  INSERT INTO wallet_transactions (wallet_id, type, amount, currency, description, status)
  VALUES (v_wallet_id, 'conversion', p_amount, p_from_currency,
    format('Conversion %s %s → %s %s (commission %s%%: %s %s)',
      p_amount, p_from_currency, v_converted, p_to_currency,
      v_commission_percent, v_commission_amount, p_from_currency),
    'completed');

  RETURN json_build_object(
    'success', true,
    'converted_amount', v_converted,
    'commission_percent', v_commission_percent,
    'commission_amount', v_commission_amount,
    'rate', v_rate
  );
END;
$$;
