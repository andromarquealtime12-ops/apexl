ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_printful boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS printful_product_id text,
  ADD COLUMN IF NOT EXISTS printful_variant_id text;

CREATE INDEX IF NOT EXISTS idx_products_printful
  ON public.products(printful_product_id)
  WHERE printful_product_id IS NOT NULL;