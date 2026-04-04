-- Allow drivers to view unassigned orders (available deliveries)
CREATE POLICY "Drivers can view available orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  driver_id IS NULL
  AND status IN ('confirmed', 'ready', 'ready_for_pickup')
  AND has_role(auth.uid(), 'driver'::app_role)
);

-- Allow drivers to update unassigned orders (to accept them)
CREATE POLICY "Drivers can accept unassigned orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  driver_id IS NULL
  AND status IN ('confirmed', 'ready', 'ready_for_pickup')
  AND has_role(auth.uid(), 'driver'::app_role)
);