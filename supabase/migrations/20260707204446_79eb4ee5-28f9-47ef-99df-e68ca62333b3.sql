
-- =========================================================
-- 1) ORDERS: prevent buyers/sellers/drivers from tampering
-- =========================================================
CREATE OR REPLACE FUNCTION public.guard_orders_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Admins and service_role bypass
  IF v_uid IS NULL OR public.has_role(v_uid, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Immutable ownership / financial fields for all non-admin actors
  IF NEW.buyer_id       IS DISTINCT FROM OLD.buyer_id       THEN RAISE EXCEPTION 'buyer_id is immutable'; END IF;
  IF NEW.total_amount   IS DISTINCT FROM OLD.total_amount   THEN RAISE EXCEPTION 'total_amount is immutable'; END IF;
  IF NEW.delivery_fee   IS DISTINCT FROM OLD.delivery_fee   THEN RAISE EXCEPTION 'delivery_fee is immutable'; END IF;
  IF NEW.currency       IS DISTINCT FROM OLD.currency       THEN RAISE EXCEPTION 'currency is immutable'; END IF;
  IF NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN RAISE EXCEPTION 'payment_method is immutable'; END IF;
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN RAISE EXCEPTION 'payment_status can only be changed by admin/RPC'; END IF;

  -- driver_id: allow NULL -> self (accept), or self -> self; block reassignment
  IF NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
    IF OLD.driver_id IS NULL AND NEW.driver_id = v_uid AND public.has_role(v_uid, 'driver'::app_role) THEN
      NULL; -- allowed self-assignment
    ELSE
      RAISE EXCEPTION 'driver_id can only be self-assigned by an unassigned driver';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_orders_update ON public.orders;
CREATE TRIGGER trg_guard_orders_update
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_orders_update();

-- Add WITH CHECK clauses to existing UPDATE policies (mirror USING)
DROP POLICY IF EXISTS "Buyers can update own orders" ON public.orders;
CREATE POLICY "Buyers can update own orders" ON public.orders
FOR UPDATE TO authenticated
USING (auth.uid() = buyer_id)
WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Sellers can update orders with their items" ON public.orders;
CREATE POLICY "Sellers can update orders with their items" ON public.orders
FOR UPDATE TO authenticated
USING (id IN (SELECT get_seller_order_ids()))
WITH CHECK (id IN (SELECT get_seller_order_ids()));

DROP POLICY IF EXISTS "Drivers can update assigned orders" ON public.orders;
CREATE POLICY "Drivers can update assigned orders" ON public.orders
FOR UPDATE TO authenticated
USING (auth.uid() = driver_id AND has_role(auth.uid(), 'driver'::app_role))
WITH CHECK (auth.uid() = driver_id AND has_role(auth.uid(), 'driver'::app_role));

-- =========================================================
-- 2) DELIVERY_VERIFICATION: drivers can't rewrite codes/status
-- =========================================================
CREATE OR REPLACE FUNCTION public.guard_delivery_verification_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR public.has_role(v_uid, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Codes and status are RPC-only (verify_pickup_code / verify_delivery_code run as SECURITY DEFINER
  -- and bypass this trigger's user-scoped checks since auth.uid() there is the driver, but the
  -- RPCs are the only legitimate writers. Block direct client updates entirely.)
  IF NEW.pickup_code           IS DISTINCT FROM OLD.pickup_code           THEN RAISE EXCEPTION 'pickup_code is not directly editable'; END IF;
  IF NEW.delivery_code         IS DISTINCT FROM OLD.delivery_code         THEN RAISE EXCEPTION 'delivery_code is not directly editable'; END IF;
  IF NEW.status                IS DISTINCT FROM OLD.status                THEN RAISE EXCEPTION 'status is not directly editable'; END IF;
  IF NEW.pickup_verified_at    IS DISTINCT FROM OLD.pickup_verified_at    THEN RAISE EXCEPTION 'pickup_verified_at is not directly editable'; END IF;
  IF NEW.delivery_verified_at  IS DISTINCT FROM OLD.delivery_verified_at  THEN RAISE EXCEPTION 'delivery_verified_at is not directly editable'; END IF;
  IF NEW.attempt_count         IS DISTINCT FROM OLD.attempt_count         THEN RAISE EXCEPTION 'attempt_count is not directly editable'; END IF;
  IF NEW.order_id              IS DISTINCT FROM OLD.order_id              THEN RAISE EXCEPTION 'order_id is immutable'; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_delivery_verification_update ON public.delivery_verification;
CREATE TRIGGER trg_guard_delivery_verification_update
BEFORE UPDATE ON public.delivery_verification
FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_verification_update();

DROP POLICY IF EXISTS "Drivers can update assigned order verifications" ON public.delivery_verification;
CREATE POLICY "Drivers can update assigned order verifications" ON public.delivery_verification
FOR UPDATE TO authenticated
USING (order_id IN (SELECT get_driver_order_ids()))
WITH CHECK (order_id IN (SELECT get_driver_order_ids()));

-- =========================================================
-- 3) ORDER_RETURNS: sellers can only edit their notes/confirmation
-- =========================================================
CREATE OR REPLACE FUNCTION public.guard_order_returns_seller_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_seller boolean;
BEGIN
  IF v_uid IS NULL OR public.has_role(v_uid, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Only run seller-scoped checks when the row belongs to this seller's orders
  SELECT EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = OLD.order_id AND oi.seller_id = v_uid
  ) INTO v_is_seller;

  IF NOT v_is_seller THEN
    RETURN NEW; -- buyer / driver updates handled by their own policies/RPCs
  END IF;

  -- Whitelist of fields sellers may edit directly
  IF NEW.refund_amount   IS DISTINCT FROM OLD.refund_amount   THEN RAISE EXCEPTION 'refund_amount can only be set by admin/RPC'; END IF;
  IF NEW.status          IS DISTINCT FROM OLD.status          THEN RAISE EXCEPTION 'status can only be changed by admin/RPC'; END IF;
  IF NEW.admin_notes     IS DISTINCT FROM OLD.admin_notes     THEN RAISE EXCEPTION 'admin_notes is admin-only'; END IF;
  IF NEW.fault_type      IS DISTINCT FROM OLD.fault_type      THEN RAISE EXCEPTION 'fault_type is set via RPC'; END IF;
  IF NEW.order_id        IS DISTINCT FROM OLD.order_id        THEN RAISE EXCEPTION 'order_id is immutable'; END IF;
  IF NEW.buyer_id        IS DISTINCT FROM OLD.buyer_id        THEN RAISE EXCEPTION 'buyer_id is immutable'; END IF;
  IF NEW.reason          IS DISTINCT FROM OLD.reason          THEN RAISE EXCEPTION 'reason is buyer-only'; END IF;
  IF NEW.return_driver_id      IS DISTINCT FROM OLD.return_driver_id      THEN RAISE EXCEPTION 'return_driver_id is set via RPC'; END IF;
  IF NEW.return_pickup_code    IS DISTINCT FROM OLD.return_pickup_code    THEN RAISE EXCEPTION 'return_pickup_code is set via RPC'; END IF;
  IF NEW.return_delivery_code  IS DISTINCT FROM OLD.return_delivery_code  THEN RAISE EXCEPTION 'return_delivery_code is set via RPC'; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_order_returns_seller_update ON public.order_returns;
CREATE TRIGGER trg_guard_order_returns_seller_update
BEFORE UPDATE ON public.order_returns
FOR EACH ROW EXECUTE FUNCTION public.guard_order_returns_seller_update();

DROP POLICY IF EXISTS "Sellers can update returns for their orders" ON public.order_returns;
CREATE POLICY "Sellers can update returns for their orders" ON public.order_returns
FOR UPDATE TO authenticated
USING (order_id IN (SELECT get_seller_order_ids()))
WITH CHECK (order_id IN (SELECT get_seller_order_ids()));
