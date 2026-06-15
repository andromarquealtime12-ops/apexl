
-- Remove the security-definer view (flagged by linter)
DROP VIEW IF EXISTS public.public_profiles CASCADE;

-- Replace own-row-only SELECT with a broader policy, but column access is restricted via GRANTs
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Authenticated can view safe profile columns"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Lock down column access: revoke broad SELECT, then grant only safe columns
REVOKE SELECT ON public.profiles FROM authenticated, anon;

GRANT SELECT (
  id,
  user_id,
  full_name,
  avatar_url,
  city,
  country,
  identity_status,
  created_at,
  updated_at
) ON public.profiles TO authenticated;

-- Ensure write access remains for own-row updates/inserts (RLS policies enforce ownership)
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Provide a SECURITY DEFINER function for a user to read their FULL own profile
CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_own_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;
