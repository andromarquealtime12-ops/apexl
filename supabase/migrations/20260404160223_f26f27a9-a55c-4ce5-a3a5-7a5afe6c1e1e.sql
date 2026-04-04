
-- 1. Remove wallet UPDATE policy (users should never directly update wallets)
DROP POLICY IF EXISTS "Users can update own wallet" ON wallets;

-- 2. Fix notifications INSERT policy - restrict to admin only (service role bypasses RLS)
DROP POLICY IF EXISTS "System/Admin can create notifications" ON notifications;
CREATE POLICY "Only admins can create notifications"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. Remove user INSERT policy on wallet_transactions (all transactions via RPCs)
DROP POLICY IF EXISTS "Users can create transactions" ON wallet_transactions;

-- 4. Fix robot logs INSERT policy
DROP POLICY IF EXISTS "System can insert robot logs" ON admin_robot_logs;
DROP POLICY IF EXISTS "Only admins can insert robot logs" ON admin_robot_logs;
CREATE POLICY "Only admins can insert robot logs"
ON admin_robot_logs FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5. Replace overly permissive profiles SELECT policy with restricted one
DROP POLICY IF EXISTS "Authenticated can read basic profiles" ON profiles;

-- Create a view for public profile info (safe fields only)
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT user_id, full_name, avatar_url, city, country, trust_score, referral_code, created_at
FROM public.profiles;

-- Allow authenticated users to read the safe public view
CREATE POLICY "Authenticated can read basic public profile fields"
ON profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
);
