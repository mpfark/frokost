-- Fix duplicate audit log entries caused by two triggers on public.lunch_signups
-- Keep the newer trigger (log_signup_changes) and drop the older one (trigger_log_signup_change)

BEGIN;

DROP TRIGGER IF EXISTS trigger_log_signup_change ON public.lunch_signups;

-- Ensure the intended trigger exists (idempotent)
DROP TRIGGER IF EXISTS log_signup_changes ON public.lunch_signups;
CREATE TRIGGER log_signup_changes
AFTER INSERT OR UPDATE OR DELETE ON public.lunch_signups
FOR EACH ROW EXECUTE FUNCTION public.log_signup_change();

-- Prevent real duplicate signups (double-click / retries)
CREATE UNIQUE INDEX IF NOT EXISTS lunch_signups_user_id_lunch_date_uniq
ON public.lunch_signups (user_id, lunch_date);

COMMIT;