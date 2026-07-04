
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_lat float8;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_lng float8;

CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text NOT NULL,
  city text,
  center_lat float8,
  center_lng float8,
  radius_km numeric NOT NULL DEFAULT 15,
  base_fee numeric NOT NULL DEFAULT 50,
  fee_per_km numeric NOT NULL DEFAULT 30,
  currency text NOT NULL DEFAULT 'DOP',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.delivery_zones TO anon, authenticated;
GRANT ALL ON public.delivery_zones TO service_role;

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read active zones" ON public.delivery_zones;
CREATE POLICY "public read active zones"
ON public.delivery_zones FOR SELECT
USING (active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin manage zones" ON public.delivery_zones;
CREATE POLICY "admin manage zones"
ON public.delivery_zones FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS delivery_zones_updated_at ON public.delivery_zones;
CREATE TRIGGER delivery_zones_updated_at
BEFORE UPDATE ON public.delivery_zones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.delivery_zones (name, country, city, center_lat, center_lng, radius_km, base_fee, fee_per_km, currency)
VALUES
  ('Santo Domingo', 'DO', 'Santo Domingo', 18.4861, -69.9312, 25, 50, 30, 'DOP'),
  ('Santiago', 'DO', 'Santiago', 19.4517, -70.6970, 20, 50, 30, 'DOP'),
  ('Port-au-Prince', 'HT', 'Port-au-Prince', 18.5944, -72.3074, 20, 250, 150, 'HTG')
ON CONFLICT DO NOTHING;
