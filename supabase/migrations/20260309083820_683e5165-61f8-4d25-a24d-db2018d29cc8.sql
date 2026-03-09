
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create trigger function to call push notification edge function
CREATE OR REPLACE FUNCTION public.send_push_on_kitchen_notification()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  -- Get the Supabase URL and service role key from vault or env
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- If settings not available, try to construct from known values
  IF supabase_url IS NULL OR supabase_url = '' THEN
    supabase_url := 'https://gupglbmayvwwxwkunotk.supabase.co';
  END IF;

  -- Use pg_net to call the edge function asynchronously
  PERFORM extensions.http_post(
    url := supabase_url || '/functions/v1/send-push-notification',
    body := jsonb_build_object('notification_id', NEW.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, current_setting('supabase.service_role_key', true))
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the insert if push fails
  RAISE WARNING 'Push notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger on kitchen_notifications
CREATE TRIGGER on_kitchen_notification_created
  AFTER INSERT ON public.kitchen_notifications
  FOR EACH ROW EXECUTE FUNCTION public.send_push_on_kitchen_notification();
