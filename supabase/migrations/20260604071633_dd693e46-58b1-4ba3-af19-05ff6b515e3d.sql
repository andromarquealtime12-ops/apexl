CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE public.admin_access_codes
SET code = crypt(code, gen_salt('bf'))
WHERE code IS NOT NULL AND code NOT LIKE '$2%';

DROP FUNCTION IF EXISTS public.validate_admin_code(text, uuid);
DROP FUNCTION IF EXISTS public.validate_admin_code(text);

CREATE OR REPLACE FUNCTION public.validate_admin_code(code_input text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code_record RECORD;
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT id, uses_remaining
    INTO code_record
  FROM public.admin_access_codes
  WHERE is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (uses_remaining IS NULL OR uses_remaining > 0)
    AND code = crypt(code_input, code)
  LIMIT 1;

  IF code_record.id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
    VALUES (caller_id, 'admin')
    ON CONFLICT DO NOTHING;

  UPDATE public.admin_access_codes
  SET uses_remaining = GREATEST(COALESCE(uses_remaining, 1) - 1, 0),
      is_active = CASE WHEN COALESCE(uses_remaining, 1) - 1 <= 0 THEN false ELSE is_active END
  WHERE id = code_record.id;

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, new_value)
  VALUES (caller_id, 'admin_code_redeemed', 'admin_access_code', code_record.id, jsonb_build_object('at', now()));

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_admin_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_admin_code(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.validate_admin_code(text) TO authenticated;

DROP POLICY IF EXISTS "System can read all for sending" ON public.push_subscriptions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'push_subscriptions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.push_subscriptions';
  END IF;
END $$;

DROP POLICY IF EXISTS "Anyone can view approved shops" ON public.seller_applications;

DROP VIEW IF EXISTS public.public_seller_shops;
CREATE VIEW public.public_seller_shops
WITH (security_invoker = false) AS
SELECT
  id,
  user_id,
  shop_name,
  shop_description,
  shop_city,
  shop_address,
  latitude,
  longitude,
  created_at
FROM public.seller_applications
WHERE status = 'approved';

GRANT SELECT ON public.public_seller_shops TO anon, authenticated;

CREATE POLICY "Drivers can view assigned shop details"
ON public.seller_applications
FOR SELECT
TO authenticated
USING (
  status = 'approved' AND EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.driver_id = auth.uid()
      AND oi.seller_id = seller_applications.user_id
  )
);