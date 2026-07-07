ALTER TABLE public.driver_applications
  ADD COLUMN IF NOT EXISTS driver_license_front_url text,
  ADD COLUMN IF NOT EXISTS driver_license_back_url  text,
  ADD COLUMN IF NOT EXISTS vehicle_registration_url text,
  ADD COLUMN IF NOT EXISTS selfie_url               text;

ALTER TABLE public.seller_applications
  ADD COLUMN IF NOT EXISTS id_document_front_url text,
  ADD COLUMN IF NOT EXISTS id_document_back_url  text,
  ADD COLUMN IF NOT EXISTS selfie_url            text;