
DROP VIEW IF EXISTS public.public_profiles CASCADE;

CREATE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT
  id,
  user_id,
  full_name,
  avatar_url,
  city,
  country,
  identity_status,
  created_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
