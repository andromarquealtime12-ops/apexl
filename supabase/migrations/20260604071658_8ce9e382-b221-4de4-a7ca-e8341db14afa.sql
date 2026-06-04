DROP VIEW IF EXISTS public.public_seller_shops;

CREATE OR REPLACE FUNCTION public.get_public_seller_shops(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  shop_name text,
  shop_description text,
  shop_city text,
  shop_address text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sa.id,
    sa.user_id,
    sa.shop_name,
    sa.shop_description,
    sa.shop_city,
    sa.shop_address,
    sa.latitude,
    sa.longitude,
    sa.created_at
  FROM public.seller_applications sa
  WHERE sa.status = 'approved'
    AND (p_user_id IS NULL OR sa.user_id = p_user_id);
$$;

REVOKE ALL ON FUNCTION public.get_public_seller_shops(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_seller_shops(uuid) TO anon, authenticated;