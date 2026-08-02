-- 1. Tighten realtime topic authorization (anchor on prefix only)
DROP POLICY IF EXISTS "Users can read own-scoped realtime topics" ON realtime.messages;
DROP POLICY IF EXISTS "Users can send own-scoped realtime topics" ON realtime.messages;

CREATE POLICY "Users can read own-scoped realtime topics"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.topic() = ('user:' || auth.uid()::text)
  OR realtime.topic() LIKE ('user:' || auth.uid()::text || ':%')
);

CREATE POLICY "Users can send own-scoped realtime topics"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  realtime.topic() = ('user:' || auth.uid()::text)
  OR realtime.topic() LIKE ('user:' || auth.uid()::text || ':%')
);

-- 2. Explicit admin SELECT policy on admin_robot_settings
DROP POLICY IF EXISTS "Admins can view robot settings" ON public.admin_robot_settings;
CREATE POLICY "Admins can view robot settings"
ON public.admin_robot_settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Explicit admin SELECT policy on order_items
DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;
CREATE POLICY "Admins can view all order items"
ON public.order_items FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));