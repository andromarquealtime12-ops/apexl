
-- Drop existing chat policies
DROP POLICY IF EXISTS "Order participants can send chat" ON public.order_chat_messages;
DROP POLICY IF EXISTS "Order participants can view chat" ON public.order_chat_messages;

-- Recreate with seller access included
CREATE POLICY "Order participants can view chat"
ON public.order_chat_messages
FOR SELECT
TO authenticated
USING (
  (order_id IN (SELECT get_buyer_order_ids()))
  OR (order_id IN (SELECT get_driver_order_ids()))
  OR (order_id IN (SELECT get_seller_order_ids()))
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Order participants can send chat"
ON public.order_chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = sender_id)
  AND (
    (order_id IN (SELECT get_buyer_order_ids()))
    OR (order_id IN (SELECT get_driver_order_ids()))
    OR (order_id IN (SELECT get_seller_order_ids()))
  )
);
