
CREATE OR REPLACE FUNCTION public.enforce_single_restaurant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.restaurants r WHERE r.seller_id = NEW.seller_id AND r.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) THEN
    RAISE EXCEPTION 'RESTAURANT_LIMIT: un seul restaurant par utilisateur';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_single_restaurant ON public.restaurants;
CREATE TRIGGER trg_single_restaurant
BEFORE INSERT ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_restaurant();

CREATE OR REPLACE FUNCTION public.enforce_single_role_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text := TG_ARGV[0];
BEGIN
  IF v_kind = 'seller' THEN
    IF EXISTS (SELECT 1 FROM public.seller_applications s WHERE s.user_id = NEW.user_id AND s.status <> 'rejected') THEN
      RAISE EXCEPTION 'APPLICATION_EXISTS: une seule candidature vendeur par utilisateur';
    END IF;
    IF public.has_role(NEW.user_id, 'driver')
       OR EXISTS (SELECT 1 FROM public.driver_applications d WHERE d.user_id = NEW.user_id AND d.status <> 'rejected') THEN
      RAISE EXCEPTION 'ROLE_CONFLICT: un livreur ne peut pas postuler comme vendeur';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.driver_applications d WHERE d.user_id = NEW.user_id AND d.status <> 'rejected') THEN
      RAISE EXCEPTION 'APPLICATION_EXISTS: une seule candidature livreur par utilisateur';
    END IF;
    IF public.has_role(NEW.user_id, 'seller')
       OR EXISTS (SELECT 1 FROM public.seller_applications s WHERE s.user_id = NEW.user_id AND s.status <> 'rejected') THEN
      RAISE EXCEPTION 'ROLE_CONFLICT: un vendeur ne peut pas postuler comme livreur';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_single_seller_application ON public.seller_applications;
CREATE TRIGGER trg_single_seller_application
BEFORE INSERT ON public.seller_applications
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_role_application('seller');

DROP TRIGGER IF EXISTS trg_single_driver_application ON public.driver_applications;
CREATE TRIGGER trg_single_driver_application
BEFORE INSERT ON public.driver_applications
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_role_application('driver');
