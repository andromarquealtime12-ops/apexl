
-- Fix: Change view to SECURITY INVOKER (default, safe)
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = true)
AS
SELECT user_id, full_name, avatar_url, city, country, trust_score, referral_code, created_at
FROM public.profiles;
