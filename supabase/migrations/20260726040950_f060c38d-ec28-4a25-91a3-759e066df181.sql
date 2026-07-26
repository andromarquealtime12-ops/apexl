-- Approving a seller/driver application also marks their identity as verified,
-- so approved sellers/drivers are fully trusted with no extra identity workflow.

CREATE OR REPLACE FUNCTION public.approve_seller_application(application_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    app_record RECORD;
BEGIN
    IF NOT has_role(auth.uid(), 'admin') THEN
        RETURN false;
    END IF;

    SELECT * INTO app_record FROM seller_applications WHERE id = application_id AND status = 'pending';

    IF app_record.id IS NOT NULL THEN
        INSERT INTO user_roles (user_id, role) VALUES (app_record.user_id, 'seller')
        ON CONFLICT (user_id, role) DO NOTHING;

        UPDATE seller_applications
        SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
        WHERE id = application_id;

        UPDATE profiles
        SET identity_status = 'verified',
            email_verified = true,
            updated_at = now()
        WHERE user_id = app_record.user_id;

        RETURN true;
    END IF;

    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_driver_application(application_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    app_record RECORD;
BEGIN
    IF NOT has_role(auth.uid(), 'admin') THEN
        RETURN false;
    END IF;

    SELECT * INTO app_record FROM driver_applications WHERE id = application_id AND status = 'pending';

    IF app_record.id IS NOT NULL THEN
        INSERT INTO user_roles (user_id, role) VALUES (app_record.user_id, 'driver')
        ON CONFLICT (user_id, role) DO NOTHING;

        UPDATE driver_applications
        SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
        WHERE id = application_id;

        UPDATE profiles
        SET identity_status = 'verified',
            email_verified = true,
            updated_at = now()
        WHERE user_id = app_record.user_id;

        RETURN true;
    END IF;

    RETURN false;
END;
$$;

-- Backfill: any already-approved seller/driver becomes fully verified.
UPDATE public.profiles p
SET identity_status = 'verified', updated_at = now()
WHERE identity_status IS DISTINCT FROM 'verified'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.user_id AND ur.role IN ('seller', 'driver')
  );
