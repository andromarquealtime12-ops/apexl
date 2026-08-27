CREATE OR REPLACE FUNCTION public.get_user_language(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(p.language, 'fr') FROM public.profiles p WHERE p.user_id = _user_id LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_user_language(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_language(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_language(uuid) TO service_role;