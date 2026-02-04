
-- Add geolocation columns to profiles (for buyers and addresses)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS latitude double precision,
ADD COLUMN IF NOT EXISTS longitude double precision;

-- Add geolocation to seller_applications and driver_applications
ALTER TABLE public.seller_applications
ADD COLUMN IF NOT EXISTS latitude double precision,
ADD COLUMN IF NOT EXISTS longitude double precision;

ALTER TABLE public.driver_applications
ADD COLUMN IF NOT EXISTS latitude double precision,
ADD COLUMN IF NOT EXISTS longitude double precision,
ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_location_update timestamptz;

-- Add geolocation to orders for delivery tracking
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS buyer_latitude double precision,
ADD COLUMN IF NOT EXISTS buyer_longitude double precision;

-- Create driver_locations table for real-time tracking
CREATE TABLE IF NOT EXISTS public.driver_locations (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    is_online boolean DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(driver_id)
);

-- Enable RLS
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Drivers can update their own location
CREATE POLICY "Drivers can manage own location"
ON public.driver_locations
FOR ALL
USING (auth.uid() = driver_id)
WITH CHECK (auth.uid() = driver_id);

-- Anyone authenticated can view online drivers for finding nearby ones
CREATE POLICY "Authenticated users can view online drivers"
ON public.driver_locations
FOR SELECT
USING (auth.uid() IS NOT NULL AND is_online = true);

-- Enable realtime for driver locations
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;

-- Function to calculate distance between two points (Haversine formula)
CREATE OR REPLACE FUNCTION public.calculate_distance(
    lat1 double precision,
    lon1 double precision,
    lat2 double precision,
    lon2 double precision
)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    R double precision := 6371; -- Earth's radius in kilometers
    dLat double precision;
    dLon double precision;
    a double precision;
    c double precision;
BEGIN
    IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
        RETURN NULL;
    END IF;
    
    dLat := radians(lat2 - lat1);
    dLon := radians(lon2 - lon1);
    a := sin(dLat/2) * sin(dLat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dLon/2) * sin(dLon/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    RETURN R * c;
END;
$$;

-- Function to get nearby drivers
CREATE OR REPLACE FUNCTION public.get_nearby_drivers(
    p_latitude double precision,
    p_longitude double precision,
    p_radius_km double precision DEFAULT 10
)
RETURNS TABLE(
    driver_id uuid,
    latitude double precision,
    longitude double precision,
    distance_km double precision,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dl.driver_id,
        dl.latitude,
        dl.longitude,
        calculate_distance(p_latitude, p_longitude, dl.latitude, dl.longitude) as distance_km,
        dl.updated_at
    FROM public.driver_locations dl
    WHERE dl.is_online = true
    AND calculate_distance(p_latitude, p_longitude, dl.latitude, dl.longitude) <= p_radius_km
    ORDER BY distance_km ASC;
END;
$$;
