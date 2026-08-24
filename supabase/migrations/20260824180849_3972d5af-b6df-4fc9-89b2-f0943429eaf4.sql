
-- 1) Profiles: block self privilege-escalation on sensitive columns
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- server-side / service role contexts and admins are exempt
  IF v_uid IS NULL OR public.has_role(v_uid, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  NEW.identity_status        := OLD.identity_status;
  NEW.account_status         := OLD.account_status;
  NEW.suspension_reason      := OLD.suspension_reason;
  NEW.suspension_until       := OLD.suspension_until;
  NEW.trust_score            := OLD.trust_score;
  NEW.total_spent            := OLD.total_spent;
  NEW.total_earned           := OLD.total_earned;
  NEW.admin_notes            := OLD.admin_notes;
  NEW.report_count           := OLD.report_count;
  NEW.lost_packages_count    := OLD.lost_packages_count;
  NEW.referral_code          := OLD.referral_code;
  NEW.referred_by            := OLD.referred_by;
  NEW.two_factor_secret      := OLD.two_factor_secret;
  NEW.verification_code      := OLD.verification_code;
  NEW.verification_code_expires_at := OLD.verification_code_expires_at;
  NEW.email_verified         := OLD.email_verified;
  NEW.user_id                := OLD.user_id;
  -- personal_info_locked may only move false -> true (handled by other trigger too)
  IF OLD.personal_info_locked AND NOT COALESCE(NEW.personal_info_locked, false) THEN
    NEW.personal_info_locked := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_privileged_fields ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileged_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_fields();

-- keep the explicit WITH CHECK on the self-update policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2) Orders: restrict sellers to fulfillment status transitions only
CREATE OR REPLACE FUNCTION public.guard_orders_seller_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_bypass text;
BEGIN
  BEGIN
    v_bypass := current_setting('app.bypass_order_guard', true);
  EXCEPTION WHEN OTHERS THEN
    v_bypass := NULL;
  END;
  IF v_bypass = 'on' OR v_uid IS NULL OR public.has_role(v_uid, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- only applies when the caller is a seller on this order and is neither buyer nor driver
  IF v_uid = OLD.buyer_id OR v_uid = OLD.driver_id THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = OLD.id AND oi.seller_id = v_uid
  ) THEN
    RETURN NEW;
  END IF;

  -- financial / assignment fields already immutable via guard_orders_update; pin the rest
  NEW.buyer_id          := OLD.buyer_id;
  NEW.driver_id         := OLD.driver_id;
  NEW.total_amount      := OLD.total_amount;
  NEW.delivery_fee      := OLD.delivery_fee;
  NEW.currency          := OLD.currency;
  NEW.payment_method    := OLD.payment_method;
  NEW.payment_status    := OLD.payment_status;
  NEW.delivery_address  := OLD.delivery_address;
  NEW.delivery_address2 := OLD.delivery_address2;
  NEW.delivery_city     := OLD.delivery_city;
  NEW.delivery_state    := OLD.delivery_state;
  NEW.delivery_zip      := OLD.delivery_zip;
  NEW.delivery_country  := OLD.delivery_country;
  NEW.delivery_lat      := OLD.delivery_lat;
  NEW.delivery_lng      := OLD.delivery_lng;
  NEW.buyer_latitude    := OLD.buyer_latitude;
  NEW.buyer_longitude   := OLD.buyer_longitude;
  NEW.shopify_order_id  := OLD.shopify_order_id;
  NEW.shopify_order_number := OLD.shopify_order_number;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status NOT IN ('confirmed', 'preparing', 'ready', 'ready_for_pickup')
       OR OLD.status NOT IN ('pending', 'confirmed', 'preparing', 'ready', 'ready_for_pickup') THEN
      RAISE EXCEPTION 'Sellers can only move orders through preparation statuses';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_orders_seller_update ON public.orders;
CREATE TRIGGER trg_guard_orders_seller_update
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_orders_seller_update();
