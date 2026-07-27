
-- 1) deposit_agents: replace broad SELECT with safe function; keep full row access for owner/admin
DROP POLICY IF EXISTS "Authenticated users can view active verified agents" ON public.deposit_agents;

CREATE OR REPLACE FUNCTION public.get_active_deposit_agents_public()
RETURNS TABLE (
  id uuid,
  name text,
  address text,
  city text,
  opening_hours text,
  is_verified boolean,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, address, city, opening_hours, is_verified, is_active
  FROM public.deposit_agents
  WHERE is_active = true AND is_verified = true
  ORDER BY city;
$$;

REVOKE ALL ON FUNCTION public.get_active_deposit_agents_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_deposit_agents_public() TO authenticated;

-- 2) order_items: validate price integrity and lock rows after order leaves pending
CREATE OR REPLACE FUNCTION public.validate_order_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_status text;
  v_order_buyer uuid;
  v_product_price numeric;
BEGIN
  SELECT status, buyer_id INTO v_order_status, v_order_buyer
  FROM public.orders WHERE id = NEW.order_id;

  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Only allow inserts when order is pending (unless admin/service bypasses via app.bypass_order_guard)
  IF current_setting('app.bypass_order_guard', true) IS DISTINCT FROM 'on'
     AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    IF v_order_status <> 'pending' THEN
      RAISE EXCEPTION 'Cannot add items to order in status %', v_order_status;
    END IF;

    -- Validate unit price matches product price when product exists
    IF NEW.product_id IS NOT NULL THEN
      SELECT price INTO v_product_price FROM public.products WHERE id = NEW.product_id;
      IF v_product_price IS NOT NULL AND abs(NEW.unit_price - v_product_price) > 0.01 THEN
        RAISE EXCEPTION 'unit_price does not match product price';
      END IF;
    END IF;

    -- Validate total_price = unit_price * quantity
    IF abs(NEW.total_price - (NEW.unit_price * NEW.quantity)) > 0.01 THEN
      RAISE EXCEPTION 'total_price mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_item_insert ON public.order_items;
CREATE TRIGGER trg_validate_order_item_insert
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_item_insert();

-- 3) orders: restrict buyer UPDATE to delivery-only fields via trigger
CREATE OR REPLACE FUNCTION public.guard_buyer_order_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bypass for service role / admin RPCs
  IF current_setting('app.bypass_order_guard', true) = 'on'
     OR has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Only apply when the caller is the buyer (not driver/seller)
  IF auth.uid() = OLD.buyer_id
     AND (OLD.driver_id IS DISTINCT FROM NULL AND auth.uid() <> COALESCE(OLD.driver_id, '00000000-0000-0000-0000-000000000000'::uuid))
     OR auth.uid() = OLD.buyer_id THEN

    -- Block changes to sensitive columns
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Buyers cannot change order status';
    END IF;
    IF NEW.total_amount IS DISTINCT FROM OLD.total_amount THEN
      RAISE EXCEPTION 'Buyers cannot change total_amount';
    END IF;
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
      RAISE EXCEPTION 'Buyers cannot change payment_status';
    END IF;
    IF NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN
      RAISE EXCEPTION 'Buyers cannot change payment_method';
    END IF;
    IF NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
      RAISE EXCEPTION 'Buyers cannot assign a driver';
    END IF;
    IF NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee THEN
      RAISE EXCEPTION 'Buyers cannot change delivery_fee';
    END IF;
    IF NEW.currency IS DISTINCT FROM OLD.currency THEN
      RAISE EXCEPTION 'Buyers cannot change currency';
    END IF;
    IF NEW.buyer_id IS DISTINCT FROM OLD.buyer_id THEN
      RAISE EXCEPTION 'Buyers cannot change buyer_id';
    END IF;
    IF NEW.shopify_order_id IS DISTINCT FROM OLD.shopify_order_id
       OR NEW.shopify_order_number IS DISTINCT FROM OLD.shopify_order_number THEN
      RAISE EXCEPTION 'Buyers cannot change shopify fields';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_buyer_order_update ON public.orders;
CREATE TRIGGER trg_guard_buyer_order_update
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_buyer_order_update();
