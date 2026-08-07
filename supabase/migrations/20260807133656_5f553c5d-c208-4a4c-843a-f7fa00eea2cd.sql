-- 1) Server-side price validation for checkout
CREATE OR REPLACE FUNCTION public.process_checkout(p_buyer_id uuid, p_total_amount numeric, p_delivery_fee numeric, p_currency text, p_delivery_address text, p_delivery_city text, p_delivery_notes text, p_order_items jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_wallet RECORD;
  v_balance_field text;
  v_current_balance numeric;
  v_order_id uuid;
  v_item jsonb;
  v_product RECORD;
  v_qty integer;
  v_subtotal numeric := 0;
  v_total numeric;
  v_fee numeric;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_buyer_id THEN
    RETURN json_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  IF p_order_items IS NULL OR jsonb_array_length(p_order_items) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Le panier est vide');
  END IF;

  v_fee := GREATEST(COALESCE(p_delivery_fee, 0), 0);

  -- Recompute subtotal from authoritative product prices
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
  LOOP
    v_qty := GREATEST(COALESCE((v_item->>'quantity')::integer, 0), 0);
    IF v_qty = 0 THEN
      RETURN json_build_object('success', false, 'error', 'Quantité invalide');
    END IF;

    SELECT id, seller_id, price, is_active, stock_quantity
      INTO v_product
    FROM public.products
    WHERE id = (v_item->>'product_id')::uuid;

    IF v_product.id IS NULL OR v_product.is_active IS NOT TRUE THEN
      RETURN json_build_object('success', false, 'error', 'Produit indisponible');
    END IF;

    v_subtotal := v_subtotal + (v_product.price * v_qty);
  END LOOP;

  v_total := v_subtotal + v_fee;

  IF v_total <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Montant invalide');
  END IF;

  v_balance_field := CASE p_currency
    WHEN 'DOP' THEN 'balance_dop'
    WHEN 'HTG' THEN 'balance_htg'
    ELSE 'balance_usd'
  END;

  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_buyer_id
  FOR UPDATE;

  IF v_wallet.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Portefeuille introuvable. Veuillez recharger votre portefeuille.');
  END IF;

  EXECUTE format('SELECT COALESCE(%I, 0) FROM public.wallets WHERE id = $1', v_balance_field)
  INTO v_current_balance
  USING v_wallet.id;

  IF v_current_balance < v_total THEN
    RETURN json_build_object(
      'success', false,
      'error', format('Solde insuffisant. Solde actuel: %s, Montant requis: %s', v_current_balance, v_total)
    );
  END IF;

  EXECUTE format('UPDATE public.wallets SET %I = %I - $1, updated_at = now() WHERE id = $2',
    v_balance_field, v_balance_field)
  USING v_total, v_wallet.id;

  INSERT INTO public.orders (
    buyer_id, total_amount, delivery_fee, currency,
    payment_method, delivery_address, delivery_city,
    delivery_notes, status, payment_status
  ) VALUES (
    p_buyer_id, v_total, v_fee, p_currency,
    'card_visa', p_delivery_address, p_delivery_city,
    NULLIF(p_delivery_notes, ''), 'confirmed', 'pending'
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
  LOOP
    v_qty := (v_item->>'quantity')::integer;
    SELECT id, seller_id, price INTO v_product
    FROM public.products WHERE id = (v_item->>'product_id')::uuid;

    INSERT INTO public.order_items (
      order_id, product_id, seller_id, quantity,
      unit_price, total_price, selected_color, selected_size
    ) VALUES (
      v_order_id,
      v_product.id,
      v_product.seller_id,
      v_qty,
      v_product.price,
      v_product.price * v_qty,
      NULLIF(v_item->>'selected_color', ''),
      NULLIF(v_item->>'selected_size', '')
    );
  END LOOP;

  INSERT INTO public.wallet_transactions (
    wallet_id, type, amount, currency, status, reference, description
  ) VALUES (
    v_wallet.id, 'payment', -v_total, p_currency, 'completed',
    v_order_id::text, 'Paiement commande #' || LEFT(v_order_id::text, 8)
  );

  RETURN json_build_object(
    'success', true,
    'order_id', v_order_id,
    'message', 'Commande créée avec succès'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_cash_checkout(p_buyer_id uuid, p_total_amount numeric, p_delivery_fee numeric, p_currency text, p_delivery_address text, p_delivery_city text, p_delivery_notes text, p_order_items jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_item jsonb;
  v_product RECORD;
  v_qty integer;
  v_subtotal numeric := 0;
  v_total numeric;
  v_fee numeric;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_buyer_id THEN
    RETURN json_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  IF p_order_items IS NULL OR jsonb_array_length(p_order_items) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Le panier est vide');
  END IF;

  v_fee := GREATEST(COALESCE(p_delivery_fee, 0), 0);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
  LOOP
    v_qty := GREATEST(COALESCE((v_item->>'quantity')::integer, 0), 0);
    IF v_qty = 0 THEN
      RETURN json_build_object('success', false, 'error', 'Quantité invalide');
    END IF;

    SELECT id, seller_id, price, is_active INTO v_product
    FROM public.products WHERE id = (v_item->>'product_id')::uuid;

    IF v_product.id IS NULL OR v_product.is_active IS NOT TRUE THEN
      RETURN json_build_object('success', false, 'error', 'Produit indisponible');
    END IF;

    v_subtotal := v_subtotal + (v_product.price * v_qty);
  END LOOP;

  v_total := v_subtotal + v_fee;

  IF v_total <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Montant invalide');
  END IF;

  INSERT INTO public.orders (
    buyer_id, total_amount, delivery_fee, currency,
    payment_method, delivery_address, delivery_city,
    delivery_notes, status, payment_status
  ) VALUES (
    p_buyer_id, v_total, v_fee, p_currency,
    'cash', p_delivery_address, p_delivery_city,
    NULLIF(p_delivery_notes, ''), 'confirmed', 'pending'
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
  LOOP
    v_qty := (v_item->>'quantity')::integer;
    SELECT id, seller_id, price INTO v_product
    FROM public.products WHERE id = (v_item->>'product_id')::uuid;

    INSERT INTO public.order_items (
      order_id, product_id, seller_id, quantity,
      unit_price, total_price, selected_color, selected_size
    ) VALUES (
      v_order_id, v_product.id, v_product.seller_id, v_qty,
      v_product.price, v_product.price * v_qty,
      NULLIF(v_item->>'selected_color', ''),
      NULLIF(v_item->>'selected_size', '')
    );
  END LOOP;

  RETURN json_build_object('success', true, 'order_id', v_order_id, 'message', 'Commande cash créée avec succès');
END;
$function$;

-- 2) Remove broad table-level read access to payment account details
DROP POLICY IF EXISTS "Authenticated can view active deposit methods" ON public.deposit_methods;