-- Allow pickup_code to be NULL after verification (it gets cleared once verified)
ALTER TABLE public.delivery_verification ALTER COLUMN pickup_code DROP NOT NULL;