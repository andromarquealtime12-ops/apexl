-- Table to track which sellers have marked their items ready for an order
CREATE TABLE public.order_seller_readiness (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  marked_ready_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (order_id, seller_id)
);

CREATE INDEX idx_order_seller_readiness_order ON public.order_seller_readiness(order_id);

ALTER TABLE public.order_seller_readiness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view readiness for their orders"
ON public.order_seller_readiness FOR SELECT
USING (
  order_id IN (SELECT get_seller_order_ids())
  OR order_id IN (SELECT get_buyer_order_ids())
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Sellers can insert own readiness"
ON public.order_seller_readiness FOR INSERT
WITH CHECK (
  auth.uid() = seller_id
  AND order_id IN (SELECT get_seller_order_ids())
);

CREATE POLICY "Admins can manage readiness"
ON public.order_seller_readiness FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Function: mark this seller's items ready; only flip order to 'ready' when ALL sellers are ready
CREATE OR REPLACE FUNCTION public.mark_seller_items_ready(p_order_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller UUID := auth.uid();
  v_total_sellers INT;
  v_ready_sellers INT;
  v_is_seller BOOLEAN;
  v_order_status TEXT;
BEGIN
  IF v_seller IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  -- Confirm caller is a seller on this order
  SELECT EXISTS(
    SELECT 1 FROM public.order_items
    WHERE order_id = p_order_id AND seller_id = v_seller
  ) INTO v_is_seller;

  IF NOT v_is_seller THEN
    RAISE EXCEPTION 'Vous n''avez pas d''articles sur cette commande';
  END IF;

  SELECT status INTO v_order_status FROM public.orders WHERE id = p_order_id;

  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'Commande introuvable';
  END IF;

  IF v_order_status NOT IN ('pending','confirmed','preparing','ready') THEN
    RAISE EXCEPTION 'Cette commande n''est plus modifiable';
  END IF;

  -- Record readiness (idempotent)
  INSERT INTO public.order_seller_readiness (order_id, seller_id)
  VALUES (p_order_id, v_seller)
  ON CONFLICT (order_id, seller_id) DO NOTHING;

  -- Count distinct sellers in order_items vs ready sellers
  SELECT COUNT(DISTINCT seller_id) INTO v_total_sellers
  FROM public.order_items
  WHERE order_id = p_order_id AND seller_id IS NOT NULL;

  SELECT COUNT(*) INTO v_ready_sellers
  FROM public.order_seller_readiness
  WHERE order_id = p_order_id;

  -- Flip order to 'ready' only when all sellers are ready
  IF v_ready_sellers >= v_total_sellers AND v_order_status <> 'ready' THEN
    UPDATE public.orders
    SET status = 'ready', updated_at = now()
    WHERE id = p_order_id;
  END IF;

  RETURN jsonb_build_object(
    'ready_sellers', v_ready_sellers,
    'total_sellers', v_total_sellers,
    'all_ready', v_ready_sellers >= v_total_sellers
  );
END;
$$;