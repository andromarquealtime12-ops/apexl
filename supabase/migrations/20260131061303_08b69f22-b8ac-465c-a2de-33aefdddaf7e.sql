-- Add policy for admins to insert codes
CREATE POLICY "Admins can insert codes"
ON public.admin_access_codes
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add policy for admins to update codes
CREATE POLICY "Admins can update codes"
ON public.admin_access_codes
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add policy for admins to delete codes
CREATE POLICY "Admins can delete codes"
ON public.admin_access_codes
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));