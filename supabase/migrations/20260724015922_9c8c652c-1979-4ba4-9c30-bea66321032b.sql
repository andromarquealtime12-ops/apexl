
-- 1) deposit_methods: allow authenticated users to read active methods
CREATE POLICY "Authenticated can view active deposit methods"
  ON public.deposit_methods
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 2) driver_locations: narrow to active/live delivery statuses only
DROP POLICY IF EXISTS "Driver location visible to self, admin, or order parties" ON public.driver_locations;

CREATE POLICY "Driver location visible to self, admin, or active delivery parties"
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
        AND o.status = ANY (ARRAY['ready_for_pickup','picked_up','in_transit'])
        AND (
          o.buyer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.order_items oi
            WHERE oi.order_id = o.id AND oi.seller_id = auth.uid()
          )
        )
    )
  );

-- 3) reviews: require authentication to read (hides reviewer/reviewed IDs from anon)
DROP POLICY IF EXISTS "Anyone can view visible reviews" ON public.reviews;

CREATE POLICY "Authenticated users can view visible reviews"
  ON public.reviews
  FOR SELECT
  TO authenticated
  USING (is_visible = true OR has_role(auth.uid(), 'admin'::app_role));
