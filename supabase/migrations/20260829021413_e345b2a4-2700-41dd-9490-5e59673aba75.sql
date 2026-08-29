CREATE POLICY "Users can create own notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_order_participant(_order_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = _order_id
      AND (
        o.buyer_id = _user_id
        OR o.driver_id = _user_id
        OR EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id AND oi.seller_id = _user_id)
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.notify_order_participant(
  _order_id uuid,
  _user_id uuid,
  _title text,
  _message text,
  _type text DEFAULT 'info',
  _action_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_order_participant(_order_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a participant of this order';
  END IF;
  IF NOT public.is_order_participant(_order_id, _user_id)
     AND NOT public.has_role(_user_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Recipient is not a participant of this order';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, action_url)
  VALUES (_user_id, _title, _message, COALESCE(_type, 'info'), _action_url)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_order_participant(uuid, uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_order_participant(uuid, uuid) TO authenticated;