CREATE POLICY "Admins can delete transaction proofs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'transaction-proofs' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update transaction proofs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'transaction-proofs' AND public.has_role(auth.uid(), 'admin'::public.app_role));