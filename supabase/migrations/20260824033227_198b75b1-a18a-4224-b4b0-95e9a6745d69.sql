CREATE OR REPLACE FUNCTION public.update_pickup_location(
  p_lat double precision,
  p_lng double precision,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_restaurant_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  IF p_lat IS NULL OR p_lng IS NULL
     OR p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180 THEN
    RETURN json_build_object('success', false, 'error', 'Coordonnées invalides');
  END IF;

  IF p_restaurant_id IS NOT NULL THEN
    UPDATE public.restaurants
    SET latitude = p_lat,
        longitude = p_lng,
        address = COALESCE(NULLIF(p_address, ''), address),
        city = COALESCE(NULLIF(p_city, ''), city),
        updated_at = now()
    WHERE id = p_restaurant_id
      AND seller_id = v_uid;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      RETURN json_build_object('success', false, 'error', 'Restaurant introuvable');
    END IF;

    RETURN json_build_object('success', true, 'target', 'restaurant');
  END IF;

  UPDATE public.profiles
  SET shop_latitude = p_lat,
      shop_longitude = p_lng,
      shop_address = COALESCE(NULLIF(p_address, ''), shop_address),
      latitude = p_lat,
      longitude = p_lng,
      address = COALESCE(NULLIF(p_address, ''), address),
      city = COALESCE(NULLIF(p_city, ''), city),
      updated_at = now()
  WHERE user_id = v_uid;

  UPDATE public.seller_applications
  SET latitude = p_lat,
      longitude = p_lng,
      shop_address = COALESCE(NULLIF(p_address, ''), shop_address),
      shop_city = COALESCE(NULLIF(p_city, ''), shop_city),
      updated_at = now()
  WHERE user_id = v_uid;

  RETURN json_build_object('success', true, 'target', 'seller');
END;
$$;

REVOKE ALL ON FUNCTION public.update_pickup_location(double precision, double precision, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_pickup_location(double precision, double precision, text, text, uuid) TO authenticated;