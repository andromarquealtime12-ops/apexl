
-- Function to get order IDs for the current buyer
CREATE OR REPLACE FUNCTION public.get_buyer_order_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM orders WHERE buyer_id = auth.uid();
$$;

-- Function to get order IDs for the current driver
CREATE OR REPLACE FUNCTION public.get_driver_order_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM orders WHERE driver_id = auth.uid();
$$;

-- Function to get order IDs for the current seller
CREATE OR REPLACE FUNCTION public.get_seller_order_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT order_id FROM order_items WHERE seller_id = auth.uid();
$$;

-- Restrict access to authenticated users only
REVOKE EXECUTE ON FUNCTION public.get_buyer_order_ids FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_buyer_order_ids TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_driver_order_ids FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_driver_order_ids TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_seller_order_ids FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_seller_order_ids TO authenticated;

-- ==========================================
-- Fix orders SELECT policies
-- ==========================================
DROP POLICY IF EXISTS "Buyers can view own orders" ON orders;
CREATE POLICY "Buyers can view own orders" ON orders
  FOR SELECT USING (id IN (SELECT get_buyer_order_ids()));

DROP POLICY IF EXISTS "Drivers can view assigned orders" ON orders;
CREATE POLICY "Drivers can view assigned orders" ON orders
  FOR SELECT USING (id IN (SELECT get_driver_order_ids()));

DROP POLICY IF EXISTS "Sellers can view orders with their items" ON orders;
CREATE POLICY "Sellers can view orders with their items" ON orders
  FOR SELECT TO authenticated
  USING (id IN (SELECT get_seller_order_ids()));

-- Fix orders UPDATE policies that also reference order_items
DROP POLICY IF EXISTS "Sellers can update orders with their items" ON orders;
CREATE POLICY "Sellers can update orders with their items" ON orders
  FOR UPDATE TO authenticated
  USING (id IN (SELECT get_seller_order_ids()));

-- ==========================================
-- Fix order_items SELECT policies
-- ==========================================
DROP POLICY IF EXISTS "Order items viewable by order owner" ON order_items;
CREATE POLICY "Order items viewable by buyer or driver" ON order_items
  FOR SELECT USING (
    order_id IN (SELECT get_buyer_order_ids())
    OR order_id IN (SELECT get_driver_order_ids())
  );

-- Sellers policy is fine (uses seller_id directly, no cross-table ref)

-- Fix order_items INSERT policy
DROP POLICY IF EXISTS "Buyers can create order items" ON order_items;
CREATE POLICY "Buyers can create order items" ON order_items
  FOR INSERT WITH CHECK (
    order_id IN (SELECT get_buyer_order_ids())
  );

-- ==========================================
-- Fix delivery_verification policies that reference orders
-- ==========================================
DROP POLICY IF EXISTS "Buyers can view own order verifications" ON delivery_verification;
CREATE POLICY "Buyers can view own order verifications" ON delivery_verification
  FOR SELECT USING (order_id IN (SELECT get_buyer_order_ids()));

DROP POLICY IF EXISTS "Drivers can view assigned order verifications" ON delivery_verification;
CREATE POLICY "Drivers can view assigned order verifications" ON delivery_verification
  FOR SELECT USING (order_id IN (SELECT get_driver_order_ids()));

DROP POLICY IF EXISTS "Drivers can update assigned order verifications" ON delivery_verification;
CREATE POLICY "Drivers can update assigned order verifications" ON delivery_verification
  FOR UPDATE USING (order_id IN (SELECT get_driver_order_ids()));

DROP POLICY IF EXISTS "Only order participants can create verifications" ON delivery_verification;
CREATE POLICY "Only order participants can create verifications" ON delivery_verification
  FOR INSERT WITH CHECK (
    order_id IN (SELECT get_buyer_order_ids())
    OR order_id IN (SELECT get_driver_order_ids())
    OR order_id IN (SELECT get_seller_order_ids())
  );

DROP POLICY IF EXISTS "Sellers can view their order verifications" ON delivery_verification;
CREATE POLICY "Sellers can view their order verifications" ON delivery_verification
  FOR SELECT USING (order_id IN (SELECT get_seller_order_ids()));

-- ==========================================
-- Fix order_chat_messages policies
-- ==========================================
DROP POLICY IF EXISTS "Order participants can view chat" ON order_chat_messages;
CREATE POLICY "Order participants can view chat" ON order_chat_messages
  FOR SELECT TO authenticated
  USING (
    order_id IN (SELECT get_buyer_order_ids())
    OR order_id IN (SELECT get_driver_order_ids())
  );

DROP POLICY IF EXISTS "Order participants can send chat" ON order_chat_messages;
CREATE POLICY "Order participants can send chat" ON order_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      order_id IN (SELECT get_buyer_order_ids())
      OR order_id IN (SELECT get_driver_order_ids())
    )
  );
