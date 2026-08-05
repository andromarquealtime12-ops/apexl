
-- 1. Product images: restrict uploads to sellers, own folder only
DROP POLICY IF EXISTS "Sellers can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload product images to own folder" ON storage.objects;
CREATE POLICY "Sellers upload product images to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (public.has_role(auth.uid(), 'seller') OR public.has_role(auth.uid(), 'admin'))
);

-- 2. Drivers no longer read full seller_applications rows
DROP POLICY IF EXISTS "Drivers can view assigned shop details" ON public.seller_applications;

CREATE OR REPLACE FUNCTION public.get_shop_public_info(p_seller_ids uuid[])
RETURNS TABLE(user_id uuid, shop_name text, shop_city text, shop_address text, shop_phone text, latitude double precision, longitude double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sa.user_id, sa.shop_name, sa.shop_city, sa.shop_address, sa.shop_phone, sa.latitude, sa.longitude
  FROM public.seller_applications sa
  WHERE sa.status = 'approved' AND sa.user_id = ANY(p_seller_ids)
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_public_info(uuid[]) TO authenticated;
