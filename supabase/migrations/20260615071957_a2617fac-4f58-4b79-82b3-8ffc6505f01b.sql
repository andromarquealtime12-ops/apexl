
DROP POLICY IF EXISTS "Authenticated can view safe profile columns" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view limited profile fields" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
