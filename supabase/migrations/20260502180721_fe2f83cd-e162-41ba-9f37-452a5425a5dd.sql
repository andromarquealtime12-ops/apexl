
-- Table for Shopify store connections (per seller)
CREATE TABLE public.shopify_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL UNIQUE,
  shop_domain TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shopify_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers manage own shopify connection"
  ON public.shopify_connections FOR ALL
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id AND has_role(auth.uid(), 'seller'::app_role));

CREATE POLICY "Admins manage all shopify connections"
  ON public.shopify_connections FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add shopify linkage on products & orders
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS shopify_product_id TEXT,
  ADD COLUMN IF NOT EXISTS shopify_variant_id TEXT,
  ADD COLUMN IF NOT EXISTS available_countries TEXT[] DEFAULT ARRAY['DO','HT'],
  ADD COLUMN IF NOT EXISTS is_shopify BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_shopify ON public.products(shopify_product_id) WHERE shopify_product_id IS NOT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shopify_order_id TEXT,
  ADD COLUMN IF NOT EXISTS shopify_order_number TEXT,
  ADD COLUMN IF NOT EXISTS delivery_country TEXT DEFAULT 'DO';

-- Trigger to update updated_at
CREATE TRIGGER update_shopify_connections_updated_at
  BEFORE UPDATE ON public.shopify_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
