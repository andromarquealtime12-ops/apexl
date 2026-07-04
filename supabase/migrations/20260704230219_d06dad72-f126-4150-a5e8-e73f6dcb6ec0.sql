
-- 1) user_roles: block self-escalation with RESTRICTIVE policies
DROP POLICY IF EXISTS "Users can insert their own initial role" ON public.user_roles;

CREATE POLICY "Only admins can insert roles (restrictive)"
ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Only admins can update roles (restrictive)"
ON public.user_roles AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Only admins can delete roles (restrictive)"
ON public.user_roles AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) deposit_methods: restrict direct SELECT, expose via RPC
DROP POLICY IF EXISTS "Authenticated users can view active deposit methods" ON public.deposit_methods;

CREATE POLICY "Admins can view all deposit methods"
ON public.deposit_methods FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.get_active_deposit_methods()
RETURNS SETOF public.deposit_methods
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.deposit_methods WHERE is_active = true ORDER BY sort_order ASC;
$$;

REVOKE ALL ON FUNCTION public.get_active_deposit_methods() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_deposit_methods() TO authenticated;

-- 3) return-photos: owner-scoped storage policies (bucket privacy toggled separately)
DROP POLICY IF EXISTS "Return photos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload return photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own return photos" ON storage.objects;
DROP POLICY IF EXISTS "Return photo uploaders and admins can read" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload return photos to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own return photos" ON storage.objects;

CREATE POLICY "Return photo uploaders and admins can read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'return-photos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

CREATE POLICY "Users can upload return photos to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'return-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own return photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'return-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4) realtime.messages: require authentication
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can write realtime messages" ON realtime.messages;

CREATE POLICY "Authenticated can read realtime messages"
ON realtime.messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can write realtime messages"
ON realtime.messages FOR INSERT TO authenticated WITH CHECK (true);
