-- Remove foreign key constraint on seller_id to allow demo products
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_seller_id_fkey;

-- Add a comment to indicate this is for demo purposes
COMMENT ON COLUMN public.products.seller_id IS 'UUID of the seller. Can be a real user or a demo seller ID.';