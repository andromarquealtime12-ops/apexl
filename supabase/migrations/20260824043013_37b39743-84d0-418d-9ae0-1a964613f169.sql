ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS push_sent boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.trigger_send_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://wdishwyubgftrkjuaszk.supabase.co/functions/v1/send-push-notification',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_send_push ON public.notifications;
CREATE TRIGGER notifications_send_push
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.trigger_send_push_notification();

REVOKE EXECUTE ON FUNCTION public.trigger_send_push_notification() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_driver_overview() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_cancel_delivery(uuid, text, boolean, numeric) FROM anon;