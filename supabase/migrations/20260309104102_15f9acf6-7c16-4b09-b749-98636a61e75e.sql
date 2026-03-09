
-- Create user_notifications table for personal notifications
CREATE TABLE public.user_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON public.user_notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can update own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON public.user_notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete own notifications
CREATE POLICY "Users can delete own notifications" ON public.user_notifications
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- System inserts only (via trigger)
CREATE POLICY "No direct inserts" ON public.user_notifications
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- Trigger: notify orderer when catering order is confirmed
CREATE OR REPLACE FUNCTION public.notify_user_on_catering_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_message text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status <> 'confirmed' AND NEW.status = 'confirmed' THEN
    v_message := 'Din forplejningsbestilling til "' || NEW.meeting_subject || '" d. ' || to_char(NEW.meeting_date, 'DD/MM') || ' er blevet godkendt ✅';
    INSERT INTO public.user_notifications (user_id, type, message, metadata)
    VALUES (NEW.user_id, 'order_confirmed', v_message, jsonb_build_object(
      'order_id', NEW.id,
      'meeting_subject', NEW.meeting_subject,
      'meeting_date', NEW.meeting_date
    ));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_catering_order_confirmed
  AFTER UPDATE ON public.catering_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_user_on_catering_confirmed();

-- Trigger: send push notification when user_notification is created
CREATE OR REPLACE FUNCTION public.send_push_on_user_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text := 'https://gupglbmayvwwxwkunotk.supabase.co';
  service_role_key text;
BEGIN
  service_role_key := current_setting('supabase.service_role_key', true);

  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE WARNING 'Service role key not available for push notification';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-push-notification',
    body := jsonb_build_object('user_notification_id', NEW.id, 'target_user_id', NEW.user_id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Push notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_user_notification_created
  AFTER INSERT ON public.user_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.send_push_on_user_notification();

-- Enable realtime for user_notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
