-- Add seller country to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS seller_country text;

-- Backfill from profiles
UPDATE public.products p
SET seller_country = pr.country
FROM public.profiles pr
WHERE p.seller_id = pr.user_id AND p.seller_country IS NULL;

-- Trigger to auto-fill on insert
CREATE OR REPLACE FUNCTION public.set_product_seller_country()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.seller_country IS NULL THEN
    SELECT country INTO NEW.seller_country
    FROM public.profiles
    WHERE user_id = NEW.seller_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_product_seller_country ON public.products;
CREATE TRIGGER trg_set_product_seller_country
BEFORE INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_product_seller_country();

-- Add extended address fields to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_address2 text,
  ADD COLUMN IF NOT EXISTS delivery_state text,
  ADD COLUMN IF NOT EXISTS delivery_zip text;