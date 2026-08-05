REVOKE EXECUTE ON FUNCTION public.get_shop_public_info(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shop_public_info(uuid[]) TO authenticated, service_role;