
-- 1. Remove seed/demo products (fake seller UUIDs 1111..-6666..)
DELETE FROM order_items WHERE product_id IN (
  SELECT id FROM public.products
  WHERE seller_id::text ~ '^([0-9])\1{7}-\1{4}-\1{4}-\1{4}-\1{12}$'
);
DELETE FROM public.products
WHERE seller_id::text ~ '^([0-9])\1{7}-\1{4}-\1{4}-\1{4}-\1{12}$';

-- 2. Add persistent shop location on profiles (seller pickup address)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shop_latitude  double precision,
  ADD COLUMN IF NOT EXISTS shop_longitude double precision,
  ADD COLUMN IF NOT EXISTS shop_address   text;
