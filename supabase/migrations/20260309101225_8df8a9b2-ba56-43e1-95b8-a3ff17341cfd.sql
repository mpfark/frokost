CREATE OR REPLACE FUNCTION public.send_push_on_kitchen_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    body := jsonb_build_object('notification_id', NEW.id),
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
$function$;