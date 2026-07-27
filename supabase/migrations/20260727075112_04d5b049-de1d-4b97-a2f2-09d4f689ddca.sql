
-- 1) order_items: validate seller_id matches product owner
CREATE OR REPLACE FUNCTION public.validate_order_item_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_status text;
  v_order_buyer uuid;
  v_product_price numeric;
  v_product_seller uuid;
BEGIN
  SELECT status, buyer_id INTO v_order_status, v_order_buyer
  FROM public.orders WHERE id = NEW.order_id;

  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF current_setting('app.bypass_order_guard', true) IS DISTINCT FROM 'on'
     AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    IF v_order_status <> 'pending' THEN
      RAISE EXCEPTION 'Cannot add items to order in status %', v_order_status;
    END IF;

    IF NEW.product_id IS NOT NULL THEN
      SELECT price, seller_id INTO v_product_price, v_product_seller
      FROM public.products WHERE id = NEW.product_id;

      IF v_product_price IS NOT NULL AND abs(NEW.unit_price - v_product_price) > 0.01 THEN
        RAISE EXCEPTION 'unit_price does not match product price';
      END IF;

      -- Enforce seller_id integrity: must match the product's real seller
      IF v_product_seller IS NOT NULL
         AND NEW.seller_id IS NOT NULL
         AND NEW.seller_id <> v_product_seller THEN
        RAISE EXCEPTION 'seller_id does not match product owner';
      END IF;

      -- Auto-set seller_id from product when omitted
      IF NEW.seller_id IS NULL AND v_product_seller IS NOT NULL THEN
        NEW.seller_id := v_product_seller;
      END IF;
    END IF;

    IF abs(NEW.total_price - (NEW.unit_price * NEW.quantity)) > 0.01 THEN
      RAISE EXCEPTION 'total_price mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) deposit_agents: explicit restrictive policies so only admins can INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Only admins can insert deposit agents" ON public.deposit_agents;
DROP POLICY IF EXISTS "Only admins can update deposit agents" ON public.deposit_agents;
DROP POLICY IF EXISTS "Only admins can delete deposit agents" ON public.deposit_agents;

CREATE POLICY "Only admins can insert deposit agents"
  ON public.deposit_agents
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Only admins can update deposit agents"
  ON public.deposit_agents
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Only admins can delete deposit agents"
  ON public.deposit_agents
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
