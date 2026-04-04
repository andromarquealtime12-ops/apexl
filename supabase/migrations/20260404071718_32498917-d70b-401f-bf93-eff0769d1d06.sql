-- Add ready_for_pickup to allowed statuses
ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (
  status = ANY (ARRAY[
    'pending'::text, 'confirmed'::text, 'preparing'::text, 'ready'::text,
    'ready_for_pickup'::text, 'picked_up'::text, 'delivering'::text,
    'delivered'::text, 'cancelled'::text
  ])
);

-- Fix driver acceptance RLS: drop old policy and recreate with WITH CHECK
DROP POLICY IF EXISTS "Drivers can accept unassigned orders" ON public.orders;

CREATE POLICY "Drivers can accept unassigned orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  driver_id IS NULL
  AND status IN ('confirmed', 'ready', 'ready_for_pickup')
  AND has_role(auth.uid(), 'driver'::app_role)
)
WITH CHECK (
  driver_id = auth.uid()
  AND has_role(auth.uid(), 'driver'::app_role)
);