-- =============================================
-- SECTION 1: MODIFICATIONS DE LA TABLE PROFILES
-- =============================================

-- Ajouter les nouveaux champs pour la gestion avancée des utilisateurs
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS identity_status text DEFAULT 'unverified' CHECK (identity_status IN ('unverified', 'pending', 'verified', 'rejected')),
ADD COLUMN IF NOT EXISTS id_document_front text,
ADD COLUMN IF NOT EXISTS id_document_back text,
ADD COLUMN IF NOT EXISTS selfie_photo text,
ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'banned', 'under_review')),
ADD COLUMN IF NOT EXISTS suspension_reason text,
ADD COLUMN IF NOT EXISTS suspension_until timestamp with time zone,
ADD COLUMN IF NOT EXISTS trust_score integer DEFAULT 50 CHECK (trust_score >= 0 AND trust_score <= 100),
ADD COLUMN IF NOT EXISTS total_spent numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_earned numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS admin_notes text,
ADD COLUMN IF NOT EXISTS backup_email text,
ADD COLUMN IF NOT EXISTS backup_phone text,
ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by uuid,
ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS two_factor_secret text,
ADD COLUMN IF NOT EXISTS last_login_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_login_ip text,
ADD COLUMN IF NOT EXISTS last_login_device text;

-- =============================================
-- SECTION 2: TABLE DES DEMANDES DE VÉRIFICATION D'IDENTITÉ
-- =============================================

CREATE TABLE IF NOT EXISTS public.identity_verifications (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    id_document_front text NOT NULL,
    id_document_back text NOT NULL,
    selfie_photo text NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_comment text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own verification" ON public.identity_verifications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own verification" ON public.identity_verifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all verifications" ON public.identity_verifications
    FOR ALL USING (has_role(auth.uid(), 'admin'));

-- =============================================
-- SECTION 3: TABLE DES MESSAGES SUPPORT / CHAT
-- =============================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    subject text NOT NULL,
    status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    category text,
    assigned_to uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own tickets" ON public.support_tickets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own tickets" ON public.support_tickets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all tickets" ON public.support_tickets
    FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Messages du support
CREATE TABLE IF NOT EXISTS public.support_messages (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL,
    message text NOT NULL,
    is_admin_reply boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages of own tickets" ON public.support_messages
    FOR SELECT USING (
        ticket_id IN (SELECT id FROM public.support_tickets WHERE user_id = auth.uid())
        OR has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Users can send messages on own tickets" ON public.support_messages
    FOR INSERT WITH CHECK (
        ticket_id IN (SELECT id FROM public.support_tickets WHERE user_id = auth.uid())
        OR has_role(auth.uid(), 'admin')
    );

-- =============================================
-- SECTION 4: TABLE DES ÉVALUATIONS ET SIGNALEMENTS
-- =============================================

CREATE TABLE IF NOT EXISTS public.reviews (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
    reviewer_id uuid NOT NULL,
    reviewed_user_id uuid NOT NULL,
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment text,
    review_type text CHECK (review_type IN ('buyer_to_seller', 'buyer_to_driver', 'seller_to_buyer', 'driver_to_buyer')),
    is_visible boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visible reviews" ON public.reviews
    FOR SELECT USING (is_visible = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create reviews" ON public.reviews
    FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Admins can manage reviews" ON public.reviews
    FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Signalements
CREATE TABLE IF NOT EXISTS public.reports (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_id uuid NOT NULL,
    reported_user_id uuid,
    reported_product_id uuid,
    reported_order_id uuid,
    category text NOT NULL CHECK (category IN ('fraud', 'harassment', 'inappropriate_content', 'fake_product', 'delivery_issue', 'other')),
    description text NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
    admin_notes text,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports" ON public.reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports" ON public.reports
    FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can manage all reports" ON public.reports
    FOR ALL USING (has_role(auth.uid(), 'admin'));

-- =============================================
-- SECTION 5: TABLE DES NOTIFICATIONS
-- =============================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error', 'promo', 'order', 'delivery')),
    is_read boolean DEFAULT false,
    action_url text,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System/Admin can create notifications" ON public.notifications
    FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR auth.uid() IS NOT NULL);

-- =============================================
-- SECTION 6: TABLE DES LOGS D'AUDIT ADMIN
-- =============================================

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id uuid NOT NULL,
    action text NOT NULL,
    target_type text CHECK (target_type IN ('user', 'product', 'order', 'transaction', 'report', 'ticket', 'setting')),
    target_id uuid,
    old_value jsonb,
    new_value jsonb,
    ip_address text,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view audit logs" ON public.admin_audit_logs
    FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can create audit logs" ON public.admin_audit_logs
    FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

-- =============================================
-- SECTION 7: TABLE DES PARRAINAGES
-- =============================================

CREATE TABLE IF NOT EXISTS public.referrals (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_id uuid NOT NULL,
    referred_id uuid NOT NULL UNIQUE,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rewarded')),
    reward_amount numeric DEFAULT 0,
    orders_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals" ON public.referrals
    FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "System can manage referrals" ON public.referrals
    FOR ALL USING (has_role(auth.uid(), 'admin') OR auth.uid() = referrer_id);

-- =============================================
-- SECTION 8: TABLE DE CONFIGURATION PLATEFORME
-- =============================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key text NOT NULL UNIQUE,
    value text NOT NULL,
    description text,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON public.platform_settings
    FOR SELECT USING (true);

CREATE POLICY "Only admins can manage settings" ON public.platform_settings
    FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Insert default settings
INSERT INTO public.platform_settings (key, value, description) VALUES
('identity_verification_threshold', '10000', 'Seuil en RD$ pour demander la vérification d''identité'),
('platform_commission_percent', '5', 'Pourcentage de commission sur les ventes'),
('delivery_base_fee', '100', 'Frais de base pour la livraison en RD$'),
('referral_reward_percent', '5', 'Pourcentage de récompense pour le parrainage')
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- SECTION 9: BUCKET STORAGE POUR LES DOCUMENTS
-- =============================================

-- Create bucket for identity documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('identity-documents', 'identity-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for identity documents
CREATE POLICY "Users can upload own identity docs" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'identity-documents' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can view own identity docs" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'identity-documents' AND 
        (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'))
    );

-- =============================================
-- SECTION 10: FONCTIONS UTILITAIRES
-- =============================================

-- Fonction pour générer un code de parrainage unique
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
    chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result text := '';
    i integer;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$;

-- Fonction pour suspendre un utilisateur
CREATE OR REPLACE FUNCTION public.suspend_user(
    p_user_id uuid,
    p_reason text,
    p_duration_days integer DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    IF NOT has_role(auth.uid(), 'admin') THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    UPDATE public.profiles
    SET account_status = CASE WHEN p_duration_days IS NULL THEN 'banned' ELSE 'suspended' END,
        suspension_reason = p_reason,
        suspension_until = CASE WHEN p_duration_days IS NOT NULL THEN now() + (p_duration_days || ' days')::interval ELSE NULL END,
        updated_at = now()
    WHERE user_id = p_user_id;
    
    -- Log the action
    INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, new_value)
    VALUES (auth.uid(), 'suspend_user', 'user', p_user_id, json_build_object('reason', p_reason, 'duration_days', p_duration_days));
    
    RETURN json_build_object('success', true, 'message', 'User suspended successfully');
END;
$$;

-- Fonction pour réactiver un utilisateur
CREATE OR REPLACE FUNCTION public.activate_user(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    IF NOT has_role(auth.uid(), 'admin') THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    UPDATE public.profiles
    SET account_status = 'active',
        suspension_reason = NULL,
        suspension_until = NULL,
        updated_at = now()
    WHERE user_id = p_user_id;
    
    -- Log the action
    INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id)
    VALUES (auth.uid(), 'activate_user', 'user', p_user_id);
    
    RETURN json_build_object('success', true, 'message', 'User activated successfully');
END;
$$;

-- Fonction pour approuver la vérification d'identité
CREATE OR REPLACE FUNCTION public.approve_identity_verification(
    p_verification_id uuid,
    p_comment text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    IF NOT has_role(auth.uid(), 'admin') THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    SELECT user_id INTO v_user_id FROM public.identity_verifications WHERE id = p_verification_id;
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Verification not found');
    END IF;
    
    -- Update verification
    UPDATE public.identity_verifications
    SET status = 'approved',
        admin_comment = p_comment,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        updated_at = now()
    WHERE id = p_verification_id;
    
    -- Update user profile
    UPDATE public.profiles
    SET identity_status = 'verified',
        trust_score = LEAST(trust_score + 20, 100),
        updated_at = now()
    WHERE user_id = v_user_id;
    
    -- Create notification
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (v_user_id, 'Identité vérifiée ✓', 'Votre identité a été vérifiée avec succès. Votre score de confiance a augmenté.', 'success');
    
    RETURN json_build_object('success', true, 'message', 'Identity verified successfully');
END;
$$;

-- Fonction pour rejeter la vérification d'identité
CREATE OR REPLACE FUNCTION public.reject_identity_verification(
    p_verification_id uuid,
    p_reason text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    IF NOT has_role(auth.uid(), 'admin') THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    SELECT user_id INTO v_user_id FROM public.identity_verifications WHERE id = p_verification_id;
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Verification not found');
    END IF;
    
    -- Update verification
    UPDATE public.identity_verifications
    SET status = 'rejected',
        admin_comment = p_reason,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        updated_at = now()
    WHERE id = p_verification_id;
    
    -- Update user profile
    UPDATE public.profiles
    SET identity_status = 'rejected',
        updated_at = now()
    WHERE user_id = v_user_id;
    
    -- Create notification
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (v_user_id, 'Vérification refusée', 'Votre demande de vérification a été refusée: ' || p_reason, 'error');
    
    RETURN json_build_object('success', true, 'message', 'Verification rejected');
END;
$$;

-- =============================================
-- SECTION 11: ENABLE REALTIME
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;