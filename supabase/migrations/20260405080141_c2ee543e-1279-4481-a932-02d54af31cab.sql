
CREATE OR REPLACE FUNCTION public.find_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN NULL;
  END IF;
  
  SELECT id INTO v_user_id FROM auth.users WHERE email = LOWER(TRIM(p_email)) LIMIT 1;
  RETURN v_user_id;
END;
$$;
