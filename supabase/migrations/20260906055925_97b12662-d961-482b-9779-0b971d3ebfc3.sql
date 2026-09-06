CREATE OR REPLACE FUNCTION public.enforce_product_approved_shop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.seller_applications sa
    WHERE sa.user_id = NEW.seller_id
      AND sa.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'APPROVED_SHOP_REQUIRED';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_products_require_approved_shop ON public.products;
CREATE TRIGGER trg_products_require_approved_shop
BEFORE INSERT OR UPDATE OF seller_id ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.enforce_product_approved_shop();

CREATE OR REPLACE FUNCTION public.remove_products_when_shop_unavailable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' OR (OLD.status = 'approved' AND NEW.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.order_items
    SET product_id = NULL
    WHERE product_id IN (
      SELECT id FROM public.products WHERE seller_id = OLD.user_id
    );

    DELETE FROM public.products WHERE seller_id = OLD.user_id;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

DROP TRIGGER IF EXISTS trg_remove_products_when_shop_unavailable ON public.seller_applications;
CREATE TRIGGER trg_remove_products_when_shop_unavailable
AFTER DELETE OR UPDATE OF status ON public.seller_applications
FOR EACH ROW
EXECUTE FUNCTION public.remove_products_when_shop_unavailable();