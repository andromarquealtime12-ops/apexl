ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'fr';

CREATE OR REPLACE FUNCTION public.notify_seller_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lang text;
  v_title text;
  v_msg text;
  v_short text := LEFT(NEW.order_id::text, 8);
BEGIN
  IF NEW.seller_id IS NULL THEN RETURN NEW; END IF;

  -- one alert per order per seller
  IF EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = NEW.seller_id
      AND type = 'order'
      AND action_url = '/seller'
      AND message LIKE '%' || v_short || '%'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(language, 'fr') INTO v_lang FROM public.profiles WHERE user_id = NEW.seller_id;
  v_lang := COALESCE(v_lang, 'fr');

  CASE v_lang
    WHEN 'en' THEN v_title := 'New order'; v_msg := 'You received a new order #' || v_short || '. Open your dashboard to confirm it.';
    WHEN 'es' THEN v_title := 'Nuevo pedido'; v_msg := 'Has recibido un nuevo pedido #' || v_short || '. Abre tu panel para confirmarlo.';
    WHEN 'pt' THEN v_title := 'Novo pedido'; v_msg := 'Você recebeu um novo pedido #' || v_short || '. Abra o seu painel para confirmar.';
    WHEN 'de' THEN v_title := 'Neue Bestellung'; v_msg := 'Sie haben eine neue Bestellung #' || v_short || ' erhalten. Öffnen Sie Ihr Dashboard.';
    WHEN 'it' THEN v_title := 'Nuovo ordine'; v_msg := 'Hai ricevuto un nuovo ordine #' || v_short || '. Apri la tua dashboard.';
    WHEN 'ht' THEN v_title := 'Nouvo kòmand'; v_msg := 'Ou resevwa yon nouvo kòmand #' || v_short || '. Louvri tablodbò ou pou konfime l.';
    WHEN 'zh' THEN v_title := '新订单'; v_msg := '您收到新订单 #' || v_short || '，请打开卖家面板确认。';
    WHEN 'ar' THEN v_title := 'طلب جديد'; v_msg := 'لقد تلقيت طلباً جديداً #' || v_short || '. افتح لوحة التحكم لتأكيده.';
    ELSE v_title := 'Nouvelle commande'; v_msg := 'Vous avez reçu une nouvelle commande #' || v_short || '. Ouvrez votre tableau de bord pour la confirmer.';
  END CASE;

  INSERT INTO public.notifications (user_id, title, message, type, action_url)
  VALUES (NEW.seller_id, v_title, v_msg, 'order', '/seller');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_items_notify_seller ON public.order_items;
CREATE TRIGGER order_items_notify_seller
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.notify_seller_new_order();

REVOKE EXECUTE ON FUNCTION public.notify_seller_new_order() FROM anon, authenticated;