
-- Allow all authenticated users to view approved seller applications (shops directory)
CREATE POLICY "Anyone can view approved shops"
ON public.seller_applications
FOR SELECT
TO authenticated
USING (status = 'approved');
