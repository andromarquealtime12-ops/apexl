-- Update delivery zones with correct per-country fees (DO 14 DOP/km, HT 75 HTG/km, US 1 USD/km)
-- and add US + generic worldwide fallback zones.

UPDATE public.delivery_zones
SET base_fee = 50, fee_per_km = 14, currency = 'DOP', updated_at = now()
WHERE country = 'DO';

UPDATE public.delivery_zones
SET base_fee = 200, fee_per_km = 75, currency = 'HTG', updated_at = now()
WHERE country = 'HT';

-- Insert US-wide zone if missing
INSERT INTO public.delivery_zones (name, country, city, center_lat, center_lng, radius_km, base_fee, fee_per_km, currency, active)
SELECT 'United States', 'US', NULL, 39.8283, -98.5795, 5000, 5, 1, 'USD', true
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_zones WHERE country = 'US');

-- Insert generic worldwide fallback (used when buyer country not in table)
INSERT INTO public.delivery_zones (name, country, city, center_lat, center_lng, radius_km, base_fee, fee_per_km, currency, active)
SELECT 'Worldwide (default)', 'XX', NULL, 0, 0, 20000, 5, 1, 'USD', true
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_zones WHERE country = 'XX');
