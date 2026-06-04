
-- ============ PROFILES ============
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by owner" ON public.profiles;

REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, user_id, full_name, avatar_url, city, country, identity_status,
  trust_score, latitude, longitude, created_at, account_status, referral_code
) ON public.profiles TO authenticated;

CREATE POLICY "Authenticated users can view limited profile fields"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE user_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_order_contact(_other_user uuid)
RETURNS TABLE(full_name text, phone text, whatsapp text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.full_name, p.phone, p.whatsapp
  FROM public.profiles p
  WHERE p.user_id = _other_user
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR auth.uid() = _other_user
      OR EXISTS (
        SELECT 1
        FROM public.orders o
        LEFT JOIN public.order_items oi ON oi.order_id = o.id
        WHERE (o.buyer_id = auth.uid() OR o.driver_id = auth.uid() OR oi.seller_id = auth.uid())
          AND (o.buyer_id = _other_user OR o.driver_id = _other_user OR oi.seller_id = _other_user)
      )
    );
$$;
REVOKE EXECUTE ON FUNCTION public.get_order_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_order_contact(uuid) TO authenticated;

-- ============ DEPOSIT METHODS ============
DROP POLICY IF EXISTS "Anyone can view active deposit methods" ON public.deposit_methods;
REVOKE SELECT ON public.deposit_methods FROM anon;
CREATE POLICY "Authenticated users can view active deposit methods"
  ON public.deposit_methods FOR SELECT TO authenticated USING (is_active = true);

-- ============ PLATFORM SETTINGS ============
DROP POLICY IF EXISTS "Anyone can read settings" ON public.platform_settings;
REVOKE SELECT ON public.platform_settings FROM anon;
CREATE POLICY "Authenticated users can read settings"
  ON public.platform_settings FOR SELECT TO authenticated USING (true);

-- ============ RESTAURANTS ============
-- Hide phone/whatsapp from anonymous; authenticated users keep full access via existing policies
REVOKE SELECT ON public.restaurants FROM anon;
GRANT SELECT (
  id, name, seller_id, city, address, description, longitude, latitude,
  cover_url, logo_url, cuisine_type, opening_hours, is_active, is_approved,
  created_at, updated_at
) ON public.restaurants TO anon;
