
-- =====================================================================
-- 1. EMAIL QUEUE: instant flush + 1-min safety-net
-- =====================================================================

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  msg_id bigint;
  svc_key text;
BEGIN
  BEGIN
    msg_id := pgmq.send(queue_name, payload);
  EXCEPTION WHEN undefined_table THEN
    PERFORM pgmq.create(queue_name);
    msg_id := pgmq.send(queue_name, payload);
  END;

  -- Fire-and-forget kick to process-email-queue so users see instant delivery.
  BEGIN
    SELECT decrypted_secret INTO svc_key
    FROM vault.decrypted_secrets
    WHERE name = 'email_queue_service_role_key'
    LIMIT 1;

    IF svc_key IS NOT NULL AND svc_key <> '' THEN
      PERFORM net.http_post(
        url := 'https://gupglbmayvwwxwkunotk.supabase.co/functions/v1/process-email-queue',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Lovable-Context', 'enqueue-trigger',
          'Authorization', 'Bearer ' || svc_key
        ),
        body := '{}'::jsonb
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Never fail the enqueue because of the kick; safety-net cron handles it.
    RAISE WARNING 'enqueue_email kick failed: %', SQLERRM;
  END;

  RETURN msg_id;
END;
$$;

-- Replace 5-second cron with 1-minute safety-net (keep same body / guards)
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'process-email-queue';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'process-email-queue',
  '* * * * *',
  $cron$
  SELECT CASE
    WHEN (SELECT retry_after_until FROM public.email_send_state WHERE id = 1) > now()
      THEN NULL
    WHEN EXISTS (SELECT 1 FROM pgmq.q_auth_emails LIMIT 1)
      OR EXISTS (SELECT 1 FROM pgmq.q_transactional_emails LIMIT 1)
      THEN net.http_post(
        url := 'https://gupglbmayvwwxwkunotk.supabase.co/functions/v1/process-email-queue',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Lovable-Context', 'cron',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'email_queue_service_role_key'
          )
        ),
        body := '{}'::jsonb
      )
    ELSE NULL
  END;
  $cron$
);

-- =====================================================================
-- 2. WEEKLY LUNCH REMINDER: one cron at admin-configured time
-- =====================================================================

CREATE OR REPLACE FUNCTION public.reschedule_weekly_reminder()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled boolean;
  v_day int;
  v_hour int;
  v_offset_hours int;
  v_utc_hour int;
  v_utc_dow int;
  v_secret text;
  v_schedule text;
  v_command text;
  v_jobid bigint;
BEGIN
  SELECT reminder_enabled, reminder_day, reminder_hour
    INTO v_enabled, v_day, v_hour
  FROM public.company_settings
  ORDER BY created_at ASC
  LIMIT 1;

  -- Drop old jobs (both legacy hourly and previously-scheduled weekly variants)
  FOR v_jobid IN
    SELECT jobid FROM cron.job
    WHERE jobname IN ('weekly-lunch-reminder', 'weekly-lunch-reminder-scheduled')
  LOOP
    PERFORM cron.unschedule(v_jobid);
  END LOOP;

  IF v_enabled IS NOT TRUE THEN
    RETURN; -- disabled: leave unscheduled
  END IF;

  v_day  := COALESCE(v_day, 1) % 7;            -- JS getDay() 0=Sun..6=Sat
  v_hour := COALESCE(v_hour, 8);

  -- Current UTC offset for Europe/Copenhagen (1 in winter, 2 in summer)
  v_offset_hours := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Europe/Copenhagen' - now() AT TIME ZONE 'UTC'))::int;

  v_utc_hour := v_hour - v_offset_hours;
  v_utc_dow  := v_day;
  IF v_utc_hour < 0 THEN
    v_utc_hour := v_utc_hour + 24;
    v_utc_dow  := (v_utc_dow + 6) % 7;
  ELSIF v_utc_hour >= 24 THEN
    v_utc_hour := v_utc_hour - 24;
    v_utc_dow  := (v_utc_dow + 1) % 7;
  END IF;

  v_schedule := format('0 %s * * %s', v_utc_hour, v_utc_dow);

  SELECT setting_value INTO v_secret
  FROM public.cron_settings WHERE setting_key = 'cron_secret'
  ORDER BY created_at DESC LIMIT 1;

  v_command := format($f$
    SELECT net.http_post(
      url := 'https://gupglbmayvwwxwkunotk.supabase.co/functions/v1/send-weekly-lunch-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', %L
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    ) AS request_id;
  $f$, v_secret);

  PERFORM cron.schedule('weekly-lunch-reminder-scheduled', v_schedule, v_command);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_reschedule_weekly_reminder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND
     OLD.reminder_enabled IS NOT DISTINCT FROM NEW.reminder_enabled AND
     OLD.reminder_day     IS NOT DISTINCT FROM NEW.reminder_day AND
     OLD.reminder_hour    IS NOT DISTINCT FROM NEW.reminder_hour
  THEN
    RETURN NEW;
  END IF;
  PERFORM public.reschedule_weekly_reminder();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS company_settings_reminder_reschedule ON public.company_settings;
CREATE TRIGGER company_settings_reminder_reschedule
AFTER INSERT OR UPDATE ON public.company_settings
FOR EACH ROW EXECUTE FUNCTION public.trg_reschedule_weekly_reminder();

-- Initial scheduling based on current settings
SELECT public.reschedule_weekly_reminder();

-- =====================================================================
-- 3. RECONCILE ROOM BOOKINGS: working hours only, every 30 min
-- UTC 5–17 covers CPH 7–18 in both CET and CEST.
-- =====================================================================

DO $$
DECLARE
  jid bigint;
BEGIN
  FOR jid IN
    SELECT jobid FROM cron.job
    WHERE jobname IN ('reconcile-room-bookings-15min', 'reconcile-room-bookings-workhours')
  LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'reconcile-room-bookings-workhours',
  '*/30 5-17 * * 1-5',
  $cron$
    SELECT net.http_post(
      url := 'https://gupglbmayvwwxwkunotk.supabase.co/functions/v1/reconcile-room-bookings',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT setting_value FROM public.cron_settings WHERE setting_key = 'cron_secret')
      ),
      body := '{}'::jsonb
    );
  $cron$
);
