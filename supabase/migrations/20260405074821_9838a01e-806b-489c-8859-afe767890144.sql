
-- Add agent role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'agent';

-- Function: agent credits a user wallet by email
CREATE OR REPLACE FUNCTION public.agent_deposit_to_wallet(
  p_customer_email TEXT,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'DOP',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_wallet_id UUID;
  v_balance_col TEXT;
  v_agent_id UUID;
  v_deposit_agent_id UUID;
BEGIN
  -- Verify caller is agent or admin
  IF NOT (has_role(auth.uid(), 'agent') OR has_role(auth.uid(), 'admin')) THEN
    RETURN json_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- Find customer by email
  SELECT id INTO v_customer_id FROM auth.users WHERE email = LOWER(TRIM(p_customer_email));
  IF v_customer_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Aucun utilisateur trouvé avec cet email');
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Montant invalide');
  END IF;

  -- Determine balance column
  IF p_currency = 'DOP' THEN v_balance_col := 'balance_dop';
  ELSIF p_currency = 'HTG' THEN v_balance_col := 'balance_htg';
  ELSIF p_currency = 'USD' THEN v_balance_col := 'balance_usd';
  ELSE RETURN json_build_object('success', false, 'error', 'Devise non supportée');
  END IF;

  -- Get or create wallet
  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_customer_id;
  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id) VALUES (v_customer_id) RETURNING id INTO v_wallet_id;
  END IF;

  -- Credit wallet
  EXECUTE format('UPDATE wallets SET %I = COALESCE(%I, 0) + $1, updated_at = now() WHERE id = $2', v_balance_col, v_balance_col)
  USING p_amount, v_wallet_id;

  -- Find agent's deposit_agent record
  SELECT id INTO v_deposit_agent_id FROM deposit_agents WHERE agent_user_id = auth.uid() AND is_active = true LIMIT 1;

  -- Record transaction
  INSERT INTO wallet_transactions (wallet_id, type, amount, currency, status, description, payment_method)
  VALUES (
    v_wallet_id,
    'deposit',
    p_amount,
    p_currency,
    'completed',
    'Dépôt en espèces via agent' || COALESCE(' - ' || p_notes, ''),
    'bank_other'
  );

  -- Record in agent_deposits if agent record exists
  IF v_deposit_agent_id IS NOT NULL THEN
    INSERT INTO agent_deposits (agent_id, customer_user_id, amount, currency, status, admin_notes, processed_at, processed_by)
    VALUES (v_deposit_agent_id, v_customer_id, p_amount, p_currency, 'completed', p_notes, now(), auth.uid());
  END IF;

  RETURN json_build_object('success', true, 'message', 'Dépôt effectué avec succès');
END;
$$;

-- Function: agent processes a cash withdrawal
CREATE OR REPLACE FUNCTION public.agent_withdraw_from_wallet(
  p_customer_email TEXT,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'DOP',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_wallet_id UUID;
  v_balance NUMERIC;
  v_balance_col TEXT;
BEGIN
  -- Verify caller is agent or admin
  IF NOT (has_role(auth.uid(), 'agent') OR has_role(auth.uid(), 'admin')) THEN
    RETURN json_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- Find customer
  SELECT id INTO v_customer_id FROM auth.users WHERE email = LOWER(TRIM(p_customer_email));
  IF v_customer_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Aucun utilisateur trouvé avec cet email');
  END IF;

  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Montant invalide');
  END IF;

  IF p_currency = 'DOP' THEN v_balance_col := 'balance_dop';
  ELSIF p_currency = 'HTG' THEN v_balance_col := 'balance_htg';
  ELSIF p_currency = 'USD' THEN v_balance_col := 'balance_usd';
  ELSE RETURN json_build_object('success', false, 'error', 'Devise non supportée');
  END IF;

  -- Get wallet
  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_customer_id;
  IF v_wallet_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Portefeuille introuvable');
  END IF;

  -- Check balance
  EXECUTE format('SELECT COALESCE(%I, 0) FROM wallets WHERE id = $1', v_balance_col)
  INTO v_balance USING v_wallet_id;

  IF v_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Solde insuffisant (' || v_balance || ' ' || p_currency || ')');
  END IF;

  -- Debit wallet
  EXECUTE format('UPDATE wallets SET %I = %I - $1, updated_at = now() WHERE id = $2', v_balance_col, v_balance_col)
  USING p_amount, v_wallet_id;

  -- Record transaction
  INSERT INTO wallet_transactions (wallet_id, type, amount, currency, status, description, payment_method)
  VALUES (
    v_wallet_id,
    'withdrawal',
    p_amount,
    p_currency,
    'completed',
    'Retrait en espèces via agent' || COALESCE(' - ' || p_notes, ''),
    'bank_other'
  );

  RETURN json_build_object('success', true, 'message', 'Retrait effectué avec succès');
END;
$$;
