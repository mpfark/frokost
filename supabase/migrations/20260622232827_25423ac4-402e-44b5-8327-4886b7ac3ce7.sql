
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.reschedule_weekly_reminder() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_reschedule_weekly_reminder() FROM PUBLIC, anon, authenticated;
