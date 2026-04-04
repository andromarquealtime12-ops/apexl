
-- Re-add permissive SELECT for authenticated (many features need cross-user profile reads)
-- But we'll strip sensitive data by moving it to a separate table
DROP POLICY IF EXISTS "Authenticated can read basic public profile fields" ON profiles;

CREATE POLICY "Authenticated users can read profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- Create a separate secure table for sensitive auth secrets
CREATE TABLE IF NOT EXISTS public.user_auth_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  two_factor_secret text,
  verification_code text,
  verification_code_expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_auth_secrets ENABLE ROW LEVEL SECURITY;

-- Only the owner can read their own secrets
CREATE POLICY "Users can view own auth secrets"
ON user_auth_secrets FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only the owner can update their own secrets
CREATE POLICY "Users can update own auth secrets"
ON user_auth_secrets FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- System can insert
CREATE POLICY "System can insert auth secrets"
ON user_auth_secrets FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can manage
CREATE POLICY "Admins can manage auth secrets"
ON user_auth_secrets FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Migrate existing data
INSERT INTO user_auth_secrets (user_id, two_factor_secret, verification_code, verification_code_expires_at)
SELECT user_id, two_factor_secret, verification_code, verification_code_expires_at
FROM profiles
WHERE two_factor_secret IS NOT NULL OR verification_code IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Clear sensitive data from profiles table
UPDATE profiles SET two_factor_secret = NULL, verification_code = NULL;
