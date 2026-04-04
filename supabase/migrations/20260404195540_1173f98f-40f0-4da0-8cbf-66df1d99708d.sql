
-- Push subscriptions for Web Push API
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can read all for sending" ON public.push_subscriptions
  FOR SELECT USING (true);

-- Restaurants table
CREATE TABLE public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  address text NOT NULL,
  city text NOT NULL,
  phone text,
  whatsapp text,
  cuisine_type text DEFAULT 'general',
  logo_url text,
  cover_url text,
  latitude double precision,
  longitude double precision,
  opening_hours jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  is_approved boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved restaurants visible to all" ON public.restaurants
  FOR SELECT USING (is_active = true AND is_approved = true);

CREATE POLICY "Sellers can view own restaurants" ON public.restaurants
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can create restaurants" ON public.restaurants
  FOR INSERT WITH CHECK (auth.uid() = seller_id AND has_role(auth.uid(), 'seller'::app_role));

CREATE POLICY "Sellers can update own restaurants" ON public.restaurants
  FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Admins can manage all restaurants" ON public.restaurants
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Restaurant menu items
CREATE TABLE public.restaurant_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  currency text DEFAULT 'HTG',
  category text DEFAULT 'plat',
  image_url text,
  is_available boolean DEFAULT true,
  preparation_time integer DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Items of active restaurants visible to all" ON public.restaurant_items
  FOR SELECT USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE is_active = true AND is_approved = true)
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE seller_id = auth.uid())
  );

CREATE POLICY "Sellers can manage items of own restaurants" ON public.restaurant_items
  FOR ALL USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE seller_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE seller_id = auth.uid()));

CREATE POLICY "Admins can manage all items" ON public.restaurant_items
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for push-relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions;
