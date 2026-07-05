
-- 1) driver_locations: restrict SELECT
DROP POLICY IF EXISTS "Authenticated users can view online drivers" ON public.driver_locations;

CREATE POLICY "Driver location visible to self, admin, or order parties"
ON public.driver_locations
FOR SELECT
TO authenticated
USING (
  auth.uid() = driver_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.driver_id = driver_locations.driver_id
      AND o.status NOT IN ('delivered','cancelled','refunded')
      AND (
        o.buyer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.order_items oi
          WHERE oi.order_id = o.id AND oi.seller_id = auth.uid()
        )
      )
  )
);

-- 2) platform_settings: restrict SELECT to admins only
DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.platform_settings;

CREATE POLICY "Only admins can read settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
