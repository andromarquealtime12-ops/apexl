-- Table pour les demandes d'inscription vendeur
CREATE TABLE public.seller_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    shop_name TEXT NOT NULL,
    shop_description TEXT,
    shop_address TEXT NOT NULL,
    shop_city TEXT NOT NULL,
    shop_phone TEXT NOT NULL,
    business_type TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(user_id)
);

-- Table pour les demandes d'inscription livreur
CREATE TABLE public.driver_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('motorcycle', 'car', 'bicycle', 'truck')),
    vehicle_brand TEXT NOT NULL,
    vehicle_model TEXT,
    vehicle_year TEXT,
    license_plate TEXT NOT NULL,
    driver_license_number TEXT NOT NULL,
    phone TEXT NOT NULL,
    city TEXT NOT NULL,
    availability TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.seller_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for seller_applications
CREATE POLICY "Users can view own seller application"
ON public.seller_applications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own seller application"
ON public.seller_applications FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending seller application"
ON public.seller_applications FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can view all seller applications"
ON public.seller_applications FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update seller applications"
ON public.seller_applications FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for driver_applications
CREATE POLICY "Users can view own driver application"
ON public.driver_applications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own driver application"
ON public.driver_applications FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending driver application"
ON public.driver_applications FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can view all driver applications"
ON public.driver_applications FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update driver applications"
ON public.driver_applications FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Function to approve seller application
CREATE OR REPLACE FUNCTION public.approve_seller_application(application_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    app_record RECORD;
BEGIN
    -- Check if caller is admin
    IF NOT has_role(auth.uid(), 'admin') THEN
        RETURN false;
    END IF;
    
    SELECT * INTO app_record FROM seller_applications WHERE id = application_id AND status = 'pending';
    
    IF app_record.id IS NOT NULL THEN
        -- Add seller role
        INSERT INTO user_roles (user_id, role) VALUES (app_record.user_id, 'seller')
        ON CONFLICT (user_id, role) DO NOTHING;
        
        -- Update application status
        UPDATE seller_applications 
        SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
        WHERE id = application_id;
        
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$;

-- Function to approve driver application
CREATE OR REPLACE FUNCTION public.approve_driver_application(application_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    app_record RECORD;
BEGIN
    -- Check if caller is admin
    IF NOT has_role(auth.uid(), 'admin') THEN
        RETURN false;
    END IF;
    
    SELECT * INTO app_record FROM driver_applications WHERE id = application_id AND status = 'pending';
    
    IF app_record.id IS NOT NULL THEN
        -- Add driver role
        INSERT INTO user_roles (user_id, role) VALUES (app_record.user_id, 'driver')
        ON CONFLICT (user_id, role) DO NOTHING;
        
        -- Update application status
        UPDATE driver_applications 
        SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
        WHERE id = application_id;
        
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_seller_applications_updated_at
BEFORE UPDATE ON public.seller_applications
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driver_applications_updated_at
BEFORE UPDATE ON public.driver_applications
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();