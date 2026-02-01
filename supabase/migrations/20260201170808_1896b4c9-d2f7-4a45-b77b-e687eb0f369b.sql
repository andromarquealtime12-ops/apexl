-- Allow admins to insert roles (to assign seller/driver roles)
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Allow admins to update roles
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Allow sellers to delete their own products
CREATE POLICY "Sellers can delete own products"
ON public.products
FOR DELETE
USING (auth.uid() = seller_id);