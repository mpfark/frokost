CREATE TABLE IF NOT EXISTS public.push_internal_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.push_internal_config TO service_role;
REVOKE ALL ON public.push_internal_config FROM anon, authenticated;
ALTER TABLE public.push_internal_config ENABLE ROW LEVEL SECURITY;
INSERT INTO public.push_internal_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.send_push_on_kitchen_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE k text;
BEGIN
  SELECT token INTO k FROM public.push_internal_config WHERE id = 1;
  IF k IS NULL THEN
    RAISE WARNING 'push: internal token missing';
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := 'https://gupglbmayvwwxwkunotk.supabase.co/functions/v1/send-push-notification',
    body := jsonb_build_object('notification_id', NEW.id),
    headers := jsonb_build_object('Content-Type','application/json','x-push-token', k)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'push failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_push_on_user_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE k text;
BEGIN
  SELECT token INTO k FROM public.push_internal_config WHERE id = 1;
  IF k IS NULL THEN
    RAISE WARNING 'push: internal token missing';
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := 'https://gupglbmayvwwxwkunotk.supabase.co/functions/v1/send-push-notification',
    body := jsonb_build_object('user_notification_id', NEW.id, 'target_user_id', NEW.user_id),
    headers := jsonb_build_object('Content-Type','application/json','x-push-token', k)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'push failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update own subscriptions" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;