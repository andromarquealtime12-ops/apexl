-- User roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'buyer', 'seller', 'driver');

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    country TEXT DEFAULT 'DO' CHECK (country IN ('DO', 'HT')),
    address TEXT,
    city TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Categories table
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_ht TEXT, -- Creole name
    icon TEXT,
    image_url TEXT,
    parent_id UUID REFERENCES public.categories(id),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Products table
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES public.categories(id),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(12,2) NOT NULL,
    currency TEXT DEFAULT 'DOP' CHECK (currency IN ('DOP', 'HTG', 'USD')),
    stock_quantity INTEGER DEFAULT 0,
    images TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Payment methods enum
CREATE TYPE public.payment_method_type AS ENUM (
    'card_visa', 'card_mastercard', 
    'orange_money', 'moncash', 
    'banreservas', 'bhd', 
    'bank_transfer_do', 'bank_transfer_ht'
);

-- Wallets table
CREATE TABLE public.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    balance_dop DECIMAL(12,2) DEFAULT 0,
    balance_htg DECIMAL(12,2) DEFAULT 0,
    balance_usd DECIMAL(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Wallet transactions table
CREATE TABLE public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'payment', 'refund', 'transfer')),
    amount DECIMAL(12,2) NOT NULL,
    currency TEXT DEFAULT 'DOP' CHECK (currency IN ('DOP', 'HTG', 'USD')),
    payment_method payment_method_type,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    reference TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Orders table
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'delivering', 'delivered', 'cancelled')),
    total_amount DECIMAL(12,2) NOT NULL,
    delivery_fee DECIMAL(12,2) DEFAULT 0,
    currency TEXT DEFAULT 'DOP' CHECK (currency IN ('DOP', 'HTG', 'USD')),
    payment_method payment_method_type,
    delivery_address TEXT,
    delivery_city TEXT,
    delivery_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Order items table
CREATE TABLE public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    seller_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Admin access codes table
CREATE TABLE public.admin_access_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    uses_remaining INTEGER DEFAULT 1,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ
);
ALTER TABLE public.admin_access_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- User roles: users can read their own roles
CREATE POLICY "Users can view own roles" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Profiles policies
CREATE POLICY "Profiles are viewable by owner" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Categories: publicly viewable
CREATE POLICY "Categories are publicly viewable" ON public.categories
    FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage categories" ON public.categories
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Products policies
CREATE POLICY "Active products are publicly viewable" ON public.products
    FOR SELECT USING (is_active = true);
CREATE POLICY "Sellers can view own products" ON public.products
    FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY "Sellers can create products" ON public.products
    FOR INSERT WITH CHECK (auth.uid() = seller_id AND public.has_role(auth.uid(), 'seller'));
CREATE POLICY "Sellers can update own products" ON public.products
    FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "Admins can manage all products" ON public.products
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Wallets policies
CREATE POLICY "Users can view own wallet" ON public.wallets
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own wallet" ON public.wallets
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can create wallets" ON public.wallets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Wallet transactions policies
CREATE POLICY "Users can view own transactions" ON public.wallet_transactions
    FOR SELECT USING (
        wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid())
    );
CREATE POLICY "Users can create transactions" ON public.wallet_transactions
    FOR INSERT WITH CHECK (
        wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid())
    );

-- Orders policies
CREATE POLICY "Buyers can view own orders" ON public.orders
    FOR SELECT USING (auth.uid() = buyer_id);
CREATE POLICY "Drivers can view assigned orders" ON public.orders
    FOR SELECT USING (auth.uid() = driver_id);
CREATE POLICY "Buyers can create orders" ON public.orders
    FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Buyers can update own orders" ON public.orders
    FOR UPDATE USING (auth.uid() = buyer_id);
CREATE POLICY "Drivers can update assigned orders" ON public.orders
    FOR UPDATE USING (auth.uid() = driver_id AND public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Admins can manage all orders" ON public.orders
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Order items policies
CREATE POLICY "Order items viewable by order owner" ON public.order_items
    FOR SELECT USING (
        order_id IN (SELECT id FROM public.orders WHERE buyer_id = auth.uid() OR driver_id = auth.uid())
    );
CREATE POLICY "Sellers can view items they sold" ON public.order_items
    FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY "Buyers can create order items" ON public.order_items
    FOR INSERT WITH CHECK (
        order_id IN (SELECT id FROM public.orders WHERE buyer_id = auth.uid())
    );

-- Admin access codes: only admins
CREATE POLICY "Only admins can view codes" ON public.admin_access_codes
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can manage codes" ON public.admin_access_codes
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Function to create profile and wallet on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Utilisateur'));
    
    INSERT INTO public.wallets (user_id)
    VALUES (NEW.id);
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'buyer');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for new user
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to validate admin code and grant role
CREATE OR REPLACE FUNCTION public.validate_admin_code(code_input TEXT, user_id_input UUID)
RETURNS BOOLEAN AS $$
DECLARE
    code_record RECORD;
BEGIN
    SELECT * INTO code_record 
    FROM public.admin_access_codes 
    WHERE code = code_input 
    AND is_active = true 
    AND (expires_at IS NULL OR expires_at > now())
    AND (uses_remaining IS NULL OR uses_remaining > 0);
    
    IF code_record.id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role) 
        VALUES (user_id_input, 'admin')
        ON CONFLICT (user_id, role) DO NOTHING;
        
        IF code_record.uses_remaining IS NOT NULL THEN
            UPDATE public.admin_access_codes 
            SET uses_remaining = uses_remaining - 1 
            WHERE id = code_record.id;
        END IF;
        
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default categories
INSERT INTO public.categories (name, name_ht, icon, sort_order) VALUES
('Alimentation & Boissons', 'Manje ak Bwason', 'utensils', 1),
('Électronique & Téléphones', 'Elektwonik ak Telefòn', 'smartphone', 2),
('Vêtements & Mode', 'Rad ak Mòd', 'shirt', 3),
('Restaurant', 'Restoran', 'chef-hat', 4),
('Maison & Jardin', 'Kay ak Jaden', 'home', 5),
('Beauté & Santé', 'Bote ak Sante', 'heart', 6),
('Sports & Loisirs', 'Espò ak Plezi', 'dumbbell', 7),
('Livres & Médias', 'Liv ak Medya', 'book', 8),
('Automobile', 'Machin', 'car', 9),
('Services', 'Sèvis', 'briefcase', 10);

-- Insert initial admin code (change this in production!)
INSERT INTO public.admin_access_codes (code, uses_remaining) 
VALUES ('AYITI-ADMIN-2024', 5);