-- Create storage bucket for return photos
INSERT INTO storage.buckets (id, name, public) VALUES ('return-photos', 'return-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY "Return photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'return-photos');

-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload return photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'return-photos');

-- Users can delete their own uploads
CREATE POLICY "Users can delete own return photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'return-photos' AND auth.uid()::text = (storage.foldername(name))[1]);