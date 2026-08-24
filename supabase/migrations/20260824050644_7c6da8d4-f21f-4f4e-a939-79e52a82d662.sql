ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS personal_info_locked boolean NOT NULL DEFAULT false;

-- Existing members who already have a real name (first + last) are locked.
UPDATE public.profiles
SET personal_info_locked = true
WHERE coalesce(trim(full_name), '') <> ''
  AND array_length(regexp_split_to_array(trim(full_name), '\s+'), 1) >= 2;

CREATE OR REPLACE FUNCTION public.guard_profile_personal_info()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins can always correct data
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF OLD.personal_info_locked THEN
    NEW.full_name := OLD.full_name;
    NEW.date_of_birth := OLD.date_of_birth;
    NEW.personal_info_locked := true;
    RETURN NEW;
  END IF;

  -- Lock as soon as a complete name (first + last) is recorded
  IF coalesce(trim(NEW.full_name), '') <> ''
     AND array_length(regexp_split_to_array(trim(NEW.full_name), '\s+'), 1) >= 2 THEN
    NEW.personal_info_locked := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_personal_info_trg ON public.profiles;
CREATE TRIGGER guard_profile_personal_info_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_personal_info();