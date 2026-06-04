
-- Widen safe columns to include contact info needed across the app
GRANT SELECT (
  phone, whatsapp, address, email_verified, phone_verified,
  total_spent, total_earned, referred_by, last_login_at
) ON public.profiles TO authenticated;

-- Admin-only full read RPC (admins still get all columns)
CREATE OR REPLACE FUNCTION public.admin_get_profile(_user_id uuid)
RETURNS SETOF public.profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.profiles
  WHERE user_id = _user_id
    AND public.has_role(auth.uid(), 'admin'::public.app_role);
$$;
REVOKE EXECUTE ON FUNCTION public.admin_get_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_profile(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_profiles()
RETURNS SETOF public.profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.profiles
  WHERE public.has_role(auth.uid(), 'admin'::public.app_role);
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles() TO authenticated;
